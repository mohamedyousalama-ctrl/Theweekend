import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, loadConfig } from '../../src/server/config.mjs';
import { createHttpServer } from '../../src/server/http.mjs';
import { createRakanAdapter } from '../../src/agent/adapter.mjs';
import { fakeClient, knowledge, modelJson, response } from '../agent/fixtures.mjs';
import { OWNER_PASS, testApp, testEnv } from '../platform/helpers.mjs';

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

test('owner-review real mode with a fake provider reports model real and issues allowed actions', async () => {
  const adapter = createRakanAdapter({
    WEEKEND_MODEL_MODE: 'real',
    WEEKEND_MODEL_PROVIDER: 'anthropic',
    WEEKEND_MODEL_ID: 'claude-opus-5',
    WEEKEND_MODEL_API_KEY: 'test-key-not-real',
    WEEKEND_REQUEST_TIMEOUT_MS: 8000,
  }, { client: fakeClient([response(modelJson())]), knowledge });
  const { app, config } = testApp(ownerReviewReal(), { adapter });
  const server = createHttpServer(app, config);
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;
  try {
    const session = await req(base, '/session', {
      method: 'POST',
      body: { role: 'customer', passcode: OWNER_PASS },
    });
    assert.equal(session.status, 200);
    assert.equal(session.json.context.capabilities.model, 'real');
    const token = session.json.token;

    const ctx = await req(base, '/context', { token });
    assert.equal(ctx.status, 200);
    assert.equal(ctx.json.capabilities.model, 'real');

    const health = await req(base, '/health');
    assert.equal(health.status, 200);
    assert.equal(health.json.model, 'ok');

    const turn = await req(base, '/turns', {
      method: 'POST',
      token,
      body: {
        contract_version: '0.1.0',
        session_id: session.json.context.session_id,
        turn_id: '11111111-2222-4333-8444-555555555581',
        text: 'كم سعر الحلاقة؟',
        image_ref: null,
        client_action_id: null,
        locale_hint: 'ar',
      },
    });
    assert.equal(turn.status, 200);
    assert.equal(turn.json.output.state, 'ok');
    assert.ok(turn.json.allowed_actions.length >= 1);
    assert.ok(turn.json.allowed_actions.some((a) => a.kind === 'open_official_booking' && /^act_/.test(a.action_id)));
    assert.ok(!JSON.stringify(turn.json).toLowerCase().includes('confirm'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.close();
  }
});

test('owner-review real mode fails at start when the model key is missing', () => {
  const env = testEnv(ownerReviewReal());
  delete env.WEEKEND_MODEL_API_KEY;
  assert.throws(
    () => loadConfig(env),
    err => err instanceof ConfigError && err.variable === 'WEEKEND_MODEL_API_KEY',
  );
});
