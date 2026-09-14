import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, failure } from './helpers.mjs';
import { renderConversation } from '../../src/ui/conversation/view.js';
import { renderApprovedBrief } from '../../src/ui/brief/approved-brief.js';
import { renderInboxList } from '../../src/ui/staff/inbox-list.js';
import { renderPreferenceEditor } from '../../src/ui/preferences/preference-editor.js';
import { renderCapabilityCopy } from '../../src/ui/capability/capability-copy.js';
import { renderHealthBanner } from '../../src/ui/capability/health-banner.js';
import { previousActionsInvalidAfterReconnect } from '../../src/ui/policy.js';

const context = readJson('valid/trusted-context.json');
const output = readJson('valid/chat-turn-output.json');
const allowed = readJson('valid/allowed-action.json');
const brief = readJson('valid/barber-brief.json');
const health = readJson('valid/health-state.json');
const staffContext = {
  ...context,
  role: 'staff',
  capabilities: { ...context.capabilities, staff_inbox: 'enabled' },
};

test('§6 loading', () => {
  const convo = renderConversation({ context: null, loading: true });
  assert.equal(convo.meta.composerDisabled, true);
  assert.match(convo.html, /data-state="loading"/);
  const banner = renderHealthBanner({ health: null });
  assert.equal(banner.meta.checking, true);
  const inbox = renderInboxList({ context: staffContext, health: { ...health, staff_inbox: 'ok' }, loading: true });
  assert.equal(inbox.meta.status, 'loading');
  assert.equal(inbox.meta.success, false);
});

test('§6 validation', () => {
  const err = readJson('valid/error-shape.json');
  const convo = renderConversation({ context, output, allowedActions: [allowed], error: err, draft: 'نص' });
  assert.match(convo.html, /VALIDATION_ERROR|composer-error/);
  assert.match(convo.html, /نص/);
});

test('§6 unavailable', () => {
  const down = failure('unavailable-model').instance;
  const convo = renderConversation({ context, output: down, allowedActions: [] });
  assert.equal(convo.meta.success, false);
  const cap = renderCapabilityCopy({ context, health: failure('store-unavailable').instance });
  assert.equal(cap.meta.bookingConfirmed, false);
});

test('§6 timeout', () => {
  const timeout = failure('timeout').instance;
  const convo = renderConversation({
    context,
    output: timeout,
    draft: 'مسودة',
    error: timeout.error,
  });
  assert.match(convo.html, /TIMEOUT/);
  assert.match(convo.html, /مسودة/);
  const briefView = renderApprovedBrief({ brief });
  assert.equal(briefView.meta.success, false);
});

test('§6 failed save', () => {
  const stale = failure('stale-action').instance;
  const convo = renderConversation({ context, output, allowedActions: [allowed], actionResult: stale });
  assert.equal(convo.meta.success, false);
  const pref = renderPreferenceEditor({
    allowedActions: [{ ...allowed, kind: 'save_preference', url: null, action_id: 'act_syn_save_pref' }],
    error: failure('preference-conflict').instance,
  });
  assert.equal(pref.meta.success, false);
  assert.equal(pref.meta.conflict, true);
});

test('§6 reconnected', () => {
  const down = failure('store-unavailable').instance;
  assert.equal(previousActionsInvalidAfterReconnect(down, health), true);
  const convo = renderConversation({
    context,
    output,
    allowedActions: [allowed],
    reconnectInvalidates: true,
  });
  assert.match(convo.html, /data-executable="false"/);
});
