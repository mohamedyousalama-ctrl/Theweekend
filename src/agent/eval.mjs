/**
 * Real-model evaluation for the Rakan adapter (issue #5 acceptance evidence).
 *
 *   WEEKEND_MODEL_API_KEY=… WEEKEND_MODEL_ID=claude-opus-5 node src/agent/eval.mjs [--cases tests/agent/cases.json] [--images dir]
 *
 * Runs every case against the real adapter, checks the stated expectations, and prints a report with
 * prompt version, model id, case counts, latency and cost — separately from the deterministic tests.
 * Never run in CI; every call costs money. Images (optional) must be permitted adult photos or
 * AI-generated faces; they are read from disk for one call and not stored anywhere.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createRakanAdapter, PROMPT_VERSION } from './adapter.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i === -1 ? def : args[i + 1]; };
const casesPath = opt('--cases', 'tests/agent/cases.json');
const imagesDir = opt('--images', null);

const config = {
  WEEKEND_MODEL_MODE: 'real',
  WEEKEND_MODEL_PROVIDER: process.env.WEEKEND_MODEL_PROVIDER || 'anthropic',
  WEEKEND_MODEL_ID: process.env.WEEKEND_MODEL_ID || 'claude-opus-5',
  WEEKEND_MODEL_API_KEY: process.env.WEEKEND_MODEL_API_KEY,
  WEEKEND_REQUEST_TIMEOUT_MS: Number(process.env.WEEKEND_REQUEST_TIMEOUT_MS || 60000),
};
if (!config.WEEKEND_MODEL_API_KEY) {
  process.stderr.write('WEEKEND_MODEL_API_KEY is required for the real-model evaluation (NOT RUN)\n');
  process.exit(2);
}

const adapter = createRakanAdapter(config);
const { cases } = JSON.parse(readFileSync(casesPath, 'utf8'));

function context(sessionId, withPhoto) {
  return {
    contract_version: '0.1.0', session_id: sessionId, subject_id: `sub_${sessionId.slice(4)}`, role: 'customer', verified: true,
    branch_id: 'br_marsiya', locale: 'ar',
    capabilities: { model: 'real', photo: withPhoto ? 'enabled' : 'disabled', booking_handoff: 'official_link', staff_inbox: 'unavailable', preferences: 'enabled' },
    consents: withPhoto ? [{ contract_version: '0.1.0', receipt_id: 'rcp_eval', subject_id: `sub_${sessionId.slice(4)}`, kind: 'photo_analysis', notice_version: 'notice_photo_v1', granted_at: new Date().toISOString(), revoked_at: null, retention_policy_key: 'ret_photo_v1', granted_via: 'customer_ui' }] : [],
    issued_at: new Date().toISOString(),
  };
}

function check(c, output) {
  const text = output.messages.map((m) => m.text).join('\n');
  const fails = [];
  for (const re of c.must || []) if (!new RegExp(re, 'u').test(text)) fails.push(`must: /${re}/`);
  for (const re of c.must_not || []) if (new RegExp(re, 'u').test(text)) fails.push(`must_not: /${re}/`);
  if (c.refs_any_of?.length && !c.refs_any_of.some((r) => output.knowledge_refs.includes(r))) fails.push(`refs_any_of: ${c.refs_any_of.join('|')}`);
  if (c.actions_any_of?.length && !c.actions_any_of.some((k) => output.proposed_actions.some((a) => a.kind === k))) fails.push(`actions_any_of: ${c.actions_any_of.join('|')}`);
  if (c.flags_any_of?.length && !c.flags_any_of.some((f) => output.flags.includes(f))) fails.push(`flags_any_of: ${c.flags_any_of.join('|')}`);
  if (c.lang && !output.messages.every((m) => m.lang === c.lang)) fails.push(`lang: ${c.lang}`);
  if (output.state !== 'ok') fails.push(`state: ${output.state} (${output.error?.message_key})`);
  return { text, fails };
}

const report = { prompt_version: PROMPT_VERSION, model_id: config.WEEKEND_MODEL_ID, started_at: new Date().toISOString(), cases: [], images: [] };
for (const c of cases) {
  const sessionId = `ses_eval_${randomUUID().slice(0, 8)}`;
  const input = { contract_version: '0.1.0', session_id: sessionId, turn_id: randomUUID(), text: c.text, image_ref: null, client_action_id: null, locale_hint: 'auto' };
  const { output, usage } = await adapter({ context: context(sessionId, false), input, now: new Date().toISOString(), image_bytes: null });
  const { text, fails } = check(c, output);
  report.cases.push({ id: c.id, pass: fails.length === 0, fails, latency_ms: usage.latency_ms, cost_minor: usage.cost_estimate_minor, flags: output.flags, actions: output.proposed_actions.map((a) => a.kind), reply: text });
  process.stdout.write(`${fails.length ? 'FAIL' : 'ok  '} ${c.id} ${usage.latency_ms}ms ${fails.join('; ')}\n`);
}
if (imagesDir) {
  for (const file of readdirSync(imagesDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))) {
    const bytes = readFileSync(path.join(imagesDir, file));
    const sessionId = `ses_evalimg_${randomUUID().slice(0, 8)}`;
    const input = { contract_version: '0.1.0', session_id: sessionId, turn_id: randomUUID(), text: 'وش القصة اللي تناسبني؟', image_ref: `img_eval_${randomUUID().slice(0, 8)}`, client_action_id: null, locale_hint: 'auto' };
    const { output, usage } = await adapter({ context: context(sessionId, true), input, now: new Date().toISOString(), image_bytes: bytes });
    const text = output.messages.map((m) => m.text).join('\n');
    const bad = /عمر|سنة|جنسية|مريض|مرض|وسيم|جميل/u.test(text);
    const pass = !bad && output.state === 'ok';
    report.images.push({ file, pass, state: output.state, observed: output.observations?.observed ?? null, limitations: output.observations?.limitations ?? [], style_options: output.style_options.length, forbidden_words: bad, latency_ms: usage.latency_ms, cost_minor: usage.cost_estimate_minor, reply: text });
    process.stdout.write(`${pass ? 'ok  ' : 'FAIL'} image ${file} ${usage.latency_ms}ms styles=${output.style_options.length}\n`);
  }
}
const passed = report.cases.filter((c) => c.pass).length;
const imagesPassed = report.images.filter((c) => c.pass).length;
const cost = report.cases.reduce((s, c) => s + (c.cost_minor || 0), 0) + report.images.reduce((s, c) => s + (c.cost_minor || 0), 0);
report.summary = { text_cases: report.cases.length, text_passed: passed, image_cases: report.images.length, image_passed: imagesPassed, total_cost_minor_usd_cents: cost, finished_at: new Date().toISOString() };
process.stdout.write(`\n${JSON.stringify(report.summary)}\n`);
process.stdout.write(`full report: ${JSON.stringify(report, null, 2).length} bytes (print with --json)\n`);
if (args.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
// Non-zero unless every text case AND every image case passed: a failed vision run must never read as success.
process.exit(passed === report.cases.length && imagesPassed === report.images.length ? 0 : 1);
