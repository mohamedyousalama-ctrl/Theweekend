/**
 * Stream A — Rakan model adapter (issue #5).
 *
 * Interface expected by src/server/app.mjs:
 *   adapter({ context, input, now, image_bytes }) → Promise<{ output: ChatTurnOutput, usage: ModelUsageRecord }>
 *
 * Real inference goes through the official Anthropic SDK with a structured JSON output. Everything the
 * model returns is validated against the shared contract before it reaches the server; merchant facts
 * must be grounded in enabled knowledge records or the turn fails closed.
 *
 * Privacy: image bytes are used for one request and never stored here; conversation memory is
 * in-process, bounded and expires (HISTORY_TTL_MS); no customer text is logged.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateContract } from '../contracts/validate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

export const PROMPT_VERSION = 'rakan.system.v0.3';
export const DEFAULT_PROMPT_PATH = path.join(ROOT, 'prompts', 'rakan.system.md');
export const DEFAULT_KNOWLEDGE_PATH = path.join(ROOT, 'knowledge', 'marsiya.v1.json');

const HISTORY_TTL_MS = 2 * 60 * 60 * 1000;
const HISTORY_MAX_MESSAGES = 20;
const MAX_TOKENS = 4096;

// USD per million tokens (Claude API list prices, 2026-06); cache read ≈ 0.1×, cache write ≈ 1.25× input.
const PRICES_USD_PER_MTOK = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

export const ACTION_KINDS = [
  'open_official_booking',
  'request_pending_booking',
  'share_brief_text',
  'share_photo_ref',
  'save_preference',
  'delete_preference',
  'talk_to_staff',
  'decline',
  'continue_without_photo',
];

export const FLAG_TOKENS = new Set([
  'refusal_medical',
  'subject_not_customer',
  'photo_declined_subject',
  'injection_suspected',
  'handoff_requested',
  'no_offer_after_decline',
  'unknown_fact',
  'complaint',
  'english',
]);

const NOT_INFERRED = ['identity', 'age', 'ethnicity', 'health', 'attractiveness', 'gender'];

/** JSON schema handed to the model as output_config.format (kept to the constrained-decoding subset). */
export const MODEL_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'observations', 'style_options', 'proposed_actions', 'knowledge_refs', 'brief_draft', 'flags'],
  properties: {
    reply: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'lang'],
        properties: { text: { type: 'string' }, lang: { type: 'string', enum: ['ar', 'en'] } },
      },
    },
    observations: {
      type: 'object',
      additionalProperties: false,
      required: ['present', 'hair_length', 'hair_texture', 'beard', 'top_density_visible', 'face_visible', 'limitations', 'confidence'],
      properties: {
        present: { type: 'boolean' },
        hair_length: { type: 'string', enum: ['short', 'medium', 'long', 'uncertain'] },
        hair_texture: { type: 'string', enum: ['straight', 'wavy', 'curly', 'coily', 'uncertain'] },
        beard: { type: 'string', enum: ['none', 'stubble', 'short', 'full', 'uncertain'] },
        top_density_visible: { type: 'string', enum: ['full', 'thinning_visible', 'uncertain'] },
        face_visible: { type: 'string', enum: ['full', 'partial', 'covered'] },
        limitations: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
    },
    style_options: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name_ar', 'name_en', 'why_ar', 'upkeep_ar', 'feasible_in_person'],
        properties: {
          name_ar: { type: 'string' },
          name_en: { type: 'string' },
          why_ar: { type: 'string' },
          upkeep_ar: { type: 'string' },
          feasible_in_person: { type: 'string', enum: ['yes', 'unknown'] },
        },
      },
    },
    proposed_actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'label_ar', 'label_en', 'payload'],
        properties: {
          kind: { type: 'string', enum: ACTION_KINDS },
          label_ar: { type: 'string' },
          label_en: { type: 'string' },
          payload: {
            type: 'object',
            additionalProperties: false,
            required: ['preference_kind', 'value_text'],
            properties: {
              preference_kind: { type: 'string', enum: ['style', 'barber', 'branch', 'do_not', 'note', 'none'] },
              value_text: { type: 'string' },
            },
          },
        },
      },
    },
    knowledge_refs: { type: 'array', items: { type: 'string' } },
    brief_draft: {
      type: 'object',
      additionalProperties: false,
      required: ['present', 'barber_preference', 'requested_look_ar', 'do_not'],
      properties: {
        present: { type: 'boolean' },
        barber_preference: { type: 'string' },
        requested_look_ar: { type: 'string' },
        do_not: { type: 'array', items: { type: 'string' } },
      },
    },
    flags: { type: 'array', items: { type: 'string' } },
  },
};

export function loadKnowledge(file = DEFAULT_KNOWLEDGE_PATH) {
  const pack = JSON.parse(readFileSync(file, 'utf8'));
  const enabled = pack.records.filter((r) => r.enabled === true && (r.status === 'merchant_approved' || r.status === 'verified_public'));
  const byId = new Map(enabled.map((r) => [r.knowledge_id, r]));
  return { pack, enabled, byId };
}

export function loadPrompt(file = DEFAULT_PROMPT_PATH) {
  const text = readFileSync(file, 'utf8');
  const marker = text.indexOf('\n---\n');
  return marker === -1 ? text : text.slice(marker + 5).trim();
}

export function knowledgeText(enabled) {
  const lines = enabled.map((r) => `${r.knowledge_id} | ${r.kind} | ${r.status} | ${r.text_ar}`);
  return `# Knowledge records (the only merchant facts you may state; cite ids in knowledge_refs)\n${lines.join('\n')}`;
}

export function sniffImageMime(bytes) {
  if (!bytes || bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.slice(0, 4).toString('ascii') === 'RIFF' && bytes.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (bytes.slice(0, 6).toString('ascii') === 'GIF87a' || bytes.slice(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  return null;
}

export function estimateCostMinor(modelId, usage) {
  const price = PRICES_USD_PER_MTOK[modelId];
  if (!price || !usage) return null;
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const usd = (input * price.input + output * price.output + cacheRead * price.input * 0.1 + cacheWrite * price.input * 1.25) / 1_000_000;
  return Math.max(0, Math.round(usd * 100));
}

function riyadhClock(nowIso) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Riyadh', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(nowIso));
  } catch {
    return nowIso;
  }
}

export function dynamicContext(context, now, hasImage) {
  const caps = context.capabilities;
  const consents = (context.consents || []).filter((c) => !c.revoked_at).map((c) => c.kind);
  const allowed = ACTION_KINDS.filter((k) => actionAllowed(k, caps, hasImage));
  return [
    '# Current session (trusted, from the server)',
    `now_riyadh: ${riyadhClock(now)}`,
    `customer_locale: ${context.locale}`,
    `role: ${context.role}`,
    `photo_capability: ${caps.photo}; photo_in_this_turn: ${hasImage ? 'yes' : 'no'}; active_permissions: ${consents.join(',') || 'none'}`,
    `booking_handoff: ${caps.booking_handoff}; staff_inbox: ${caps.staff_inbox}; preferences: ${caps.preferences}`,
    `action_kinds_allowed_now: ${allowed.join(',')}`,
  ].join('\n');
}

export function actionAllowed(kind, caps, hasImage) {
  switch (kind) {
    case 'open_official_booking': return caps.booking_handoff === 'official_link';
    case 'request_pending_booking': return caps.booking_handoff === 'pending_request';
    case 'share_brief_text':
    case 'talk_to_staff': return caps.staff_inbox === 'enabled';
    case 'share_photo_ref': return caps.staff_inbox === 'enabled' && caps.photo === 'enabled' && hasImage;
    case 'save_preference':
    case 'delete_preference': return caps.preferences === 'enabled';
    case 'continue_without_photo': return caps.photo === 'enabled';
    default: return true;
  }
}

// No \b after Arabic: JS word boundaries are ASCII-only, so use a Unicode lookahead instead.
const PRICE_RE = /(\d+(?:[.,]\d+)?)\s*(?:ريال|ر\.س|SAR|riyals?|SR)(?![\p{L}\p{N}])/giu;

/** Every amount quoted in the reply must appear in a cited knowledge record. Returns the unmatched amounts. */
export function ungroundedPrices(messages, refs, byId) {
  const cited = refs.map((id) => byId.get(id)).filter(Boolean);
  const haystack = cited.map((r) => `${r.text_ar}\n${r.text_en}`).join('\n');
  const missing = [];
  for (const m of messages) {
    for (const match of m.text.matchAll(PRICE_RE)) {
      const amount = match[1].replace(',', '.');
      const integer = amount.split('.')[0];
      if (!new RegExp(`(^|[^\\d])${integer}([^\\d]|$)`).test(haystack)) missing.push(amount);
    }
  }
  return missing;
}

function sanitizeToken(s) {
  const t = String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+/, '').slice(0, 64);
  return /^[a-z][a-z0-9_]{0,63}$/.test(t) ? t : null;
}

function clipText(s, max) {
  const t = String(s ?? '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function usageRecord({ sessionId, turnId, provider, modelId, promptVersion, usage, latencyMs, outcome, now }) {
  return {
    contract_version: '0.1.0',
    usage_id: `use_${randomUUID()}`,
    session_id: sessionId,
    turn_id: turnId,
    provider,
    model_id: modelId,
    prompt_version: promptVersion,
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    latency_ms: Math.max(0, Math.round(latencyMs || 0)),
    cost_estimate_minor: usage ? estimateCostMinor(modelId, usage) : null,
    outcome,
    created_at: now,
  };
}

function errorOutput({ turnId, usageId, code, messageKey, retryable, text, lang = 'ar', state = 'unavailable', flags = [] }) {
  return {
    contract_version: '0.1.0',
    turn_id: turnId,
    state,
    messages: [{ text, lang }],
    observations: null,
    style_options: [],
    proposed_actions: [],
    knowledge_refs: [],
    brief_draft: null,
    usage_ref: usageId,
    flags,
    error: { contract_version: '0.1.0', code, message_key: messageKey, retryable, details: { capability: 'model' } },
  };
}

/** Maps the model's JSON to a ChatTurnOutput, dropping anything the contract or the capabilities forbid. */
export function mapModelOutput(raw, { context, input, usageId, hasImage, byId, now }) {
  const notes = [];
  const messages = (Array.isArray(raw.reply) ? raw.reply : [])
    .filter((m) => m && typeof m.text === 'string' && m.text.trim())
    .slice(0, 3)
    .map((m) => ({ text: clipText(m.text, 2000), lang: m.lang === 'en' ? 'en' : 'ar' }));

  let observations = null;
  if (hasImage && raw.observations && raw.observations.present === true) {
    const o = raw.observations;
    observations = {
      contract_version: '0.1.0',
      image_ref: input.image_ref,
      observed: {
        hair_length: o.hair_length,
        hair_texture: o.hair_texture,
        beard: o.beard,
        top_density_visible: o.top_density_visible,
        face_visible: o.face_visible,
      },
      limitations: (Array.isArray(o.limitations) ? o.limitations : []).map(sanitizeToken).filter(Boolean).slice(0, 12),
      confidence: o.confidence,
      not_inferred: NOT_INFERRED,
      retention: 'stored_with_receipt',
    };
  } else if (!hasImage && raw.observations && raw.observations.present === true) {
    notes.push('observations_without_image_dropped');
  }

  const styleOptions = (Array.isArray(raw.style_options) ? raw.style_options : []).slice(0, 2).map((s, i) => ({
    option_id: `opt_${i + 1}_${randomUUID().slice(0, 8)}`,
    name_ar: clipText(s.name_ar, 80) || 'قصة',
    name_en: clipText(s.name_en, 80) || 'style',
    why_ar: clipText(s.why_ar, 300) || '—',
    upkeep_ar: clipText(s.upkeep_ar, 300) || '—',
    feasible_in_person: s.feasible_in_person === 'yes' ? true : 'unknown',
    reference_kind: 'none',
  }));

  const caps = context.capabilities;
  const proposedActions = [];
  for (const a of Array.isArray(raw.proposed_actions) ? raw.proposed_actions : []) {
    if (!a || !ACTION_KINDS.includes(a.kind) || !actionAllowed(a.kind, caps, hasImage)) continue;
    const payload = {};
    if (a.kind === 'save_preference' && a.payload) {
      if (['style', 'barber', 'branch', 'do_not', 'note'].includes(a.payload.preference_kind)) payload.preference_kind = a.payload.preference_kind;
      const v = clipText(a.payload.value_text, 300);
      if (v) payload.value_text = v;
      if (!payload.value_text) continue;
    }
    proposedActions.push({
      kind: a.kind,
      label_ar: clipText(a.label_ar, 80) || a.kind,
      label_en: clipText(a.label_en, 80) || a.kind,
      payload,
    });
    if (proposedActions.length === 3) break;
  }

  const refs = [];
  for (const id of Array.isArray(raw.knowledge_refs) ? raw.knowledge_refs : []) {
    if (typeof id === 'string' && byId.has(id) && !refs.includes(id)) refs.push(id);
    else notes.push('unknown_ref_dropped');
  }

  let briefDraft = null;
  if (raw.brief_draft && raw.brief_draft.present === true && typeof raw.brief_draft.requested_look_ar === 'string' && raw.brief_draft.requested_look_ar.trim()) {
    const b = raw.brief_draft;
    briefDraft = {
      contract_version: '0.1.0',
      brief_id: `brf_draft_${randomUUID()}`,
      subject_id: context.subject_id,
      branch_id: context.branch_id,
      barber_preference: b.barber_preference ? clipText(b.barber_preference, 80) : null,
      requested_look: { option_id: null, text_ar: clipText(b.requested_look_ar, 300) },
      do_not: (Array.isArray(b.do_not) ? b.do_not : []).map((d) => clipText(d, 80)).filter(Boolean).slice(0, 5),
      reference: { kind: 'none', image_ref: null, receipt_id: null },
      provenance: { approved_by_subject_at: null, version: 1 },
      status: 'draft',
    };
    if (!briefDraft.branch_id) briefDraft = null;
  }

  const flags = [];
  for (const f of Array.isArray(raw.flags) ? raw.flags : []) {
    const t = sanitizeToken(f);
    if (t && FLAG_TOKENS.has(t) && !flags.includes(t)) flags.push(t);
  }
  for (const n of notes) if (!flags.includes(n)) flags.push(n);

  return {
    contract_version: '0.1.0',
    turn_id: input.turn_id,
    state: 'ok',
    messages: messages.length ? messages : [{ text: 'وش أقدر أساعدك فيه؟', lang: 'ar' }],
    observations,
    style_options: styleOptions,
    proposed_actions: proposedActions,
    knowledge_refs: refs,
    brief_draft: briefDraft,
    usage_ref: usageId,
    flags,
    error: null,
  };
}

function extractJson(response) {
  const block = (response.content || []).find((b) => b.type === 'text');
  if (!block) return null;
  try {
    return JSON.parse(block.text);
  } catch {
    return null;
  }
}

export function createRakanAdapter(config, deps = {}) {
  if (config.WEEKEND_MODEL_MODE !== 'real') {
    throw new Error('createRakanAdapter requires WEEKEND_MODEL_MODE=real');
  }
  if (config.WEEKEND_MODEL_PROVIDER !== 'anthropic') {
    throw new Error(`WEEKEND_MODEL_PROVIDER must be "anthropic" for the Rakan adapter (got "${config.WEEKEND_MODEL_PROVIDER}")`);
  }
  const modelId = config.WEEKEND_MODEL_ID;
  const knowledge = deps.knowledge || loadKnowledge(deps.knowledgePath);
  const promptText = deps.prompt || loadPrompt(deps.promptPath);
  const kText = knowledgeText(knowledge.enabled);
  const clock = deps.clock || (() => Date.now());
  const client = deps.client || new Anthropic({
    apiKey: config.WEEKEND_MODEL_API_KEY,
    timeout: Math.max(2000, (config.WEEKEND_REQUEST_TIMEOUT_MS || 30000) - 500),
    maxRetries: 1,
  });
  const histories = new Map();

  function history(sessionId) {
    const nowMs = clock();
    for (const [id, h] of histories) if (nowMs - h.updated > HISTORY_TTL_MS) histories.delete(id);
    if (!histories.has(sessionId)) histories.set(sessionId, { updated: nowMs, messages: [] });
    const h = histories.get(sessionId);
    h.updated = nowMs;
    return h;
  }

  function remember(sessionId, userText, assistantText) {
    const h = history(sessionId);
    h.messages.push({ role: 'user', content: userText }, { role: 'assistant', content: assistantText });
    if (h.messages.length > HISTORY_MAX_MESSAGES) h.messages.splice(0, h.messages.length - HISTORY_MAX_MESSAGES);
  }

  async function callModel({ context, input, now, imageBytes, correction }) {
    const hasImage = Boolean(imageBytes);
    const content = [];
    if (hasImage) {
      const mime = sniffImageMime(imageBytes);
      if (mime) content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: Buffer.from(imageBytes).toString('base64') } });
    }
    content.push({ type: 'text', text: input.text && input.text.trim() ? input.text : '(الصورة مرفقة بدون نص)' });
    const system = [
      { type: 'text', text: promptText, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: kText, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: dynamicContext(context, now, hasImage) },
    ];
    if (correction) system.push({ type: 'text', text: correction });
    const messages = [...history(context.session_id).messages, { role: 'user', content }];
    return client.messages.create({
      model: modelId,
      max_tokens: MAX_TOKENS,
      system,
      messages,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: MODEL_OUTPUT_SCHEMA } },
    });
  }

  return async function adapter({ context, input, now, image_bytes }) {
    const started = clock();
    const base = { sessionId: context.session_id, turnId: input.turn_id, provider: 'anthropic', modelId, promptVersion: PROMPT_VERSION, now };

    if (context.capabilities.model !== 'real') {
      const usage = usageRecord({ ...base, provider: 'none', modelId: 'unavailable', promptVersion: 'none', usage: null, latencyMs: 0, outcome: 'error' });
      return { usage, output: errorOutput({ turnId: input.turn_id, usageId: usage.usage_id, code: 'MODEL_UNAVAILABLE', messageKey: 'model.unavailable', retryable: true, text: 'المحادثة بالنموذج غير متاحة في هذا الإعداد.' }) };
    }

    const hasImage = Boolean(image_bytes);
    if (hasImage && !(context.consents || []).some((c) => c.kind === 'photo_analysis' && !c.revoked_at)) {
      const usage = usageRecord({ ...base, usage: null, latencyMs: 0, outcome: 'error' });
      return { usage, output: errorOutput({ turnId: input.turn_id, usageId: usage.usage_id, code: 'CONSENT_REQUIRED', messageKey: 'photo.consent_required', retryable: false, text: 'أحتاج موافقتك على تحليل الصورة أول، أو نكمل بالنص.', state: 'error' }) };
    }

    let response;
    let raw;
    let correction = null;
    let lastUsage = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await callModel({ context, input, now, imageBytes: image_bytes, correction });
      } catch (err) {
        const latency = clock() - started;
        const retryable = !(err instanceof Anthropic.BadRequestError || err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError);
        const usage = usageRecord({ ...base, usage: null, latencyMs: latency, outcome: 'error' });
        return { usage, output: errorOutput({ turnId: input.turn_id, usageId: usage.usage_id, code: 'MODEL_UNAVAILABLE', messageKey: retryable ? 'model.temporarily_unavailable' : 'model.misconfigured', retryable, text: 'راكان مو متاح هاللحظة. جرّب بعد شوي أو استخدم صفحة الحجز.' }) };
      }
      lastUsage = response.usage;
      if (response.stop_reason === 'refusal') {
        const usage = usageRecord({ ...base, usage: lastUsage, latencyMs: clock() - started, outcome: 'ok' });
        return { usage, output: { ...errorOutput({ turnId: input.turn_id, usageId: usage.usage_id, code: 'VALIDATION_ERROR', messageKey: 'agent.refused', retryable: false, text: 'ما أقدر أساعد بهذا الطلب. لو تبي، نكمل بشي ثاني.', state: 'ok' }), error: null, flags: ['refusal_model'] } };
      }
      raw = extractJson(response);
      if (!raw) {
        correction = 'Your previous reply was not valid JSON for the schema. Return only the JSON object.';
        continue;
      }
      const draft = mapModelOutput(raw, { context, input, usageId: 'use_pending', hasImage, byId: knowledge.byId, now });
      const missing = ungroundedPrices(draft.messages, draft.knowledge_refs, knowledge.byId);
      if (missing.length && attempt === 0) {
        correction = `You quoted amounts (${missing.join(', ')}) that are not in any knowledge record you cited. Quote only prices that appear in the records and list their ids in knowledge_refs; otherwise say the price is on the booking page.`;
        raw = null;
        continue;
      }
      if (missing.length) {
        const usage = usageRecord({ ...base, usage: lastUsage, latencyMs: clock() - started, outcome: 'error' });
        return { usage, output: errorOutput({ turnId: input.turn_id, usageId: usage.usage_id, code: 'VALIDATION_ERROR', messageKey: 'agent.ungrounded_price', retryable: true, text: 'خلني أتأكد من السعر قبل أقوله لك. تقدر تشوف الأسعار كاملة في صفحة الحجز.', state: 'error', flags: ['unknown_fact'] }) };
      }
      break;
    }

    const usage = usageRecord({ ...base, usage: lastUsage, latencyMs: clock() - started, outcome: raw ? 'ok' : 'error' });
    if (!raw) {
      return { usage, output: errorOutput({ turnId: input.turn_id, usageId: usage.usage_id, code: 'VALIDATION_ERROR', messageKey: 'agent.invalid_output', retryable: true, text: 'صار خلل بسيط عندي. أعد رسالتك لو سمحت.', state: 'error' }) };
    }
    const output = mapModelOutput(raw, { context, input, usageId: usage.usage_id, hasImage, byId: knowledge.byId, now });
    const check = validateContract('ChatTurnOutput', output);
    if (!check.ok) {
      usage.outcome = 'error';
      return { usage, output: errorOutput({ turnId: input.turn_id, usageId: usage.usage_id, code: 'VALIDATION_ERROR', messageKey: 'agent.contract_invalid', retryable: true, text: 'صار خلل بسيط عندي. أعد رسالتك لو سمحت.', state: 'error' }) };
    }
    remember(context.session_id, input.text || '(صورة)', output.messages.map((m) => m.text).join('\n'));
    return { usage, output };
  };
}
