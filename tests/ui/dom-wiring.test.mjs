import test from 'node:test';
import assert from 'node:assert/strict';
import { failure, readJson } from './helpers.mjs';
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

function consentError(messageKey, extra = {}) {
  return {
    contract_version: '0.1.0',
    code: 'CONSENT_REQUIRED',
    message_key: messageKey,
    retryable: false,
    details: extra,
  };
}

function parseBody(opts) {
  if (typeof opts.body === 'string') {
    try { return JSON.parse(opts.body); } catch { return null; }
  }
  return null;
}

test('403 CONSENT_REQUIRED shows the consent step and retries the original action after grant', async () => {
  const calls = [];
  let actionHits = 0;
  const fetchImpl = async (path, opts = {}) => {
    const json = parseBody(opts);
    calls.push({ path, method: opts.method || 'GET', json });
    if (path.startsWith('/actions/')) {
      actionHits += 1;
      if (actionHits === 1) {
        return {
          ok: false,
          status: 403,
          json: async () => consentError('action.consent_required', { action_id: 'act_syn_share_text' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          contract_version: '0.1.0',
          action_id: path.split('/').pop(),
          outcome: 'done',
          receipt_id: 'rcp_syn_share',
          message_key: 'brief.shared_text',
        }),
      };
    }
    if (path === '/consents') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          contract_version: '0.1.0',
          receipt_id: 'rcp_syn_share_grant',
          subject_id: context.subject_id,
          kind: json.kind,
          notice_version: 'notice_share_text_v1',
          granted_at: '2026-09-14T22:00:00Z',
          revoked_at: null,
          retention_policy_key: 'ret_share_text_v1',
          granted_via: json.granted_via,
        }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const root = createRoot();
  const app = createRakanUi(root, { fetchImpl });
  app.state.context = context;
  app.state.token = 'tok_syn';
  app.state.surface = 'approved_brief';
  app.state.brief = { ...brief, status: 'approved' };
  app.state.shareActions = [action('share_brief_text', 'act_syn_share_text', { requires_receipt_kind: 'staff_sharing_text' })];
  app.paint();
  const btn = root.querySelector('[data-action-id="act_syn_share_text"]');
  assert.ok(btn);
  btn.click();
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  const step = root.querySelector('[data-component="consent-step"]');
  assert.ok(step, 'consent step shown');
  assert.equal(step.getAttribute('data-consent-kind'), 'staff_sharing_text');
  const grant = root.querySelector('[data-consent-grant="true"]');
  assert.equal(grant.click(), 1);
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
  const consentPost = calls.find((c) => c.path === '/consents' && c.method === 'POST');
  assert.ok(consentPost);
  assert.deepEqual(consentPost.json, { kind: 'staff_sharing_text', granted_via: 'customer_ui' });
  assert.equal(calls.filter((c) => c.path === '/actions/act_syn_share_text').length, 2);
  assert.equal(app.state.actionResult?.outcome, 'done');
  assert.equal(app.state.consent, null);
});

test('brief approve posts /briefs then share-actions and renders executable share buttons', async () => {
  const calls = [];
  const fetchImpl = async (path, opts = {}) => {
    const json = parseBody(opts);
    calls.push({ path, method: opts.method || 'GET', json });
    if (path === '/briefs' && opts.method === 'POST') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ...brief,
          status: 'approved',
          requested_look: { ...brief.requested_look, text_ar: json.text_ar },
          do_not: json.do_not,
          barber_preference: json.barber_preference,
          provenance: { approved_by_subject_at: '2026-09-14T22:00:00Z', version: 1 },
        }),
      };
    }
    if (path === `/briefs/${brief.brief_id}/share-actions`) {
      assert.deepEqual(json, {});
      return {
        ok: true,
        status: 200,
        json: async () => ({
          contract_version: '0.1.0',
          allowed_actions: [
            action('share_brief_text', 'act_syn_issued_text', { requires_receipt_kind: 'staff_sharing_text' }),
            action('share_photo_ref', 'act_syn_issued_photo', { requires_receipt_kind: 'staff_sharing_photo' }),
          ],
        }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const root = createRoot();
  const app = createRakanUi(root, { fetchImpl });
  app.state.context = context;
  app.state.token = 'tok_syn';
  app.state.surface = 'conversation';
  app.state.output = { ...output, brief_draft: { ...brief, status: 'draft' } };
  app.paint();
  const approve = root.querySelector('[data-action="approve-brief"]');
  assert.ok(approve, 'approve step rendered for brief_draft');
  approve.click();
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
  const created = calls.find((c) => c.path === '/briefs');
  assert.ok(created);
  assert.equal(created.json.text_ar, brief.requested_look.text_ar);
  assert.deepEqual(created.json.do_not, brief.do_not);
  assert.equal(app.state.surface, 'approved_brief');
  const textBtn = root.querySelector('[data-action-id="act_syn_issued_text"][data-executable="true"]');
  const photoBtn = root.querySelector('[data-action-id="act_syn_issued_photo"][data-executable="true"]');
  assert.ok(textBtn);
  assert.ok(photoBtn);
  assert.match(root.innerHTML, /مشاركة ملاحظات الصورة/);
});

test('direct preference save posts /preferences when no save_preference action exists', async () => {
  const calls = [];
  const fetchImpl = async (path, opts = {}) => {
    const json = parseBody(opts);
    calls.push({ path, method: opts.method || 'GET', json });
    if (path === '/preferences' && opts.method === 'POST') {
      return { ok: true, status: 200, json: async () => ({ preference_id: 'prf_syn_new' }) };
    }
    if (path === '/preferences') {
      return { ok: true, status: 200, json: async () => ({ preferences: [] }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const root = createRoot();
  const app = createRakanUi(root, { fetchImpl });
  app.state.context = context;
  app.state.token = 'tok_syn';
  app.state.surface = 'preferences';
  app.state.allowedActions = [];
  app.paint();
  const form = root.querySelector('[data-component="preference-editor"]');
  const text = root.querySelector('[name="value_text"]');
  assert.ok(form);
  assert.ok(root.querySelector('[data-direct-save="true"]'));
  text.value = 'fade short';
  form.fire('submit');
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  const saved = calls.find((c) => c.path === '/preferences' && c.method === 'POST');
  assert.ok(saved);
  assert.equal(saved.json.kind, 'style');
  assert.equal(saved.json.value_text, 'fade short');
  assert.equal(saved.json.source, 'customer_typed');
});

test('paint restores focus to the composer after a re-render', () => {
  const { app, root } = ui('done');
  app.state.surface = 'conversation';
  app.state.output = output;
  app.paint();
  const first = root.querySelector('#wk-composer-text');
  assert.ok(first);
  first.focus();
  assert.equal(root._activeElement.getAttribute('id'), 'wk-composer-text');
  app.paint();
  assert.equal(root._activeElement.getAttribute('id'), 'wk-composer-text');
  assert.ok(root._activeElement !== first, 'focus moved to the new node after innerHTML');
});

test('photo upload sets imageRef from the server response when photo is enabled', async () => {
  const calls = [];
  const fetchImpl = async (path, opts = {}) => {
    calls.push({ path, method: opts.method || 'GET', contentType: opts.headers?.['content-type'] });
    if (path === '/uploads') {
      return { ok: true, status: 200, json: async () => ({ image_ref: 'img_syn_up' }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const root = createRoot();
  const app = createRakanUi(root, { fetchImpl });
  app.state.context = {
    ...context,
    capabilities: { ...context.capabilities, photo: 'enabled' },
  };
  app.state.token = 'tok_syn';
  app.state.surface = 'conversation';
  app.state.output = output;
  app.paint();
  const input = root.querySelector('#wk-photo-upload');
  assert.ok(input, 'upload control shown when photo is enabled');
  input.files = [{
    type: 'image/jpeg',
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  }];
  input.fire('change');
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  const up = calls.find((c) => c.path === '/uploads');
  assert.ok(up);
  assert.equal(up.contentType, 'image/jpeg');
  assert.equal(app.state.imageRef, 'img_syn_up');
});

test('upload CONSENT_REQUIRED grants photo_analysis then retries POST /uploads', async () => {
  const calls = [];
  let uploads = 0;
  const fetchImpl = async (path, opts = {}) => {
    const json = parseBody(opts);
    calls.push({ path, method: opts.method || 'GET', json });
    if (path === '/uploads') {
      uploads += 1;
      if (uploads === 1) {
        return {
          ok: false,
          status: 403,
          json: async () => consentError('photo.consent_required', { capability: 'photo' }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ image_ref: 'img_syn_retry' }) };
    }
    if (path === '/consents') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          contract_version: '0.1.0',
          receipt_id: 'rcp_syn_photo',
          subject_id: context.subject_id,
          kind: 'photo_analysis',
          notice_version: 'notice_photo_v1',
          granted_at: '2026-09-14T22:00:00Z',
          revoked_at: null,
          retention_policy_key: 'ret_photo_v1',
          granted_via: 'customer_ui',
        }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const root = createRoot();
  const app = createRakanUi(root, { fetchImpl });
  app.state.context = {
    ...context,
    capabilities: { ...context.capabilities, photo: 'enabled' },
  };
  app.state.token = 'tok_syn';
  app.state.surface = 'conversation';
  app.state.output = output;
  app.paint();
  const input = root.querySelector('#wk-photo-upload');
  input.files = [{
    type: 'image/png',
    arrayBuffer: async () => new Uint8Array([9, 8, 7]).buffer,
  }];
  input.fire('change');
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.equal(root.querySelector('[data-consent-kind="photo_analysis"]') != null, true);
  root.querySelector('[data-consent-grant="true"]').click();
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
  assert.equal(calls.filter((c) => c.path === '/uploads').length, 2);
  assert.equal(app.state.imageRef, 'img_syn_retry');
});

test('retryable MODEL_UNAVAILABLE keeps the draft and retry posts /turns again', async () => {
  const calls = [];
  const down = failure('unavailable-model').instance;
  const ok = {
    output,
    allowed_actions: [],
    action_result: null,
    context,
  };
  let turns = 0;
  const fetchImpl = async (path, opts = {}) => {
    const json = parseBody(opts);
    calls.push({ path, method: opts.method || 'GET', json });
    if (path === '/turns') {
      turns += 1;
      const body = turns === 1
        ? { output: down, allowed_actions: [], action_result: null, context }
        : ok;
      return { ok: true, status: 200, json: async () => body };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const root = createRoot();
  const app = createRakanUi(root, { fetchImpl });
  app.state.context = context;
  app.state.token = 'tok_syn';
  app.state.surface = 'conversation';
  app.paint();
  const composer = root.querySelector('[data-component="composer"]');
  const textarea = root.querySelector('#wk-composer-text');
  textarea.value = 'سلام';
  composer.fire('submit');
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.equal(turns, 1);
  assert.equal(app.state.draft, 'سلام');
  assert.equal(app.state.output?.state, 'unavailable');
  const retry = root.querySelector('[data-retry="true"]');
  assert.ok(retry, 'retry control shown for retryable model failure');
  retry.click();
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.equal(turns, 2);
  assert.equal(app.state.output?.state, 'ok');
  assert.equal(app.state.draft, '');
  assert.equal(calls.filter((c) => c.path === '/turns').length, 2);
});

test('retry after a retryable turn then a retryable upload posts /uploads once and no /turns', async () => {
  const calls = [];
  const down = failure('unavailable-model').instance;
  const uploadErr = {
    contract_version: '0.1.0',
    code: 'TIMEOUT',
    message_key: 'model.timeout',
    retryable: true,
    details: { capability: 'photo' },
  };
  const photoContext = {
    ...context,
    capabilities: { ...context.capabilities, photo: 'enabled' },
  };
  let uploads = 0;
  const fetchImpl = async (path, opts = {}) => {
    calls.push({ path, method: opts.method || 'GET' });
    if (path === '/turns') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ output: down, allowed_actions: [], action_result: null, context: photoContext }),
      };
    }
    if (path === '/uploads') {
      uploads += 1;
      if (uploads === 1) {
        return { ok: false, status: 504, json: async () => uploadErr };
      }
      return { ok: true, status: 200, json: async () => ({ image_ref: 'img_syn_retry_up' }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const root = createRoot();
  const app = createRakanUi(root, { fetchImpl });
  app.state.context = photoContext;
  app.state.token = 'tok_syn';
  app.state.surface = 'conversation';
  app.paint();
  const composer = root.querySelector('[data-component="composer"]');
  const textarea = root.querySelector('#wk-composer-text');
  textarea.value = 'سلام';
  composer.fire('submit');
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.equal(calls.filter((c) => c.path === '/turns').length, 1);
  const input = root.querySelector('#wk-photo-upload');
  assert.ok(input);
  input.files = [{
    type: 'image/jpeg',
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  }];
  input.fire('change');
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.equal(calls.filter((c) => c.path === '/uploads' && c.method === 'POST').length, 1);
  const retry = root.querySelector('[data-retry="true"]');
  assert.ok(retry, 'retry control shown for retryable upload failure');
  const before = calls.length;
  retry.click();
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  const after = calls.slice(before);
  assert.equal(after.filter((c) => c.path === '/uploads' && c.method === 'POST').length, 1);
  assert.equal(after.filter((c) => c.path === '/turns').length, 0);
  assert.equal(calls.filter((c) => c.path === '/turns').length, 1);
  assert.equal(app.state.imageRef, 'img_syn_retry_up');
});
