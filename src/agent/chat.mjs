/**
 * Terminal chat with the real Rakan adapter — for the first try before the web UI exists.
 *
 *   WEEKEND_MODEL_API_KEY=… node src/agent/chat.mjs            (model id from WEEKEND_MODEL_ID, default claude-opus-5)
 *   … --photo ./permitted-face.jpg                               (one permitted adult photo for the next turn)
 *
 * Costs money per turn. Nothing is stored; the session lives only in this process.
 */
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRakanAdapter, PROMPT_VERSION } from './adapter.mjs';

const args = process.argv.slice(2);
const photoIndex = args.indexOf('--photo');
const photoPath = photoIndex === -1 ? null : args[photoIndex + 1];

const config = {
  WEEKEND_MODEL_MODE: 'real',
  WEEKEND_MODEL_PROVIDER: process.env.WEEKEND_MODEL_PROVIDER || 'anthropic',
  WEEKEND_MODEL_ID: process.env.WEEKEND_MODEL_ID || 'claude-opus-5',
  WEEKEND_MODEL_API_KEY: process.env.WEEKEND_MODEL_API_KEY,
  WEEKEND_REQUEST_TIMEOUT_MS: Number(process.env.WEEKEND_REQUEST_TIMEOUT_MS || 60000),
};
if (!config.WEEKEND_MODEL_API_KEY) {
  process.stderr.write('WEEKEND_MODEL_API_KEY is required (never commit it).\n');
  process.exit(2);
}
const adapter = createRakanAdapter(config);
const sessionId = `ses_chat_${randomUUID().slice(0, 8)}`;
const subjectId = `sub_chat_${randomUUID().slice(0, 8)}`;
let pendingPhoto = photoPath ? readFileSync(photoPath) : null;

function context() {
  const now = new Date().toISOString();
  return {
    contract_version: '0.1.0', session_id: sessionId, subject_id: subjectId, role: 'customer', verified: true, branch_id: 'br_marsiya', locale: 'ar',
    capabilities: { model: 'real', photo: pendingPhoto ? 'enabled' : 'disabled', booking_handoff: 'official_link', staff_inbox: 'unavailable', preferences: 'enabled' },
    consents: pendingPhoto ? [{ contract_version: '0.1.0', receipt_id: 'rcp_chat', subject_id: subjectId, kind: 'photo_analysis', notice_version: 'notice_photo_v1', granted_at: now, revoked_at: null, retention_policy_key: 'ret_photo_v1', granted_via: 'customer_ui' }] : [],
    issued_at: now,
  };
}

process.stdout.write(`Rakan terminal chat — ${config.WEEKEND_MODEL_ID}, ${PROMPT_VERSION}. اكتب رسالتك (exit للخروج)\n`);
const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'أنت> ' });
rl.prompt();
rl.on('line', async (line) => {
  const text = line.trim();
  if (!text || text === 'exit') { if (text === 'exit') rl.close(); else rl.prompt(); return; }
  const input = { contract_version: '0.1.0', session_id: sessionId, turn_id: randomUUID(), text, image_ref: pendingPhoto ? `img_chat_${randomUUID().slice(0, 8)}` : null, client_action_id: null, locale_hint: 'auto' };
  const { output, usage } = await adapter({ context: context(), input, now: new Date().toISOString(), image_bytes: pendingPhoto });
  pendingPhoto = null;
  for (const m of output.messages) process.stdout.write(`راكان> ${m.text}\n`);
  if (output.state !== 'ok') process.stdout.write(`   [state=${output.state} ${output.error?.code} ${output.error?.message_key}]\n`);
  if (output.observations) process.stdout.write(`   [observations] ${JSON.stringify(output.observations.observed)} limits=${output.observations.limitations.join(',')}\n`);
  for (const s of output.style_options) process.stdout.write(`   [style] ${s.name_ar} — ${s.why_ar} (${s.upkeep_ar})\n`);
  if (output.proposed_actions.length) process.stdout.write(`   [actions] ${output.proposed_actions.map((a) => `${a.kind}:${a.label_ar}`).join(' | ')}\n`);
  if (output.brief_draft) process.stdout.write(`   [brief draft] ${output.brief_draft.requested_look.text_ar} / حلاق: ${output.brief_draft.barber_preference ?? '—'}\n`);
  process.stdout.write(`   [refs ${output.knowledge_refs.join(',') || '—'}] [flags ${output.flags.join(',') || '—'}] [${usage.latency_ms} ms, ${usage.input_tokens}+${usage.output_tokens} tok, ≈${usage.cost_estimate_minor ?? '?'}¢]\n`);
  rl.prompt();
});
rl.on('close', () => process.exit(0));
