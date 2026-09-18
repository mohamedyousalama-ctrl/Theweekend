import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, CLIENT_KEY_RETENTION_MS, RETENTION_SWEEP_INTERVAL_MS, createApp } from '../../src/server/app.mjs';
import { hmacClientKey, signSession } from '../../src/server/ids.mjs';
import { runModelTurn } from '../../src/integrations/internal/model-adapter.mjs';
import { OWNER_PASS, STAFF_PASS, testApp } from './helpers.mjs';

const turn = (sessionId, turnId) => ({
  contract_version: '0.1.0',
  session_id: sessionId,
  turn_id: turnId,
  text: 'أبغى قصة',
  image_ref: null,
  client_action_id: null,
  locale_hint: 'ar',
});

function adapterWithCost(costMinor) {
  return ({ context, input, now }) => {
    const result = runModelTurn({ context, input, now });
    result.usage.cost_estimate_minor = costMinor;
    return result;
  };
}

test('a loop of public-guest session creates from one client is throttled', () => {
  const { app } = testApp({
    WEEKEND_PUBLIC_GUEST: 'true',
    WEEKEND_GUEST_SESSIONS_PER_10MIN: '5',
  });
  const clientKey = '203.0.113.40';
  for (let i = 0; i < 5; i += 1) {
    const out = app.createSession('customer', '', { clientKey });
    assert.equal(out.context.role, 'customer');
  }
  assert.throws(
    () => app.createSession('customer', '', { clientKey }),
    err => err instanceof AppError
      && err.status === 401
      && err.shape.code === 'UNAUTHORIZED'
      && err.shape.message_key === 'session.throttled'
      && err.shape.retryable === true,
  );
  const other = app.createSession('customer', '', { clientKey: '203.0.113.41' });
  assert.equal(other.context.role, 'customer', 'a different client is not locked out');
  const owner = app.createSession('owner', OWNER_PASS, { clientKey });
  assert.equal(owner.context.role, 'owner', 'owner login from the same client is not counted as a guest create');
  const staff = app.createSession('staff', STAFF_PASS, { clientKey });
  assert.equal(staff.context.role, 'staff');
  const authenticated = app.createSession('customer', OWNER_PASS, { clientKey });
  assert.equal(authenticated.context.role, 'customer');
  app.close();
});

test('guest spend cannot enter the owner reserve; an owner turn still runs', async () => {
  const logs = [];
  const { app, config } = testApp({
    WEEKEND_PUBLIC_GUEST: 'true',
    WEEKEND_SPEND_CAP_USD_PER_DAY: '5',
    WEEKEND_OWNER_RESERVED_USD_PER_DAY: '1',
    WEEKEND_MAX_CALLS_PER_SESSION: '8',
  }, {
    adapter: adapterWithCost(400),
    costCeilingMinor: 400,
    log: (record) => logs.push(record),
  });
  const guest = app.createSession('customer', '', { clientKey: '203.0.113.50' });
  const first = await app.submitTurn(guest.token, turn(guest.context.session_id, '11111111-2222-4333-8444-555555555601'));
  assert.equal(first.output.state, 'ok');
  const spent = app.store.get('SELECT * FROM daily_spend');
  assert.equal(spent.cost_minor, 400);
  assert.equal(spent.guest_cost_minor, 400);
  await assert.rejects(
    () => app.submitTurn(guest.token, turn(guest.context.session_id, '11111111-2222-4333-8444-555555555602')),
    err => err instanceof AppError && err.status === 429 && err.shape.code === 'BUDGET_EXCEEDED'
      && err.shape.message_key === 'model.budget_exceeded',
  );
  const shareLogs = logs.filter((row) => row.kind === 'guest_spend');
  assert.deepEqual(shareLogs.map((row) => row.share_reached), [80, 100]);
  const ownerApp = createApp(config, {
    store: app.store,
    adapter: adapterWithCost(50),
    costCeilingMinor: 50,
    log: (record) => logs.push(record),
  });
  try {
    const owner = ownerApp.createSession('owner', OWNER_PASS, { clientKey: '203.0.113.51' });
    const out = await ownerApp.submitTurn(owner.token, turn(owner.context.session_id, '11111111-2222-4333-8444-555555555603'));
    assert.equal(out.output.state, 'ok', 'owner still runs inside the reserved slice');
    const after = app.store.get('SELECT * FROM daily_spend');
    assert.equal(after.cost_minor, 450);
    assert.equal(after.guest_cost_minor, 400, 'owner spend does not count as guest spend');
  } finally {
    try { ownerApp.close(); } catch { /* store closed with the guest app below */ }
    try { app.close(); } catch { /* already closed by ownerApp */ }
  }
});

test('a guest actual above the ceiling is clamped to the guest share', async () => {
  const logs = [];
  const { app, config } = testApp({
    WEEKEND_PUBLIC_GUEST: 'true',
    WEEKEND_SPEND_CAP_USD_PER_DAY: '5',
    WEEKEND_OWNER_RESERVED_USD_PER_DAY: '1',
    WEEKEND_MAX_CALLS_PER_SESSION: '8',
  }, {
    adapter: adapterWithCost(500),
    costCeilingMinor: 100,
    log: (record) => logs.push(record),
  });
  const guest = app.createSession('customer', '', { clientKey: '203.0.113.52' });
  const first = await app.submitTurn(guest.token, turn(guest.context.session_id, '11111111-2222-4333-8444-555555555631'));
  assert.equal(first.output.state, 'ok');
  const spent = app.store.get('SELECT * FROM daily_spend');
  assert.equal(spent.guest_cost_minor, 400);
  assert.equal(spent.cost_minor, 400);
  const overage = logs.find((row) => row.kind === 'guest_spend' && row.ceiling_violation === true);
  assert.equal(overage?.requested_minor, 500);
  assert.equal(overage?.charged_minor, 400);
  assert.equal(overage?.overage_minor, 100);
  const ownerApp = createApp(config, {
    store: app.store,
    adapter: adapterWithCost(50),
    costCeilingMinor: 50,
    log: (record) => logs.push(record),
  });
  try {
    const owner = ownerApp.createSession('owner', OWNER_PASS, { clientKey: '203.0.113.53' });
    const out = await ownerApp.submitTurn(owner.token, turn(owner.context.session_id, '11111111-2222-4333-8444-555555555632'));
    assert.equal(out.output.state, 'ok', 'owner still runs inside the reserved slice after a guest ceiling violation');
    await assert.rejects(
      () => app.submitTurn(guest.token, turn(guest.context.session_id, '11111111-2222-4333-8444-555555555633')),
      err => err instanceof AppError && err.status === 429 && err.shape.code === 'BUDGET_EXCEEDED'
        && err.shape.message_key === 'model.budget_exceeded',
    );
  } finally {
    try { ownerApp.close(); } catch { /* store closed with the guest app below */ }
    try { app.close(); } catch { /* already closed by ownerApp */ }
  }
});

test('guest spend alerts fire on settled cost, not the reservation', async () => {
  const logs = [];
  const costs = [0, 320];
  const { app } = testApp({
    WEEKEND_PUBLIC_GUEST: 'true',
    WEEKEND_SPEND_CAP_USD_PER_DAY: '5',
    WEEKEND_OWNER_RESERVED_USD_PER_DAY: '1',
    WEEKEND_MAX_CALLS_PER_SESSION: '8',
  }, {
    adapter: (args) => {
      const result = runModelTurn(args);
      result.usage.cost_estimate_minor = costs.shift();
      return result;
    },
    costCeilingMinor: 400,
    log: (record) => logs.push(record),
  });
  const guest = app.createSession('customer', '', { clientKey: '203.0.113.54' });
  const first = await app.submitTurn(guest.token, turn(guest.context.session_id, '11111111-2222-4333-8444-555555555641'));
  assert.equal(first.output.state, 'ok');
  const afterReserve = app.store.get('SELECT * FROM daily_spend');
  assert.equal(afterReserve.guest_cost_minor, 0);
  assert.equal(afterReserve.guest_alert_80, 0);
  assert.equal(afterReserve.guest_alert_100, 0);
  assert.equal(logs.filter((row) => row.kind === 'guest_spend').length, 0);
  const second = await app.submitTurn(guest.token, turn(guest.context.session_id, '11111111-2222-4333-8444-555555555642'));
  assert.equal(second.output.state, 'ok');
  const shareLogs = logs.filter((row) => row.kind === 'guest_spend');
  assert.equal(shareLogs.length, 1);
  assert.equal(shareLogs[0].share_reached, 80);
  app.close();
});

test('guest settlement clamps against settled spend, not in-flight reservations', async () => {
  const logs = [];
  const turnA = '11111111-2222-4333-8444-555555555651';
  const turnB = '11111111-2222-4333-8444-555555555652';
  const costs = { [turnA]: 300, [turnB]: 0 };
  const gates = new Map();
  const entered = [];
  for (const id of [turnA, turnB]) {
    let release;
    gates.set(id, { opened: new Promise((resolve) => { release = resolve; }), release: () => release() });
  }
  const { app } = testApp({
    WEEKEND_PUBLIC_GUEST: 'true',
    WEEKEND_SPEND_CAP_USD_PER_DAY: '5',
    WEEKEND_OWNER_RESERVED_USD_PER_DAY: '1',
    WEEKEND_MAX_CALLS_PER_SESSION: '8',
    WEEKEND_GUEST_TURNS_PER_MIN: '8',
  }, {
    adapter: async ({ context, input, now }) => {
      entered.push(input.turn_id);
      await gates.get(input.turn_id).opened;
      const result = runModelTurn({ context, input, now });
      result.usage.cost_estimate_minor = costs[input.turn_id];
      return result;
    },
    costCeilingMinor: 200,
    log: (record) => logs.push(record),
  });
  const guestA = app.createSession('customer', '', { clientKey: '203.0.113.81' });
  const guestB = app.createSession('customer', '', { clientKey: '203.0.113.82' });
  const promiseA = app.submitTurn(guestA.token, turn(guestA.context.session_id, turnA));
  const promiseB = app.submitTurn(guestB.token, turn(guestB.context.session_id, turnB));
  for (let i = 0; i < 50 && entered.length < 2; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(entered.length, 2);
  const reserved = app.store.get('SELECT * FROM daily_spend');
  assert.equal(reserved.guest_cost_minor, 400);
  assert.equal(reserved.guest_settled_minor, 0);
  gates.get(turnA).release();
  const outA = await promiseA;
  assert.equal(outA.output.state, 'ok');
  assert.equal(app.store.get('SELECT guest_settled_minor FROM daily_spend').guest_settled_minor, 300);
  assert.equal(logs.filter((row) => row.kind === 'guest_spend').length, 0, '300 is below 80% of the 400 share');
  gates.get(turnB).release();
  const outB = await promiseB;
  assert.equal(outB.output.state, 'ok');
  const spent = app.store.get('SELECT * FROM daily_spend');
  assert.equal(spent.guest_settled_minor, 300);
  assert.equal(spent.guest_cost_minor, 300);
  const guestC = app.createSession('customer', '', { clientKey: '203.0.113.83' });
  await assert.rejects(
    () => app.submitTurn(guestC.token, turn(guestC.context.session_id, '11111111-2222-4333-8444-555555555653')),
    err => err instanceof AppError && err.status === 429 && err.shape.code === 'BUDGET_EXCEEDED'
      && err.shape.message_key === 'model.budget_exceeded',
  );
  assert.equal(logs.filter((row) => row.kind === 'guest_spend').length, 0);
  app.close();
});

test('a failed spend reservation does not burn the guest turn slot', async () => {
  const turnA = '11111111-2222-4333-8444-555555555661';
  let releaseA;
  const holdA = new Promise((resolve) => { releaseA = resolve; });
  let aEntered = false;
  const { app } = testApp({
    WEEKEND_PUBLIC_GUEST: 'true',
    WEEKEND_SPEND_CAP_USD_PER_DAY: '5',
    WEEKEND_OWNER_RESERVED_USD_PER_DAY: '1',
    WEEKEND_GUEST_TURNS_PER_MIN: '1',
    WEEKEND_MAX_CALLS_PER_SESSION: '8',
  }, {
    adapter: async ({ context, input, now }) => {
      if (input.turn_id === turnA) {
        aEntered = true;
        await holdA;
        const result = runModelTurn({ context, input, now });
        result.usage.cost_estimate_minor = 0;
        return result;
      }
      const result = runModelTurn({ context, input, now });
      result.usage.cost_estimate_minor = 50;
      return result;
    },
    costCeilingMinor: 400,
    log() {},
  });
  const guestA = app.createSession('customer', '', { clientKey: '203.0.113.91' });
  const guestB = app.createSession('customer', '', { clientKey: '203.0.113.92' });
  const promiseA = app.submitTurn(guestA.token, turn(guestA.context.session_id, turnA));
  for (let i = 0; i < 50 && !aEntered; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(aEntered, true);
  await assert.rejects(
    () => app.submitTurn(guestB.token, turn(guestB.context.session_id, '11111111-2222-4333-8444-555555555662')),
    err => err instanceof AppError && err.status === 429 && err.shape.code === 'BUDGET_EXCEEDED'
      && err.shape.message_key === 'model.budget_exceeded',
  );
  releaseA();
  const outA = await promiseA;
  assert.equal(outA.output.state, 'ok');
  const retry = await app.submitTurn(guestB.token, turn(guestB.context.session_id, '11111111-2222-4333-8444-555555555663'));
  assert.equal(retry.output.state, 'ok', 'the burned-slot bug would have returned session.throttled');
  app.close();
});

test('public-guest paid turns are limited per client per minute', async () => {
  const { app } = testApp({
    WEEKEND_PUBLIC_GUEST: 'true',
    WEEKEND_GUEST_TURNS_PER_MIN: '2',
    WEEKEND_MAX_CALLS_PER_SESSION: '8',
  });
  const clientKey = '203.0.113.60';
  const first = app.createSession('customer', '', { clientKey });
  const second = app.createSession('customer', '', { clientKey });
  await app.submitTurn(first.token, turn(first.context.session_id, '11111111-2222-4333-8444-555555555611'));
  await app.submitTurn(second.token, turn(second.context.session_id, '11111111-2222-4333-8444-555555555612'));
  await assert.rejects(
    () => app.submitTurn(first.token, turn(first.context.session_id, '11111111-2222-4333-8444-555555555613')),
    err => err instanceof AppError && err.status === 429 && err.shape.code === 'BUDGET_EXCEEDED'
      && err.shape.message_key === 'session.throttled' && err.shape.retryable === true,
  );
  const other = app.createSession('customer', '', { clientKey: '203.0.113.61' });
  const allowed = await app.submitTurn(other.token, turn(other.context.session_id, '11111111-2222-4333-8444-555555555614'));
  assert.equal(allowed.output.state, 'ok');
  const owner = app.createSession('owner', OWNER_PASS, { clientKey });
  const ownerTurn = await app.submitTurn(owner.token, turn(owner.context.session_id, '11111111-2222-4333-8444-555555555615'));
  assert.equal(ownerTurn.output.state, 'ok', 'owner turns are not counted in the guest per-minute limit');
  app.close();
});

test('public-guest uploads beyond the daily per-client limit are rejected', () => {
  const { app } = testApp({
    WEEKEND_PUBLIC_GUEST: 'true',
    WEEKEND_PHOTO_ENABLED: 'true',
    WEEKEND_GUEST_UPLOADS_PER_DAY: '3',
  });
  const clientKey = '203.0.113.70';
  const guest = app.createSession('customer', '', { clientKey });
  app.grantConsent(guest.token, 'photo_analysis', 'customer_ui');
  for (let i = 0; i < 3; i += 1) {
    const up = app.registerUpload(guest.token, { byteLength: 12, contentType: 'image/jpeg' });
    assert.match(up.image_ref, /^img_/);
  }
  assert.throws(
    () => app.registerUpload(guest.token, { byteLength: 12, contentType: 'image/jpeg' }),
    err => err instanceof AppError && err.status === 400 && err.shape.code === 'UPLOAD_REJECTED'
      && err.shape.message_key === 'upload.rejected' && err.shape.details.limit === 3,
  );
  const other = app.createSession('customer', '', { clientKey: '203.0.113.71' });
  app.grantConsent(other.token, 'photo_analysis', 'customer_ui');
  const allowed = app.registerUpload(other.token, { byteLength: 12, contentType: 'image/jpeg' });
  assert.match(allowed.image_ref, /^img_/);
  const authenticated = app.createSession('customer', OWNER_PASS, { clientKey });
  app.grantConsent(authenticated.token, 'photo_analysis', 'customer_ui');
  const extra = app.registerUpload(authenticated.token, { byteLength: 12, contentType: 'image/jpeg' });
  assert.match(extra.image_ref, /^img_/, 'an authenticated customer is not under the guest upload quota');
  app.close();
});

test('guest upload quota survives a process restart on the same sqlite file', () => {
  const { app, config } = testApp({
    WEEKEND_PUBLIC_GUEST: 'true',
    WEEKEND_PHOTO_ENABLED: 'true',
    WEEKEND_GUEST_UPLOADS_PER_DAY: '3',
  });
  const clientKey = '203.0.113.72';
  const guest = app.createSession('customer', '', { clientKey });
  app.grantConsent(guest.token, 'photo_analysis', 'customer_ui');
  for (let i = 0; i < 3; i += 1) {
    const up = app.registerUpload(guest.token, { byteLength: 12, contentType: 'image/jpeg' });
    assert.match(up.image_ref, /^img_/);
  }
  app.close();
  const restarted = createApp(config);
  try {
    assert.throws(
      () => restarted.registerUpload(guest.token, { byteLength: 12, contentType: 'image/jpeg' }),
      err => err instanceof AppError && err.status === 400 && err.shape.code === 'UPLOAD_REJECTED'
        && err.shape.message_key === 'upload.rejected' && err.shape.details.limit === 3,
    );
  } finally {
    restarted.close();
  }
});

test('guest upload quota survives photo_analysis withdrawal', () => {
  const { app } = testApp({
    WEEKEND_PUBLIC_GUEST: 'true',
    WEEKEND_PHOTO_ENABLED: 'true',
    WEEKEND_GUEST_UPLOADS_PER_DAY: '3',
  });
  const clientKey = '203.0.113.73';
  const guest = app.createSession('customer', '', { clientKey });
  const receipt = app.grantConsent(guest.token, 'photo_analysis', 'customer_ui');
  for (let i = 0; i < 3; i += 1) {
    const up = app.registerUpload(guest.token, { byteLength: 12, contentType: 'image/jpeg' });
    assert.match(up.image_ref, /^img_/);
  }
  app.revokeConsent(guest.token, receipt.receipt_id);
  assert.equal(app.store.get('SELECT COUNT(*) AS n FROM images').n, 0, 'photo rows are still purged');
  assert.equal(app.store.get('SELECT n FROM guest_upload_quota').n, 3);
  app.grantConsent(guest.token, 'photo_analysis', 'customer_ui');
  assert.throws(
    () => app.registerUpload(guest.token, { byteLength: 12, contentType: 'image/jpeg' }),
    err => err instanceof AppError && err.status === 400 && err.shape.code === 'UPLOAD_REJECTED'
      && err.shape.message_key === 'upload.rejected' && err.shape.details.limit === 3,
  );
  app.close();
});

test('guest vision turns count inside the guest spend share', async () => {
  let calls = 0;
  const costly = (args) => {
    calls += 1;
    const result = runModelTurn(args);
    result.usage.cost_estimate_minor = 400;
    return result;
  };
  const { app } = testApp({
    WEEKEND_PUBLIC_GUEST: 'true',
    WEEKEND_PHOTO_ENABLED: 'true',
    WEEKEND_SPEND_CAP_USD_PER_DAY: '5',
    WEEKEND_OWNER_RESERVED_USD_PER_DAY: '1',
    WEEKEND_MAX_CALLS_PER_SESSION: '8',
  }, { adapter: costly, costCeilingMinor: 400, log() {} });
  const guest = app.createSession('customer', '', { clientKey: '203.0.113.80' });
  await app.submitTurn(guest.token, turn(guest.context.session_id, '11111111-2222-4333-8444-555555555621'));
  assert.equal(calls, 1);
  app.grantConsent(guest.token, 'photo_analysis', 'customer_ui');
  const up = app.registerUpload(guest.token, { byteLength: 12, contentType: 'image/jpeg' });
  await assert.rejects(
    () => app.submitTurn(guest.token, {
      ...turn(guest.context.session_id, '11111111-2222-4333-8444-555555555622'),
      image_ref: up.image_ref,
    }),
    err => err instanceof AppError && err.shape.code === 'BUDGET_EXCEEDED' && err.shape.message_key === 'model.budget_exceeded',
  );
  assert.equal(calls, 1, 'the vision call was not made after the guest share was spent');
  app.close();
});

test('sessions store an HMAC of the client address, never the raw IP', () => {
  const ip = '203.0.113.40';
  const { app, config } = testApp({ WEEKEND_PUBLIC_GUEST: 'true' });
  const guest = app.createSession('customer', '', { clientKey: ip });
  const row = app.store.get('SELECT * FROM sessions WHERE session_id = ?', [guest.context.session_id]);
  assert.equal(row.client_key, hmacClientKey(ip, config.WEEKEND_SESSION_SECRET));
  assert.match(row.client_key, /^[a-f0-9]{64}$/);
  assert.equal(row.client_key.includes(ip), false);
  const dump = JSON.stringify(app.store.all('SELECT session_id, client_key, role FROM sessions'));
  assert.equal(dump.includes(ip), false, 'the raw address does not appear in session rows');
  const owner = app.createSession('owner', OWNER_PASS, { clientKey: '198.51.100.7' });
  const ownerRow = app.store.get('SELECT client_key FROM sessions WHERE session_id = ?', [owner.context.session_id]);
  assert.equal(ownerRow.client_key, hmacClientKey('198.51.100.7', config.WEEKEND_SESSION_SECRET));
  assert.notEqual(
    hmacClientKey(ip, config.WEEKEND_SESSION_SECRET),
    signSession(ip, config.WEEKEND_SESSION_SECRET).split('.')[1],
    'a client-key digest must not equal a session-token signature for the same input',
  );
  app.close();
});

test('idle sweep nulls client_key after expiry plus one UTC day', () => {
  let now = Date.parse('2026-01-01T00:00:00.000Z');
  let tick = null;
  const { app } = testApp({ WEEKEND_PUBLIC_GUEST: 'true' }, {
    clock: () => new Date(now).toISOString(),
    setInterval(fn, ms) {
      assert.equal(ms, RETENTION_SWEEP_INTERVAL_MS);
      tick = fn;
      return { unref() {} };
    },
    clearInterval() {},
  });
  const ip = '203.0.113.99';
  const guest = app.createSession('customer', '', { clientKey: ip });
  const sessionId = guest.context.session_id;
  assert.ok(app.store.get('SELECT client_key FROM sessions WHERE session_id = ?', [sessionId]).client_key);
  tick();
  assert.ok(app.store.get('SELECT client_key FROM sessions WHERE session_id = ?', [sessionId]).client_key, 'live sessions keep the digest');

  now += 8 * 3600000;
  tick();
  assert.ok(app.store.get('SELECT client_key FROM sessions WHERE session_id = ?', [sessionId]).client_key, 'just-expired sessions keep the digest through the upload window');

  now += CLIENT_KEY_RETENTION_MS - 1000;
  tick();
  assert.ok(app.store.get('SELECT client_key FROM sessions WHERE session_id = ?', [sessionId]).client_key);

  now += 2000;
  tick();
  assert.equal(
    app.store.get('SELECT client_key FROM sessions WHERE session_id = ?', [sessionId]).client_key,
    null,
  );
  const dump = JSON.stringify(app.store.all('SELECT * FROM sessions'));
  assert.equal(dump.includes(ip), false);
  app.close();
});
