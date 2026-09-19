import test from 'node:test';
import assert from 'node:assert/strict';
import { staffInboxFlag } from '../../src/agent/eval-flags.mjs';

test('eval flags: staff inbox defaults to enabled; --staff-inbox unavailable is honoured; unknown values throw', () => {
  assert.equal(staffInboxFlag([]), 'enabled');
  assert.equal(staffInboxFlag(['--text-only']), 'enabled');
  assert.equal(staffInboxFlag(['--staff-inbox', 'unavailable']), 'unavailable');
  assert.equal(staffInboxFlag(['--staff-inbox', 'enabled']), 'enabled');

  assert.throws(
    () => staffInboxFlag(['--staff-inbox', 'always']),
    { message: '--staff-inbox must be "enabled" or "unavailable" (got "always")' },
  );
});
