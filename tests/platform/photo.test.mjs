import test from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO_BYTES_TTL_MS, PHOTO_OBSERVATIONS_TTL_MS } from '../../src/server/app.mjs';
import { runModelTurn } from '../../src/integrations/internal/model-adapter.mjs';
import { OWNER_PASS, testApp } from './helpers.mjs';

const JPEG_HEAD = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

function observationsFor(imageRef) {
  return {
    contract_version: '0.1.0',
    image_ref: imageRef,
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
}

function photoAdapter(imageRef) {
  return ({ context, input, now }) => {
    const usageId = `use_photo_${input.turn_id.slice(-12)}`;
    const observations = observationsFor(imageRef || input.image_ref);
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
        observations,
        style_options: [],
        proposed_actions: [],
        knowledge_refs: [],
        brief_draft: null,
        usage_ref: usageId,
        flags: [],
        error: null,
      },
    };
  };
}

test('upload bytes reach the adapter once, then are discarded', async () => {
  const seen = [];
  const adapter = (args) => {
    seen.push(args.image_bytes ? args.image_bytes.length : 0);
    return runModelTurn(args);
  };
  const { app } = testApp({ WEEKEND_PHOTO_ENABLED: 'true' }, { adapter });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  app.grantConsent(token, 'photo_analysis', 'customer_ui');
  const up = app.registerUpload(token, {
    byteLength: JPEG_HEAD.length,
    contentType: 'image/jpeg',
    bytes: JPEG_HEAD,
  });
  assert.equal(app.peekPhotoBytes(up.image_ref), true);
  await app.submitTurn(token, {
    contract_version: '0.1.0',
    session_id: context.session_id,
    turn_id: '11111111-2222-4333-8444-555555555561',
    text: '',
    image_ref: up.image_ref,
    client_action_id: null,
    locale_hint: 'ar',
  });
  assert.deepEqual(seen, [JPEG_HEAD.length]);
  assert.equal(app.peekPhotoBytes(up.image_ref), false);
  const blobCols = app.store.all(`PRAGMA table_info(images)`).map((c) => c.name);
  assert.equal(blobCols.includes('bytes'), false);
  assert.equal(blobCols.includes('blob'), false);
  await app.submitTurn(token, {
    contract_version: '0.1.0',
    session_id: context.session_id,
    turn_id: '11111111-2222-4333-8444-555555555562',
    text: '',
    image_ref: up.image_ref,
    client_action_id: null,
    locale_hint: 'ar',
  });
  assert.deepEqual(seen, [JPEG_HEAD.length, 0]);
  app.close();
});

test('photo bytes survive a rejected turn and a client-action turn', async () => {
  const { app } = testApp({ WEEKEND_PHOTO_ENABLED: 'true', WEEKEND_MAX_CALLS_PER_SESSION: '1' });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  app.grantConsent(token, 'photo_analysis', 'customer_ui');
  const up = app.registerUpload(token, {
    byteLength: JPEG_HEAD.length, contentType: 'image/jpeg', bytes: JPEG_HEAD,
  });
  const booking = app.issueBookingAction(token);
  await app.submitTurn(token, {
    contract_version: '0.1.0',
    session_id: context.session_id,
    turn_id: '11111111-2222-4333-8444-555555555801',
    text: '',
    image_ref: up.image_ref,
    client_action_id: booking.action_id,
    locale_hint: 'ar',
  });
  assert.equal(app.peekPhotoBytes(up.image_ref), true);
  await app.submitTurn(token, {
    contract_version: '0.1.0',
    session_id: context.session_id,
    turn_id: '11111111-2222-4333-8444-555555555802',
    text: 'أبغى قصة',
    image_ref: null,
    client_action_id: null,
    locale_hint: 'ar',
  });
  await assert.rejects(
    () => app.submitTurn(token, {
      contract_version: '0.1.0',
      session_id: context.session_id,
      turn_id: '11111111-2222-4333-8444-555555555803',
      text: '',
      image_ref: up.image_ref,
      client_action_id: null,
      locale_hint: 'ar',
    }),
    (err) => err.shape?.code === 'BUDGET_EXCEEDED',
  );
  assert.equal(app.peekPhotoBytes(up.image_ref), true);
  app.close();
});

test('abandoned upload bytes expire after the 10-minute TTL and the entry cap', () => {
  let now = Date.parse('2026-09-14T10:00:00.000Z');
  const { app } = testApp({ WEEKEND_PHOTO_ENABLED: 'true' }, {
    clock: () => new Date(now).toISOString(),
    photoBytesMax: 2,
  });
  const { token } = app.createSession('customer', OWNER_PASS);
  app.grantConsent(token, 'photo_analysis', 'customer_ui');
  const first = app.registerUpload(token, {
    byteLength: JPEG_HEAD.length, contentType: 'image/jpeg', bytes: JPEG_HEAD,
  });
  const second = app.registerUpload(token, {
    byteLength: JPEG_HEAD.length, contentType: 'image/jpeg', bytes: JPEG_HEAD,
  });
  assert.equal(app.peekPhotoBytes(first.image_ref), true);
  const third = app.registerUpload(token, {
    byteLength: JPEG_HEAD.length, contentType: 'image/jpeg', bytes: JPEG_HEAD,
  });
  assert.equal(app.peekPhotoBytes(first.image_ref), false, 'the oldest in-memory entry is evicted');
  assert.equal(app.peekPhotoBytes(second.image_ref), true);
  assert.equal(app.peekPhotoBytes(third.image_ref), true);
  now += PHOTO_BYTES_TTL_MS + 1;
  app.registerUpload(token, {
    byteLength: JPEG_HEAD.length, contentType: 'image/jpeg', bytes: JPEG_HEAD,
  });
  assert.equal(app.peekPhotoBytes(second.image_ref), false);
  assert.equal(app.peekPhotoBytes(third.image_ref), false);
  app.close();
});

test('photo_analysis revocation purges bytes, image rows and observations; observations expire after 24h', () => {
  let now = Date.parse('2026-09-14T10:00:00.000Z');
  const { app } = testApp({ WEEKEND_PHOTO_ENABLED: 'true' }, {
    clock: () => new Date(now).toISOString(),
  });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const receipt = app.grantConsent(token, 'photo_analysis', 'customer_ui');
  const up = app.registerUpload(token, {
    byteLength: JPEG_HEAD.length, contentType: 'image/jpeg', bytes: JPEG_HEAD,
  });
  app.store.run(
    `INSERT INTO photo_observations (image_ref, session_id, subject_id, observations_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [up.image_ref, context.session_id, context.subject_id, '{"contract_version":"0.1.0"}', new Date(now).toISOString()],
  );
  app.revokeConsent(token, receipt.receipt_id);
  assert.equal(app.peekPhotoBytes(up.image_ref), false);
  assert.equal(app.store.get('SELECT * FROM images WHERE image_ref = ?', [up.image_ref]), null);
  assert.equal(app.store.get('SELECT * FROM photo_observations WHERE image_ref = ?', [up.image_ref]), null);

  app.grantConsent(token, 'photo_analysis', 'customer_ui');
  const kept = app.registerUpload(token, {
    byteLength: JPEG_HEAD.length, contentType: 'image/jpeg', bytes: JPEG_HEAD,
  });
  app.store.run(
    `INSERT INTO photo_observations (image_ref, session_id, subject_id, observations_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [kept.image_ref, context.session_id, context.subject_id, '{"contract_version":"0.1.0"}', new Date(now).toISOString()],
  );
  now += PHOTO_OBSERVATIONS_TTL_MS + 1;
  app.store.run(
    'UPDATE sessions SET expires_at = ? WHERE session_id = ?',
    [new Date(now + 8 * 3600000).toISOString(), context.session_id],
  );
  app.registerUpload(token, {
    byteLength: JPEG_HEAD.length, contentType: 'image/jpeg', bytes: JPEG_HEAD,
  });
  assert.equal(app.store.get('SELECT * FROM photo_observations WHERE image_ref = ?', [kept.image_ref]), null);
  assert.equal(app.store.get('SELECT * FROM images WHERE image_ref = ?', [kept.image_ref]), null);
  app.close();
});

test('revoking photo_analysis redacts cached turn observations', async () => {
  const { app } = testApp({ WEEKEND_PHOTO_ENABLED: 'true' }, { adapter: photoAdapter() });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const receipt = app.grantConsent(token, 'photo_analysis', 'customer_ui');
  const up = app.registerUpload(token, {
    byteLength: JPEG_HEAD.length, contentType: 'image/jpeg', bytes: JPEG_HEAD,
  });
  const input = {
    contract_version: '0.1.0',
    session_id: context.session_id,
    turn_id: '11111111-2222-4333-8444-555555555571',
    text: '',
    image_ref: up.image_ref,
    client_action_id: null,
    locale_hint: 'ar',
  };
  const first = await app.submitTurn(token, input);
  assert.deepEqual(first.output.observations, observationsFor(up.image_ref));
  app.revokeConsent(token, receipt.receipt_id);
  const replay = await app.submitTurn(token, input);
  assert.equal(replay.output.observations, null);
  app.close();
});

test('expired photo turns replay without cached observations', async () => {
  let now = Date.parse('2026-09-14T10:00:00.000Z');
  const { app } = testApp({ WEEKEND_PHOTO_ENABLED: 'true' }, {
    adapter: photoAdapter(),
    clock: () => new Date(now).toISOString(),
  });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  app.grantConsent(token, 'photo_analysis', 'customer_ui');
  const up = app.registerUpload(token, {
    byteLength: JPEG_HEAD.length, contentType: 'image/jpeg', bytes: JPEG_HEAD,
  });
  const input = {
    contract_version: '0.1.0',
    session_id: context.session_id,
    turn_id: '11111111-2222-4333-8444-555555555572',
    text: '',
    image_ref: up.image_ref,
    client_action_id: null,
    locale_hint: 'ar',
  };
  const first = await app.submitTurn(token, input);
  assert.ok(first.output.observations);
  now += PHOTO_OBSERVATIONS_TTL_MS + 1;
  app.store.run(
    'UPDATE sessions SET expires_at = ? WHERE session_id = ?',
    [new Date(now + 8 * 3600000).toISOString(), context.session_id],
  );
  const replay = await app.submitTurn(token, input);
  assert.equal(replay.output.observations, null);
  app.close();
});
