import test from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, buildSummary } from '../../src/agent/eval-report.mjs';

test('skipReason: mismatch returns the reason; match or absent requirement is null', () => {
  assert.equal(
    skipReason({ requires_staff_inbox: 'enabled' }, 'unavailable'),
    'requires --staff-inbox=enabled (mode is unavailable)',
  );
  assert.equal(
    skipReason({ requires_staff_inbox: 'unavailable' }, 'enabled'),
    'requires --staff-inbox=unavailable (mode is enabled)',
  );
  assert.equal(skipReason({ requires_staff_inbox: 'enabled' }, 'enabled'), null);
  assert.equal(skipReason({ requires_staff_inbox: 'unavailable' }, 'unavailable'), null);
  assert.equal(skipReason({}, 'unavailable'), null);
  assert.equal(skipReason({ id: 'greet' }, 'enabled'), null);
});

test('buildSummary: skipped rows are excluded from counts and cost; a real fail still fails', () => {
  const summary = buildSummary({
    caseRows: [
      { id: 'a', pass: true, skip: false, cost_minor: 4 },
      { id: 'b', pass: false, skip: false, cost_minor: 3 },
      { id: 'talk_to_staff', pass: null, skip: true, cost_minor: 99 },
    ],
    imageRows: [],
    staffInbox: 'unavailable',
    finishedAt: '2026-09-19T02:00:00.000Z',
  });

  assert.equal(summary.text_cases, 2);
  assert.equal(summary.text_passed, 1);
  assert.equal(summary.text_skipped, 1);
  assert.equal(summary.staff_inbox, 'unavailable');
  assert.equal(summary.total_cost_minor_usd_cents, 7);
  assert.equal(summary.image_cases, 0);
  assert.equal(summary.image_passed, 0);
  assert.equal(summary.finished_at, '2026-09-19T02:00:00.000Z');
  assert.equal(summary.text_passed < summary.text_cases, true);
});
