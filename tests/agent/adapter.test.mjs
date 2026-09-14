import test from 'node:test';
import assert from 'node:assert/strict';
import { createRakanAdapter, mapModelOutput, ungroundedPrices, normalizeDigits, estimateCostMinor, sniffImageMime, MODEL_OUTPUT_SCHEMA } from '../../src/agent/adapter.mjs';
import { validateContract } from '../../src/contracts/validate.mjs';
import { knowledge, context, input, modelJson, response, fakeClient, badRequest, PNG_BYTES, realConfig, photoConsent, PRICE_REF } from './fixtures.mjs';

function adapterWith(script, configOverrides = {}) {
  const client = fakeClient(script);
  const adapter = createRakanAdapter(realConfig(configOverrides), { client, knowledge, clock: () => 1_000 });
  return { adapter, client };
}

test('adapter refuses to build without real mode or with a foreign provider', () => {
  assert.throws(() => createRakanAdapter(realConfig({ WEEKEND_MODEL_MODE: 'mock' }), { client: fakeClient([]), knowledge }), /WEEKEND_MODEL_MODE=real/);
  assert.throws(() => createRakanAdapter(realConfig({ WEEKEND_MODEL_PROVIDER: 'openai' }), { client: fakeClient([]), knowledge }), /anthropic/);
});

test('model capability not real → unavailable without any model call', async () => {
  const { adapter, client } = adapterWith([response(modelJson())]);
  const ctx = context({ capabilities: { model: 'unavailable', photo: 'disabled', booking_handoff: 'official_link', staff_inbox: 'enabled', preferences: 'enabled' } });
  const { output, usage } = await adapter({ context: ctx, input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(client.calls.length, 0);
  assert.equal(output.state, 'unavailable');
  assert.equal(output.error.code, 'MODEL_UNAVAILABLE');
  assert.equal(usage.provider, 'none');
  assert.ok(validateContract('ChatTurnOutput', output).ok);
  assert.ok(validateContract('ModelUsageRecord', usage).ok);
});

test('grounded price reply → valid contract output, actions kept, usage costed, history remembered', async () => {
  const { adapter, client } = adapterWith([response(modelJson()), response(modelJson())]);
  const now = '2026-09-14T06:00:00Z';
  const first = await adapter({ context: context(), input: input(), now, image_bytes: null });
  assert.equal(first.output.state, 'ok', JSON.stringify(first.output.error));
  assert.ok(validateContract('ChatTurnOutput', first.output).ok);
  assert.ok(validateContract('ModelUsageRecord', first.usage).ok);
  assert.deepEqual(first.output.knowledge_refs, [PRICE_REF, 'kno_mrs_booking_url']);
  assert.equal(first.output.proposed_actions[0].kind, 'open_official_booking');
  assert.equal(first.output.observations, null);
  assert.equal(first.usage.provider, 'anthropic');
  assert.equal(first.usage.model_id, 'claude-opus-5');
  assert.equal(first.usage.prompt_version, 'rakan.system.v0.3');
  assert.equal(first.usage.input_tokens, 1200);
  assert.equal(first.usage.cost_estimate_minor, estimateCostMinor('claude-opus-5', { input_tokens: 1200, output_tokens: 180, cache_read_input_tokens: 900 }));
  const req = client.calls[0];
  assert.equal(req.model, 'claude-opus-5');
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.deepEqual(req.output_config.format.schema, MODEL_OUTPUT_SCHEMA);
  assert.equal(req.system[0].cache_control.type, 'ephemeral');
  assert.match(req.system[1].text, /kno_mrs_price_haircut/);
  assert.match(req.system[2].text, /booking_handoff: official_link/);
  assert.equal(req.messages.length, 1);
  await adapter({ context: context(), input: input('وش الإضافات؟'), now, image_bytes: null });
  assert.equal(client.calls[1].messages.length, 3, 'second turn carries the first exchange as history');
  assert.equal(client.calls[1].messages[1].role, 'assistant');
});

test('ungrounded price → one corrective retry, then a closed error state', async () => {
  const bad = modelJson({ reply: [{ text: 'الحلاقة بـ40 ريال بس', lang: 'ar' }], knowledge_refs: [] });
  const { adapter, client } = adapterWith([response(bad), response(bad)]);
  const { output, usage } = await adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[1].system.at(-1).text, /not in any knowledge record/);
  assert.equal(output.state, 'error');
  assert.equal(output.error.message_key, 'agent.ungrounded_price');
  assert.ok(!/40/.test(output.messages[0].text), 'the wrong price never reaches the customer');
  assert.equal(usage.outcome, 'error');
  assert.ok(validateContract('ChatTurnOutput', output).ok);
});

test('a corrected second attempt is accepted', async () => {
  const bad = modelJson({ reply: [{ text: 'الحلاقة بـ40 ريال', lang: 'ar' }], knowledge_refs: [] });
  const { adapter } = adapterWith([response(bad), response(modelJson())]);
  const { output } = await adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(output.state, 'ok');
});

test('observations only with an image and an active photo permission', async () => {
  const withObs = modelJson({ observations: { present: true, hair_length: 'short', hair_texture: 'wavy', beard: 'short', top_density_visible: 'full', face_visible: 'full', limitations: ['Low Light', 'angle'], confidence: 'medium' }, style_options: [{ name_ar: 'تدريج قصير', name_en: 'short taper', why_ar: 'يناسب الشعر الكثيف', upkeep_ar: 'كل 3 أسابيع', feasible_in_person: 'unknown' }] });
  const { adapter } = adapterWith([response(withObs), response(withObs), response(withObs)]);
  const now = '2026-09-14T06:00:00Z';
  const noImage = await adapter({ context: context(), input: input(), now, image_bytes: null });
  assert.equal(noImage.output.observations, null);
  assert.ok(noImage.output.flags.includes('observations_without_image_dropped'));
  const noConsent = await adapter({ context: context(), input: input('شوف صورتي', { image_ref: 'img_test1' }), now, image_bytes: PNG_BYTES });
  assert.equal(noConsent.output.state, 'error');
  assert.equal(noConsent.output.error.code, 'CONSENT_REQUIRED');
  const ok = await adapter({ context: context({ consents: [photoConsent()] }), input: input('شوف صورتي', { image_ref: 'img_test1' }), now, image_bytes: PNG_BYTES });
  assert.equal(ok.output.state, 'ok');
  assert.equal(ok.output.observations.image_ref, 'img_test1');
  assert.deepEqual(ok.output.observations.limitations, ['low_light', 'angle']);
  assert.deepEqual(ok.output.observations.not_inferred, ['identity', 'age', 'ethnicity', 'health', 'attractiveness', 'gender']);
  assert.equal(ok.output.style_options.length, 1);
  assert.equal(ok.output.style_options[0].feasible_in_person, 'unknown');
  assert.ok(validateContract('ChatTurnOutput', ok.output).ok);
});

test('image bytes go to the model as a base64 block and are not kept', async () => {
  const { adapter, client } = adapterWith([response(modelJson())]);
  await adapter({ context: context({ consents: [photoConsent()] }), input: input('صورة', { image_ref: 'img_x' }), now: '2026-09-14T06:00:00Z', image_bytes: PNG_BYTES });
  const content = client.calls[0].messages[0].content;
  assert.equal(content[0].type, 'image');
  assert.equal(content[0].source.media_type, 'image/png');
  assert.equal(content[0].source.data, PNG_BYTES.toString('base64'));
  assert.equal(sniffImageMime(Buffer.from('not an image at all!')), null);
});

test('proposed actions are filtered by capabilities and unknown refs are dropped', async () => {
  const json = modelJson({
    proposed_actions: [
      { kind: 'open_official_booking', label_ar: 'حجز', label_en: 'Book', payload: { preference_kind: 'none', value_text: '' } },
      { kind: 'save_preference', label_ar: 'احفظ', label_en: 'Save', payload: { preference_kind: 'style', value_text: 'تدريج قصير' } },
      { kind: 'share_photo_ref', label_ar: 'شارك الصورة', label_en: 'Share photo', payload: { preference_kind: 'none', value_text: '' } },
      { kind: 'talk_to_staff', label_ar: 'موظف', label_en: 'Staff', payload: { preference_kind: 'none', value_text: '' } },
    ],
    knowledge_refs: [PRICE_REF, 'kno_does_not_exist'],
  });
  const { adapter } = adapterWith([response(json)]);
  const ctx = context({ capabilities: { model: 'real', photo: 'disabled', booking_handoff: 'unavailable', staff_inbox: 'enabled', preferences: 'unavailable' } });
  const { output } = await adapter({ context: ctx, input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.deepEqual(output.proposed_actions.map((a) => a.kind), ['talk_to_staff']);
  const noInbox = adapterWith([response(json)]);
  const r2 = await noInbox.adapter({ context: context({ capabilities: { model: 'real', photo: 'disabled', booking_handoff: 'unavailable', staff_inbox: 'unavailable', preferences: 'unavailable' } }), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.deepEqual(r2.output.proposed_actions, [], 'talk_to_staff is never offered without a staff inbox');
  assert.deepEqual(output.knowledge_refs, [PRICE_REF]);
  assert.ok(output.flags.includes('unknown_ref_dropped'));
});

test('save_preference keeps its payload and a brief draft becomes a contract BarberBrief', async () => {
  const json = modelJson({
    proposed_actions: [{ kind: 'save_preference', label_ar: 'احفظ', label_en: 'Save', payload: { preference_kind: 'style', value_text: 'تدريج قصير' } }],
    brief_draft: { present: true, barber_preference: 'مهدي', requested_look_ar: 'تدريج قصير من الجوانب مع طول من فوق', do_not: ['لا تقصر من فوق'] },
  });
  const { adapter } = adapterWith([response(json)]);
  const { output } = await adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.deepEqual(output.proposed_actions[0].payload, { preference_kind: 'style', value_text: 'تدريج قصير' });
  assert.equal(output.brief_draft.status, 'draft');
  assert.equal(output.brief_draft.barber_preference, 'مهدي');
  assert.equal(output.brief_draft.provenance.approved_by_subject_at, null);
  assert.ok(validateContract('BarberBrief', output.brief_draft).ok);
});

test('invalid JSON twice → explicit error, never a fabricated reply', async () => {
  const { adapter, client } = adapterWith([response('not json'), response('{still not json')]);
  const { output, usage } = await adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(client.calls.length, 2);
  assert.equal(output.state, 'error');
  assert.equal(output.error.message_key, 'agent.invalid_output');
  assert.equal(usage.outcome, 'error');
});

test('provider errors → unavailable; a 400 is not retryable, a network error is', async () => {
  const bad = adapterWith([badRequest()]);
  const r1 = await bad.adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(r1.output.state, 'unavailable');
  assert.equal(r1.output.error.retryable, false);
  assert.equal(r1.output.error.message_key, 'model.misconfigured');
  const net = adapterWith([new Error('socket hang up')]);
  const r2 = await net.adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(r2.output.state, 'unavailable');
  assert.equal(r2.output.error.retryable, true);
});

test('a model refusal is surfaced honestly with a flag', async () => {
  const { adapter } = adapterWith([response(modelJson(), { stop_reason: 'refusal', content: [] })]);
  const { output } = await adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(output.state, 'ok');
  assert.deepEqual(output.flags, ['refusal_model']);
  assert.equal(output.proposed_actions.length, 0);
  assert.ok(validateContract('ChatTurnOutput', output).ok);
});

test('history is bounded and per session', async () => {
  const script = Array.from({ length: 14 }, () => response(modelJson()));
  const { adapter, client } = adapterWith(script);
  for (let i = 0; i < 12; i += 1) await adapter({ context: context(), input: input(`رسالة ${i}`), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(client.calls.at(-1).messages.length, 21, '20 remembered messages plus the current one');
  await adapter({ context: context({ session_id: 'ses_test_b' }), input: input('جلسة ثانية', { session_id: 'ses_test_b' }), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(client.calls.at(-1).messages.length, 1);
});

test('price grounding helper', () => {
  const byId = new Map([['kno_a', { text_ar: 'قص الشعر: 30 ريال', text_en: 'Haircut 30 SAR' }]]);
  assert.deepEqual(ungroundedPrices([{ text: 'بـ30 ريال' }], ['kno_a'], byId), []);
  assert.deepEqual(ungroundedPrices([{ text: 'بـ300 ريال' }], ['kno_a'], byId), ['300']);
  assert.deepEqual(ungroundedPrices([{ text: 'Only 30 SAR today' }], [], byId), ['30']);
  assert.deepEqual(ungroundedPrices([{ text: 'المدة 35 دقيقة' }], [], byId), [], 'durations are not prices');
});

test('mapModelOutput never emits more than the contract allows', () => {
  const raw = modelJson({ reply: Array.from({ length: 6 }, (_, i) => ({ text: `m${i}`, lang: 'ar' })), style_options: Array.from({ length: 4 }, () => ({ name_ar: 'أ', name_en: 'a', why_ar: 'b', upkeep_ar: 'c', feasible_in_person: 'yes' })), flags: ['refusal_medical', 'made_up_flag', 'Refusal_Medical'] });
  const out = mapModelOutput(raw, { context: context(), input: input(), usageId: 'use_x', hasImage: false, byId: knowledge.byId, now: '2026-09-14T06:00:00Z' });
  assert.equal(out.messages.length, 3);
  assert.equal(out.style_options.length, 2);
  assert.equal(out.style_options[0].feasible_in_person, true);
  assert.deepEqual(out.flags, ['refusal_medical']);
  assert.ok(validateContract('ChatTurnOutput', out).ok);
});

test('audit fixes: Arabic-Indic digits, number formats, delete_preference, unknown model id, NotFoundError, history cap', async () => {
  const byId = new Map([['kno_a', { text_ar: 'قص الشعر: 30 ريال', text_en: 'Haircut 30 SAR' }], ['kno_b', { text_ar: 'العضوية السنوية: 2499 ريال', text_en: 'Annual 2499 SAR' }]]);
  assert.deepEqual(ungroundedPrices([{ text: 'السعر ٩٩٩ ريال' }], ['kno_a'], byId), ['999'], 'Arabic-Indic digits are checked');
  assert.deepEqual(ungroundedPrices([{ text: 'بـ٣٠ ريال' }], ['kno_a'], byId), [], 'Arabic-Indic digits ground against Western digits');
  assert.deepEqual(ungroundedPrices([{ text: 'السنوية 2,499 ريال' }], ['kno_b'], byId), [], 'thousands separator is not a decimal point');
  assert.deepEqual(ungroundedPrices([{ text: 'السنوية 2,499 ريالاً' }], ['kno_a'], byId), ['2499']);
  assert.deepEqual(ungroundedPrices([{ text: '30.5 ريال' }], ['kno_a'], byId), []);
  const json = modelJson({ proposed_actions: [{ kind: 'delete_preference', label_ar: 'احذف', label_en: 'Delete', payload: { preference_kind: 'style', value_text: 'x' } }] });
  const { adapter } = adapterWith([response(json)]);
  const r = await adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.deepEqual(r.output.proposed_actions, [], 'delete_preference is never proposed by the model');
  assert.throws(() => createRakanAdapter(realConfig({ WEEKEND_MODEL_ID: 'claude-unknown-9' }), { client: fakeClient([]), knowledge }), /no price entry/);
  const notFound = adapterWith([new (await import('@anthropic-ai/sdk')).default.NotFoundError(404, { type: 'error', error: { type: 'not_found_error', message: 'model' } }, 'model', new Headers())]);
  const r2 = await notFound.adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(r2.output.error.retryable, false);
  const many = adapterWith(Array.from({ length: 520 }, () => response(modelJson())));
  for (let i = 0; i < 510; i += 1) await many.adapter({ context: context({ session_id: `ses_cap_${i}` }), input: input('x', { session_id: `ses_cap_${i}` }), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(many.client.calls.at(-1).messages.length, 1, 'new sessions still start empty under the cap');
});
