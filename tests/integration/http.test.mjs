import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpServer } from '../../src/server/http.mjs';
import { OWNER_PASS, STAFF_PASS, testApp } from '../platform/helpers.mjs';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    server.on('error', reject);
  });
}

async function withServer(overrides, fn) {
  const { app, config } = testApp(overrides);
  const server = createHttpServer(app, config);
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn({ app, config, base });
  } finally {
    await new Promise(resolve => server.close(resolve));
    app.close();
  }
}

async function req(base, path, { method = 'GET', token, body, headers } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
}

test('health is honest about the model', async () => {
  await withServer({}, async ({ base }) => {
    const { status, json } = await req(base, '/health');
    assert.equal(status, 200);
    assert.equal(json.model, 'unavailable');
    assert.equal(json.store, 'ok');
    assert.equal(json.contract_version, '0.1.0');
  });
});

test('POST /briefs/:id/share-actions issues bound actions and conceals other subjects', async () => {
  await withServer({ WEEKEND_PHOTO_ENABLED: 'true' }, async ({ base }) => {
    const customer = await req(base, '/session', {
      method: 'POST',
      body: { role: 'customer', passcode: OWNER_PASS },
    });
    const other = await req(base, '/session', {
      method: 'POST',
      body: { role: 'customer', passcode: OWNER_PASS },
    });
    const staff = await req(base, '/session', {
      method: 'POST',
      body: { role: 'staff', passcode: STAFF_PASS },
    });
    const brief = await req(base, '/briefs', {
      method: 'POST',
      token: customer.json.token,
      body: { text_ar: 'موجز للمشاركة', do_not: [] },
    });
    assert.equal(brief.status, 200);
    const own = await req(base, `/briefs/${brief.json.brief_id}/share-actions`, {
      method: 'POST',
      token: customer.json.token,
      body: {},
    });
    assert.equal(own.status, 200);
    assert.equal(own.json.contract_version, '0.1.0');
    assert.equal(own.json.allowed_actions[0].kind, 'share_brief_text');
    assert.equal(own.json.allowed_actions[0].bound.object_id, brief.json.brief_id);
    assert.equal(own.json.allowed_actions.some(a => a.kind === 'share_photo_ref'), false);

    const hidden = await req(base, `/briefs/${brief.json.brief_id}/share-actions`, {
      method: 'POST',
      token: other.json.token,
      body: {},
    });
    assert.equal(hidden.status, 404);
    assert.equal(hidden.json.code, 'NOT_FOUND');
    assert.equal(hidden.json.message_key, 'brief.not_found');

    const staffDenied = await req(base, `/briefs/${brief.json.brief_id}/share-actions`, {
      method: 'POST',
      token: staff.json.token,
      body: {},
    });
    assert.equal(staffDenied.status, 401);
    assert.equal(staffDenied.json.code, 'UNAUTHORIZED');
    assert.equal(staffDenied.json.message_key, 'brief.role');
  });
});

test('http session, brief sync, and booking handoff', async () => {
  await withServer({}, async ({ base, config }) => {
    const customer = await req(base, '/session', {
      method: 'POST',
      body: { role: 'customer', passcode: OWNER_PASS },
    });
    assert.equal(customer.status, 200);
    const token = customer.json.token;
    const staff = await req(base, '/session', {
      method: 'POST',
      body: { role: 'staff', passcode: STAFF_PASS },
    });
    const other = await req(base, '/session', {
      method: 'POST',
      body: { role: 'customer', passcode: OWNER_PASS },
    });

    const brief = await req(base, '/briefs', {
      method: 'POST',
      token,
      body: { text_ar: 'موجز نصي للحفّاف', do_not: [] },
    });
    assert.equal(brief.status, 200);

    const blocked = await req(base, '/staff/briefs', { token: other.json.token });
    assert.equal(blocked.status, 401);

    const beforeShare = await req(base, '/staff/briefs', { token: staff.json.token });
    assert.equal(beforeShare.status, 200);
    assert.equal(beforeShare.json.briefs.some(b => b.brief_id === brief.json.brief_id), false);

    await req(base, '/consents', {
      method: 'POST',
      token,
      body: { kind: 'staff_sharing_text', granted_via: 'customer_ui' },
    });
    const shareActions = await req(base, `/briefs/${brief.json.brief_id}/share-actions`, {
      method: 'POST',
      token,
      body: {},
    });
    const textShare = shareActions.json.allowed_actions.find(a => a.kind === 'share_brief_text');
    const shared = await req(base, `/actions/${textShare.action_id}`, { method: 'POST', token, body: {} });
    assert.equal(shared.json.outcome, 'done');

    const inbox = await req(base, '/staff/briefs', { token: staff.json.token });
    assert.equal(inbox.status, 200);
    assert.equal(inbox.json.briefs.some(b => b.brief_id === brief.json.brief_id), true);

    const handoff = await req(base, '/booking/handoff', { token });
    assert.equal(handoff.json.url, config.WEEKEND_OFFICIAL_BOOKING_URL);
    const clicked = await req(base, `/actions/${handoff.json.action_id}`, { method: 'POST', token, body: {} });
    assert.equal(clicked.json.outcome, 'external_handoff');
  });
});

test('forged bearer token is rejected', async () => {
  await withServer({}, async ({ base }) => {
    const { status, json } = await req(base, '/context', { token: 'ses_nope.abcd' });
    assert.equal(status, 401);
    assert.equal(json.code, 'UNAUTHORIZED');
  });
});

test('repeated failed sessions from one address are throttled', async () => {
  await withServer({}, async ({ base }) => {
    const headers = { 'x-forwarded-for': '198.51.100.20' };
    for (let i = 0; i < 5; i += 1) {
      const { status, json } = await req(base, '/session', {
        method: 'POST',
        headers,
        body: { role: 'staff', passcode: 'nope' },
      });
      assert.equal(status, 401);
      assert.equal(json.retryable, false);
    }
    const limited = await req(base, '/session', {
      method: 'POST',
      headers,
      body: { role: 'staff', passcode: STAFF_PASS },
    });
    assert.equal(limited.status, 401);
    assert.equal(limited.json.code, 'UNAUTHORIZED');
    assert.equal(limited.json.retryable, true);
  });
});

test('local mock turn over http is not a booking confirmation', async () => {
  await withServer({}, async ({ base }) => {
    const customer = await req(base, '/session', {
      method: 'POST',
      body: { role: 'customer', passcode: OWNER_PASS },
    });
    const sessionId = customer.json.context.session_id;
    const turn = await req(base, '/turns', {
      method: 'POST',
      token: customer.json.token,
      body: {
        contract_version: '0.1.0',
        session_id: sessionId,
        turn_id: '11111111-2222-4333-8444-555555555571',
        text: 'أبغى قصة',
        image_ref: null,
        client_action_id: null,
        locale_hint: 'ar',
      },
    });
    assert.equal(turn.status, 200);
    assert.equal(turn.json.output.state, 'ok');
    assert.ok(!JSON.stringify(turn.json).toLowerCase().includes('confirm'));
  });
});

test('a client-supplied X-Forwarded-For cannot bypass or misdirect the passcode limiter', async () => {
  await withServer({}, async ({ base }) => {
    for (let i = 0; i < 5; i += 1) {
      const { status } = await req(base, '/session', { method: 'POST', body: { role: 'staff', passcode: 'nope' }, headers: { 'x-forwarded-for': `203.0.113.${i}` } });
      assert.equal(status, 401);
    }
    const { status, json } = await req(base, '/session', { method: 'POST', body: { role: 'staff', passcode: STAFF_PASS }, headers: { 'x-forwarded-for': '203.0.113.99' } });
    assert.equal(status, 401, 'the socket address is the key when no proxy is trusted');
    assert.equal(json.message_key, 'session.throttled');
  });
});

test('behind a trusted proxy only the rightmost X-Forwarded-For entry is the client key', async () => {
  await withServer({ WEEKEND_TRUST_PROXY: '1' }, async ({ base }) => {
    for (let i = 0; i < 5; i += 1) {
      const { status } = await req(base, '/session', { method: 'POST', body: { role: 'staff', passcode: 'nope' }, headers: { 'x-forwarded-for': `10.0.0.${i}, 198.51.100.7` } });
      assert.equal(status, 401);
    }
    const spoofed = await req(base, '/session', { method: 'POST', body: { role: 'staff', passcode: STAFF_PASS }, headers: { 'x-forwarded-for': '10.0.0.200, 198.51.100.7' } });
    assert.equal(spoofed.status, 401, 'rotating the client-supplied entry does not escape the throttle');
    const other = await req(base, '/session', { method: 'POST', body: { role: 'staff', passcode: STAFF_PASS }, headers: { 'x-forwarded-for': '10.0.0.1, 198.51.100.8' } });
    assert.equal(other.status, 200, 'a different real client address is not locked out');
  });
});

test('non-object JSON bodies are VALIDATION_ERROR 400', async () => {
  await withServer({}, async ({ base }) => {
    for (const raw of ['null', '[]', '"x"']) {
      const res = await fetch(`${base}/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: raw,
      });
      assert.equal(res.status, 400, raw);
      const json = await res.json();
      assert.equal(json.code, 'VALIDATION_ERROR');
      assert.equal(json.message_key, 'http.invalid_json');
    }
  });
});
