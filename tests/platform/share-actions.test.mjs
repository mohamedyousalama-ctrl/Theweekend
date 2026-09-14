import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/server/app.mjs';
import { OWNER_PASS, testApp } from './helpers.mjs';

test('share brief action re-checks ownership and version on click', () => {
  const { app } = testApp();
  const { token } = app.createSession('customer', OWNER_PASS);
  const brief = app.createBrief(token, { text_ar: 'قصة قصيرة من الجوانب', do_not: [] });
  app.grantConsent(token, 'staff_sharing_text', 'customer_ui');
  const action = app.issueShareBriefAction(token, { brief_id: brief.brief_id });
  assert.equal(action.bound.object_id, brief.brief_id);
  assert.equal(action.bound.object_version, brief.provenance.version);
  const result = app.executeAction(token, action.action_id);
  assert.equal(result.outcome, 'done');
  app.close();
});

test('share brief is stale when the brief version changes after issue', () => {
  const { app } = testApp();
  const { token } = app.createSession('customer', OWNER_PASS);
  const brief = app.createBrief(token, { text_ar: 'قصة قصيرة من الجوانب', do_not: [] });
  app.grantConsent(token, 'staff_sharing_text', 'customer_ui');
  const action = app.issueShareBriefAction(token, { brief_id: brief.brief_id });
  app.store.run('UPDATE briefs SET version = version + 1 WHERE brief_id = ?', [brief.brief_id]);
  assert.equal(app.executeAction(token, action.action_id).outcome, 'stale');
  app.close();
});

test('share brief for another subject is NOT_FOUND', () => {
  const { app } = testApp();
  const a = app.createSession('customer', OWNER_PASS);
  const b = app.createSession('customer', OWNER_PASS);
  const brief = app.createBrief(a.token, { text_ar: 'موجز خاص', do_not: [] });
  assert.throws(
    () => app.issueShareBriefAction(b.token, { brief_id: brief.brief_id }),
    err => err instanceof AppError && err.shape.code === 'NOT_FOUND',
  );
  app.close();
});

test('share photo action re-checks ownership on click', () => {
  const { app } = testApp({ WEEKEND_PHOTO_ENABLED: 'true' });
  const { token } = app.createSession('customer', OWNER_PASS);
  app.grantConsent(token, 'photo_analysis', 'customer_ui');
  app.grantConsent(token, 'staff_sharing_photo', 'customer_ui');
  const up = app.registerUpload(token, { byteLength: 12, contentType: 'image/jpeg' });
  const action = app.issueSharePhotoAction(token, { image_ref: up.image_ref });
  assert.equal(action.bound.object_id, up.image_ref);
  assert.equal(app.executeAction(token, action.action_id).outcome, 'done');
  app.close();
});

test('share photo for another subject is NOT_FOUND', () => {
  const { app } = testApp({ WEEKEND_PHOTO_ENABLED: 'true' });
  const a = app.createSession('customer', OWNER_PASS);
  const b = app.createSession('customer', OWNER_PASS);
  app.grantConsent(a.token, 'photo_analysis', 'customer_ui');
  const up = app.registerUpload(a.token, { byteLength: 12, contentType: 'image/jpeg' });
  assert.throws(
    () => app.issueSharePhotoAction(b.token, { image_ref: up.image_ref }),
    err => err instanceof AppError && err.shape.code === 'NOT_FOUND',
  );
  app.close();
});
