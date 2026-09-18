import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, failure, assertNoForbiddenCopy } from './helpers.mjs';
import { renderConversation } from '../../src/ui/conversation/view.js';
import { composeTurn, renderComposer } from '../../src/ui/conversation/composer.js';
import { renderActionRow } from '../../src/ui/conversation/action-row.js';
import { renderOptionalImage } from '../../src/ui/conversation/optional-image.js';
import { photoPreviewPermitted } from '../../src/ui/policy.js';
import { validateContract } from '../../src/contracts/validate.mjs';

const output = readJson('valid/chat-turn-output.json');
const inputFix = readJson('valid/chat-turn-input.json');
const context = readJson('valid/trusted-context.json');
const allowed = readJson('valid/allowed-action.json');
const observations = readJson('valid/cosmetic-observations.json');
const timeout = failure('timeout').instance;
const consent = failure('consent-required-photo').instance;
const unavailable = failure('unavailable-model').instance;

test('transcript renders ChatTurnOutput.messages and ignores proposed_actions as tools', () => {
  const view = renderConversation({
    context,
    output,
    allowedActions: [allowed],
    locale: 'ar',
  });
  assert.match(view.html, /أقدر أساعدك بالنص/);
  assert.equal(view.meta.proposedNotExecutable.includes('open_official_booking'), true);
  assert.equal(view.html.includes('data-proposed-actions="inert"'), true);
  assert.equal(view.html.includes('data-executable="true"'), true);
  assert.equal((view.html.match(/data-action-id="act_syn_book_link_a"/g) || []).length, 1);
  assert.equal(view.meta.bookingConfirmed, false);
  assertNoForbiddenCopy(view.html, assert);
});

test('composer builds ChatTurnInput with client turn_id uuid', () => {
  const built = composeTurn({
    sessionId: inputFix.session_id,
    text: inputFix.text,
    turnId: inputFix.turn_id,
    localeHint: 'ar',
  });
  const result = validateContract('ChatTurnInput', built);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(built.turn_id, inputFix.turn_id);
  assert.equal(built.image_ref, null);
});

test('empty composer shows turn.invalid copy locally and does not disable Send on a stale empty draft', () => {
  const empty = renderComposer({ locale: 'ar', draft: '' });
  assert.doesNotMatch(empty.html, /disabled data-send="true"|data-send="true"[^>]*disabled/);
  const invalid = renderComposer({
    locale: 'ar',
    draft: '',
    validationError: {
      code: 'VALIDATION_ERROR',
      message_key: 'turn.invalid',
      details: { field: 'text' },
    },
  });
  assert.match(invalid.html, /اكتب نصاً قبل الإرسال/);
  const blocked = renderComposer({ locale: 'en', draft: 'hello', disabled: true });
  assert.match(blocked.html, /disabled data-send="true"|data-send="true"[^>]*disabled/);
});

test('composer field copy is HTML-escaped', () => {
  const view = renderComposer({
    locale: 'ar',
    validationError: {
      code: 'VALIDATION_ERROR',
      message_key: '<img src=x onerror=alert(1)>',
      details: { field: 'text' },
    },
  });
  assert.match(view.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.equal(view.html.includes('<img'), false);
});

test('action row drops invented kinds and does not execute proposals', () => {
  const row = renderActionRow({
    allowedActions: [allowed, { action_id: 'act_x', kind: 'prepare_booking_request', label_ar: 'x', label_en: 'x' }],
    proposedActions: output.proposed_actions,
    locale: 'ar',
  });
  assert.deepEqual(row.meta.kinds, ['open_official_booking']);
  assert.deepEqual(row.meta.inventedDropped, ['prepare_booking_request']);
  assert.equal(row.html.includes('prepare_booking_request'), false);
  assert.equal(row.meta.bookingConfirmed, false);
  assert.match(row.html, /تسليم خارجي|مؤكد/);
});

test('photo preview stays hidden without capability and photo_analysis receipt', () => {
  assert.equal(photoPreviewPermitted(context), false);
  const blocked = renderOptionalImage({ context, imageRef: 'img_syn_session_a', allowedActions: [] });
  assert.equal(blocked.meta.previewShown, false);
  assert.equal(blocked.meta.photoOptional, true);
  assert.match(blocked.html, /data-photo-preview="hidden"/);
});

test('photo preview shows only when photo=enabled and active photo_analysis receipt', () => {
  const enabled = {
    ...context,
    capabilities: { ...context.capabilities, photo: 'enabled' },
    consents: [{
      ...readJson('valid/permission-receipt.json'),
      kind: 'photo_analysis',
      receipt_id: 'rcp_syn_photo_a',
      notice_version: 'notice_photo_v1',
      retention_policy_key: 'ret_photo_v1',
    }],
  };
  assert.equal(photoPreviewPermitted(enabled), true);
  const shown = renderOptionalImage({
    context: enabled,
    imageRef: observations.image_ref,
    allowedActions: [{
      ...allowed,
      action_id: 'act_syn_nophoto',
      kind: 'continue_without_photo',
      label_ar: 'نكمل بدون صورة',
      label_en: 'Continue without a photo',
      url: null,
    }],
  });
  assert.equal(shown.meta.previewShown, true);
  assert.equal(shown.meta.continueOffered, true);
  assert.equal(shown.meta.continueExecutable, true);
});

test('conversation always keeps a text path; 0–2 style options; observation not_inferred', () => {
  const withObs = {
    ...output,
    observations,
    style_options: output.style_options.concat(output.style_options),
  };
  const view = renderConversation({ context, output: withObs, allowedActions: [allowed] });
  assert.ok(view.meta.styleCount <= 2);
  assert.match(view.html, /data-not-inferred="identity"/);
  assert.match(view.html, /data-not-inferred="age"/);
  assert.equal(view.meta.photoOptional, true);
  assert.match(view.html, /id="wk-composer-text"/);
});

test('timeout keeps draft and does not invent a mock reply', () => {
  const view = renderConversation({
    context,
    output: timeout,
    allowedActions: [],
    draft: 'مسودة الزبون',
    error: timeout.error,
  });
  assert.equal(view.meta.success, false);
  assert.match(view.html, /data-error-code="TIMEOUT"/);
  assert.match(view.html, /مسودة الزبون/);
  assert.equal(view.html.includes(timeout.messages[0].text), true);
});

test('consent-required photo still offers continue-without-photo copy from fixture', () => {
  const view = renderConversation({
    context,
    output: consent,
    allowedActions: [{
      ...allowed,
      action_id: 'act_syn_nophoto2',
      kind: 'continue_without_photo',
      url: null,
      label_ar: 'نكمل بدون صورة',
      label_en: 'Continue without a photo',
    }],
  });
  assert.match(view.html, /continue_without_photo/);
  assert.equal(view.meta.photoPreviewShown, false);
});

test('unavailable model does not render a mock success turn', () => {
  const view = renderConversation({
    context,
    output: unavailable,
    allowedActions: [],
  });
  assert.equal(view.html.includes('data-success="true"'), false);
  assert.match(view.html, /MODEL_UNAVAILABLE|النموذج غير مُعد|غير متاح/);
});
