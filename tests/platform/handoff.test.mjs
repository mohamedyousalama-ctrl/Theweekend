import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, STAFF_HANDOFF_RECEIVED_TTL_MS } from '../../src/server/app.mjs';
import { runModelTurn } from '../../src/integrations/internal/model-adapter.mjs';
import { OWNER_PASS, testApp } from './helpers.mjs';

const turn = (sessionId, turnId) => ({
  contract_version: '0.1.0',
  session_id: sessionId,
  turn_id: turnId,
  text: 'أبغى قصة',
  image_ref: null,
  client_action_id: null,
  locale_hint: 'ar',
});

test('talk_to_staff records received and never marks accepted', async () => {
  const { app } = testApp();
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const first = await app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555801'));
  const talk = first.allowed_actions.find((a) => a.kind === 'talk_to_staff');
  assert.ok(talk);
  const result = app.executeAction(token, talk.action_id);
  assert.equal(result.outcome, 'pending');
  assert.equal(result.message_key, 'handoff.queued');
  const row = app.store.get(
    'SELECT * FROM staff_handoffs WHERE session_id = ?',
    [context.session_id],
  );
  assert.equal(row.status, 'received');
  assert.equal(row.accepted_at, null);
  assert.equal(row.accepted_by, null);
  app.close();
});

test('model turns pause after talk_to_staff until the received handoff times out', async () => {
  let now = Date.parse('2026-09-14T10:00:00.000Z');
  let calls = 0;
  const adapter = ({ context, input, now: at }) => {
    calls += 1;
    return runModelTurn({ context, input, now: at });
  };
  const { app } = testApp({}, { adapter, clock: () => new Date(now).toISOString() });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const first = await app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555802'));
  assert.equal(calls, 1);
  const talk = first.allowed_actions.find((a) => a.kind === 'talk_to_staff');
  assert.equal(app.executeAction(token, talk.action_id).outcome, 'pending');

  await assert.rejects(
    () => app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555803')),
    (err) => err instanceof AppError
      && err.shape.code === 'CAPABILITY_UNAVAILABLE'
      && err.shape.message_key === 'handoff.queued',
  );
  assert.equal(calls, 1);
  assert.equal(app.store.get('SELECT COUNT(*) AS n FROM usage_records WHERE session_id = ?', [context.session_id]).n, 1);

  now += STAFF_HANDOFF_RECEIVED_TTL_MS + 1;
  app.store.run(
    'UPDATE sessions SET expires_at = ? WHERE session_id = ?',
    [new Date(now + 8 * 3600000).toISOString(), context.session_id],
  );
  const resumed = await app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555804'));
  assert.equal(resumed.output.state, 'ok');
  assert.equal(calls, 2);
  const timed = app.store.get(
    'SELECT status, accepted_at FROM staff_handoffs WHERE session_id = ?',
    [context.session_id],
  );
  assert.equal(timed.status, 'timeout');
  assert.equal(timed.accepted_at, null);
  app.close();
});

test('booking click still runs while a staff handoff is received', async () => {
  const { app } = testApp();
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const first = await app.submitTurn(token, turn(context.session_id, '11111111-2222-4333-8444-555555555805'));
  const talk = first.allowed_actions.find((a) => a.kind === 'talk_to_staff');
  assert.equal(app.executeAction(token, talk.action_id).outcome, 'pending');
  const booking = app.issueBookingAction(token);
  assert.equal(app.executeAction(token, booking.action_id).outcome, 'external_handoff');
  app.close();
});
