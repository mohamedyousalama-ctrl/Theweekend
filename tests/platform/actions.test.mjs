import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/server/app.mjs';
import { OWNER_PASS, testApp } from './helpers.mjs';

test('save preference action writes and then lists', () => {
  const { app } = testApp();
  const { token } = app.createSession('customer', OWNER_PASS);
  app.grantConsent(token, 'text_preferences', 'customer_ui');
  const action = app.issueSavePreferenceAction(token, {
    preference_kind: 'style',
    value_text: 'قصة قصيرة',
  });
  assert.match(action.bound.object_id, /^prf_/);
  assert.equal(action.bound.object_version, 1);
  assert.equal(app.listPreferences(token).length, 0, 'a proposal is not a saved preference');
  const result = app.executeAction(token, action.action_id);
  assert.equal(result.outcome, 'done');
  const listed = app.listPreferences(token);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].preference_id, action.bound.object_id);
  assert.equal(listed[0].value_text, 'قصة قصيرة');
  assert.equal(listed[0].provenance, 'approved_preference');
  app.close();
});

test('delete preference action removes it from the list', () => {
  const { app } = testApp();
  const { token } = app.createSession('customer', OWNER_PASS);
  app.grantConsent(token, 'text_preferences', 'customer_ui');
  const saved = app.savePreference(token, { kind: 'note', value_text: 'احذفني', source: 'customer_typed' });
  const action = app.issueDeletePreferenceAction(token, { preference_id: saved.preference_id });
  assert.equal(action.bound.object_id, saved.preference_id);
  assert.equal(action.bound.object_version, saved.version);
  assert.equal(app.executeAction(token, action.action_id).outcome, 'done');
  assert.equal(app.listPreferences(token).length, 0);
  app.close();
});

test('version bump between issue and click is stale and does not write', () => {
  const { app } = testApp();
  const { token } = app.createSession('customer', OWNER_PASS);
  app.grantConsent(token, 'text_preferences', 'customer_ui');
  const saved = app.savePreference(token, { kind: 'note', value_text: 'واحد', source: 'customer_typed' });
  const action = app.issueDeletePreferenceAction(token, { preference_id: saved.preference_id });
  app.savePreference(token, { kind: 'note', value_text: 'اثنين', source: 'customer_typed', version: saved.version });
  assert.equal(app.executeAction(token, action.action_id).outcome, 'stale');
  const listed = app.listPreferences(token);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].value_text, 'اثنين');
  app.close();
});

test('action payload for another subject is NOT_FOUND', () => {
  const { app } = testApp();
  const a = app.createSession('customer', OWNER_PASS);
  const b = app.createSession('customer', OWNER_PASS);
  app.grantConsent(a.token, 'text_preferences', 'customer_ui');
  const saved = app.savePreference(a.token, { kind: 'style', value_text: 'خاص', source: 'customer_typed' });
  assert.throws(
    () => app.issueDeletePreferenceAction(b.token, { preference_id: saved.preference_id }),
    err => err instanceof AppError && err.shape.code === 'NOT_FOUND',
  );
  assert.throws(
    () => app.issueSavePreferenceAction(b.token, { preference_id: saved.preference_id, value_text: 'تعديل' }),
    err => err instanceof AppError && err.shape.code === 'NOT_FOUND',
  );
  assert.equal(app.listPreferences(a.token).length, 1);
  app.close();
});

test('preference proposals are not listed until the customer executes the action', () => {
  const { app } = testApp();
  const { token } = app.createSession('customer', OWNER_PASS);
  const action = app.issueSavePreferenceAction(token, {
    preference_kind: 'note',
    value_text: 'لا تُحفظ قبل الموافقة',
  });
  assert.equal(app.listPreferences(token).length, 0);
  assert.throws(
    () => app.executeAction(token, action.action_id),
    err => err instanceof AppError && err.shape.code === 'CONSENT_REQUIRED',
  );
  assert.equal(app.listPreferences(token).length, 0);
  app.grantConsent(token, 'text_preferences', 'customer_ui');
  const retry = app.issueSavePreferenceAction(token, {
    preference_kind: 'note',
    value_text: 'لا تُحفظ قبل الموافقة',
  });
  assert.equal(app.executeAction(token, retry.action_id).outcome, 'done');
  assert.equal(app.listPreferences(token).length, 1);
  assert.equal(app.listPreferences(token)[0].provenance, 'approved_preference');
  app.close();
});

test('two concurrent clicks claim an action once', async () => {
  const { app } = testApp();
  const { token } = app.createSession('customer', OWNER_PASS);
  const action = app.issueBookingAction(token);
  const results = await Promise.all([
    Promise.resolve().then(() => app.executeAction(token, action.action_id)),
    Promise.resolve().then(() => app.executeAction(token, action.action_id)),
  ]);
  const outcomes = results.map(r => r.outcome).sort();
  assert.deepEqual(outcomes, ['external_handoff', 'stale']);
  const consumed = app.store.get('SELECT consumed_at FROM allowed_actions WHERE action_id = ?', [action.action_id]);
  assert.ok(consumed.consumed_at);
  assert.equal(app.store.get('SELECT COUNT(*) AS n FROM action_results WHERE action_id = ?', [action.action_id]).n, 1);
  app.close();
});
