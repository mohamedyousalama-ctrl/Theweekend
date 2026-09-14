import test from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO_BYTES_TTL_MS, PHOTO_OBSERVATIONS_TTL_MS } from '../../src/server/app.mjs';
import { runModelTurn } from '../../src/integrations/internal/model-adapter.mjs';
import { OWNER_PASS, testApp } from './helpers.mjs';

const JPEG_HEAD = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

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
