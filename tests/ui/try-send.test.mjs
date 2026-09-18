import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from './helpers.mjs';
import { createRoot } from './dom-shim.mjs';
import { createRakanUi } from '../../src/ui/app.js';
import { COPY } from '../../src/ui/copy.js';

const context = readJson('valid/trusted-context.json');
const output = readJson('valid/chat-turn-output.json');
const guestDenied = {
  contract_version: '0.1.0',
  code: 'UNAUTHORIZED',
  message_key: 'session.passcode',
  retryable: false,
  details: {},
};

function parseBody(opts) {
  if (!opts?.body) return {};
  if (typeof opts.body === 'string') return JSON.parse(opts.body);
  return opts.body;
}

async function settle() {
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
}

test('try Send posts /turns after a public guest session', async () => {
  const calls = [];
  const fetchImpl = async (path, opts = {}) => {
    const json = parseBody(opts);
    calls.push({ path, method: opts.method || 'GET', json });
    if (path === '/session') {
      return { ok: true, status: 200, json: async () => ({ token: 'tok_syn', context }) };
    }
    if (path === '/turns') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ output, allowed_actions: [], action_result: null, context }),
      };
    }
    if (path === '/health') {
      return { ok: true, status: 200, json: async () => ({ contract_version: '0.1.0', model: 'ok', store: 'ok' }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const root = createRoot();
  const app = createRakanUi(root, { fetchImpl, shell: 'try' });
  await app.startPublicGuest();
  assert.equal(app.state.context?.session_id, context.session_id);
  const composer = root.querySelector('[data-component="composer"]');
  const textarea = root.querySelector('#wk-composer-text');
  textarea.value = 'أبغى فيد';
  assert.equal(composer.fire('submit'), 1);
  await settle();
  const turns = calls.filter((c) => c.path === '/turns' && c.method === 'POST');
  assert.equal(turns.length, 1);
  assert.equal(turns[0].json.text, 'أبغى فيد');
  assert.match(root.innerHTML, /أبغى فيد/);
  assert.match(root.innerHTML, /أقدر أساعدك بالنص/);
  assert.equal(root.querySelector('[data-try-pass="true"]'), null);
});

test('try Send does not drop the message when public guest is closed', async () => {
  const calls = [];
  const fetchImpl = async (path, opts = {}) => {
    const json = parseBody(opts);
    calls.push({ path, method: opts.method || 'GET', json });
    if (path === '/session') {
      if (!json.passcode) {
        return { ok: false, status: 401, json: async () => guestDenied };
      }
      return { ok: true, status: 200, json: async () => ({ token: 'tok_syn', context }) };
    }
    if (path === '/turns') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ output, allowed_actions: [], action_result: null, context }),
      };
    }
    if (path === '/health') {
      return { ok: true, status: 200, json: async () => ({ contract_version: '0.1.0', model: 'ok', store: 'ok' }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const root = createRoot();
  const app = createRakanUi(root, { fetchImpl, shell: 'try' });
  await app.startPublicGuest();
  assert.equal(app.state.context, null);
  assert.ok(root.querySelector('[data-try-pass="true"]'), 'passcode gate after guest session is refused');
  assert.match(root.innerHTML, /افتح المحادثة برمز الدخول/);

  const composer = root.querySelector('[data-component="composer"]');
  const textarea = root.querySelector('#wk-composer-text');
  textarea.value = 'أبغى فيد';
  assert.equal(composer.fire('submit'), 1);
  await settle();
  assert.equal(calls.filter((c) => c.path === '/turns').length, 0, 'no turn until a session exists');
  assert.match(root.innerHTML, /أبغى فيد/);
  assert.equal(app.state.pendingTurnText, 'أبغى فيد');

  const gate = root.querySelector('[data-try-pass="true"]');
  const pass = root.querySelector('#wk-try-pass-input');
  pass.value = 'owner-test';
  assert.equal(gate.fire('submit'), 1);
  await settle();
  const turns = calls.filter((c) => c.path === '/turns' && c.method === 'POST');
  assert.equal(turns.length, 1);
  assert.equal(turns[0].json.text, 'أبغى فيد');
  assert.equal(app.state.context?.session_id, context.session_id);
  assert.equal(root.querySelector('[data-try-pass="true"]'), null);
});

test('try Send recovers a guest_closed token by showing the passcode gate', async () => {
  let sessionCalls = 0;
  const guestClosed = {
    contract_version: '0.1.0',
    code: 'UNAUTHORIZED',
    message_key: 'session.guest_closed',
    retryable: false,
    details: {},
  };
  const fetchImpl = async (path, opts = {}) => {
    const json = parseBody(opts);
    if (path === '/session') {
      sessionCalls += 1;
      if (sessionCalls === 1) {
        return { ok: true, status: 200, json: async () => ({ token: 'tok_old', context }) };
      }
      if (!json.passcode) {
        return { ok: false, status: 401, json: async () => guestDenied };
      }
      return { ok: true, status: 200, json: async () => ({ token: 'tok_new', context }) };
    }
    if (path === '/turns') {
      return { ok: false, status: 401, json: async () => guestClosed };
    }
    if (path === '/health') {
      return { ok: true, status: 200, json: async () => ({ contract_version: '0.1.0', model: 'ok', store: 'ok' }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const root = createRoot();
  const app = createRakanUi(root, { fetchImpl, shell: 'try' });
  await app.startPublicGuest();
  assert.equal(app.state.context?.session_id, context.session_id);
  const composer = root.querySelector('[data-component="composer"]');
  const textarea = root.querySelector('#wk-composer-text');
  textarea.value = 'أبغى فيد';
  assert.equal(composer.fire('submit'), 1);
  await settle();
  assert.equal(app.state.context, null);
  assert.equal(app.state.pendingTurnText, 'أبغى فيد');
  assert.ok(root.querySelector('[data-try-pass="true"]'), 'passcode gate after the trial session is closed');
  assert.match(root.innerHTML, /رمز الدخول للمحادثة/);
  assert.match(root.innerHTML, /انتهت جلسة التجربة/);
});

test('try Send resends pending text after a stale guest token when public guest stays on', async () => {
  let sessionCalls = 0;
  let turnCalls = 0;
  const expired = {
    contract_version: '0.1.0',
    code: 'UNAUTHORIZED',
    message_key: 'session.expired',
    retryable: false,
    details: {},
  };
  const fetchImpl = async (path, opts = {}) => {
    const json = parseBody(opts);
    if (path === '/session') {
      sessionCalls += 1;
      return { ok: true, status: 200, json: async () => ({ token: `tok_${sessionCalls}`, context }) };
    }
    if (path === '/turns') {
      turnCalls += 1;
      if (turnCalls === 1) {
        return { ok: false, status: 401, json: async () => expired };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ output, allowed_actions: [], action_result: null, context }),
      };
    }
    if (path === '/health') {
      return { ok: true, status: 200, json: async () => ({ contract_version: '0.1.0', model: 'ok', store: 'ok' }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const root = createRoot();
  const app = createRakanUi(root, { fetchImpl, shell: 'try' });
  await app.startPublicGuest();
  const composer = root.querySelector('[data-component="composer"]');
  const textarea = root.querySelector('#wk-composer-text');
  textarea.value = 'أبغى فيد';
  assert.equal(composer.fire('submit'), 1);
  await settle();
  assert.equal(app.state.error, null);
  assert.equal(root.querySelector('[data-try-pass="true"]'), null);
  assert.equal(turnCalls, 2);
  assert.equal(sessionCalls, 2);
  assert.equal(app.state.context?.session_id, context.session_id);
  assert.match(root.innerHTML, /أبغى فيد/);
});

test('try pass-gate copy exists in both languages and is not shame copy', () => {
  assert.equal(Boolean(COPY.ar.try_pass_label), true);
  assert.equal(Boolean(COPY.en.try_pass_label), true);
  assert.equal(/ديمو|demo|shame/i.test(`${COPY.ar.try_pass_label}${COPY.en.try_pass_label}`), false);
});
