import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, createApp } from '../../src/server/app.mjs';
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
      && err.shape.message_key === 'model.guest_turn_limit' && err.shape.retryable === true,
  );
  const other = app.createSession('customer', '', { clientKey: '203.0.113.61' });
  const allowed = await app.submitTurn(other.token, turn(other.context.session_id, '11111111-2222-4333-8444-555555555614'));
  assert.equal(allowed.output.state, 'ok');
  const owner = app.createSession('owner', OWNER_PASS, { clientKey });
  const ownerTurn = await app.submitTurn(owner.token, turn(owner.context.session_id, '11111111-2222-4333-8444-555555555615'));
  assert.equal(ownerTurn.output.state, 'ok', 'owner turns are not counted in the guest per-minute limit');
  app.close();
});
