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
