import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, failure, listFixtureJson } from './helpers.mjs';
import { validateContract } from '../../src/contracts/validate.mjs';
import { renderConversation } from '../../src/ui/conversation/view.js';
import { renderApprovedBrief } from '../../src/ui/brief/approved-brief.js';
import { renderInboxList } from '../../src/ui/staff/inbox-list.js';
import { renderPreferenceList } from '../../src/ui/preferences/preference-list.js';
import { renderCapabilityCopy } from '../../src/ui/capability/capability-copy.js';
import { renderActionResult } from '../../src/ui/states/action-result.js';
import { renderError } from '../../src/ui/states/error.js';

const OBJECTS = {
  'trusted-context': 'TrustedContext',
  'chat-turn-input': 'ChatTurnInput',
  'chat-turn-output': 'ChatTurnOutput',
  'cosmetic-observations': 'CosmeticObservations',
  'preference': 'Preference',
  'allowed-action': 'AllowedAction',
  'action-result': 'ActionResult',
  'permission-receipt': 'PermissionReceipt',
  'barber-brief': 'BarberBrief',
  'delivery-receipt': 'DeliveryReceipt',
  'error-shape': 'ErrorShape',
  'health-state': 'HealthState',
};

test('UI consumes valid fixtures without adding fields', () => {
  for (const file of listFixtureJson('valid')) {
    const kebab = file.replace(/\.json$/, '').split('.')[0];
    const objectName = OBJECTS[kebab];
    if (!objectName) continue;
    const instance = readJson(`valid/${file}`);
    const result = validateContract(objectName, instance);
    assert.equal(result.ok, true, `${file}: ${result.errors.join('; ')}`);
    assert.equal(Object.prototype.hasOwnProperty.call(instance, 'ui_extra'), false);
  }
});

test('renderers accept valid fixtures and failure instances', () => {
  const context = readJson('valid/trusted-context.json');
  const output = readJson('valid/chat-turn-output.json');
  const allowed = readJson('valid/allowed-action.json');
  const brief = readJson('valid/barber-brief.json');
  const pref = readJson('valid/preference.json');
  const health = readJson('valid/health-state.json');
  assert.equal(typeof renderConversation({ context, output, allowedActions: [allowed] }).html, 'string');
  assert.equal(typeof renderApprovedBrief({ brief, allowedActions: [allowed] }).html, 'string');
  assert.equal(typeof renderPreferenceList({ preferences: [pref] }).html, 'string');
  assert.equal(typeof renderCapabilityCopy({ context, health }).html, 'string');
  assert.equal(typeof renderActionResult({ actionResult: readJson('valid/action-result.json') }).html, 'string');
  assert.equal(typeof renderError({ error: readJson('valid/error-shape.json') }).html, 'string');
  assert.equal(typeof renderInboxList({
    context: { ...context, role: 'staff', capabilities: { ...context.capabilities, staff_inbox: 'enabled' } },
    health: { ...health, staff_inbox: 'ok' },
    briefs: [brief],
    receipts: [readJson('valid/delivery-receipt.json')],
  }).html, 'string');
  void failure;
});
