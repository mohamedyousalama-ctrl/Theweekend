import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, failure, assertNoForbiddenCopy } from './helpers.mjs';
import { renderInboxList } from '../../src/ui/staff/inbox-list.js';
import { renderBriefPanel } from '../../src/ui/staff/brief-panel.js';
import { inboxStatusFrom } from '../../src/ui/policy.js';

const brief = { ...readJson('valid/barber-brief.json'), status: 'delivered' };
const receipt = readJson('valid/delivery-receipt.json');
const staffContext = {
  ...readJson('valid/trusted-context.json'),
  role: 'staff',
  capabilities: {
    ...readJson('valid/trusted-context.json').capabilities,
    staff_inbox: 'enabled',
  },
};
const healthOk = { ...readJson('valid/health-state.json'), staff_inbox: 'ok' };
const healthDown = failure('store-unavailable').instance;

test('inbox empty / loading / pending / error / saved come from contract objects', () => {
  assert.equal(inboxStatusFrom({ loading: true }), 'loading');
  assert.equal(inboxStatusFrom({ briefs: [], receipts: [] }), 'empty');
  assert.equal(inboxStatusFrom({
    briefs: [brief],
    receipts: [receipt],
    error: null,
    loading: false,
  }), 'pending');
  const acked = { ...receipt, acknowledged_at: '2026-09-14T10:30:00Z', acknowledged_by: 'sub_syn_staff_a' };
  assert.equal(inboxStatusFrom({ briefs: [{ ...brief, status: 'acknowledged' }], receipts: [acked] }), 'saved');
  assert.equal(inboxStatusFrom({ error: failure('capability-unavailable').instance }), 'error');
});

test('staff inbox omitted when staff_inbox unavailable; no all-branch list', () => {
  const omitted = renderInboxList({
    context: staffContext,
    health: healthDown,
    briefs: [brief],
  });
  assert.equal(omitted.meta.omitted, true);
  const list = renderInboxList({
    context: staffContext,
    health: healthOk,
    briefs: [brief],
    receipts: [receipt],
  });
  assert.equal(list.meta.allBranch, false);
  assert.equal(list.html.includes('كل الفروع'), false);
  assertNoForbiddenCopy(list.html, assert);
});

test('acknowledge is not a booking and success waits for DeliveryReceipt', () => {
  const before = renderBriefPanel({ brief, receipt: null });
  assert.equal(before.meta.success, false);
  assert.equal(before.meta.booking, false);
  assert.match(before.html, /data-success="false"/);
  assert.match(before.html, /ليس حجزاً/);
  const pending = renderBriefPanel({ brief, receipt });
  assert.equal(pending.meta.acknowledged, false);
  assert.equal(pending.meta.pending, true);
  assert.equal(pending.meta.success, false);
  const saved = renderBriefPanel({
    brief: { ...brief, status: 'acknowledged' },
    receipt: { ...receipt, acknowledged_at: '2026-09-14T10:30:00Z', acknowledged_by: 'sub_syn_staff_a' },
  });
  assert.equal(saved.meta.success, true);
  assert.equal(saved.meta.booking, false);
  assert.match(saved.html, /data-ack-is-booking="false"/);
  assert.match(saved.html, /data-booking="unconfirmed"/);
});

test('loading inbox does not claim saved', () => {
  const view = renderInboxList({
    context: staffContext,
    health: healthOk,
    loading: true,
  });
  assert.equal(view.meta.success, false);
  assert.equal(view.meta.status, 'loading');
});
