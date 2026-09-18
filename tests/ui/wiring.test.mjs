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
  const files = ['src/server/app.mjs', 'src/server/http.mjs'];
  const keys = new Set();
  const quoted = /'([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)'/g;
  const skipSuffix = new Set(['html', 'css', 'js', 'mjs', 'json', 'md']);
  for (const rel of files) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    let m;
    while ((m = quoted.exec(src))) {
      const key = m[1];
      const suffix = key.slice(key.indexOf('.') + 1);
      if (skipSuffix.has(suffix)) continue;
      keys.add(key);
    }
    if (src.includes('action.${row.kind}')) {
      keys.add('action.decline');
      keys.add('action.continue_without_photo');
    }
  }
  assert.ok(keys.has('session.expired'));
  assert.ok(keys.has('action.decline'));
  assert.ok(keys.has('http.internal'));
  for (const key of [...keys].sort()) {
    assert.notEqual(messageFromKey(key, 'ar'), key, `${key} has Arabic copy`);
    assert.notEqual(messageFromKey(key, 'en'), key, `${key} has English copy`);
  }
});

test('http.invalid_json English matches the Arabic meaning', () => {
  assert.equal(messageFromKey('http.invalid_json', 'en'), 'The request is not valid.');
  assert.equal(messageFromKey('http.invalid_json', 'ar'), 'الطلب غير صالح.');
});
