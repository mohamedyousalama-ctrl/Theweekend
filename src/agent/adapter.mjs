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

export const PROMPT_VERSION = 'rakan.system.v0.5';
export const DEFAULT_PROMPT_PATH = path.join(ROOT, 'prompts', 'rakan.system.md');
export const DEFAULT_KNOWLEDGE_PATH = path.join(ROOT, 'knowledge', 'marsiya.v1.json');

const HISTORY_TTL_MS = 2 * 60 * 60 * 1000;
const HISTORY_MAX_MESSAGES = 20;
const HISTORY_MAX_SESSIONS = 500;
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

/**
 * Cost in whole US cents, computed in integer nano-dollars (no floating-point money) and rounded UP, so the
 * daily ledger never under-counts a call. Cache reads cost 10% and cache writes 125% of the input price.
 */
export function estimateCostMinor(modelId, usage) {
  const price = PRICES_USD_PER_MTOK[modelId];
  if (!price || !usage) return null;
  const tokens = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const input = tokens(usage.input_tokens);
  const output = tokens(usage.output_tokens);
  const cacheRead = tokens(usage.cache_read_input_tokens);
  const cacheWrite = tokens(usage.cache_creation_input_tokens);
  const nanoIn = Math.round(price.input * 1000); // nano-USD per token == USD per MTok × 1000
  const nanoOut = Math.round(price.output * 1000);
  const nano20 = 20 * input * nanoIn + 20 * output * nanoOut + 2 * cacheRead * nanoIn + 25 * cacheWrite * nanoIn;
  return Math.ceil(nano20 / (20 * 10_000_000)); // one cent = 10^7 nano-USD
}

/**
 * Upper bound of one turn's cost in cents, for the server to reserve BEFORE the paid call: two attempts, each with a
 * generous 40k-token input (prompt + knowledge + history), the full MAX_TOKENS output and a 20k-token cache write.
 * The server replaces it by the real cost after the call. null for an unknown model id.
 */
export function maxCostMinorPerTurn(modelId) {
  const perAttempt = estimateCostMinor(modelId, { input_tokens: 40_000, output_tokens: MAX_TOKENS, cache_creation_input_tokens: 20_000 });
  return perAttempt == null ? null : perAttempt * 2;
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

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits → ASCII; Arabic thousands (٬) and decimal (٫) separators → , and . */
export function normalizeDigits(text) {
  return String(text)
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/\u066C/g, ',')
    .replace(/\u066B/g, '.');
}

// No \b after Arabic: JS word boundaries are ASCII-only, so use Unicode lookarounds instead.
const CURRENCY = '(?:ريال|ريالاً|ريالات|ر\\.س|SAR|riyals?|SR)';
const PRICE_RE = new RegExp(`(?<![\\p{N}.,])(\\d[\\d,]*(?:\\.\\d+)?)\\s*${CURRENCY}(?![\\p{L}\\p{N}])`, 'giu');
const PRICE_FIRST_RE = new RegExp(`(?<![\\p{L}\\p{N}])${CURRENCY}\\s*(\\d[\\d,]*(?:\\.\\d+)?)`, 'giu');

/** "2,499" → "2499" (thousands), "2,5" → "2.5" (decimal comma), "30.50" → "30.5", "007" → "7". */
export function canonicalAmount(raw) {
  let v = String(raw);
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) v = v.replace(/,/g, '');
  else v = v.replace(',', '.');
  if (v.includes('.')) v = v.replace(/0+$/, '').replace(/\.$/, '');
  return v.replace(/^0+(?=\d)/, '');
}

function amountsIn(text) {
  const out = new Set();
  const t = normalizeDigits(text);
  for (const m of t.matchAll(PRICE_RE)) out.add(canonicalAmount(m[1]));
  for (const m of t.matchAll(PRICE_FIRST_RE)) out.add(canonicalAmount(m[1]));
  return out;
}

function citedText(refs, byId) {
  return refs.map((id) => byId.get(id)).filter(Boolean).map((r) => `${r.text_ar}\n${r.text_en}`).join('\n');
}

/**
 * Every amount quoted with a currency marker in the reply must appear, with a currency marker and the same
 * value (35 ≠ 35.5; a 35-minute duration is not 35 riyals), in a cited knowledge record. There is no exemption
 * for an amount the customer wrote: a wrong price is corrected by stating the right one, never by repeating it
 * (a co-occurrence rule would let «أيوه 5 ريال … والدقن 20 ريال» through). Returns the unmatched amounts.
 */
export function ungroundedPrices(messages, refs, byId) {
  const grounded = amountsIn(citedText(refs, byId));
  const missing = [];
  for (const m of messages) for (const a of amountsIn(m.text)) if (!grounded.has(a) && !missing.includes(a)) missing.push(a);
  return missing;
}

// Figures with a unit the shop's catalogue defines: they are merchant facts, so they follow the price rule.
// A figure may be digits or a number word (خمس زيارات, two visits, زيارتين); hours are normalised to minutes.
const NUMBER_WORDS = {
  'واحد': 1, 'واحدة': 1, 'وحدة': 1, 'اثنين': 2, 'اثنتين': 2, 'ثنتين': 2, 'ثلاث': 3, 'ثلاثة': 3, 'ثلاثه': 3, 'أربع': 4, 'اربع': 4, 'أربعة': 4, 'اربعة': 4,
  'خمس': 5, 'خمسة': 5, 'خمسه': 5, 'ست': 6, 'ستة': 6, 'سته': 6, 'سبع': 7, 'سبعة': 7, 'ثمان': 8, 'ثماني': 8, 'ثمانية': 8, 'تسع': 9, 'تسعة': 9, 'عشر': 10, 'عشرة': 10,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
// Digits take no letter boundary: Arabic proclitics and «الـ» glue to a number («و5 دقايق», «الـ30 يوم»), and a hyphen may join the
// unit («35-minute»). A number word may carry one glued proclitic (و ف ب ك ل: «وخمس زيارات»). English «a»/«an» are not counted
// («within a day» is a hedge, not a fact); «an hour» is a phrase below.
const PROCLITIC = '(?:[وفبكل])?';
const NUM = `(?:(?<![\\p{N}.,])(\\d+(?:[.,]\\d+)?)[\\s-]*|(?<![\\p{L}])${PROCLITIC}(${Object.keys(NUMBER_WORDS).join('|')})[\\s-]+)`;
const UNIT_RE = (unit) => new RegExp(`${NUM}(?:${unit})(?![\\p{L}])`, 'giu');
const FACT_UNITS = [
  ['minutes', UNIT_RE('دقيقة|دقيقه|دقايق|دقائق|min(?:ute)?s?'), 1],
  ['minutes', UNIT_RE('ساعة|ساعه|ساعات|hours?|hrs?'), 60],
  ['days', UNIT_RE('يوم|أيام|ايام|days?'), 1],
  ['visits', UNIT_RE('زيارة|زياره|زيارات|visits?'), 1],
  ['percent', new RegExp(`(?<![\\p{N}.,])(\\d+(?:[.,]\\d+)?)\\s*(?:%|٪|بالمئة|بالمية|بالمائة|percent)`, 'giu'), 1],
];
// Duals and fixed phrases carry their own value (longer phrases first: they are blanked before the shorter ones run).
// A bare «ساعة» counts as one hour only after a duration framing word («المدة ساعة», «حوالي ساعة»); «كم ساعة؟», «الساعة 3»
// and «ساعة الافتتاح» are not durations.
const FACT_PHRASES = [
  ['minutes', /(?<![\p{L}])(?:[وفبكل])?(?:ساعة ونص|ساعة ونصف|ساعه ونص|an hour and a half|one and a half hours)(?![\p{L}])/giu, 90],
  ['minutes', /(?<![\p{L}])(?:[وفبكل])?(?:ساعتين|ساعتان|two hours)(?![\p{L}])/giu, 120],
  ['minutes', /(?<![\p{L}])(?:[وفبكل])?(?:ربع ساعة|ربع ساعه|quarter of an hour|quarter-hour)(?![\p{L}])/giu, 15],
  ['minutes', /(?<![\p{L}])(?:[وفبكل])?(?:ثلث ساعة|ثلث ساعه)(?![\p{L}])/giu, 20],
  ['minutes', /(?<![\p{L}])(?:[وفبكل])?(?:نصف ساعة|نص ساعة|نصف ساعه|نص ساعه|half an hour|half-hour|half hour)(?![\p{L}])/giu, 30],
  ['minutes', /(?<![\p{L}])(?:[وفبكل])?(?:ساعة واحدة|ساعة وحدة|ساعه واحدة|ساعه وحدة|an hour|one hour)(?![\p{L}])/giu, 60],
  ['minutes', /(?<=(?:المدة|مدتها|مدته|تاخذ|تأخذ|ياخذ|يأخذ|حوالي|تقريباً|تقريبا|قرابة|لمدة|خلال|نحو)\s+)(?:ساعة|ساعه)(?![\p{L}])/giu, 60],
  ['minutes', /(?<![\p{L}])(?:[وفبكل])?(?:دقيقتين|دقيقتان|two minutes)(?![\p{L}])/giu, 2],
  ['days', /(?<![\p{L}])(?:[وفبكل])?(?:يومين|يومان|two days)(?![\p{L}])/giu, 2],
  ['visits', /(?<![\p{L}])(?:[وفبكل])?(?:زيارتين|زيارتان|two visits)(?![\p{L}])/giu, 2],
];

function numberOf(token) {
  const key = token.toLowerCase();
  if (key in NUMBER_WORDS) return NUMBER_WORDS[key];
  return Number(canonicalAmount(token));
}

function factsIn(text) {
  const out = new Set();
  let t = normalizeDigits(text);
  for (const [kind, re, value] of FACT_PHRASES) {
    if (re.test(t)) out.add(`${kind}:${value}`);
    t = t.replace(re, ' ');
  }
  for (const [kind, re, factor] of FACT_UNITS) {
    for (const m of t.matchAll(re)) {
      const n = numberOf(m[1] ?? m[2]) * factor;
      if (Number.isFinite(n)) out.add(`${kind}:${canonicalAmount(String(n))}`);
    }
  }
  return out;
}

/** Durations, day counts, visit counts and percentages in the reply must come from a cited record — no exemption for the customer's own figures. */
export function ungroundedFacts(messages, refs, byId) {
  const grounded = factsIn(citedText(refs, byId));
  const missing = [];
  for (const m of messages) for (const f of factsIn(m.text)) if (!grounded.has(f) && !missing.includes(f)) missing.push(f);
  return missing;
}

const URL_RE = /https?:\/\/[^\s<>"'()[\]{}«»“”‘’]+/giu;

function urlsIn(text) {
  return [...String(text).matchAll(URL_RE)].map((m) => m[0].replace(/[.,،؛;:!?“”‘’]+$/u, ''));
}

/** All links that appear in the given knowledge records (the only links Rakan may send). */
export function linksIn(records) {
  const out = new Set();
  for (const r of records) for (const u of urlsIn(`${r.text_ar}\n${r.text_en}`)) out.add(u);
  return out;
}

/** Scheme and host are case-insensitive; path and query are not (/BOOK or ?branchid= is a different page). Fragments are dropped. */
function normalizeUrl(u) {
  try {
    const x = new URL(u);
    return `${x.protocol}//${x.host}${x.pathname}${x.search}`;
  } catch {
    return u;
  }
}

/** Every link in the reply must be a record link, exactly, or the same page without its query string (the booking page without ?branchId=). */
export function ungroundedLinks(messages, links) {
  const allowed = [...links].map(normalizeUrl);
  const missing = [];
  for (const m of messages) {
    for (const u of urlsIn(m.text)) {
      const l = normalizeUrl(u);
      if (!allowed.some((a) => a === l || a.startsWith(`${l}?`)) && !missing.includes(u)) missing.push(u);
    }
  }
  return missing;
}

/** The deterministic checks a draft output must pass before it reaches the customer; each problem carries its retry hint. */
export function groundingProblems(draft, knowledge) {
  const problems = [];
  const prices = ungroundedPrices(draft.messages, draft.knowledge_refs, knowledge.byId);
  if (prices.length) {
    problems.push({
      messageKey: 'agent.ungrounded_price',
      correction: `You quoted amounts (${prices.join(', ')}) that are not in any knowledge record you cited. Quote only prices that appear in the records and list their ids in knowledge_refs; otherwise say the price is on the booking page.`,
    });
  }
  const facts = ungroundedFacts(draft.messages, draft.knowledge_refs, knowledge.byId);
  if (facts.length) {
    problems.push({
      messageKey: 'agent.ungrounded_fact',
      correction: `You stated figures (${facts.map((f) => f.replace(':', ' ')).join(', ')}) that are not in any knowledge record you cited. State durations, days, visit counts and percentages only as the cited records give them, or leave them out.`,
    });
  }
  const cited = draft.knowledge_refs.map((id) => knowledge.byId.get(id)).filter(Boolean);
  const links = ungroundedLinks(draft.messages, linksIn(cited));
  if (links.length) {
    problems.push({
      messageKey: 'agent.ungrounded_link',
      correction: `You included links (${links.join(', ')}) that are not in a knowledge record you cited. Send only links that appear in a record and list that record's id in knowledge_refs, or send none.`,
    });
  }
  return problems;
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

/** Language of the customer's last message (script count, not session locale). */
export function customerLang(text) {
  const t = String(text ?? '');
  const ar = (t.match(/\p{Script=Arabic}/gu) || []).length;
  const en = (t.match(/[A-Za-z]/g) || []).length;
  return en > ar ? 'en' : 'ar';
}

const ERROR_COPY = {
  'model.unavailable': {
    ar: 'المحادثة بالنموذج غير متاحة في هذا الإعداد.',
    en: 'The model conversation is not available in this setup.',
  },
  'photo.consent_required': {
    ar: 'أحتاج موافقتك على تحليل الصورة أول، أو نكمل بالنص.',
    en: 'I need your consent to analyse the photo first, or we can continue in text.',
  },
  'model.timeout': {
    ar: 'تأخرت عليك، أعد رسالتك لو سمحت.',
    en: 'That took too long. Please send your message again.',
  },
  'model.temporarily_unavailable': {
    ar: 'راكان مو متاح هاللحظة. جرّب بعد شوي أو استخدم صفحة الحجز.',
    en: 'Rakan is not available right now. Try again in a bit, or use the booking page.',
  },
  'model.misconfigured': {
    ar: 'راكان مو متاح هاللحظة. جرّب بعد شوي أو استخدم صفحة الحجز.',
    en: 'Rakan is not available right now. Try again in a bit, or use the booking page.',
  },
  'agent.refused': {
    ar: 'ما أقدر أساعد بهذا الطلب. لو تبي، نكمل بشي ثاني.',
    en: "I can't help with that request. If you like, we can continue with something else.",
  },
  'agent.ungrounded_price': {
    ar: 'خلني أتأكد من السعر قبل أقوله لك. تقدر تشوف الأسعار كاملة في صفحة الحجز.',
    en: 'Let me check the price before I quote it. You can see the full prices on the booking page.',
  },
  'agent.ungrounded_fact': {
    ar: 'خلني أتأكد من التفاصيل قبل أقولها لك. التفاصيل كاملة في صفحة الحجز.',
    en: 'Let me check the details before I state them. The full details are on the booking page.',
  },
  'agent.ungrounded_link': {
    ar: 'ما عندي رابط مؤكد لهذا. تقدر تكمل من صفحة الحجز الرسمية.',
    en: "I don't have a confirmed link for that. You can continue from the official booking page.",
  },
  'agent.invalid_output': {
    ar: 'صار خلل بسيط عندي. أعد رسالتك لو سمحت.',
    en: 'Something went wrong on my side. Please send your message again.',
  },
  'agent.contract_invalid': {
    ar: 'صار خلل بسيط عندي. أعد رسالتك لو سمحت.',
    en: 'Something went wrong on my side. Please send your message again.',
  },
};

export function errorText(messageKey, lang) {
  const l = lang === 'en' ? 'en' : 'ar';
  const copy = ERROR_COPY[messageKey] || ERROR_COPY['agent.invalid_output'];
  return copy[l];
}

function errorOutput({ turnId, usageId, code, messageKey, retryable, lang = 'ar', state = 'unavailable', flags = [] }) {
  const l = lang === 'en' ? 'en' : 'ar';
  return {
    contract_version: '0.1.0',
    turn_id: turnId,
    state,
    messages: [{ text: errorText(messageKey, l), lang: l }],
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
    if (a.kind === 'delete_preference') continue; // deletion needs a preference id the model never sees; the preference view issues it server-side
    const payload = {};
    if (a.kind === 'save_preference' && a.payload) {
      if (['style', 'barber', 'branch', 'do_not', 'note'].includes(a.payload.preference_kind)) payload.preference_kind = a.payload.preference_kind;
      const v = clipText(a.payload.value_text, 300);
      if (v) payload.value_text = v;
      if (!payload.value_text) continue;
    }
    if (a.kind === 'share_photo_ref') {
      // Bound to the photo of this turn (validated server state), never to an id the model chose.
      if (typeof input.image_ref !== 'string' || !input.image_ref) continue;
      payload.image_ref = input.image_ref;
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
  if (!PRICES_USD_PER_MTOK[modelId]) {
    throw new Error(`WEEKEND_MODEL_ID "${modelId}" has no price entry in PRICES_USD_PER_MTOK; add it so the daily spend cap can be enforced`);
  }
  const knowledge = deps.knowledge || loadKnowledge(deps.knowledgePath);
  const promptText = deps.prompt || loadPrompt(deps.promptPath);
  const kText = knowledgeText(knowledge.enabled);
  const clock = deps.clock || (() => Date.now());
  // One retry, both attempts inside the server's own timeout window so no request outlives the turn.
  const serverTimeout = config.WEEKEND_REQUEST_TIMEOUT_MS || 30000;
  const client = deps.client || new Anthropic({
    apiKey: config.WEEKEND_MODEL_API_KEY,
    timeout: Math.max(2000, Math.floor(serverTimeout / 2) - 250),
    maxRetries: 1,
  });
  const histories = new Map();

  function history(sessionId) {
    const nowMs = clock();
    for (const [id, h] of histories) if (nowMs - h.updated > HISTORY_TTL_MS) histories.delete(id);
    while (histories.size >= HISTORY_MAX_SESSIONS && !histories.has(sessionId)) {
      const oldest = [...histories.entries()].sort((a, b) => a[1].updated - b[1].updated)[0];
      histories.delete(oldest[0]);
    }
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

  async function callModel({ context, input, now, imageBytes, correction, signal }) {
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
    const params = {
      model: modelId,
      max_tokens: MAX_TOKENS,
      system,
      messages,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: MODEL_OUTPUT_SCHEMA } },
    };
    return signal ? client.messages.create(params, { signal }) : client.messages.create(params);
  }

  /**
   * @param signal optional AbortSignal from the server's turn deadline: no retry starts after it fires and a late
   *   completion is never remembered as history. Provider work already done stays in the usage record.
   */
  const turn = async function adapter({ context, input, now, image_bytes, signal }) {
    const started = clock();
    const deadline = started + serverTimeout - 400;
    const lang = customerLang(input.text);
    const base = { sessionId: context.session_id, turnId: input.turn_id, provider: 'anthropic', modelId, promptVersion: PROMPT_VERSION, now };
    const closed = (fields) => errorOutput({ turnId: input.turn_id, lang, ...fields });

    if (context.capabilities.model !== 'real') {
      const usage = usageRecord({ ...base, provider: 'none', modelId: 'unavailable', promptVersion: 'none', usage: null, latencyMs: 0, outcome: 'error' });
      return { usage, output: closed({ usageId: usage.usage_id, code: 'MODEL_UNAVAILABLE', messageKey: 'model.unavailable', retryable: true }) };
    }

    const hasImage = Boolean(image_bytes);
    if (hasImage && !(context.consents || []).some((c) => c.kind === 'photo_analysis' && !c.revoked_at)) {
      const usage = usageRecord({ ...base, usage: null, latencyMs: 0, outcome: 'error' });
      return { usage, output: closed({ usageId: usage.usage_id, code: 'CONSENT_REQUIRED', messageKey: 'photo.consent_required', retryable: false, state: 'error' }) };
    }

    // Every provider attempt is charged, so tokens are summed across attempts (a corrective retry is not free).
    const totals = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    let calls = 0;
    const tally = (u) => {
      calls += 1;
      for (const k of Object.keys(totals)) totals[k] += Number(u?.[k]) || 0;
    };
    const spent = () => (calls ? totals : null);
    const aborted = () => Boolean(signal?.aborted);
    const timedOut = () => ({
      usage: usageRecord({ ...base, usage: spent(), latencyMs: clock() - started, outcome: 'timeout' }),
      output: closed({ usageId: 'use_pending', code: 'MODEL_UNAVAILABLE', messageKey: 'model.timeout', retryable: true }),
    });

    let response;
    let raw;
    let correction = null;
    let grounding = null; // the problem that still stands after the last attempt
    for (let attempt = 0; attempt < 2; attempt += 1) {
      // A retry that cannot finish inside the server's turn window is not started; the customer gets the closed error instead.
      if (attempt > 0 && (aborted() || clock() + 2000 > deadline)) break;
      try {
        response = await callModel({ context, input, now, imageBytes: image_bytes, correction, signal });
      } catch (err) {
        if (aborted()) { const t = timedOut(); t.output.usage_ref = t.usage.usage_id; return t; }
        const latency = clock() - started;
        const retryable = !(err instanceof Anthropic.BadRequestError || err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError || err instanceof Anthropic.NotFoundError);
        const usage = usageRecord({ ...base, usage: spent(), latencyMs: latency, outcome: 'error' });
        return { usage, output: closed({ usageId: usage.usage_id, code: 'MODEL_UNAVAILABLE', messageKey: retryable ? 'model.temporarily_unavailable' : 'model.misconfigured', retryable }) };
      }
      tally(response.usage);
      if (response.stop_reason === 'refusal') {
        const usage = usageRecord({ ...base, usage: spent(), latencyMs: clock() - started, outcome: 'ok' });
        return { usage, output: { ...closed({ usageId: usage.usage_id, code: 'VALIDATION_ERROR', messageKey: 'agent.refused', retryable: false, state: 'ok' }), error: null, flags: ['refusal_model'] } };
      }
      raw = extractJson(response);
      if (!raw) {
        grounding = null;
        correction = 'Your previous reply was not valid JSON for the schema. Return only the JSON object.';
        continue;
      }
      const draft = mapModelOutput(raw, { context, input, usageId: 'use_pending', hasImage, byId: knowledge.byId, now });
      const problems = groundingProblems(draft, knowledge);
      if (!problems.length) break;
      raw = null;
      grounding = problems[0];
      correction = problems.map((p) => p.correction).join(' ');
    }

    if (aborted()) {
      const t = timedOut();
      t.output.usage_ref = t.usage.usage_id;
      return t;
    }
    const usage = usageRecord({ ...base, usage: spent(), latencyMs: clock() - started, outcome: raw ? 'ok' : 'error' });
    if (!raw && grounding) {
      return { usage, output: closed({ usageId: usage.usage_id, code: 'VALIDATION_ERROR', messageKey: grounding.messageKey, retryable: true, state: 'error', flags: ['unknown_fact'] }) };
    }
    if (!raw) {
      return { usage, output: closed({ usageId: usage.usage_id, code: 'VALIDATION_ERROR', messageKey: 'agent.invalid_output', retryable: true, state: 'error' }) };
    }
    const output = mapModelOutput(raw, { context, input, usageId: usage.usage_id, hasImage, byId: knowledge.byId, now });
    const check = validateContract('ChatTurnOutput', output);
    if (!check.ok) {
      usage.outcome = 'error';
      return { usage, output: closed({ usageId: usage.usage_id, code: 'VALIDATION_ERROR', messageKey: 'agent.contract_invalid', retryable: true, state: 'error' }) };
    }
    remember(context.session_id, input.text || '(صورة)', output.messages.map((m) => m.text).join('\n'));
    return { usage, output };
  };
  // Declared for the server's pre-call reservation (src/server/index.mjs reads adapter.costCeilingMinor).
  turn.costCeilingMinor = maxCostMinorPerTurn(modelId);
  return turn;
}
