import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testApp, OWNER_PASS } from '../platform/helpers.mjs';
import { createRakanAdapter } from '../../src/agent/adapter.mjs';
import { knowledge, modelJson, response, fakeClient, PNG_BYTES } from './fixtures.mjs';

function realApp(script, overrides = {}) {
  const client = fakeClient(script);
  const env = {
    WEEKEND_MODEL_MODE: 'real',
    WEEKEND_MODEL_PROVIDER: 'anthropic',
    WEEKEND_MODEL_ID: 'claude-opus-5',
    WEEKEND_VISION_MODEL_ID: 'claude-opus-5',
    WEEKEND_BRANCH_ID: 'br_marsiya',
    ...overrides,
  };
  const adapter = createRakanAdapter({ WEEKEND_MODEL_MODE: 'real', WEEKEND_MODEL_PROVIDER: 'anthropic', WEEKEND_MODEL_ID: 'claude-opus-5', WEEKEND_MODEL_API_KEY: 'x', WEEKEND_REQUEST_TIMEOUT_MS: 8000 }, { client, knowledge });
  const { app } = testApp(env, { adapter });
  return { app, client };
}

function turn(sessionId, text, extra = {}) {
  return { contract_version: '0.1.0', session_id: sessionId, turn_id: randomUUID(), text, image_ref: null, client_action_id: null, locale_hint: 'auto', ...extra };
}

test('end to end: a customer turn through the server reaches the adapter and comes back as allowed actions', async () => {
  const { app, client } = realApp([response(modelJson())]);
  const { token, context } = app.createSession('customer', OWNER_PASS);
  assert.equal(context.capabilities.model, 'real');
  const result = await app.submitTurn(token, turn(context.session_id, 'كم سعر الحلاقة؟'));
  assert.equal(client.calls.length, 1);
  assert.equal(result.output.state, 'ok');
  assert.match(result.output.messages[0].text, /30 ريال/);
  assert.deepEqual(result.output.knowledge_refs, ['kno_mrs_price_haircut', 'kno_mrs_booking_url']);
  assert.equal(result.allowed_actions.length, 1);
  assert.equal(result.allowed_actions[0].kind, 'open_official_booking');
  assert.match(result.allowed_actions[0].action_id, /^act_/);
  assert.equal(result.allowed_actions[0].url, 'https://example.invalid/book');
});

test('end to end: an ungrounded price never reaches the customer through the server', async () => {
  const bad = modelJson({ reply: [{ text: 'الحلاقة بـ40 ريال', lang: 'ar' }], knowledge_refs: [] });
  const { app } = realApp([response(bad), response(bad)]);
  const { token, context } = app.createSession('customer', OWNER_PASS);
  const result = await app.submitTurn(token, turn(context.session_id, 'كم سعر الحلاقة؟'));
  assert.equal(result.output.state, 'error');
  assert.equal(result.output.error.message_key, 'agent.ungrounded_price');
  assert.ok(!/40/.test(result.output.messages[0].text));
});

test('end to end: photo turn requires consent and passes bytes to the model once', async () => {
  const withObs = modelJson({ observations: { present: true, hair_length: 'short', hair_texture: 'straight', beard: 'stubble', top_density_visible: 'full', face_visible: 'full', limitations: [], confidence: 'medium' } });
  const { app, client } = realApp([response(withObs)], { WEEKEND_PHOTO_ENABLED: 'true' });
  const { token, context } = app.createSession('customer', OWNER_PASS);
  app.grantConsent(token, 'photo_analysis', 'customer_ui');
  const { image_ref } = app.registerUpload(token, { byteLength: PNG_BYTES.length, contentType: 'image/png', bytes: PNG_BYTES });
  const result = await app.submitTurn(token, turn(context.session_id, 'شوف صورتي', { image_ref }));
  assert.equal(result.output.state, 'ok');
  assert.equal(result.output.observations.image_ref, image_ref);
  assert.equal(client.calls[0].messages[0].content[0].type, 'image');
});
