import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, costCeilingFor } from '../../src/server/app.mjs';
import { runModelTurn } from '../../src/integrations/internal/model-adapter.mjs';
import { OWNER_PASS, testApp, testEnv } from './helpers.mjs';
import { loadConfig } from '../../src/server/config.mjs';

const turn = (sessionId, turnId = '11111111-2222-4333-8444-555555555555') => ({
  contract_version: '0.1.0',
  session_id: sessionId,
  turn_id: turnId,
  text: 'أبغى قصة',
  image_ref: null,
  client_action_id: null,
  locale_hint: 'ar',
});

test('turn abort passes a signal and persists adapter timeout usage when it settles', async () => {
  const { app } = testApp({ WEEKEND_REQUEST_TIMEOUT_MS: '40' }, {
    adapter: ({ context, input, now, signal }) => new Promise((resolve) => {
      if (!signal) throw new Error('missing abort signal');
      signal.addEventListener('abort', () => {
        resolve({
          usage: {
            contract_version: '0.1.0',
            usage_id: 'use_adapter_timeout01',
            session_id: context.session_id,
            turn_id: input.turn_id,
            provider: 'anthropic',
            model_id: 'claude-opus-5',
            prompt_version: 'rakan.system.v0.5',
            input_tokens: 12,
            output_tokens: 0,
            latency_ms: 40,
            cost_estimate_minor: 1,
            outcome: 'timeout',
            created_at: now,
          },
          output: null,
        });
      });
    }),
  });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  await assert.rejects(
    () => app.submitTurn(token, turn(context.session_id)),
    err => err instanceof AppError && err.shape.code === 'TIMEOUT',
  );
  const row = app.store.get('SELECT * FROM usage_records WHERE session_id = ?', [context.session_id]);
  assert.equal(row.outcome, 'timeout');
  assert.equal(row.provider, 'anthropic');
  assert.equal(row.usage_id, 'use_adapter_timeout01');
  assert.equal(row.input_tokens, 12);
  app.close();
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
  const { app } = testApp({ WEEKEND_SPEND_CAP_USD_PER_DAY: '1' }, { adapter: costly, costCeilingMinor: 50 });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const today = new Date().toISOString().slice(0, 10);
  app.store.run('INSERT INTO daily_spend (day, calls, cost_minor) VALUES (?, 3, 90)', [today]); // 90 of 100 cents already spent
  await assert.rejects(
    () => app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555553')),
    err => err instanceof AppError && err.shape.code === 'BUDGET_EXCEEDED',
  );
  assert.equal(calls, 0, 'no paid call was made');
  const spend = app.store.get('SELECT * FROM daily_spend');
  assert.equal(spend.cost_minor, 90, 'nothing was reserved');
  assert.equal(spend.calls, 3);
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

test('costCeilingFor: explicit dep, the adapter declaration, the tenth-of-cap fallback, mock mode, clamped to the cap', () => {
  const real = loadConfig(testEnv({ WEEKEND_ENV: 'owner-review', WEEKEND_MODEL_MODE: 'real', WEEKEND_SPEND_CAP_USD_PER_DAY: '5' }));
  const mock = loadConfig(testEnv());
  const declared = async () => ({});
  declared.costCeilingMinor = 86;
  const plain = async () => ({});
  assert.equal(costCeilingFor(real, { adapter: declared, costCeilingMinor: 40 }), 40, 'an explicit ceiling wins');
  assert.equal(costCeilingFor(real, { adapter: declared }), 86, 'the adapter declares its own');
  assert.equal(costCeilingFor(real, { adapter: plain }), 50, 'a tenth of a 500-cent cap');
  assert.equal(costCeilingFor(mock, { adapter: plain }), 0, 'no reservation without a real adapter');
  assert.equal(costCeilingFor(mock, {}), 0);
  const tiny = loadConfig(testEnv({ WEEKEND_ENV: 'owner-review', WEEKEND_MODEL_MODE: 'real', WEEKEND_SPEND_CAP_USD_PER_DAY: '1' }));
  assert.equal(costCeilingFor(tiny, { adapter: declared }), 86, 'fits under a 100-cent cap');
  declared.costCeilingMinor = 5000;
  assert.equal(costCeilingFor(tiny, { adapter: declared }), 100, 'a ceiling above the cap is clamped so the day is not refused outright');
  for (const bad of [0, -5, 1.5, '10', null, NaN]) assert.equal(costCeilingFor(real, { adapter: plain, costCeilingMinor: bad }), 50, `invalid explicit value ${bad} falls back`);
});

test('timeout adapter cost reaches the daily ledger', async () => {
  const { app } = testApp({ WEEKEND_REQUEST_TIMEOUT_MS: '40', WEEKEND_SPEND_CAP_USD_PER_DAY: '5' }, {
    adapter: ({ context, input, now, signal }) => new Promise((resolve) => {
      if (!signal) throw new Error('missing abort signal');
      signal.addEventListener('abort', () => {
        resolve({
          usage: {
            contract_version: '0.1.0',
            usage_id: 'use_timeout_cost150',
            session_id: context.session_id,
            turn_id: input.turn_id,
            provider: 'anthropic',
            model_id: 'claude-opus-5',
            prompt_version: 'rakan.system.v0.5',
            input_tokens: 12,
            output_tokens: 0,
            latency_ms: 40,
            cost_estimate_minor: 150,
            outcome: 'timeout',
            created_at: now,
          },
          output: null,
        });
      });
    }),
    costCeilingMinor: 90,
  });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  await assert.rejects(
    () => app.submitTurn(token, turn(context.session_id)),
    err => err instanceof AppError && err.shape.code === 'TIMEOUT',
  );
  const spend = app.store.get('SELECT * FROM daily_spend');
  assert.equal(spend.cost_minor, 150);
  const row = app.store.get('SELECT * FROM usage_records WHERE session_id = ?', [context.session_id]);
  assert.equal(row.cost_estimate_minor, 150);
  assert.equal(row.usage_id, 'use_timeout_cost150');
  app.close();
});

test('malformed ChatTurnOutput still settles the adapter usage cost', async () => {
  const { app } = testApp({ WEEKEND_SPEND_CAP_USD_PER_DAY: '5' }, {
    adapter: ({ context, input, now }) => ({
      usage: {
        contract_version: '0.1.0',
        usage_id: 'use_malformed_cost150',
        session_id: context.session_id,
        turn_id: input.turn_id,
        provider: 'anthropic',
        model_id: 'claude-opus-5',
        prompt_version: 'rakan.system.v0.5',
        input_tokens: 20,
        output_tokens: 8,
        latency_ms: 12,
        cost_estimate_minor: 150,
        outcome: 'ok',
        created_at: now,
      },
      output: { contract_version: '0.1.0', turn_id: 'not-a-uuid' },
    }),
    costCeilingMinor: 90,
  });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  await assert.rejects(
    () => app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555593')),
    err => !(err instanceof AppError),
  );
  const spend = app.store.get('SELECT * FROM daily_spend');
  assert.equal(spend.cost_minor, 150);
  const row = app.store.get('SELECT * FROM usage_records WHERE session_id = ?', [context.session_id]);
  assert.equal(row.cost_estimate_minor, 150);
  assert.equal(row.usage_id, 'use_malformed_cost150');
  app.close();
});

test('a malformed adapter output releases the reservation and frees the session slot', async () => {
  let calls = 0;
  const broken = async () => {
    calls += 1;
    if (calls === 1) return { output: { contract_version: '0.1.0', turn_id: 'not-a-uuid' }, usage: null };
    return runModelTurn({ context: {}, input: turn('x'), now: new Date().toISOString() });
  };
  const { app } = testApp({ WEEKEND_SPEND_CAP_USD_PER_DAY: '1', WEEKEND_MAX_CALLS_PER_SESSION: '2' }, { adapter: broken, costCeilingMinor: 100 });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  await assert.rejects(() => app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555591')), (err) => !(err instanceof AppError));
  const spend = app.store.get('SELECT * FROM daily_spend');
  assert.equal(spend.cost_minor, 0, 'the whole-cap reservation was released');
  assert.equal(spend.calls, 1);
  assert.equal(app.store.get('SELECT COUNT(*) AS n FROM usage_records').n, 0);
  await assert.rejects(() => app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555592')), (err) => err instanceof AppError && err.shape.code === 'BUDGET_EXCEEDED' || !(err instanceof AppError));
  app.close();
});
