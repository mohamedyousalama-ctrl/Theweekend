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
  const brief = app.createBrief(token, { text_ar: 'قصة قصيرة من الجوانب', do_not: [] });
  const up = app.registerUpload(token, { byteLength: 12, contentType: 'image/jpeg' });
  const action = app.issueSharePhotoAction(token, { image_ref: up.image_ref });
  assert.equal(action.bound.object_id, brief.brief_id);
  assert.equal(action.bound.object_version, brief.provenance.version);
  const payload = JSON.parse(
    app.store.get('SELECT payload_json FROM allowed_actions WHERE action_id = ?', [action.action_id]).payload_json,
  );
  assert.equal(payload.image_ref, up.image_ref);
  assert.equal(payload.brief_id, brief.brief_id);
  assert.equal(app.executeAction(token, action.action_id).outcome, 'done');
  app.close();
});

test('share_photo_ref stays on the issued brief when a later brief exists', () => {
  const { app } = testApp({ WEEKEND_PHOTO_ENABLED: 'true' });
  const { token } = app.createSession('customer', OWNER_PASS);
  app.grantConsent(token, 'photo_analysis', 'customer_ui');
  app.grantConsent(token, 'staff_sharing_photo', 'customer_ui');
  const briefA = app.createBrief(token, { text_ar: 'الموجز الأول', do_not: [] });
  const up = app.registerUpload(token, { byteLength: 12, contentType: 'image/jpeg' });
  const issued = app.issueShareActionsForBrief(token, briefA.brief_id);
  const photo = issued.allowed_actions.find(a => a.kind === 'share_photo_ref');
  assert.ok(photo);
  assert.equal(photo.bound.object_id, briefA.brief_id);
  assert.equal(photo.bound.object_version, briefA.provenance.version);
  const briefB = app.createBrief(token, { text_ar: 'الموجز الثاني', do_not: [] });
  assert.equal(app.executeAction(token, photo.action_id).outcome, 'done');
  const rowA = app.store.get('SELECT * FROM briefs WHERE brief_id = ?', [briefA.brief_id]);
  const rowB = app.store.get('SELECT * FROM briefs WHERE brief_id = ?', [briefB.brief_id]);
  assert.equal(rowA.ref_kind, 'photo_ref');
  assert.equal(rowA.image_ref, up.image_ref);
  assert.equal(rowB.ref_kind, 'none');
  assert.equal(rowB.image_ref, null);

  const again = app.issueShareActionsForBrief(token, briefA.brief_id)
    .allowed_actions.find(a => a.kind === 'share_photo_ref');
  app.store.run('UPDATE briefs SET version = version + 1 WHERE brief_id = ?', [briefA.brief_id]);
  assert.equal(app.executeAction(token, again.action_id).outcome, 'stale');
  app.close();
});

test('staff inbox lists a brief only after an executed text share with an active receipt', () => {
  const { app } = testApp();
  const customer = app.createSession('customer', OWNER_PASS);
  const staff = app.createSession('staff', STAFF_PASS);
  const brief = app.createBrief(customer.token, { text_ar: 'لا يظهر قبل المشاركة', do_not: [] });
  const issued = app.issueShareActionsForBrief(customer.token, brief.brief_id).allowed_actions[0];
  assert.throws(
    () => app.executeAction(customer.token, issued.action_id),
    err => err instanceof AppError && err.shape.code === 'CONSENT_REQUIRED' && err.shape.message_key === 'brief.share_consent',
  );
  assert.equal(app.staffBriefs(staff.token).length, 0);
  app.grantConsent(customer.token, 'staff_sharing_text', 'customer_ui');
  const retry = app.issueShareActionsForBrief(customer.token, brief.brief_id).allowed_actions[0];
  assert.equal(app.executeAction(customer.token, retry.action_id).outcome, 'done');
  const inbox = app.staffBriefs(staff.token);
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].brief_id, brief.brief_id);
  assert.equal(inbox[0].status, 'delivered');
  assert.equal(app.staffBriefs(staff.token)[0].status, 'delivered');
  const row = app.store.get('SELECT * FROM briefs WHERE brief_id = ?', [brief.brief_id]);
  assert.equal(row.status, 'delivered');
  app.close();
});

test('model share_brief_text without brief_id binds to the latest approved brief', async () => {
  const { app } = testApp({}, {
    adapter: ({ context, input, now }) => {
      const usageId = `use_syn_bind_${input.turn_id.slice(-12)}`;
      return {
        usage: {
          contract_version: '0.1.0',
          usage_id: usageId,
          session_id: context.session_id,
          turn_id: input.turn_id,
          provider: 'mock',
          model_id: 'local-script',
          prompt_version: 'local.mock.0',
          input_tokens: 1,
          output_tokens: 1,
          latency_ms: 1,
          cost_estimate_minor: null,
          outcome: 'ok',
          created_at: now,
        },
        output: {
          contract_version: '0.1.0',
          turn_id: input.turn_id,
          state: 'ok',
          messages: [{ text: 'هذا رد محلي للاختبار فقط، وليس استشارة حقيقية.', lang: 'ar' }],
          observations: null,
          style_options: [],
          proposed_actions: [
            {
              kind: 'share_brief_text',
              label_ar: 'مشاركة الموجز',
              label_en: 'Share the brief',
              payload: {},
            },
            {
              kind: 'share_photo_ref',
              label_ar: 'مشاركة ملاحظات الصورة',
              label_en: 'Share photo notes',
              payload: {},
            },
          ],
          knowledge_refs: [],
          brief_draft: null,
          usage_ref: usageId,
          flags: [],
          error: null,
        },
      };
    },
  });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const none = await app.submitTurn(token, {
    contract_version: '0.1.0',
    session_id: context.session_id,
    turn_id: '11111111-2222-4333-8444-555555555601',
    text: 'شارك الموجز',
    image_ref: null,
    client_action_id: null,
    locale_hint: 'ar',
  });
  assert.equal(none.allowed_actions.some(a => a.kind === 'share_brief_text'), false);
  assert.equal(none.allowed_actions.some(a => a.kind === 'share_photo_ref'), false);

  const brief = app.createBrief(token, { text_ar: 'الموجز الأخير', do_not: [] });
  const bound = await app.submitTurn(token, {
    contract_version: '0.1.0',
    session_id: context.session_id,
    turn_id: '11111111-2222-4333-8444-555555555602',
    text: 'شارك الموجز',
    image_ref: null,
    client_action_id: null,
    locale_hint: 'ar',
  });
  const text = bound.allowed_actions.find(a => a.kind === 'share_brief_text');
  assert.ok(text);
  assert.equal(text.bound.object_id, brief.brief_id);
  assert.equal(text.bound.object_version, brief.provenance.version);
  assert.match(text.bound.object_id, /^brf_/);
  assert.equal(bound.allowed_actions.some(a => a.kind === 'share_photo_ref'), false);
  app.close();
});

test('model share_photo_ref without brief_id binds to the latest approved brief', async () => {
  const { app } = testApp({ WEEKEND_PHOTO_ENABLED: 'true' }, {
    adapter: ({ context, input, now }) => {
      const usageId = `use_syn_photo_${input.turn_id.slice(-12)}`;
      return {
        usage: {
          contract_version: '0.1.0',
          usage_id: usageId,
          session_id: context.session_id,
          turn_id: input.turn_id,
          provider: 'mock',
          model_id: 'local-script',
          prompt_version: 'local.mock.0',
          input_tokens: 1,
          output_tokens: 1,
          latency_ms: 1,
          cost_estimate_minor: null,
          outcome: 'ok',
          created_at: now,
        },
        output: {
          contract_version: '0.1.0',
          turn_id: input.turn_id,
          state: 'ok',
          messages: [{ text: 'هذا رد محلي للاختبار فقط، وليس استشارة حقيقية.', lang: 'ar' }],
          observations: null,
          style_options: [],
          proposed_actions: [
            {
              kind: 'share_photo_ref',
              label_ar: 'مشاركة ملاحظات الصورة',
              label_en: 'Share photo notes',
              payload: { image_ref: input.image_ref },
            },
          ],
          knowledge_refs: [],
          brief_draft: null,
          usage_ref: usageId,
          flags: [],
          error: null,
        },
      };
    },
  });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  app.grantConsent(token, 'photo_analysis', 'customer_ui');
  const up = app.registerUpload(token, { byteLength: 12, contentType: 'image/jpeg' });
  const first = app.createBrief(token, { text_ar: 'الموجز الأقدم', do_not: [] });
  const latest = app.createBrief(token, { text_ar: 'الموجز الأحدث', do_not: [] });
  const bound = await app.submitTurn(token, {
    contract_version: '0.1.0',
    session_id: context.session_id,
    turn_id: '11111111-2222-4333-8444-555555555603',
    text: 'شارك الملاحظات',
    image_ref: up.image_ref,
    client_action_id: null,
    locale_hint: 'ar',
  });
  const photo = bound.allowed_actions.find(a => a.kind === 'share_photo_ref');
  assert.ok(photo);
  assert.equal(photo.bound.object_id, latest.brief_id);
  assert.equal(photo.bound.object_version, latest.provenance.version);
  assert.notEqual(photo.bound.object_id, first.brief_id);
  const payload = JSON.parse(
    app.store.get('SELECT payload_json FROM allowed_actions WHERE action_id = ?', [photo.action_id]).payload_json,
  );
  assert.equal(payload.image_ref, up.image_ref);
  assert.equal(payload.brief_id, latest.brief_id);
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
  assert.equal(photo.bound.object_id, brief.brief_id);
  assert.equal(photo.bound.object_version, brief.provenance.version);
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

test('share_photo_ref attaches stored observations to the staff brief, never bytes', () => {
  const { app } = testApp({ WEEKEND_PHOTO_ENABLED: 'true' });
  const customer = app.createSession('customer', OWNER_PASS);
  const staff = app.createSession('staff', STAFF_PASS);
  app.grantConsent(customer.token, 'photo_analysis', 'customer_ui');
  app.grantConsent(customer.token, 'staff_sharing_text', 'customer_ui');
  app.grantConsent(customer.token, 'staff_sharing_photo', 'customer_ui');
  const brief = app.createBrief(customer.token, { text_ar: 'موجز مع ملاحظات', do_not: [] });
  const up = app.registerUpload(customer.token, { byteLength: 12, contentType: 'image/jpeg' });
  const observations = {
    contract_version: '0.1.0',
    image_ref: up.image_ref,
    observed: {
      hair_length: 'short',
      hair_texture: 'wavy',
      beard: 'stubble',
      top_density_visible: 'uncertain',
      face_visible: 'partial',
    },
    limitations: ['lighting'],
    confidence: 'low',
    not_inferred: ['identity', 'age', 'ethnicity', 'health', 'attractiveness', 'gender'],
    retention: 'stored_with_receipt',
  };
  app.store.run(
    `INSERT INTO photo_observations (image_ref, session_id, subject_id, observations_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [up.image_ref, customer.context.session_id, customer.context.subject_id, JSON.stringify(observations), new Date().toISOString()],
  );
  const textShare = app.issueShareActionsForBrief(customer.token, brief.brief_id)
    .allowed_actions.find(a => a.kind === 'share_brief_text');
  assert.equal(app.executeAction(customer.token, textShare.action_id).outcome, 'done');
  const photoShare = app.issueSharePhotoAction(customer.token, { image_ref: up.image_ref });
  assert.equal(photoShare.label_ar, 'مشاركة ملاحظات الصورة');
  assert.equal(app.executeAction(customer.token, photoShare.action_id).outcome, 'done');
  const inbox = app.staffBriefs(staff.token);
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].reference.kind, 'photo_ref');
  assert.equal(inbox[0].reference.image_ref, up.image_ref);
  assert.match(inbox[0].reference.receipt_id, /^rcp_/);
  assert.deepEqual(inbox[0].observations, observations);
  const serialized = JSON.stringify(inbox[0]);
  assert.equal(serialized.includes('image_bytes'), false);
  assert.equal(serialized.includes('signed'), false);
  assert.equal(/https?:\/\//.test(serialized), false);
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
