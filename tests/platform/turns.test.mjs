import test from 'node:test';
import assert from 'node:assert/strict';
import { runModelTurn } from '../../src/integrations/internal/model-adapter.mjs';
import { OWNER_PASS, testApp } from './helpers.mjs';

const turn = (sessionId, turnId = '11111111-2222-4333-8444-555555555701') => ({
  contract_version: '0.1.0',
  session_id: sessionId,
  turn_id: turnId,
  text: 'أبغى قصة',
  image_ref: null,
  client_action_id: null,
  locale_hint: 'ar',
});

test('a retried turn_id replays the stored response and does not call the model again', async () => {
  let calls = 0;
  const adapter = ({ context, input, now }) => {
    calls += 1;
    return runModelTurn({ context, input, now });
  };
  const { app } = testApp({}, { adapter });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const first = await app.submitTurn(token, turn(context.session_id));
  const second = await app.submitTurn(token, turn(context.session_id));
  assert.equal(calls, 1);
  assert.equal(second.output.turn_id, first.output.turn_id);
  assert.deepEqual(second.output.messages, first.output.messages);
  assert.equal(app.store.get('SELECT COUNT(*) AS n FROM usage_records WHERE session_id = ?', [context.session_id]).n, 1);
  app.close();
});

test('a concurrent duplicate turn_id observes the original in-flight call', async () => {
  let calls = 0;
  const adapter = async ({ context, input, now }) => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 40));
    return runModelTurn({ context, input, now });
  };
  const { app } = testApp({}, { adapter });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const id = '11111111-2222-4333-8444-555555555702';
  const results = await Promise.all([
    app.submitTurn(token, turn(context.session_id, id)),
    app.submitTurn(token, turn(context.session_id, id)),
  ]);
  assert.equal(calls, 1);
  assert.equal(results[0].output.usage_ref, results[1].output.usage_ref);
  assert.equal(app.store.get('SELECT COUNT(*) AS n FROM usage_records WHERE session_id = ?', [context.session_id]).n, 1);
  app.close();
});
