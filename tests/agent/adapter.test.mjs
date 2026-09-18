import test from 'node:test';
import assert from 'node:assert/strict';
import { createRakanAdapter, mapModelOutput, ungroundedPrices, ungroundedFacts, ungroundedLinks, linksIn, canonicalAmount, normalizeDigits, estimateCostMinor, maxCostMinorPerTurn, sniffImageMime, MODEL_OUTPUT_SCHEMA, customerLang, errorText, PROMPT_VERSION, isGreetingOnly } from '../../src/agent/adapter.mjs';
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
  assert.equal(first.usage.prompt_version, PROMPT_VERSION);
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
  assert.equal(output.messages[0].lang, 'ar');
  assert.ok(!/40/.test(output.messages[0].text), 'the wrong price never reaches the customer');
  assert.equal(usage.outcome, 'error');
  assert.ok(validateContract('ChatTurnOutput', output).ok);
});

test('grounding failure for an English customer uses English reply[].lang', async () => {
  const bad = modelJson({ reply: [{ text: 'A haircut is 40 SAR', lang: 'en' }], knowledge_refs: [] });
  const { adapter } = adapterWith([response(bad), response(bad)]);
  const { output } = await adapter({ context: context(), input: input('How much is a haircut?'), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(customerLang('How much is a haircut?'), 'en');
  assert.equal(output.state, 'error');
  assert.equal(output.error.message_key, 'agent.ungrounded_price');
  assert.equal(output.messages.length, 1);
  assert.equal(output.messages[0].lang, 'en');
  assert.equal(output.messages[0].text, errorText('agent.ungrounded_price', 'en'));
  assert.ok(!/40/.test(output.messages[0].text), 'the wrong price never reaches the customer');
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

test('greeting-only turns drop dumped styles, brief and extra actions', () => {
  assert.equal(isGreetingOnly('هلا والله'), true);
  assert.equal(isGreetingOnly('أبغى فيد'), false);
  assert.equal(isGreetingOnly('كم سعر الحلاقة؟'), false);
  const raw = modelJson({
    reply: [{ text: 'هلا والله. تبي حلاقة؟', lang: 'ar' }],
    style_options: [
      { name_ar: 'فيد', name_en: 'fade', why_ar: 'x', upkeep_ar: 'y', feasible_in_person: 'unknown' },
      { name_ar: 'كلاسيك', name_en: 'classic', why_ar: 'x', upkeep_ar: 'y', feasible_in_person: 'unknown' },
    ],
    brief_draft: { present: true, barber_preference: '', requested_look_ar: 'فيد مع تحديد اللحية', do_not: [] },
    proposed_actions: [
      { kind: 'open_official_booking', label_ar: 'حجز', label_en: 'book', payload: { preference_kind: 'none', value_text: '' } },
      { kind: 'save_preference', label_ar: 'حفظ', label_en: 'save', payload: { preference_kind: 'style', value_text: 'فيد' } },
      { kind: 'continue_without_photo', label_ar: 'بدون', label_en: 'skip', payload: { preference_kind: 'none', value_text: '' } },
    ],
  });
  const dumped = mapModelOutput(raw, {
    context: context(),
    input: input('هلا والله'),
    usageId: 'use_x',
    hasImage: false,
    byId: knowledge.byId,
    now: '2026-09-14T06:00:00Z',
  });
  assert.equal(dumped.style_options.length, 0);
  assert.equal(dumped.brief_draft, null);
  assert.equal(dumped.proposed_actions.length, 0);
  const priced = mapModelOutput(raw, {
    context: context(),
    input: input('كم سعر الحلاقة؟'),
    usageId: 'use_x',
    hasImage: false,
    byId: knowledge.byId,
    now: '2026-09-14T06:00:00Z',
  });
  assert.equal(priced.style_options.length, 2);
  assert.equal(priced.proposed_actions.some((a) => a.kind === 'open_official_booking'), true);
  const photoAsk = mapModelOutput(raw, {
    context: context(),
    input: input('صورتي'),
    usageId: 'use_x',
    hasImage: false,
    byId: knowledge.byId,
    now: '2026-09-14T06:00:00Z',
  });
  assert.equal(photoAsk.style_options.length, 0);
  assert.equal(photoAsk.brief_draft, null);
  assert.equal(photoAsk.proposed_actions.length, 0);
});

test('audit fixes: Arabic-Indic digits, number formats, delete_preference, unknown model id, NotFoundError, history cap', async () => {
  const byId = new Map([['kno_a', { text_ar: 'قص الشعر: 30 ريال', text_en: 'Haircut 30 SAR' }], ['kno_b', { text_ar: 'العضوية السنوية: 2499 ريال', text_en: 'Annual 2499 SAR' }]]);
  assert.deepEqual(ungroundedPrices([{ text: 'السعر ٩٩٩ ريال' }], ['kno_a'], byId), ['999'], 'Arabic-Indic digits are checked');
  assert.deepEqual(ungroundedPrices([{ text: 'بـ٣٠ ريال' }], ['kno_a'], byId), [], 'Arabic-Indic digits ground against Western digits');
  assert.deepEqual(ungroundedPrices([{ text: 'السنوية 2,499 ريال' }], ['kno_b'], byId), [], 'thousands separator is not a decimal point');
  assert.deepEqual(ungroundedPrices([{ text: 'السنوية 2,499 ريالاً' }], ['kno_a'], byId), ['2499']);
  assert.deepEqual(ungroundedPrices([{ text: '30.5 ريال' }], ['kno_a'], byId), ['30.5'], 'a different decimal amount is a different price');
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

test('post-merge review: amounts are compared as full values and only against currency-marked record amounts', () => {
  const byId = new Map([
    ['kno_hair', { text_ar: 'قص الشعر: 30 ريال، المدة 35 دقيقة، السعر شامل الضريبة.', text_en: 'Haircut: 30 SAR, 35 minutes, VAT inclusive.' }],
    ['kno_dand', { text_ar: 'باي باي قشرة: 149 ريال شامل الضريبة، المدة 45 دقيقة.', text_en: 'Dandruff wash: 149 SAR, 45 minutes.' }],
    ['kno_beard', { text_ar: 'تهذيب اللحية: 20 ريال', text_en: 'Beard trim: 20 SAR' }],
    ['kno_half', { text_ar: 'عرض: 12.5 ريال', text_en: 'Offer: 12.5 SAR' }],
    ['kno_plan', { text_ar: 'عضوية: 5 زيارات خلال 30 يوم؛ زيارتان = 100 ريال؛ الجلسة 30 دقيقة', text_en: 'Plan: 5 visits per 30 days; 2 visits = 100 SAR; a 30-minute session' }],
    ['kno_glued', { text_ar: 'تنتهي مع نهاية الـ30 يوم', text_en: '' }],
  ]);
  assert.equal(canonicalAmount('2,499'), '2499');
  assert.equal(canonicalAmount('2,5'), '2.5');
  assert.equal(canonicalAmount('30.50'), '30.5');
  assert.equal(canonicalAmount('007'), '7');
  assert.deepEqual(ungroundedPrices([{ text: 'الحلاقة 35 ريال' }], ['kno_hair'], byId), ['35'], 'a 35-minute duration does not ground a 35-riyal price');
  assert.deepEqual(ungroundedPrices([{ text: 'الحلاقة 30.5 ريال' }], ['kno_hair'], byId), ['30.5']);
  assert.deepEqual(ungroundedPrices([{ text: 'Haircut is SAR 30 today' }], ['kno_hair'], byId), [], 'currency-first amounts are matched');
  assert.deepEqual(ungroundedPrices([{ text: 'Haircut is SAR 300 today' }], ['kno_hair'], byId), ['300']);
  assert.deepEqual(ungroundedPrices([{ text: 'لا، مو 300 ريال — الحلاقة 30 ريال' }], ['kno_hair'], byId), ['300'], 'no exemption: a wrong price is not repeated, even to deny it');
  assert.deepEqual(ungroundedPrices([{ text: 'لا، الحلاقة 30 ريال' }], ['kno_hair'], byId), [], 'the right way to correct: state the grounded price only');
  assert.deepEqual(ungroundedPrices([{ text: 'أيوه صحيح، الحلاقة 5 ريال والدقن 20 ريال' }], ['kno_hair', 'kno_beard'], byId), ['5'], 'a grounded amount beside a wrong one does not launder it');
  assert.deepEqual(ungroundedPrices([{ text: 'العرض 12.5 ريال' }], ['kno_half'], byId), [], 'decimal amounts are read whole');
  assert.deepEqual(ungroundedPrices([{ text: 'العرض 2.5 ريال' }], ['kno_hair'], byId), ['2.5'], 'the digits after a decimal point never ground alone');
  assert.deepEqual(ungroundedFacts([{ text: 'المدة 45 دقيقة تقريباً' }], ['kno_hair'], byId), ['minutes:45']);
  assert.deepEqual(ungroundedFacts([{ text: 'المدة 45 دقيقة تقريباً' }], ['kno_hair', 'kno_dand'], byId), []);
  assert.deepEqual(ungroundedFacts([{ text: 'العضوية 5 زيارات خلال 30 يوم وفيها خصم 15%' }], ['kno_hair'], byId).sort(), ['days:30', 'percent:15', 'visits:5']);
  assert.deepEqual(ungroundedFacts([{ text: 'لا، المدة ٣٥ دقيقة مو 45 دقيقة' }], ['kno_hair'], byId), ['minutes:45'], 'no exemption for the customer\'s figure, Arabic-Indic digits read the same');
  assert.deepEqual(ungroundedFacts([{ text: 'خلال ٣٠ يوم' }], [], byId), ['days:30']);
  assert.deepEqual(ungroundedFacts([{ text: 'العضوية 2.5 زيارات' }], ['kno_plan'], byId), ['visits:2.5'], 'a fractional figure never grounds on its last digits');
  assert.deepEqual(ungroundedFacts([{ text: 'تقريباً نص ساعة' }], ['kno_hair'], byId), ['minutes:30'], 'half an hour is a duration');
  assert.deepEqual(ungroundedFacts([{ text: 'تقريباً نصف ساعة' }], ['kno_plan'], byId), [], 'half an hour equals a 30-minute record');
  assert.deepEqual(ungroundedFacts([{ text: 'المدة ساعة' }], ['kno_hair'], byId), ['minutes:60']);
  assert.deepEqual(ungroundedFacts([{ text: 'وساعتين بعدها' }], ['kno_hair'], byId), ['minutes:120']);
  assert.deepEqual(ungroundedFacts([{ text: 'ساعتين تقريباً' }], ['kno_hair'], byId), ['minutes:120']);
  assert.deepEqual(ungroundedFacts([{ text: 'about 2 hours' }], ['kno_hair'], byId), ['minutes:120']);
  assert.deepEqual(ungroundedFacts([{ text: 'الساعة 3 العصر' }], ['kno_hair'], byId), [], 'o\'clock is not a duration');
  assert.deepEqual(ungroundedFacts([{ text: 'خمس زيارات بالشهر' }], ['kno_plan'], byId), [], 'number words count');
  assert.deepEqual(ungroundedFacts([{ text: 'زيارتين بالشهر' }], ['kno_plan'], byId), [], 'the dual form counts');
  assert.deepEqual(ungroundedFacts([{ text: 'ثلاث زيارات بالشهر' }], ['kno_plan'], byId), ['visits:3']);
  assert.deepEqual(ungroundedFacts([{ text: 'five visits a month' }], ['kno_plan'], byId), []);
  assert.deepEqual(ungroundedFacts([{ text: 'a 35-minute cut' }], ['kno_hair'], byId), [], 'hyphenated English durations');
  assert.deepEqual(ungroundedFacts([{ text: 'about a 300-minute cut' }], ['kno_hair'], byId), ['minutes:300'], 'a hyphenated invented duration is caught');
  assert.deepEqual(ungroundedFacts([{ text: 'و5 دقايق زيادة' }], ['kno_hair'], byId), ['minutes:5'], 'a proclitic glued to a digit does not hide it');
  assert.deepEqual(ungroundedFacts([{ text: 'وخمس زيارات' }], ['kno_plan'], byId), [], 'a proclitic glued to a number word');
  assert.deepEqual(ungroundedFacts([{ text: 'بثلاث زيارات' }], ['kno_plan'], byId), ['visits:3']);
  assert.deepEqual(ungroundedFacts([{ text: '5زيارات' }], ['kno_plan'], byId), [], 'no space between digit and unit');
  assert.deepEqual(ungroundedFacts([{ text: 'المدة 30 يوم من التفعيل' }], ['kno_glued'], byId), [], 'a record that only says «الـ30 يوم» still grounds 30 days');
  assert.deepEqual(ungroundedFacts([{ text: 'عندك يومين وثلاث زيارات' }], ['kno_plan'], byId).sort(), ['days:2', 'visits:3']);
  assert.deepEqual(ungroundedFacts([{ text: 'كم ساعة تحتاج؟' }], ['kno_hair'], byId), [], 'a question is not a duration');
  assert.deepEqual(ungroundedFacts([{ text: 'ساعة الافتتاح غير معروفة' }], ['kno_hair'], byId), [], 'the opening hour is not a duration');
  assert.deepEqual(ungroundedFacts([{ text: 'حوالي ساعة' }], ['kno_hair'], byId), ['minutes:60'], 'a framed bare hour is a duration');
  assert.deepEqual(ungroundedFacts([{ text: 'ساعة واحدة تقريباً' }], ['kno_hair'], byId), ['minutes:60']);
  assert.deepEqual(ungroundedFacts([{ text: 'it takes an hour' }], ['kno_hair'], byId), ['minutes:60']);
  assert.deepEqual(ungroundedFacts([{ text: 'we reply within a day, book a visit' }], ['kno_hair'], byId), [], 'English articles are hedges, not counts');
  assert.deepEqual(ungroundedFacts([{ text: 'an hour and a half' }], ['kno_hair'], byId), ['minutes:90']);
  assert.deepEqual(ungroundedFacts([{ text: 'تقريباً 35 دقيقة' }], ['kno_hair'], byId), []);
});

test('post-merge review: links must come from a knowledge record', () => {
  const links = linksIn(knowledge.enabled);
  assert.ok(links.has('https://theweekendhairstyling.com/book?branchId=3a1ca9a9-12bd-36bb-7b56-f4b957522fbe'));
  assert.deepEqual(ungroundedLinks([{ text: 'احجز من https://theweekendhairstyling.com/book.' }], links), [], 'a shortening of a record link is fine');
  assert.deepEqual(ungroundedLinks([{ text: 'هنا https://theweekendhairstyling.com/book?branchId=3a1ca9a9-12bd-36bb-7b56-f4b957522fbe' }], links), []);
  assert.deepEqual(ungroundedLinks([{ text: 'شوف https://theweekendhairstyling.com/offers/ramadan' }], links), ['https://theweekendhairstyling.com/offers/ramadan']);
  assert.deepEqual(ungroundedLinks([{ text: 'see http://evil.example/book' }], links), ['http://evil.example/book']);
  assert.deepEqual(ungroundedLinks([{ text: 'شوف “https://theweekendhairstyling.com/book”' }], links), [], 'curly quotes are not part of the link');
  assert.deepEqual(ungroundedLinks([{ text: 'https://THEWEEKENDHAIRSTYLING.COM/book' }], links), [], 'hosts are case-insensitive');
  assert.deepEqual(ungroundedLinks([{ text: 'https://theweekendhairstyling.com/BOOK' }], links), ['https://theweekendhairstyling.com/BOOK'], 'paths are case-sensitive');
  assert.deepEqual(ungroundedLinks([{ text: 'https://theweekendhairstyling.com/book?branchid=3a1ca9a9-12bd-36bb-7b56-f4b957522fbe' }], links), ['https://theweekendhairstyling.com/book?branchid=3a1ca9a9-12bd-36bb-7b56-f4b957522fbe'], 'query strings are case-sensitive');
  assert.deepEqual(ungroundedLinks([{ text: 'https://theweekendhairstyling.com/book?branchId=3a1ca9a9-12bd-36bb-7b56-f4b957522fbe#top' }], links), [], 'a fragment does not change the page');
  assert.deepEqual(ungroundedLinks([{ text: 'https://t' }], links), ['https://t'], 'only the query string may be dropped, not an arbitrary tail');
  assert.deepEqual(ungroundedLinks([{ text: 'https://theweekendhairstyling.com/boo' }], links), ['https://theweekendhairstyling.com/boo']);
  assert.deepEqual(ungroundedLinks([{ text: 'https://theweekendhairstyling.com.evil.tld/book' }], links), ['https://theweekendhairstyling.com.evil.tld/book']);
  const cited = (ids) => linksIn(ids.map((id) => knowledge.byId.get(id)));
  assert.deepEqual(ungroundedLinks([{ text: 'احجز من https://theweekendhairstyling.com/book' }], cited([])), ['https://theweekendhairstyling.com/book'], 'a pack link without its record cited is not grounded');
  assert.deepEqual(ungroundedLinks([{ text: 'احجز من https://theweekendhairstyling.com/book' }], cited(['kno_mrs_booking_url'])), []);
  assert.deepEqual(ungroundedLinks([{ text: 'احجز من https://theweekendhairstyling.com/book' }], cited([PRICE_REF])), ['https://theweekendhairstyling.com/book'], 'citing an unrelated record does not ground the link');
});

test('post-merge review: an ungrounded figure or link gets one corrective retry, then a closed error', async () => {
  const badFact = modelJson({ reply: [{ text: 'قص الشعر بـ30 ريال والمدة 90 دقيقة', lang: 'ar' }] });
  const a = adapterWith([response(badFact), response(badFact)]);
  const r = await a.adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(a.client.calls.length, 2);
  assert.match(a.client.calls[1].system.at(-1).text, /minutes 90/);
  assert.equal(r.output.state, 'error');
  assert.equal(r.output.error.message_key, 'agent.ungrounded_fact');
  assert.deepEqual(r.output.flags, ['unknown_fact']);
  assert.ok(validateContract('ChatTurnOutput', r.output).ok);
  assert.ok(validateContract('ModelUsageRecord', r.usage).ok);
  const uncited = modelJson({ reply: [{ text: 'احجز من https://theweekendhairstyling.com/book', lang: 'ar' }], knowledge_refs: [PRICE_REF] });
  const u = adapterWith([response(uncited), response(uncited)]);
  const ru = await u.adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(ru.output.error.message_key, 'agent.ungrounded_link', 'a real pack link still needs its record cited');
  assert.match(u.client.calls[1].system.at(-1).text, /list that record's id in knowledge_refs/);
  const badLink = modelJson({ reply: [{ text: 'احجز من https://theweekendhairstyling.com/promo', lang: 'ar' }] });
  const b = adapterWith([response(badLink), response(modelJson())]);
  const r2 = await b.adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(b.client.calls.length, 2);
  assert.match(b.client.calls[1].system.at(-1).text, /links \(https:\/\/theweekendhairstyling\.com\/promo\)/);
  assert.equal(r2.output.state, 'ok', 'the corrected second attempt is accepted');
  const c = adapterWith([response(badLink), response(badLink)]);
  const r3 = await c.adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(r3.output.error.message_key, 'agent.ungrounded_link');
  assert.ok(validateContract('ChatTurnOutput', r3.output).ok);
});

test('post-merge review: tokens of every attempt are charged, cost is integer arithmetic rounded up', async () => {
  const { adapter, client } = adapterWith([response('not json at all'), response(modelJson())]);
  const r = await adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(client.calls.length, 2);
  assert.equal(r.output.state, 'ok');
  assert.equal(r.usage.input_tokens, 2400, 'both attempts are summed');
  assert.equal(r.usage.output_tokens, 360);
  assert.equal(r.usage.cost_estimate_minor, estimateCostMinor('claude-opus-5', { input_tokens: 2400, output_tokens: 360, cache_read_input_tokens: 1800, cache_creation_input_tokens: 0 }));
  const failing = adapterWith([response('still not json'), badRequest()]);
  const r2 = await failing.adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(r2.output.error.code, 'MODEL_UNAVAILABLE');
  assert.equal(r2.usage.input_tokens, 1200, 'the first, paid attempt is still recorded when the retry throws');
  assert.equal(estimateCostMinor('claude-opus-5', { input_tokens: 1_000_000 }), 500);
  assert.equal(estimateCostMinor('claude-opus-5', { output_tokens: 1_000_000 }), 2500);
  assert.equal(estimateCostMinor('claude-opus-5', { cache_read_input_tokens: 1_000_000 }), 50);
  assert.equal(estimateCostMinor('claude-opus-5', { cache_creation_input_tokens: 1_000_000 }), 625);
  assert.equal(estimateCostMinor('claude-opus-5', { input_tokens: 1 }), 1, 'a sub-cent call is rounded up, never to zero');
  assert.equal(estimateCostMinor('claude-opus-5', { input_tokens: 0, output_tokens: 0 }), 0);
  assert.equal(estimateCostMinor('claude-sonnet-5', { input_tokens: 333_333, output_tokens: 1 }), 67, 'ceil(66.67 + 0.001)');
  assert.equal(estimateCostMinor('claude-unknown', { input_tokens: 5 }), null);
});

test('post-merge review: no retry after the turn deadline or an abort, and a late completion is never remembered', async () => {
  const ticks = [1_000, 1_000, 7_500, 7_500, 7_500, 7_500];
  let i = 0;
  const clock = () => ticks[Math.min(i++, ticks.length - 1)];
  const bad = modelJson({ reply: [{ text: 'الحلاقة بـ40 ريال بس', lang: 'ar' }], knowledge_refs: [] });
  const client = fakeClient([response(bad), response(modelJson())]);
  const adapter = createRakanAdapter(realConfig(), { client, knowledge, clock });
  const r = await adapter({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(client.calls.length, 1, 'no second call with under 2 s left of the 8 s turn window');
  assert.equal(r.output.error.message_key, 'agent.ungrounded_price');

  const aborter = new AbortController();
  const seen = [];
  const abortingClient = {
    messages: {
      async create(params, opts) {
        seen.push(opts?.signal);
        aborter.abort();
        return response(modelJson());
      },
    },
  };
  const adapter2 = createRakanAdapter(realConfig(), { client: abortingClient, knowledge, clock: () => 1_000 });
  const r2 = await adapter2({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null, signal: aborter.signal });
  assert.equal(seen[0], aborter.signal, 'the turn signal reaches the SDK request');
  assert.equal(r2.output.state, 'unavailable');
  assert.equal(r2.output.error.message_key, 'model.timeout');
  assert.equal(r2.usage.outcome, 'timeout');
  assert.equal(r2.usage.input_tokens, 1200, 'work the provider already did is still accounted');
  assert.ok(validateContract('ChatTurnOutput', r2.output).ok);
  assert.ok(validateContract('ModelUsageRecord', r2.usage).ok);
  const plain = fakeClient([response(modelJson())]);
  const adapter3 = createRakanAdapter(realConfig(), { client: plain, knowledge, clock: () => 1_000 });
  await adapter3({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(plain.calls[0].messages.length, 1);
  const abortedThenPlain = fakeClient([response(modelJson()), response(modelJson())]);
  const adapter4 = createRakanAdapter(realConfig(), { client: abortedThenPlain, knowledge, clock: () => 1_000 });
  const ac = new AbortController();
  ac.abort();
  await adapter4({ context: context(), input: input(), now: '2026-09-14T06:00:00Z', image_bytes: null, signal: ac.signal });
  await adapter4({ context: context(), input: input('ثاني'), now: '2026-09-14T06:00:00Z', image_bytes: null });
  assert.equal(abortedThenPlain.calls[1].messages.length, 1, 'an aborted turn left no history behind');
});

test('post-merge review: share_photo_ref is bound to the photo of this turn, never to a model-chosen id', async () => {
  const json = modelJson({ proposed_actions: [{ kind: 'share_photo_ref', label_ar: 'شارك الصورة', label_en: 'Share photo', payload: { preference_kind: 'none', value_text: '' } }] });
  const withImage = mapModelOutput(json, { context: context({ consents: [photoConsent()] }), input: input('صورتي', { image_ref: 'img_turn_1' }), usageId: 'use_x', hasImage: true, byId: knowledge.byId, now: '2026-09-14T06:00:00Z' });
  assert.deepEqual(withImage.proposed_actions.map((a) => [a.kind, a.payload]), [['share_photo_ref', { image_ref: 'img_turn_1' }]]);
  assert.ok(validateContract('ChatTurnOutput', withImage).ok);
  const noRef = mapModelOutput(json, { context: context(), input: input('نص'), usageId: 'use_x', hasImage: true, byId: knowledge.byId, now: '2026-09-14T06:00:00Z' });
  assert.deepEqual(noRef.proposed_actions, [], 'no image reference in the turn → no share action');
});

test('the adapter declares a per-turn cost ceiling for the server to reserve before the call', () => {
  const { adapter } = adapterWith([response(modelJson())]);
  assert.equal(adapter.costCeilingMinor, maxCostMinorPerTurn('claude-opus-5'));
  assert.ok(Number.isInteger(adapter.costCeilingMinor) && adapter.costCeilingMinor > 0);
  assert.ok(adapter.costCeilingMinor < 500, 'well under the daily cap of a few dollars');
  assert.equal(maxCostMinorPerTurn('claude-opus-5'), 2 * estimateCostMinor('claude-opus-5', { input_tokens: 40_000, output_tokens: 4096, cache_creation_input_tokens: 20_000 }));
  assert.equal(maxCostMinorPerTurn('claude-unknown'), null);
  assert.ok(maxCostMinorPerTurn('claude-sonnet-5') < maxCostMinorPerTurn('claude-opus-5'));
});
