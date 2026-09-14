import test from 'node:test';
import assert from 'node:assert/strict';
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
