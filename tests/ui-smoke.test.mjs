/**
 * Critical UI assertions so `npm test` includes Stream B without editing package.json.
 * Full suite: `node --test tests/ui/*.test.mjs` (request C to add that glob).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderConversation } from '../src/ui/conversation/view.js';
import { renderShareControls } from '../src/ui/brief/share-controls.js';
import { renderBriefPanel } from '../src/ui/staff/brief-panel.js';
import { renderPreferenceList } from '../src/ui/preferences/preference-list.js';
import { renderCapabilityCopy } from '../src/ui/capability/capability-copy.js';
import { renderActionResult } from '../src/ui/states/action-result.js';
import { actionPresentation, filterAllowedActions, photoPreviewPermitted } from '../src/ui/policy.js';
import { composeTurn } from '../src/ui/conversation/composer.js';
import { validateContract } from '../src/contracts/validate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = join(ROOT, 'fixtures/contracts');
const readJson = (rel) => JSON.parse(readFileSync(join(FIX, rel), 'utf8'));
const HASH = '7ee86b47bd1b75f21655e30bd2a2770b8a9f4bea8ce1e50af7982f0a80b0d980';

const output = readJson('valid/chat-turn-output.json');
const context = readJson('valid/trusted-context.json');
const allowed = readJson('valid/allowed-action.json');
const brief = readJson('valid/barber-brief.json');
const pref = readJson('valid/preference.json');
const health = readJson('valid/health-state.json');
const stale = readJson('failures/stale-action.json').instance;

test('smoke: design/reference hash unchanged', () => {
  const hex = createHash('sha256')
    .update(readFileSync(join(ROOT, 'design/reference/rakan-guest-memory.dc.html')))
    .digest('hex');
  assert.equal(hex, HASH);
});

test('smoke: no success before ActionResult.done', () => {
  const idle = renderConversation({ context, output, allowedActions: [allowed] });
  assert.equal(idle.meta.success, false);
  const staleView = renderActionResult({ actionResult: stale });
  assert.equal(staleView.meta.showSuccess, false);
  assert.equal(actionPresentation({ outcome: 'done' }).showSuccess, true);
  assert.equal(actionPresentation({ outcome: 'pending' }).showSuccess, false);
});

test('smoke: photo optional; preview blocked on default fixture context', () => {
  assert.equal(photoPreviewPermitted(context), false);
  const view = renderConversation({ context, output, allowedActions: [allowed] });
  assert.equal(view.meta.photoOptional, true);
  assert.equal(view.meta.photoPreviewShown, false);
});

test('smoke: share-text ≠ share-photo', () => {
  const controls = renderShareControls({
    allowedActions: [
      { ...allowed, action_id: 'act_syn_share_text', kind: 'share_brief_text', url: null },
      { ...allowed, action_id: 'act_syn_share_photo', kind: 'share_photo_ref', url: null },
    ],
  });
  assert.equal(controls.meta.bundled, false);
  assert.equal(controls.meta.hasText, true);
  assert.equal(controls.meta.hasPhoto, true);
});

test('smoke: invented action kinds are not rendered', () => {
  const kept = filterAllowedActions([
    allowed,
    { action_id: 'act_x', kind: 'simulate_booking' },
  ]);
  assert.deepEqual(kept.map((a) => a.kind), ['open_official_booking']);
});

test('smoke: M2 not mounted; booking never confirmed', () => {
  const cap = renderCapabilityCopy({ context, health });
  assert.equal(cap.meta.m2Mounted, false);
  assert.equal(cap.meta.bookingConfirmed, false);
  const panel = renderBriefPanel({ brief, receipt: null });
  assert.equal(panel.meta.success, false);
  assert.equal(panel.meta.booking, false);
});

test('smoke: executed_result is not displayed as M1 truth', () => {
  const list = renderPreferenceList({
    preferences: [pref, { ...pref, preference_id: 'prf_syn_exec', provenance: 'executed_result' }],
  });
  assert.equal(list.meta.displayedExecuted, false);
});

test('smoke: ChatTurnInput from composer validates', () => {
  const input = composeTurn({
    sessionId: 'ses_syn_customer_a',
    text: 'أبي قصة عملية بدون صورة',
    turnId: '3d1c6e2a-4b7f-4c11-9a20-0c8d1e2f3a4b',
  });
  assert.equal(validateContract('ChatTurnInput', input).ok, true);
});

test('smoke: share buttons are executable and a booking action with a URL is a real link', () => {
  const share = renderShareControls({ allowedActions: [{ ...allowed, action_id: 'act_syn_share_text', kind: 'share_brief_text', url: null, requires_receipt_kind: 'staff_sharing_text' }] });
  assert.match(share.html, /data-executable="true"/);
  const view = renderConversation({ context, output, allowedActions: [{ ...allowed, action_id: 'act_syn_book', kind: 'open_official_booking', url: 'https://theweekendhairstyling.com/book' }] });
  assert.match(view.html, /<a [^>]*href="https:\/\/theweekendhairstyling\.com\/book"[^>]*rel="noopener noreferrer"/);
});
