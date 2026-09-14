import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, assertNoForbiddenCopy } from './helpers.mjs';
import { renderApprovedBrief } from '../../src/ui/brief/approved-brief.js';
import { renderShareControls } from '../../src/ui/brief/share-controls.js';
import { shareKindsSeparate } from '../../src/ui/policy.js';

const brief = readJson('valid/barber-brief.json');
const allowed = readJson('valid/allowed-action.json');
const decline = readJson('valid/allowed-action.decline.json');

const shareText = {
  ...allowed,
  action_id: 'act_syn_share_text',
  kind: 'share_brief_text',
  label_ar: 'مشاركة الموجز',
  label_en: 'Share the brief',
  url: null,
  requires_receipt_kind: 'staff_sharing_text',
};
const sharePhoto = {
  ...allowed,
  action_id: 'act_syn_share_photo',
  kind: 'share_photo_ref',
  label_ar: 'مشاركة مرجع الصورة',
  label_en: 'Share photo reference',
  url: null,
  requires_receipt_kind: 'staff_sharing_photo',
};

test('share_brief_text and share_photo_ref are separate controls', () => {
  const split = shareKindsSeparate([shareText, sharePhoto, decline]);
  assert.equal(split.bundled, false);
  assert.equal(split.text.length, 1);
  assert.equal(split.photo.length, 1);
  const controls = renderShareControls({ allowedActions: [shareText, sharePhoto] });
  assert.equal(controls.meta.bundled, false);
  assert.equal(controls.meta.sameControl, false);
  assert.equal(controls.meta.hasText, true);
  assert.equal(controls.meta.hasPhoto, true);
  assert.match(controls.html, /data-action-kind="share_brief_text"/);
  assert.match(controls.html, /data-action-kind="share_photo_ref"/);
  assert.match(controls.html, /مشاركة ملاحظات الصورة/);
  assert.equal(controls.html.includes('data-share-bundled="false"'), true);
});

test('short approved brief is a read model with barber as preference not allocation', () => {
  const view = renderApprovedBrief({
    brief: {
      ...brief,
      status: 'approved',
      provenance: { ...brief.provenance, approved_by_subject_at: '2026-09-14T10:15:00Z' },
      barber_preference: 'prefers-named-barber',
    },
    allowedActions: [shareText, sharePhoto],
  });
  assert.equal(view.meta.barberIsPreference, true);
  assert.equal(view.meta.bundledShare, false);
  assert.match(view.html, /ليس تخصيص/);
  assert.match(view.html, /data-allocation="preference"/);
  assert.equal(view.meta.success, false);
  assertNoForbiddenCopy(view.html, assert);
});

test('brief does not show success before ActionResult', () => {
  const idle = renderApprovedBrief({ brief, allowedActions: [shareText] });
  assert.equal(idle.meta.success, false);
  assert.equal(idle.html.includes('data-success="true"'), false);
  const after = renderApprovedBrief({
    brief,
    allowedActions: [shareText],
    actionResult: readJson('valid/action-result.json'),
  });
  assert.equal(after.meta.success, false);
  assert.match(after.html, /data-outcome="external_handoff"/);
  assert.match(after.html, /data-booking="unconfirmed"/);
});
