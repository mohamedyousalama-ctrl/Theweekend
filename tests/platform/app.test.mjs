import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, createApp } from '../../src/server/app.mjs';
import { loadConfig } from '../../src/server/config.mjs';
import { OWNER_PASS, STAFF_PASS, testApp, testEnv } from './helpers.mjs';

const turn = (sessionId, text = 'أبغى قصة') => ({
  contract_version: '0.1.0',
  session_id: sessionId,
  turn_id: '11111111-2222-4333-8444-555555555555',
  text,
  image_ref: null,
  client_action_id: null,
  locale_hint: 'ar',
});

test('owner-review never exposes a mock model capability', () => {
  const { app } = testApp({ WEEKEND_ENV: 'owner-review', WEEKEND_MODEL_MODE: 'real' });
  const { token } = app.createSession('customer', OWNER_PASS);
  const ctx = app.context(token);
  assert.equal(ctx.capabilities.model, 'unavailable');
  const health = app.health();
  assert.equal(health.model, 'unavailable');
  app.close();
});

test('forged session is unauthorized', () => {
  const { app } = testApp();
  assert.throws(() => app.context('ses_forged.00'), err => err instanceof AppError && err.shape.code === 'UNAUTHORIZED');
  app.close();
});

test('official booking click is EXTERNAL_HANDOFF, never confirmed', () => {
  const { app, config } = testApp();
  const { token } = app.createSession('customer', OWNER_PASS);
  const action = app.issueBookingAction(token);
  assert.equal(action.kind, 'open_official_booking');
  assert.equal(action.url, config.WEEKEND_OFFICIAL_BOOKING_URL);
  const result = app.executeAction(token, action.action_id);
  assert.equal(result.outcome, 'external_handoff');
  assert.notEqual(result.outcome, 'done');
  assert.ok(!JSON.stringify(result).toLowerCase().includes('confirm'));
  app.close();
});

test('replayed action is stale and not a success', () => {
  const { app } = testApp();
  const { token } = app.createSession('customer', OWNER_PASS);
  const action = app.issueBookingAction(token);
  assert.equal(app.executeAction(token, action.action_id).outcome, 'external_handoff');
  assert.equal(app.executeAction(token, action.action_id).outcome, 'stale');
  app.close();
});

test('expired action cannot succeed', () => {
  let now = Date.parse('2026-09-14T10:00:00.000Z');
  const { app } = testApp({}, { clock: () => new Date(now).toISOString() });
  const { token } = app.createSession('customer', OWNER_PASS);
  const action = app.issueBookingAction(token);
  now += 2 * 3600000;
  assert.equal(app.executeAction(token, action.action_id).outcome, 'expired');
  app.close();
});

test('cross-subject action is concealed', () => {
  const { app } = testApp();
  const a = app.createSession('customer', OWNER_PASS);
  const b = app.createSession('customer', OWNER_PASS);
  const action = app.issueBookingAction(a.token);
  assert.throws(
    () => app.executeAction(b.token, action.action_id),
    err => err instanceof AppError && err.shape.code === 'NOT_FOUND',
  );
  app.close();
});

test('preferences persist across store reopen and stay isolated', () => {
  const env = testEnv();
  const first = createApp(loadConfig(env));
  const a = first.createSession('customer', OWNER_PASS);
  first.grantConsent(a.token, 'text_preferences', 'customer_ui');
  const saved = first.savePreference(a.token, { kind: 'style', value_text: 'قصة قصيرة', source: 'customer_typed' });
  first.close();

  const second = createApp(loadConfig(env));
  const listed = second.listPreferences(a.token);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].preference_id, saved.preference_id);
  assert.equal(listed[0].provenance, 'approved_preference');
  const other = second.createSession('customer', OWNER_PASS);
  assert.equal(second.listPreferences(other.token).length, 0);
  second.close();
});

test('preference version conflict is CONFLICT', () => {
  const { app } = testApp();
  const { token } = app.createSession('customer', OWNER_PASS);
  app.grantConsent(token, 'text_preferences', 'customer_ui');
  app.savePreference(token, { kind: 'note', value_text: 'واحد', source: 'customer_typed' });
  assert.throws(
    () => app.savePreference(token, { kind: 'note', value_text: 'اثنين', source: 'customer_typed', version: 99 }),
    err => err instanceof AppError && err.shape.code === 'CONFLICT',
  );
  app.close();
});

test('photo upload requires consent and stays off without it', () => {
  const { app } = testApp({ WEEKEND_PHOTO_ENABLED: 'true' });
  const { token } = app.createSession('customer', OWNER_PASS);
  assert.throws(
    () => app.registerUpload(token, { byteLength: 12, contentType: 'image/jpeg' }),
    err => err instanceof AppError && err.shape.code === 'CONSENT_REQUIRED',
  );
  const receipt = app.grantConsent(token, 'photo_analysis', 'customer_ui');
  const up = app.registerUpload(token, { byteLength: 12, contentType: 'image/jpeg' });
  assert.match(up.image_ref, /^img_/);
  app.revokeConsent(token, receipt.receipt_id);
  assert.throws(
    () => app.registerUpload(token, { byteLength: 12, contentType: 'image/jpeg' }),
    err => err instanceof AppError && err.shape.code === 'CONSENT_REQUIRED',
  );
  app.close();
});

test('oversized upload is rejected', () => {
  const { app } = testApp({ WEEKEND_PHOTO_ENABLED: 'true', WEEKEND_UPLOAD_MAX_BYTES: '16' });
  const { token } = app.createSession('customer', OWNER_PASS);
  app.grantConsent(token, 'photo_analysis', 'customer_ui');
  assert.throws(
    () => app.registerUpload(token, { byteLength: 64, contentType: 'image/png' }),
    err => err instanceof AppError && err.shape.code === 'UPLOAD_REJECTED',
  );
  app.close();
});

test('staff sees customer brief; other customer does not', () => {
  const { app } = testApp();
  const customer = app.createSession('customer', OWNER_PASS);
  const other = app.createSession('customer', OWNER_PASS);
  const staff = app.createSession('staff', STAFF_PASS);
  const brief = app.createBrief(customer.token, { text_ar: 'قصة قصيرة من الجوانب', do_not: [] });
  assert.throws(() => app.staffBriefs(other.token), err => err instanceof AppError && err.shape.code === 'UNAUTHORIZED');
  const inbox = app.staffBriefs(staff.token);
  assert.equal(inbox.some(b => b.brief_id === brief.brief_id), true);
  const ack = app.acknowledgeBrief(staff.token, brief.brief_id);
  assert.ok(ack.acknowledged_at);
  assert.equal(ack.brief_id, brief.brief_id);
  app.close();
});

test('local mock turn is labeled unavailable-or-ok but never a booking confirmation', () => {
  const { app } = testApp();
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const out = app.submitTurn(token, turn(context.session_id));
  assert.equal(out.output.state, 'ok');
  assert.match(out.output.messages[0].text, /للاختبار فقط/);
  assert.ok(out.allowed_actions.some(a => a.kind === 'open_official_booking'));
  app.close();
});

test('wrong staff passcode fails', () => {
  const { app } = testApp();
  assert.throws(
    () => app.createSession('staff', 'nope'),
    err => err instanceof AppError && err.shape.code === 'UNAUTHORIZED',
  );
  app.close();
});
