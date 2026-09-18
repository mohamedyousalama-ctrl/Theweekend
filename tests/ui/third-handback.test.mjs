import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJson } from './helpers.mjs';
import { renderConsentStep } from '../../src/ui/consent/consent-step.js';
import { renderBriefDraft } from '../../src/ui/brief/brief-draft.js';
import { renderOptionalImage } from '../../src/ui/conversation/optional-image.js';
import { receiptKindFromConsentError } from '../../src/ui/policy.js';
import { captureFocusKey, restoreFocus } from '../../src/ui/focus.js';
import { createRoot } from './dom-shim.mjs';
import { t } from '../../src/ui/copy.js';

const brief = readJson('valid/barber-brief.json');
const context = readJson('valid/trusted-context.json');
const receipt = readJson('valid/permission-receipt.json');

test('consent step uses the named receipt kind and notice copy', () => {
  const view = renderConsentStep({ kind: 'photo_analysis', locale: 'ar' });
  assert.equal(view.meta.shown, true);
  assert.match(view.html, /data-consent-kind="photo_analysis"/);
  assert.match(view.html, /data-consent-grant="true"/);
  assert.match(view.html, /تحليل الصورة اختياري/);
  assert.equal(view.meta.canRevoke, false);
  const withReceipt = renderConsentStep({
    kind: 'text_preferences',
    receipts: [receipt],
  });
  assert.equal(withReceipt.meta.canRevoke, true);
  assert.match(withReceipt.html, /data-consent-revoke="true"/);
  assert.match(withReceipt.html, /data-receipt-id="rcp_syn_prefs_a"/);
});

test('receipt kind is taken from the error or requires_receipt_kind fallback', () => {
  assert.equal(receiptKindFromConsentError({
    code: 'CONSENT_REQUIRED',
    message_key: 'photo.consent_required',
    details: { capability: 'photo' },
  }), 'photo_analysis');
  assert.equal(receiptKindFromConsentError({
    code: 'CONSENT_REQUIRED',
    message_key: 'preference.consent_required',
    details: { capability: 'preferences' },
  }), 'text_preferences');
  assert.equal(receiptKindFromConsentError({
    code: 'CONSENT_REQUIRED',
    message_key: 'brief.share_consent',
    details: { capability: 'staff_inbox' },
  }), 'staff_sharing_text');
  assert.equal(receiptKindFromConsentError({
    code: 'CONSENT_REQUIRED',
    message_key: 'brief.photo_consent',
  }), 'staff_sharing_photo');
  assert.equal(receiptKindFromConsentError({
    code: 'CONSENT_REQUIRED',
    message_key: 'action.consent_required',
    details: { action_id: 'act_syn_x' },
  }, 'staff_sharing_photo'), 'staff_sharing_photo');
});

test('action.consent_required uses the default fallback, not a duplicate case', () => {
  assert.equal(receiptKindFromConsentError({
    code: 'CONSENT_REQUIRED',
    message_key: 'action.consent_required',
  }, 'text_preferences'), 'text_preferences');
  assert.equal(receiptKindFromConsentError({
    code: 'CONSENT_REQUIRED',
    message_key: 'action.consent_required',
  }), null);
  const src = readFileSync(join(ROOT, 'src/ui/policy.js'), 'utf8');
  assert.equal((src.match(/case 'action\.consent_required'/g) || []).length, 0);
});

test('brief draft approve control is not an invented AllowedAction kind', () => {
  const view = renderBriefDraft({ draft: { ...brief, status: 'draft' } });
  assert.equal(view.meta.shown, true);
  assert.match(view.html, /data-action="approve-brief"/);
  assert.equal(view.html.includes('data-action-id'), false);
  assert.equal(view.html.includes('approve_brief'), false);
  const hidden = renderBriefDraft({ draft: { ...brief, status: 'approved' } });
  assert.equal(hidden.meta.shown, false);
});

test('photo upload is shown only when capabilities.photo is enabled; continue-without-photo remains', () => {
  const blocked = renderOptionalImage({ context, imageRef: null, allowedActions: [] });
  assert.equal(blocked.meta.uploadShown, false);
  assert.equal(blocked.html.includes('wk-photo-upload'), false);
  const enabled = renderOptionalImage({
    context: { ...context, capabilities: { ...context.capabilities, photo: 'enabled' } },
    allowedActions: [],
  });
  assert.equal(enabled.meta.uploadShown, true);
  assert.equal(enabled.meta.photoOptional, true);
  assert.match(enabled.html, /data-photo-upload="enabled"/);
  assert.match(enabled.html, /data-action-kind="continue_without_photo"/);
});

test('copy translates the previously raw labels', () => {
  assert.equal(t('ar', 'value_text'), 'نص التفضيل');
  assert.equal(t('en', 'value_text'), 'Preference text');
  assert.equal(t('ar', 'booking_handoff'), 'الحجز');
  assert.equal(t('ar', 'photo_analysis'), 'تحليل الصورة');
  assert.equal(t('ar', 'share_photo'), 'مشاركة ملاحظات الصورة');
});

test('focus helper restores by id after the node is replaced', () => {
  const root = createRoot();
  root.innerHTML = '<textarea id="wk-composer-text" name="text"></textarea>';
  const first = root.querySelector('#wk-composer-text');
  first.focus();
  const key = captureFocusKey(root);
  assert.deepEqual(key, { kind: 'id', value: 'wk-composer-text' });
  root.innerHTML = '<textarea id="wk-composer-text" name="text"></textarea>';
  restoreFocus(root, key);
  assert.equal(root._activeElement.getAttribute('id'), 'wk-composer-text');
  assert.ok(root._activeElement !== first);
});

test('handoff Accept/Release restore by their own control attr, not the card data-handoff-id', () => {
  const markup = [
    '<div data-handoff-id="hnd_syn_a" data-handoff-status="received">',
    '<button type="button" data-handoff-id="hnd_syn_a" data-handoff-accept="true" data-handoff-control="accept:hnd_syn_a">قبول</button>',
    '<button type="button" data-handoff-id="hnd_syn_a" data-handoff-release="true" data-handoff-control="release:hnd_syn_a">إفلات</button>',
    '</div>',
  ].join('');
  const root = createRoot();
  root.innerHTML = markup;
  const accept = root.querySelector('[data-handoff-control="accept:hnd_syn_a"]');
  accept.focus();
  const key = captureFocusKey(root);
  assert.deepEqual(key, { kind: 'attr', attr: 'data-handoff-control', value: 'accept:hnd_syn_a' });
  root.innerHTML = markup;
  restoreFocus(root, key);
  assert.equal(root._activeElement.getAttribute('data-handoff-control'), 'accept:hnd_syn_a');
  assert.equal(root._activeElement.tagName, 'button');
});
