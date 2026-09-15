import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, STAFF_HANDOFF_RECEIVED_TTL_MS } from '../../src/server/app.mjs';
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

async function queuedHandoff(app, customerToken, sessionId, turnId) {
  const first = await app.submitTurn(customerToken, turn(sessionId, turnId));
  const talk = first.allowed_actions.find((a) => a.kind === 'talk_to_staff');
  assert.ok(talk);
  assert.equal(app.executeAction(customerToken, talk.action_id).outcome, 'pending');
  return app.store.get(
    'SELECT * FROM staff_handoffs WHERE session_id = ? ORDER BY received_at DESC LIMIT 1',
    [sessionId],
  );
}

test('staff accept claims received, assigns, and still pauses the model', async () => {
  let calls = 0;
  const adapter = ({ context, input, now: at }) => {
    calls += 1;
    return runModelTurn({ context, input, now: at });
  };
  const { app } = testApp({}, { adapter });
  const customer = app.createSession('customer', OWNER_PASS);
  const staff = app.createSession('staff', STAFF_PASS);
  const row = await queuedHandoff(
    app,
    customer.token,
    customer.context.session_id,
    '11111111-2222-4333-8444-555555555811',
  );
  assert.equal(row.status, 'received');
  assert.equal(row.accepted_at, null);

  assert.throws(
    () => app.staffHandoffs(customer.token),
    (err) => err instanceof AppError && err.shape.code === 'UNAUTHORIZED',
  );
  assert.throws(
    () => app.acceptStaffHandoff(customer.token, row.handoff_id),
    (err) => err instanceof AppError && err.shape.code === 'UNAUTHORIZED',
  );

  const listed = app.staffHandoffs(staff.token);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].handoff_id, row.handoff_id);
  assert.equal(listed[0].status, 'received');

  const accepted = app.acceptStaffHandoff(staff.token, row.handoff_id);
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.accepted_by, staff.context.subject_id);
  assert.ok(accepted.accepted_at);
  assert.equal(accepted.assigned_at, accepted.accepted_at);
  assert.equal(app.acceptStaffHandoff(staff.token, row.handoff_id).accepted_at, accepted.accepted_at);

  await assert.rejects(
    () => app.submitTurn(customer.token, turn(customer.context.session_id, '11111111-2222-4333-8444-555555555812')),
    (err) => err instanceof AppError
      && err.shape.code === 'CAPABILITY_UNAVAILABLE'
      && err.shape.message_key === 'handoff.queued',
  );
  assert.equal(calls, 1);
  app.close();
});

test('another staff session cannot steal an accepted handoff', async () => {
  const { app } = testApp();
  const customer = app.createSession('customer', OWNER_PASS);
  const staff = app.createSession('staff', STAFF_PASS);
  const other = app.createSession('staff', STAFF_PASS);
  const row = await queuedHandoff(
    app,
    customer.token,
    customer.context.session_id,
    '11111111-2222-4333-8444-555555555813',
  );
  app.acceptStaffHandoff(staff.token, row.handoff_id);
  assert.throws(
    () => app.acceptStaffHandoff(other.token, row.handoff_id),
    (err) => err instanceof AppError
      && err.shape.code === 'CONFLICT'
      && err.shape.message_key === 'handoff.accepted',
  );
  const stored = app.store.get('SELECT accepted_by, status FROM staff_handoffs WHERE handoff_id = ?', [row.handoff_id]);
  assert.equal(stored.status, 'accepted');
  assert.equal(stored.accepted_by, staff.context.subject_id);
  app.close();
});

test('staff release unpauses the model; timeout cannot be accepted', async () => {
  let now = Date.parse('2026-09-14T10:00:00.000Z');
  let calls = 0;
  const adapter = ({ context, input, now: at }) => {
    calls += 1;
    return runModelTurn({ context, input, now: at });
  };
  const { app } = testApp({}, { adapter, clock: () => new Date(now).toISOString() });
  const customer = app.createSession('customer', OWNER_PASS);
  const staff = app.createSession('staff', STAFF_PASS);
  const row = await queuedHandoff(
    app,
    customer.token,
    customer.context.session_id,
    '11111111-2222-4333-8444-555555555814',
  );
  const accepted = app.acceptStaffHandoff(staff.token, row.handoff_id);
  now += STAFF_HANDOFF_RECEIVED_TTL_MS + 1;
  app.store.run(
    'UPDATE sessions SET expires_at = ? WHERE session_id = ?',
    [new Date(now + 8 * 3600000).toISOString(), customer.context.session_id],
  );
  await assert.rejects(
    () => app.submitTurn(customer.token, turn(customer.context.session_id, '11111111-2222-4333-8444-555555555815')),
    (err) => err instanceof AppError && err.shape.message_key === 'handoff.queued',
  );
  assert.equal(app.store.get('SELECT status FROM staff_handoffs WHERE handoff_id = ?', [row.handoff_id]).status, 'accepted');
  assert.equal(calls, 1);

  const released = app.releaseStaffHandoff(staff.token, accepted.handoff_id);
  assert.equal(released.status, 'released');
  assert.ok(released.released_at);
  assert.equal(app.staffHandoffs(staff.token).length, 0);
  assert.equal(app.releaseStaffHandoff(staff.token, accepted.handoff_id).status, 'released');

  const resumed = await app.submitTurn(customer.token, turn(customer.context.session_id, '11111111-2222-4333-8444-555555555816'));
  assert.equal(resumed.output.state, 'ok');
  assert.equal(calls, 2);

  const late = await queuedHandoff(
    app,
    customer.token,
    customer.context.session_id,
    '11111111-2222-4333-8444-555555555817',
  );
  now += STAFF_HANDOFF_RECEIVED_TTL_MS + 1;
  app.store.run(
    'UPDATE sessions SET expires_at = ? WHERE session_id = ?',
    [new Date(now + 8 * 3600000).toISOString(), customer.context.session_id],
  );
  assert.throws(
    () => app.acceptStaffHandoff(staff.token, late.handoff_id),
    (err) => err instanceof AppError
      && err.shape.code === 'NOT_FOUND'
      && err.shape.message_key === 'handoff.not_found',
  );
  const timed = app.store.get('SELECT status, accepted_at FROM staff_handoffs WHERE handoff_id = ?', [late.handoff_id]);
  assert.equal(timed.status, 'timeout');
  assert.equal(timed.accepted_at, null);
  assert.throws(
    () => app.releaseStaffHandoff(staff.token, late.handoff_id),
    (err) => err instanceof AppError && err.shape.message_key === 'handoff.not_found',
  );
  app.close();
});
