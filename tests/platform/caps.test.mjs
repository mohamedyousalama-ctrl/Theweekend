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
