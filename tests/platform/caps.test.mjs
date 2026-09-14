import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/server/app.mjs';
import { runModelTurn } from '../../src/integrations/internal/model-adapter.mjs';
import { OWNER_PASS, testApp } from './helpers.mjs';

const turn = (sessionId, turnId = '11111111-2222-4333-8444-555555555555') => ({
  contract_version: '0.1.0',
  session_id: sessionId,
  turn_id: turnId,
  text: 'أبغى قصة',
  image_ref: null,
  client_action_id: null,
  locale_hint: 'ar',
});

test('adapter timeout is TIMEOUT and records usage outcome timeout', async () => {
  const { app } = testApp({ WEEKEND_REQUEST_TIMEOUT_MS: '40' }, {
    adapter: () => new Promise(() => {}),
  });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  await assert.rejects(
    () => app.submitTurn(token, turn(context.session_id)),
    err => err instanceof AppError && err.shape.code === 'TIMEOUT' && err.shape.retryable === true,
  );
  const row = app.store.get('SELECT * FROM usage_records WHERE session_id = ?', [context.session_id]);
  assert.equal(row.outcome, 'timeout');
  app.close();
});

test('daily spend cap uses cost_estimate_minor', async () => {
  const costly = ({ context, input, now }) => {
    const result = runModelTurn({ context, input, now });
    result.usage.cost_estimate_minor = 100;
    return result;
  };
  const { app } = testApp({ WEEKEND_SPEND_CAP_USD_PER_DAY: '1' }, { adapter: costly });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const first = await app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555551'));
  assert.equal(first.output.state, 'ok');
  const spend = app.store.get('SELECT * FROM daily_spend');
  assert.equal(spend.cost_minor, 100);
  await assert.rejects(
    () => app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555552')),
    err => err instanceof AppError && err.shape.code === 'BUDGET_EXCEEDED',
  );
  app.close();
});

test('a turn whose cost ceiling does not fit under the daily cap is refused before the model is called', async () => {
  let calls = 0;
  const costly = ({ context, input, now }) => {
    calls += 1;
    const result = runModelTurn({ context, input, now });
    result.usage.cost_estimate_minor = 150;
    return result;
  };
  const { app } = testApp({ WEEKEND_SPEND_CAP_USD_PER_DAY: '1' }, { adapter: costly, costCeilingMinor: 150 });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  await assert.rejects(
    () => app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555553')),
    err => err instanceof AppError && err.shape.code === 'BUDGET_EXCEEDED',
  );
  assert.equal(calls, 0, 'no paid call was made');
  const spend = app.store.get('SELECT * FROM daily_spend');
  assert.equal(spend.cost_minor, 0);
  assert.equal(app.store.get('SELECT COUNT(*) AS n FROM usage_records').n, 0);
  app.close();
});

const slowCostly = (costMinor, calls) => async ({ context, input, now }) => {
  calls.n += 1;
  await new Promise((resolve) => setTimeout(resolve, 30));
  const result = runModelTurn({ context, input, now });
  result.usage.cost_estimate_minor = costMinor;
  return result;
};

test('two concurrent turns cannot both pass the daily cap: the ceiling is reserved before the call', async () => {
  const calls = { n: 0 };
  const { app } = testApp({ WEEKEND_SPEND_CAP_USD_PER_DAY: '1' }, { adapter: slowCostly(60, calls), costCeilingMinor: 60 });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const results = await Promise.allSettled([
    app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555561')),
    app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555562')),
  ]);
  const ok = results.filter((r) => r.status === 'fulfilled');
  const refused = results.filter((r) => r.status === 'rejected');
  assert.equal(ok.length, 1);
  assert.equal(refused.length, 1);
  assert.equal(refused[0].reason.shape.code, 'BUDGET_EXCEEDED');
  assert.equal(calls.n, 1, 'only the admitted turn reached the model');
  const spend = app.store.get('SELECT * FROM daily_spend');
  assert.equal(spend.cost_minor, 60, 'the reservation was replaced by the real cost');
  assert.equal(spend.calls, 1);
  assert.equal(app.store.get('SELECT COUNT(*) AS n FROM usage_records').n, 1);
  app.close();
});

test('a real cost above its reservation is still recorded, and the next turn is refused', async () => {
  const calls = { n: 0 };
  const { app } = testApp({ WEEKEND_SPEND_CAP_USD_PER_DAY: '1' }, { adapter: slowCostly(150, calls), costCeilingMinor: 10 });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const first = await app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555571'));
  assert.equal(first.output.state, 'ok', 'the customer keeps the reply that was already paid for');
  assert.equal(app.store.get('SELECT * FROM daily_spend').cost_minor, 150, 'the ledger never under-counts');
  await assert.rejects(
    () => app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555572')),
    err => err instanceof AppError && err.shape.code === 'BUDGET_EXCEEDED',
  );
  assert.equal(calls.n, 1);
  app.close();
});

test('the session call cap counts turns still in flight', async () => {
  const calls = { n: 0 };
  const { app } = testApp({ WEEKEND_MAX_CALLS_PER_SESSION: '1' }, { adapter: slowCostly(1, calls) });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const results = await Promise.allSettled([
    app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555581')),
    app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555582')),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const refused = results.find((r) => r.status === 'rejected');
  assert.equal(refused.reason.shape.message_key, 'model.session_cap');
  assert.equal(calls.n, 1);
  app.close();
});

test('a timed-out or failed call releases its reservation', async () => {
  const { app } = testApp({ WEEKEND_REQUEST_TIMEOUT_MS: '40', WEEKEND_SPEND_CAP_USD_PER_DAY: '1' }, {
    adapter: () => new Promise(() => {}),
    costCeilingMinor: 90,
  });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  await assert.rejects(() => app.submitTurn(token, turn(context.session_id)), err => err.shape.code === 'TIMEOUT');
  const spend = app.store.get('SELECT * FROM daily_spend');
  assert.equal(spend.cost_minor, 0, 'the ceiling was released');
  assert.equal(spend.calls, 1, 'the attempt stays counted');
  const failing = testApp({ WEEKEND_SPEND_CAP_USD_PER_DAY: '1' }, { adapter: () => { throw new Error('provider down'); }, costCeilingMinor: 90 });
  const s2 = failing.app.createSession('customer', OWNER_PASS);
  await assert.rejects(() => failing.app.submitTurn(s2.token, turn(s2.context.session_id)), /provider down/);
  assert.equal(failing.app.store.get('SELECT * FROM daily_spend').cost_minor, 0);
  failing.app.close();
  app.close();
});
