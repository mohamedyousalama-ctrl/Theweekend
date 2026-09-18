#!/usr/bin/env node
/**
 * Issue #8 owner-review walkthrough against a live Weekend URL.
 *
 * Required:
 *   WEEKEND_WALKTHROUGH_URL  HTTPS origin only (no path). Never committed.
 * Optional (session steps skipped if either is missing):
 *   WEEKEND_OWNER_PASSCODE
 *   WEEKEND_STAFF_PASSCODE
 * Optional (default off — a wrong passcode still counts toward five failures / 15 min):
 *   WEEKEND_WALKTHROUGH_NEGATIVE=1  run the staff wrong-passcode probe after authenticated logins
 *
 * Prints JSON with ids, counts, hashes and truncated reply previews.
 * Never prints passcodes, tokens, Authorization headers or image bytes.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = '0.1.0';
const TURN_TIMEOUT_MS = 90_000;
const SECRET_KEYS = new Set([
  'token',
  'passcode',
  'authorization',
  'api_key',
  'WEEKEND_MODEL_API_KEY',
  'WEEKEND_OWNER_PASSCODE',
  'WEEKEND_STAFF_PASSCODE',
  'WEEKEND_SESSION_SECRET',
]);

export function isNegativeProbeEnabled(env = process.env) {
  return env.WEEKEND_WALKTHROUGH_NEGATIVE === '1';
}

export const NEGATIVE_PROBE_DEFAULT_SKIP =
  'wrong-passcode probe (WEEKEND_WALKTHROUGH_NEGATIVE unset; default off to avoid self-lockout)';

export const TEXT_ONLY_TURN_BLOCKER =
  'step 4-5: text-only style turn was not HTTP 200 with output.state=ok';

export function textOnlyTurnBlocker(style) {
  if (style?.status === 200 && style?.json?.output?.state === 'ok') return null;
  return TEXT_ONLY_TURN_BLOCKER;
}

export const HANDOFF_NOT_RUN =
  'staff handoff (no talk_to_staff on greet/price/style turns)';

export const HANDOFF_SKIP_BLOCKER =
  'staff handoff was not exercised: no talk_to_staff on greet/price/style turns';

export function handoffSkip(talk) {
  if (talk) return null;
  return {
    not_run: HANDOFF_NOT_RUN,
    blocker: HANDOFF_SKIP_BLOCKER,
  };
}

export function walkthroughExitCode(report) {
  return Array.isArray(report?.blockers) && report.blockers.length > 0 ? 1 : 0;
}

function failUsage(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function originFromEnv() {
  const raw = process.env.WEEKEND_WALKTHROUGH_URL;
  if (!raw || !raw.trim()) {
    failUsage('WEEKEND_WALKTHROUGH_URL is required (HTTPS origin; do not commit the value).');
  }
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    failUsage('WEEKEND_WALKTHROUGH_URL must be an absolute HTTPS URL.');
  }
  if (url.protocol !== 'https:') failUsage('WEEKEND_WALKTHROUGH_URL must be https.');
  if (url.username || url.password || url.port) {
    failUsage('WEEKEND_WALKTHROUGH_URL must not include userinfo or a port.');
  }
  return url.origin;
}

function clip(text, max = 160) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = SECRET_KEYS.has(key) ? '[redacted]' : redact(item);
    }
    return out;
  }
  return value;
}

function summarizeOutput(output) {
  if (!output) return null;
  const messages = Array.isArray(output.messages) ? output.messages : [];
  return {
    state: output.state,
    langs: messages.map((m) => m.lang),
    text_preview: clip(messages[0]?.text),
    knowledge_refs: output.knowledge_refs || [],
    style_option_count: Array.isArray(output.style_options) ? output.style_options.length : 0,
    proposed_action_kinds: (output.proposed_actions || []).map((a) => a.kind),
    flags: output.flags || [],
    has_observations: output.observations !== null && output.observations !== undefined,
    error_code: output.error?.code || null,
  };
}

function actionKinds(actions) {
  return (actions || []).map((a) => a.kind);
}

function findAction(actions, kind) {
  return (actions || []).find((a) => a.kind === kind) || null;
}

async function http(base, path, { method = 'GET', token, body, headers, timeoutMs = 30_000 } = {}) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined && !(body instanceof Uint8Array) ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body instanceof Uint8Array
        ? body
        : body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const raw = await res.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = { parse_error: true, bytes: raw.length };
  }
  return {
    status: res.status,
    ms: Date.now() - started,
    json,
  };
}

function turnBody(sessionId, text, extra = {}) {
  return {
    contract_version: CONTRACT,
    session_id: sessionId,
    turn_id: randomUUID(),
    text,
    image_ref: extra.image_ref ?? null,
    client_action_id: extra.client_action_id ?? null,
    locale_hint: extra.locale_hint || 'ar',
  };
}

async function sha256Of(base, path) {
  const res = await fetch(base + path, { method: 'GET' });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
    dir_rtl: path === '/' ? /dir="rtl"/.test(buf.toString('utf8')) : null,
    lang_ar: path === '/' ? /lang="ar"/.test(buf.toString('utf8')) : null,
  };
}

function localFileHash(rel) {
  const bytes = readFileSync(join(ROOT, rel));
  return {
    path: rel,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

async function main() {
  const base = originFromEnv();
  const ownerPass = process.env.WEEKEND_OWNER_PASSCODE || '';
  const staffPass = process.env.WEEKEND_STAFF_PASSCODE || '';
  const report = {
    contract_version: CONTRACT,
    started_at: new Date().toISOString(),
    issue: 8,
    host_kind: 'https_origin_from_env',
    authenticated_steps: Boolean(ownerPass && staffPass),
    steps: {},
    blockers: [],
    not_run: [
      'vision eval (no permitted-face directory)',
      'Khalid phone walkthrough',
      'native-speaker scoring',
      'qualified-barber scoring',
      'G01-G13',
    ],
  };

  const health = await http(base, '/health');
  report.steps.health = {
    status: health.status,
    ms: health.ms,
    body: redact(health.json),
  };
  if (health.status !== 200 || health.json?.store !== 'ok') {
    report.blockers.push('GET /health is not HTTP 200 with store=ok');
  }

  report.steps.static = {
    index: await sha256Of(base, '/'),
    customer_js: await sha256Of(base, '/customer.js'),
    app_js: await sha256Of(base, '/app.js'),
    tokens_css: await sha256Of(base, '/styles/tokens.css'),
    handoff_list_js: await sha256Of(base, '/staff/handoff-list.js'),
    photo_notes_js: await sha256Of(base, '/staff/photo-notes.js'),
    checkout_customer_js: localFileHash('src/ui/customer.js'),
    checkout_app_js: localFileHash('src/ui/app.js'),
  };
  const liveCustomer = report.steps.static.customer_js;
  const localCustomer = report.steps.static.checkout_customer_js;
  report.steps.static.customer_js_ok = liveCustomer.status === 200;
  report.steps.static.customer_js_matches_checkout = liveCustomer.sha256 === localCustomer.sha256;
  report.steps.static.staff_followup_ui_present = report.steps.static.handoff_list_js.status === 200;
  if (!report.steps.static.customer_js_ok) {
    report.blockers.push('live /customer.js is not HTTP 200 (CSP customer bootstrap)');
  } else if (!report.steps.static.customer_js_matches_checkout) {
    report.blockers.push('live /customer.js sha256 does not match this checkout src/ui/customer.js (auto-deploy of main not verified)');
  }
  if (report.steps.static.index.dir_rtl !== true || report.steps.static.index.lang_ar !== true) {
    report.blockers.push('live index.html is not lang=ar dir=rtl');
  }

  const unauthPaths = [
    '/staff/briefs',
    '/staff/handoffs',
    '/context',
    '/preferences',
    '/booking/handoff',
  ];
  report.steps.unauthenticated = {};
  for (const path of unauthPaths) {
    const res = await http(base, path);
    report.steps.unauthenticated[path] = {
      status: res.status,
      code: res.json?.code,
      message_key: res.json?.message_key,
    };
    if (res.status !== 401 || res.json?.code !== 'UNAUTHORIZED') {
      report.blockers.push(`${path} without a session was not 401 UNAUTHORIZED`);
    }
  }

  const forged = await http(base, '/actions/act_forged', {
    method: 'POST',
    token: 'forged',
    body: {},
  });
  report.steps.forged_action = {
    status: forged.status,
    code: forged.json?.code,
    message_key: forged.json?.message_key,
  };
  if (forged.status !== 401) report.blockers.push('forged bearer was not 401');

  const unauthUpload = await http(base, '/uploads', {
    method: 'POST',
    headers: { 'content-type': 'image/jpeg' },
    body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  });
  report.steps.unauthenticated_upload = {
    status: unauthUpload.status,
    code: unauthUpload.json?.code,
    message_key: unauthUpload.json?.message_key,
  };
  if (unauthUpload.status !== 401) report.blockers.push('unauthenticated upload was not 401');

  if (!report.authenticated_steps) {
    report.not_run.push('authenticated session turns (WEEKEND_OWNER_PASSCODE / WEEKEND_STAFF_PASSCODE unset)');
    report.not_run.push(
      isNegativeProbeEnabled()
        ? 'wrong-passcode probe (WEEKEND_WALKTHROUGH_NEGATIVE=1 but authenticated logins were skipped)'
        : NEGATIVE_PROBE_DEFAULT_SKIP,
    );
    report.finished_at = new Date().toISOString();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(walkthroughExitCode(report));
  }

  const customer = await http(base, '/session', {
    method: 'POST',
    body: { role: 'customer', passcode: ownerPass },
  });
  const staff = await http(base, '/session', {
    method: 'POST',
    body: { role: 'staff', passcode: staffPass },
  });
  const other = await http(base, '/session', {
    method: 'POST',
    body: { role: 'customer', passcode: ownerPass },
  });
  report.steps.sessions = {
    customer: { status: customer.status, role: customer.json?.context?.role, capabilities: customer.json?.context?.capabilities },
    staff: { status: staff.status, role: staff.json?.context?.role },
    other_customer: { status: other.status, role: other.json?.context?.role },
  };
  if (customer.status !== 200 || staff.status !== 200 || other.status !== 200) {
    report.blockers.push('owner or staff passcode was rejected (values not logged)');
    report.finished_at = new Date().toISOString();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(1);
  }

  const customerToken = customer.json.token;
  const staffToken = staff.json.token;
  const otherToken = other.json.token;
  const sessionId = customer.json.context.session_id;

  if (isNegativeProbeEnabled()) {
    const badSession = await http(base, '/session', {
      method: 'POST',
      body: { role: 'staff', passcode: 'nope' },
    });
    report.steps.wrong_passcode = {
      status: badSession.status,
      code: badSession.json?.code,
      message_key: badSession.json?.message_key,
      retryable: badSession.json?.retryable,
    };
    if (badSession.status !== 401) report.blockers.push('wrong staff passcode was not 401');
  } else {
    report.not_run.push(NEGATIVE_PROBE_DEFAULT_SKIP);
  }

  const greet = await http(base, '/turns', {
    method: 'POST',
    token: customerToken,
    timeoutMs: TURN_TIMEOUT_MS,
    body: turnBody(sessionId, 'سلام'),
  });
  report.steps.step2_free_speech = {
    status: greet.status,
    ms: greet.ms,
    output: summarizeOutput(greet.json?.output),
    allowed_action_kinds: actionKinds(greet.json?.allowed_actions),
  };
  if (greet.status !== 200 || greet.json?.output?.state !== 'ok') {
    report.blockers.push('step 2: first real-model turn was not state=ok');
  }

  const price = await http(base, '/turns', {
    method: 'POST',
    token: customerToken,
    timeoutMs: TURN_TIMEOUT_MS,
    body: turnBody(sessionId, 'كم سعر الحلاقة في مرسية؟'),
  });
  report.steps.step3_branch_service = {
    status: price.status,
    ms: price.ms,
    output: summarizeOutput(price.json?.output),
    allowed_action_kinds: actionKinds(price.json?.allowed_actions),
  };
  if (price.status !== 200 || price.json?.output?.state !== 'ok') {
    report.blockers.push('step 3: branch service question was not state=ok');
  }

  const style = await http(base, '/turns', {
    method: 'POST',
    token: customerToken,
    timeoutMs: TURN_TIMEOUT_MS,
    body: turnBody(sessionId, 'أبغى فيد. بدون منتجات وبدون صورة.'),
  });
  const styleActions = style.json?.allowed_actions || [];
  report.steps.step4_and_5_text_only = {
    status: style.status,
    ms: style.ms,
    output: summarizeOutput(style.json?.output),
    allowed_action_kinds: actionKinds(styleActions),
    photo_path: 'text_only_no_upload',
  };
  const styleBlocker = textOnlyTurnBlocker(style);
  if (styleBlocker) report.blockers.push(styleBlocker);

  const continueWithout = findAction(styleActions, 'continue_without_photo');
  const decline = findAction(styleActions, 'decline');
  const chosen = continueWithout || decline;
  if (chosen) {
    const executed = await http(base, `/actions/${chosen.action_id}`, {
      method: 'POST',
      token: customerToken,
      body: {},
    });
    report.steps.step4_and_5_text_only.executed = {
      kind: chosen.kind,
      status: executed.status,
      outcome: executed.json?.outcome,
      message_key: executed.json?.message_key,
    };
  }

  const photoBeforeConsent = await http(base, '/uploads', {
    method: 'POST',
    token: customerToken,
    headers: { 'content-type': 'image/jpeg' },
    body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  });
  report.steps.photo_before_consent = {
    status: photoBeforeConsent.status,
    code: photoBeforeConsent.json?.code,
    message_key: photoBeforeConsent.json?.message_key,
  };
  if (photoBeforeConsent.status !== 403 || photoBeforeConsent.json?.code !== 'CONSENT_REQUIRED') {
    report.blockers.push('upload before photo_analysis consent was not 403 CONSENT_REQUIRED');
  }

  const prefConsent = await http(base, '/consents', {
    method: 'POST',
    token: customerToken,
    body: { kind: 'text_preferences', granted_via: 'customer_ui' },
  });
  const saved = await http(base, '/preferences', {
    method: 'POST',
    token: customerToken,
    body: { kind: 'style', value_text: 'فيد قصير — تفضيل نصي للمراجعة' },
  });
  const listed = await http(base, '/preferences', { token: customerToken });
  const otherListed = await http(base, '/preferences', { token: otherToken });
  const ownPref = (listed.json?.preferences || []).find((p) => p.kind === 'style');
  const leaked = (otherListed.json?.preferences || []).some((p) => p.preference_id === ownPref?.preference_id);
  report.steps.step7_preference = {
    consent_status: prefConsent.status,
    save_status: saved.status,
    own_count: (listed.json?.preferences || []).length,
    own_kind: ownPref?.kind || null,
    own_provenance: ownPref?.provenance || null,
    other_count: (otherListed.json?.preferences || []).length,
    other_saw_foreign_id: leaked,
    distinguished_from_completed_haircut: ownPref?.provenance === 'approved_preference',
  };
  if (saved.status !== 200 || !ownPref || leaked) {
    report.blockers.push('step 7: preference save/isolation failed');
  }

  const brief = await http(base, '/briefs', {
    method: 'POST',
    token: customerToken,
    body: { text_ar: 'موجز نصي للمراجعة: فيد قصير، بدون منتجات.', do_not: ['منتجات'] },
  });
  const shareConsent = await http(base, '/consents', {
    method: 'POST',
    token: customerToken,
    body: { kind: 'staff_sharing_text', granted_via: 'customer_ui' },
  });
  const shareActions = await http(base, `/briefs/${brief.json?.brief_id}/share-actions`, {
    method: 'POST',
    token: customerToken,
    body: {},
  });
  const textShare = findAction(shareActions.json?.allowed_actions, 'share_brief_text');
  const shared = textShare
    ? await http(base, `/actions/${textShare.action_id}`, { method: 'POST', token: customerToken, body: {} })
    : { status: 0, json: { outcome: 'missing_share_action' } };
  const staffInbox = await http(base, '/staff/briefs', { token: staffToken });
  const otherStaff = await http(base, '/staff/briefs', { token: otherToken });
  const visible = (staffInbox.json?.briefs || []).some((b) => b.brief_id === brief.json?.brief_id);
  report.steps.step6_brief = {
    create_status: brief.status,
    brief_id_present: Boolean(brief.json?.brief_id),
    requested_look_preview: clip(brief.json?.requested_look?.text_ar),
    share_consent_status: shareConsent.status,
    share_outcome: shared.json?.outcome,
    share_message_key: shared.json?.message_key,
    staff_sees_brief: visible,
    other_customer_staff_status: otherStaff.status,
    other_customer_staff_code: otherStaff.json?.code,
  };
  if (!visible || otherStaff.status !== 401) {
    report.blockers.push('step 6: staff did not see the shared brief, or a customer reached the staff inbox');
  }

  const booking = await http(base, '/booking/handoff', { token: customerToken });
  const clicked = booking.json?.action_id
    ? await http(base, `/actions/${booking.json.action_id}`, { method: 'POST', token: customerToken, body: {} })
    : { status: 0, json: {} };
  report.steps.step8_booking = {
    issue_status: booking.status,
    kind: booking.json?.kind,
    outcome: clicked.json?.outcome,
    message_key: clicked.json?.message_key,
    url_host: (() => {
      try {
        return booking.json?.url ? new URL(booking.json.url).host : null;
      } catch {
        return 'invalid_url';
      }
    })(),
  };
  if (clicked.json?.outcome !== 'external_handoff') {
    report.blockers.push('step 8: booking click was not external_handoff');
  }

  const talk = findAction(styleActions, 'talk_to_staff') || findAction(price.json?.allowed_actions, 'talk_to_staff')
    || findAction(greet.json?.allowed_actions, 'talk_to_staff');
  const skippedHandoff = handoffSkip(talk);
  if (skippedHandoff) {
    report.not_run.push(skippedHandoff.not_run);
    report.blockers.push(skippedHandoff.blocker);
  } else {
    const queued = await http(base, `/actions/${talk.action_id}`, {
      method: 'POST',
      token: customerToken,
      body: {},
    });
    const staffHandoffs = await http(base, '/staff/handoffs', { token: staffToken });
    const customerHandoffs = await http(base, '/staff/handoffs', { token: customerToken });
    report.steps.staff_handoff = {
      outcome: queued.json?.outcome,
      message_key: queued.json?.message_key,
      staff_list_status: staffHandoffs.status,
      staff_count: (staffHandoffs.json?.handoffs || []).length,
      customer_list_status: customerHandoffs.status,
      customer_list_code: customerHandoffs.json?.code,
    };
    if (customerHandoffs.status !== 401) {
      report.blockers.push('customer GET /staff/handoffs was not 401');
    }
  }

  report.finished_at = new Date().toISOString();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(walkthroughExitCode(report));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`${err?.stack || String(err)}\n`);
    process.exit(1);
  });
}
