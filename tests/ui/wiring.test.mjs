import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJson } from './helpers.mjs';
import { renderShareControls } from '../../src/ui/brief/share-controls.js';
import { renderPreferenceEditor } from '../../src/ui/preferences/preference-editor.js';
import { renderActionRow } from '../../src/ui/conversation/action-row.js';
import { messageFromKey } from '../../src/ui/copy.js';

const allowed = readJson('valid/allowed-action.json');
const action = (kind, extra = {}) => ({ ...allowed, action_id: `act_syn_${kind}`, kind, label_ar: kind, label_en: kind, url: null, ...extra });

test('share and delete buttons are executable, so app.js binds them; the save button stays a form submit', () => {
  const controls = renderShareControls({ allowedActions: [action('share_brief_text', { requires_receipt_kind: 'staff_sharing_text' }), action('share_photo_ref', { requires_receipt_kind: 'staff_sharing_photo' })] });
  assert.equal((controls.html.match(/data-executable="true"/g) || []).length, 2);
  const off = renderShareControls({ allowedActions: [action('share_brief_text')], disabled: true });
  assert.match(off.html, /data-executable="false"/);
  const editor = renderPreferenceEditor({ allowedActions: [action('save_preference'), action('delete_preference')] });
  assert.match(editor.html, /data-action-kind="delete_preference"[^>]*data-executable="true"/);
  assert.doesNotMatch(editor.html, /data-action-kind="save_preference"[^>]*data-executable/);
  const src = readFileSync(join(ROOT, 'src/ui/app.js'), 'utf8');
  assert.ok(src.includes('[data-action-id][data-executable="true"]'), 'app.js binds executable action elements');
});

test('an action with the server URL is a real link that opens on the click; without a URL it is a button', () => {
  const booking = action('open_official_booking', { url: 'https://theweekendhairstyling.com/book?branchId=3a1ca9a9-12bd-36bb-7b56-f4b957522fbe' });
  const row = renderActionRow({ allowedActions: [booking] });
  assert.match(row.html, /<a [^>]*href="https:\/\/theweekendhairstyling\.com\/book\?branchId=3a1ca9a9-12bd-36bb-7b56-f4b957522fbe"/);
  assert.match(row.html, /target="_blank"/);
  assert.match(row.html, /rel="noopener noreferrer"/);
  assert.match(row.html, /data-opens-itself="true"/);
  assert.match(row.html, /data-executable="true"/);
  assert.equal(row.meta.bookingConfirmed, false);
  const plain = renderActionRow({ allowedActions: [action('talk_to_staff')] });
  assert.match(plain.html, /<button [^>]*data-action-kind="talk_to_staff"/);
  assert.doesNotMatch(plain.html, /<a /);
  const frozen = renderActionRow({ allowedActions: [booking], reconnectInvalidates: true });
  assert.doesNotMatch(frozen.html, /<a /);
  assert.match(frozen.html, /data-executable="false"/);
  const http = renderActionRow({ allowedActions: [action('open_official_booking', { url: 'http://example.invalid/book' })] });
  assert.doesNotMatch(http.html, /<a /, 'only https links become anchors');
  const src = readFileSync(join(ROOT, 'src/ui/app.js'), 'utf8');
  assert.ok(src.includes("result.outcome === 'external_handoff' && !opensItself"), 'no window.open after the awaited POST for a link');
  const both = renderActionRow({ allowedActions: [action('talk_to_staff'), action('continue_without_photo')] });
  assert.doesNotMatch(both.html, /data-action-kind="continue_without_photo"/, 'the optional-image control owns continue_without_photo');
  assert.deepEqual(both.meta.kinds, ['talk_to_staff']);
});

test('every message key the server or the adapter can emit has copy in both languages', () => {
  for (const key of [
    'booking.external_handoff', 'action.stale', 'action.expired', 'action.done', 'action.save_preference', 'action.delete_preference',
    'action.continue_without_photo', 'brief.shared_text', 'brief.shared_photo', 'preference.version_conflict',
    'model.unavailable', 'model.timeout', 'model.budget_exceeded', 'model.session_cap', 'model.temporarily_unavailable', 'model.misconfigured',
    'agent.ungrounded_price', 'agent.ungrounded_fact', 'agent.ungrounded_link', 'agent.invalid_output', 'agent.contract_invalid', 'agent.refused',
    'photo.consent_required', 'preference.consent_required', 'action.consent_required',
    'brief.share_consent', 'brief.photo_consent',
    'handoff.queued', 'handoff.accepted', 'handoff.not_found',
    'store.unavailable', 'upload.rejected', 'input.invalid', 'session.invalid',
  ]) {
    assert.notEqual(messageFromKey(key, 'ar'), key, `${key} has Arabic copy`);
    assert.notEqual(messageFromKey(key, 'en'), key, `${key} has English copy`);
  }
});
