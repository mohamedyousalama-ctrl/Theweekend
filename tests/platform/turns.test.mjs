import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/server/app.mjs';
import { loadConfig } from '../../src/server/config.mjs';
import { runModelTurn } from '../../src/integrations/internal/model-adapter.mjs';
import { OWNER_PASS, testApp, testEnv } from './helpers.mjs';

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

test('a pending turn abandoned across restart is reclaimed; complete still replays', async () => {
  let calls = 0;
  const adapter = ({ context, input, now }) => {
    calls += 1;
    return runModelTurn({ context, input, now });
  };
  const env = testEnv();
  const config = loadConfig(env);
  const first = createApp(config, { adapter });
  const { token, context } = first.createSession('customer', OWNER_PASS);
  const turnId = '11111111-2222-4333-8444-555555555703';
  first.store.run(
    `INSERT INTO turns (session_id, turn_id, status, response_json, created_at)
     VALUES (?, ?, 'pending', NULL, ?)`,
    [context.session_id, turnId, new Date().toISOString()],
  );
  first.close();

  const second = createApp(config, { adapter });
  const abandoned = second.store.get(
    'SELECT status FROM turns WHERE session_id = ? AND turn_id = ?',
    [context.session_id, turnId],
  );
  assert.equal(abandoned.status, 'failed');
  const out = await second.submitTurn(token, turn(context.session_id, turnId));
  assert.equal(out.output.state, 'ok');
  assert.equal(calls, 1);
  const replay = await second.submitTurn(token, turn(context.session_id, turnId));
  assert.equal(calls, 1);
  assert.equal(replay.output.usage_ref, out.output.usage_ref);
  second.close();
});

test('a consent-blocked turn can retry the same turn_id after the receipt exists', async () => {
  const { app } = testApp();
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const brief = app.createBrief(token, { text_ar: 'موجز للمشاركة', do_not: [] });
  const share = app.issueShareActionsForBrief(token, brief.brief_id)
    .allowed_actions.find((a) => a.kind === 'share_brief_text');
  const input = turn(context.session_id, '11111111-2222-4333-8444-555555555704');
  input.text = '';
  input.client_action_id = share.action_id;
  await assert.rejects(
    () => app.submitTurn(token, input),
    (err) => err.shape?.code === 'CONSENT_REQUIRED',
  );
  const row = app.store.get(
    'SELECT status FROM turns WHERE session_id = ? AND turn_id = ?',
    [context.session_id, input.turn_id],
  );
  assert.equal(row.status, 'failed');
  app.grantConsent(token, 'staff_sharing_text', 'customer_ui');
  const out = await app.submitTurn(token, input);
  assert.equal(out.action_result.outcome, 'done');
  app.close();
});
