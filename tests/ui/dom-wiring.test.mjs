import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from './helpers.mjs';
import { createRoot } from './dom-shim.mjs';

// The real app, driven through the DOM shim: one click or submit must post exactly one action, and a link must not
// also open a popup.
const windowOpen = [];
globalThis.window = { open: (...args) => windowOpen.push(args) };
const { createRakanUi } = await import('../../src/ui/app.js');

const context = readJson('valid/trusted-context.json');
const output = readJson('valid/chat-turn-output.json');
const allowed = readJson('valid/allowed-action.json');
const brief = readJson('valid/barber-brief.json');
const action = (kind, id, extra = {}) => ({ ...allowed, action_id: id, kind, label_ar: kind, label_en: kind, url: null, ...extra });

function ui(outcome = 'done') {
  const calls = [];
  const fetchImpl = async (path, opts = {}) => {
    calls.push({ path, method: opts.method || 'GET' });
    const body = path.startsWith('/actions/')
      ? { contract_version: '0.1.0', action_id: path.split('/').pop(), outcome, receipt_id: null, message_key: 'action.done' }
      : path === '/preferences' ? { preferences: [] } : {};
    return { ok: true, status: 200, json: async () => body };
  };
  const root = createRoot();
  const app = createRakanUi(root, { fetchImpl });
  app.state.context = context;
  const posts = (id) => calls.filter((c) => c.method === 'POST' && c.path === `/actions/${id}`).length;
  const settle = async () => { for (let i = 0; i < 4; i += 1) await Promise.resolve(); };
  return { app, root, calls, posts, settle };
}

test('the booking link posts its action once and opens no popup', async () => {
  windowOpen.length = 0;
  const { app, root, posts, settle } = ui('external_handoff');
  app.state.surface = 'conversation';
  app.state.output = output;
  app.state.allowedActions = [action('open_official_booking', 'act_syn_link', { url: 'https://theweekendhairstyling.com/book' })];
  app.paint();
  const link = root.querySelector('a[data-action-id="act_syn_link"]');
  assert.ok(link, 'rendered as a link');
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(link.click(), 1, 'one click listener');
  await settle();
  assert.equal(posts('act_syn_link'), 1);
  assert.equal(windowOpen.length, 0, 'the link opens itself; no popup after the awaited POST');
  assert.equal(app.state.error, null);
});

test('share, delete and continue-without-photo buttons post once per click; save posts once per submit', async () => {
  const shared = ui('done');
  shared.app.state.surface = 'approved_brief';
  shared.app.state.brief = { ...brief, status: 'approved' };
  shared.app.state.allowedActions = [
    action('share_brief_text', 'act_syn_share_text', { requires_receipt_kind: 'staff_sharing_text' }),
    action('share_photo_ref', 'act_syn_share_photo', { requires_receipt_kind: 'staff_sharing_photo' }),
  ];
  shared.app.paint();
  for (const id of ['act_syn_share_text', 'act_syn_share_photo']) {
    const btn = shared.root.querySelector(`[data-action-id="${id}"]`);
    assert.ok(btn, `${id} rendered`);
    assert.equal(btn.click(), 1, `${id}: one listener`);
    await shared.settle();
    assert.equal(shared.posts(id), 1, `${id}: one POST`);
  }

  const prefs = ui('done');
  prefs.app.state.surface = 'preferences';
  prefs.app.state.allowedActions = [action('save_preference', 'act_syn_save'), action('delete_preference', 'act_syn_delete')];
  prefs.app.paint();
  const del = prefs.root.querySelector('[data-action-id="act_syn_delete"]');
  assert.equal(del.click(), 1);
  await prefs.settle();
  assert.equal(prefs.posts('act_syn_delete'), 1);
  const form = prefs.root.querySelector('[data-component="preference-editor"]');
  const save = prefs.root.querySelector('[data-action-id="act_syn_save"]');
  assert.equal(save.click(), 0, 'the save button has no click listener of its own');
  assert.equal(form.fire('submit'), 1, 'the form submit executes the save action');
  await prefs.settle();
  assert.equal(prefs.posts('act_syn_save'), 1);

  const photo = ui('done');
  photo.app.state.surface = 'conversation';
  photo.app.state.output = output;
  photo.app.state.allowedActions = [action('continue_without_photo', 'act_syn_nophoto'), action('talk_to_staff', 'act_syn_staff')];
  photo.app.paint();
  const controls = photo.root.querySelectorAll('[data-action-kind="continue_without_photo"]');
  assert.equal(controls.length, 1, 'one control, in the optional-image block');
  assert.equal(controls[0].click(), 1, 'one listener');
  await photo.settle();
  assert.equal(photo.posts('act_syn_nophoto'), 1);
  assert.equal(photo.app.state.imageRef, null);
});
