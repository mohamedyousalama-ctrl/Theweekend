import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, failure, assertNoForbiddenCopy } from './helpers.mjs';
import { renderPreferenceList } from '../../src/ui/preferences/preference-list.js';
import { renderPreferenceEditor } from '../../src/ui/preferences/preference-editor.js';
import { preferenceVisibleInM1 } from '../../src/ui/policy.js';

const pref = readJson('valid/preference.json');
const allowed = readJson('valid/allowed-action.json');
const conflict = failure('preference-conflict').instance;
const done = {
  contract_version: '0.1.0',
  action_id: 'act_syn_save_pref',
  outcome: 'done',
  receipt_id: 'rcp_syn_prefs_a',
  message_key: 'action.save_preference',
};

const save = {
  ...allowed,
  action_id: 'act_syn_save_pref',
  kind: 'save_preference',
  url: null,
  label_ar: 'حفظ التفضيل',
  label_en: 'Save preference',
};

test('proposal vs approved_preference are distinct; executed_result is not M1 truth', () => {
  const proposal = { ...pref, preference_id: 'prf_syn_prop', provenance: 'proposal' };
  const executed = { ...pref, preference_id: 'prf_syn_exec', provenance: 'executed_result', value_text: 'قصة منفذة' };
  assert.equal(preferenceVisibleInM1(pref), true);
  assert.equal(preferenceVisibleInM1(proposal), true);
  assert.equal(preferenceVisibleInM1(executed), false);
  const list = renderPreferenceList({ preferences: [pref, proposal, executed] });
  assert.equal(list.meta.count, 2);
  assert.equal(list.meta.displayedExecuted, false);
  assert.equal(list.meta.executedHidden, 1);
  assert.match(list.html, /data-provenance="approved_preference"/);
  assert.match(list.html, /data-provenance="proposal"/);
  assert.equal(list.html.includes('prf_syn_exec'), false);
  assert.equal(list.html.includes('قصة منفذة'), false);
  assertNoForbiddenCopy(list.html, assert);
});

test('save/delete only via AllowedActions; no success before ActionResult', () => {
  const idle = renderPreferenceEditor({ allowedActions: [save], selected: pref });
  assert.equal(idle.meta.canSave, true);
  assert.equal(idle.meta.success, false);
  assert.equal(idle.meta.executedWritten, false);
  const after = renderPreferenceEditor({
    allowedActions: [save],
    selected: pref,
    actionResult: done,
  });
  assert.equal(after.meta.success, true);
  assert.match(after.html, /data-outcome="done"/);
});

test('version conflict keeps previous preference and is not a save', () => {
  const view = renderPreferenceEditor({
    allowedActions: [save],
    selected: pref,
    error: conflict,
  });
  assert.equal(view.meta.conflict, true);
  assert.equal(view.meta.success, false);
  assert.match(view.html, /CONFLICT|تعارض إصدار/);
});

test('preferences unavailable omits save/delete', () => {
  const view = renderPreferenceEditor({
    allowedActions: [save],
    capabilitiesEnabled: false,
  });
  assert.equal(view.meta.canSave, false);
  assert.equal(view.meta.canDelete, false);
});
