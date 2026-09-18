import test from 'node:test';
import assert from 'node:assert/strict';
import { createRakanAdapter } from '../../src/agent/adapter.mjs';
import { createHttpServer } from '../../src/server/http.mjs';
import { capabilitiesFor } from '../../src/server/app.mjs';
import { loadConfig } from '../../src/server/config.mjs';
import { handoffSkip } from '../../scripts/owner-walkthrough.mjs';
import { fakeClient, knowledge, modelJson, response } from '../agent/fixtures.mjs';
import { OWNER_PASS, STAFF_PASS, testApp, testEnv } from './helpers.mjs';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    server.on('error', reject);
  });
}

async function req(base, path, { method = 'GET', token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
}

function ownerReviewReal(overrides = {}) {
  return {
    WEEKEND_ENV: 'owner-review',
    WEEKEND_MODEL_MODE: 'real',
    WEEKEND_MODEL_PROVIDER: 'anthropic',
    WEEKEND_MODEL_ID: 'claude-opus-5',
    WEEKEND_VISION_MODEL_ID: 'claude-opus-5',
    ...overrides,
  };
}

test('capabilitiesFor: customer staff_inbox follows the staff-inbox store, not the session role', () => {
  const config = loadConfig(testEnv());
  assert.equal(capabilitiesFor(config, 'customer', false, true).staff_inbox, 'enabled');
  assert.equal(capabilitiesFor(config, 'customer', false, false).staff_inbox, 'unavailable');
  assert.equal(capabilitiesFor(config, 'staff', false, false).staff_inbox, 'enabled');
  assert.equal(capabilitiesFor(config, 'owner', false, false).staff_inbox, 'enabled');
});

test('customer session reports staff_inbox enabled when the store is up', () => {
  const { app } = testApp();
  const { token } = app.createSession('customer', OWNER_PASS);
  assert.equal(app.context(token).capabilities.staff_inbox, 'enabled');
  assert.equal(app.health().staff_inbox, 'ok');
  app.close();
});

test('customer session reports staff_inbox unavailable when the store is down', () => {
  const { app } = testApp();
  app.store.probe = () => {
    throw new Error('store down');
  };
  const { token } = app.createSession('customer', OWNER_PASS);
  assert.equal(app.context(token).capabilities.staff_inbox, 'unavailable');
  assert.equal(app.health().staff_inbox, 'unavailable');
  app.close();
});

test('real adapter keeps talk_to_staff for a customer session and queues the staff inbox', async () => {
  const json = modelJson({
    proposed_actions: [
      {
        kind: 'talk_to_staff',
        label_ar: 'تحدث مع الفريق',
        label_en: 'Talk to staff',
        payload: { preference_kind: 'none', value_text: '' },
      },
      {
        kind: 'open_official_booking',
        label_ar: 'صفحة الحجز',
        label_en: 'Booking page',
        payload: { preference_kind: 'none', value_text: '' },
      },
    ],
  });
  const adapter = createRakanAdapter({
    WEEKEND_MODEL_MODE: 'real',
    WEEKEND_MODEL_PROVIDER: 'anthropic',
    WEEKEND_MODEL_ID: 'claude-opus-5',
    WEEKEND_MODEL_API_KEY: 'test-key-not-real',
    WEEKEND_REQUEST_TIMEOUT_MS: 8000,
  }, { client: fakeClient([response(json)]), knowledge });
  const { app, config } = testApp(ownerReviewReal(), { adapter });
  const server = createHttpServer(app, config);
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;
  try {
    const customer = await req(base, '/session', {
      method: 'POST',
      body: { role: 'customer', passcode: OWNER_PASS },
    });
    assert.equal(customer.status, 200);
    assert.equal(customer.json.context.role, 'customer');
    assert.equal(customer.json.context.capabilities.staff_inbox, 'enabled');
    const customerToken = customer.json.token;
    const sessionId = customer.json.context.session_id;

    const staff = await req(base, '/session', {
      method: 'POST',
      body: { role: 'staff', passcode: STAFF_PASS },
    });
    assert.equal(staff.status, 200);
    const staffToken = staff.json.token;

    const turn = await req(base, '/turns', {
      method: 'POST',
      token: customerToken,
      body: {
        contract_version: '0.1.0',
        session_id: sessionId,
        turn_id: '11111111-2222-4333-8444-555555555861',
        text: 'أبغى أوصل للفريق',
        image_ref: null,
        client_action_id: null,
        locale_hint: 'ar',
      },
    });
    assert.equal(turn.status, 200);
    assert.equal(turn.json.context.capabilities.staff_inbox, 'enabled');
    const kinds = (turn.json.allowed_actions || []).map((a) => a.kind);
    assert.ok(kinds.includes('talk_to_staff'));
    assert.ok(kinds.includes('open_official_booking'));
    const talk = turn.json.allowed_actions.find((a) => a.kind === 'talk_to_staff');
    assert.equal(handoffSkip(talk), null);

    const queued = await req(base, `/actions/${talk.action_id}`, {
      method: 'POST',
      token: customerToken,
      body: {},
    });
    assert.equal(queued.status, 200);
    assert.equal(queued.json.outcome, 'pending');
    assert.equal(queued.json.message_key, 'handoff.queued');

    const listed = await req(base, '/staff/handoffs', { token: staffToken });
    assert.equal(listed.status, 200);
    const rows = listed.json.handoffs || [];
    assert.ok(rows.some((row) => row.session_id === sessionId && row.status === 'received'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.close();
  }
});
