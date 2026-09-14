import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/server/app.mjs';
import { OWNER_PASS, STAFF_PASS, testApp } from './helpers.mjs';

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

test('share-actions for an owned brief returns a bound text share', () => {
  const { app } = testApp();
  const { token } = app.createSession('customer', OWNER_PASS);
  const brief = app.createBrief(token, { text_ar: 'قصة قصيرة من الجوانب', do_not: [] });
  const out = app.issueShareActionsForBrief(token, brief.brief_id);
  assert.equal(out.contract_version, '0.1.0');
  assert.equal(out.allowed_actions.length, 1);
  const action = out.allowed_actions[0];
  assert.equal(action.kind, 'share_brief_text');
  assert.equal(action.bound.object_id, brief.brief_id);
  assert.equal(action.bound.object_version, brief.provenance.version);
  assert.equal(action.requires_receipt_kind, 'staff_sharing_text');
  const again = app.issueShareActionsForBrief(token, brief.brief_id);
  assert.notEqual(again.allowed_actions[0].action_id, action.action_id);
  app.close();
});

test('share-actions conceals another subject\'s brief and refuses staff', () => {
  const { app } = testApp();
  const customer = app.createSession('customer', OWNER_PASS);
  const other = app.createSession('customer', OWNER_PASS);
  const staff = app.createSession('staff', STAFF_PASS);
  const brief = app.createBrief(customer.token, { text_ar: 'موجز خاص', do_not: [] });
  assert.throws(
    () => app.issueShareActionsForBrief(other.token, brief.brief_id),
    err => err instanceof AppError && err.shape.code === 'NOT_FOUND' && err.shape.message_key === 'brief.not_found' && err.status === 404,
  );
  assert.throws(
    () => app.issueShareActionsForBrief(staff.token, brief.brief_id),
    err => err instanceof AppError && err.shape.code === 'UNAUTHORIZED' && err.shape.message_key === 'brief.role' && err.status === 401,
  );
  app.close();
});

test('share-actions omits photo share without an image or the photo capability', () => {
  const withPhoto = testApp({ WEEKEND_PHOTO_ENABLED: 'true' });
  const { token, context } = withPhoto.app.createSession('customer', OWNER_PASS);
  withPhoto.app.grantConsent(token, 'photo_analysis', 'customer_ui');
  const brief = withPhoto.app.createBrief(token, { text_ar: 'بدون صورة بعد', do_not: [] });
  const withoutImage = withPhoto.app.issueShareActionsForBrief(token, brief.brief_id);
  assert.equal(withoutImage.allowed_actions.some(a => a.kind === 'share_photo_ref'), false);
  const up = withPhoto.app.registerUpload(token, { byteLength: 12, contentType: 'image/jpeg' });
  const withImage = withPhoto.app.issueShareActionsForBrief(token, brief.brief_id);
  const photo = withImage.allowed_actions.find(a => a.kind === 'share_photo_ref');
  assert.ok(photo);
  assert.equal(photo.bound.object_id, up.image_ref);
  assert.equal(photo.requires_receipt_kind, 'staff_sharing_photo');
  assert.equal(photo.bound.session_id, context.session_id);
  withPhoto.app.close();

  const { app } = testApp({ WEEKEND_PHOTO_ENABLED: 'false' });
  const session = app.createSession('customer', OWNER_PASS);
  const otherBrief = app.createBrief(session.token, { text_ar: 'القدرة مغلقة', do_not: [] });
  const off = app.issueShareActionsForBrief(session.token, otherBrief.brief_id);
  assert.equal(off.allowed_actions.some(a => a.kind === 'share_photo_ref'), false);
  assert.equal(off.allowed_actions[0].kind, 'share_brief_text');
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
