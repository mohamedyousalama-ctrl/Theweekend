import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, failure } from './helpers.mjs';
import { renderActionResult } from '../../src/ui/states/action-result.js';
import { renderConversation } from '../../src/ui/conversation/view.js';
import { actionPresentation, previousActionsInvalidAfterReconnect } from '../../src/ui/policy.js';

const stale = failure('stale-action').instance;
const allowed = readJson('valid/allowed-action.json');
const output = readJson('valid/chat-turn-output.json');
const context = readJson('valid/trusted-context.json');
const health = readJson('valid/health-state.json');
const down = failure('store-unavailable').instance;

test('stale ActionResult is a failed save, not success', () => {
  const presentation = actionPresentation(stale);
  assert.equal(presentation.showSuccess, false);
  assert.equal(presentation.failed, true);
  assert.equal(presentation.bookingConfirmed, false);
  const view = renderActionResult({ actionResult: stale });
  assert.match(view.html, /data-success="false"/);
  assert.match(view.html, /data-kind="failed"/);
  assert.match(view.html, /data-outcome="stale"/);
});

test('stale action returns the row to enabled and keeps prior transcript', () => {
  const view = renderConversation({
    context,
    output,
    allowedActions: [allowed],
    actionResult: stale,
  });
  assert.equal(view.meta.success, false);
  assert.match(view.html, /data-executable="true"/);
  assert.match(view.html, /أقدر أساعدك بالنص/);
});

test('reconnected health invalidates previous action ids', () => {
  assert.equal(previousActionsInvalidAfterReconnect(down, health), true);
  const view = renderConversation({
    context,
    output,
    allowedActions: [allowed],
    reconnectInvalidates: true,
  });
  assert.match(view.html, /data-executable="false"/);
});

test('pending and external_handoff are not confirmed bookings', () => {
  const pending = renderActionResult({
    actionResult: {
      contract_version: '0.1.0',
      action_id: 'act_syn_pending',
      outcome: 'pending',
      receipt_id: null,
      message_key: 'booking.pending_unconfirmed',
    },
  });
  assert.equal(pending.meta.showSuccess, false);
  assert.equal(pending.meta.pending, true);
  const handoff = renderActionResult({ actionResult: readJson('valid/action-result.json') });
  assert.equal(handoff.meta.handoff, true);
  assert.equal(handoff.meta.showSuccess, false);
  assert.equal(handoff.meta.bookingConfirmed, false);
  assert.match(handoff.html, /ليس تأكيداً/);
});
