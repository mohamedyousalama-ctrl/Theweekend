import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/server/app.mjs';
import { OWNER_PASS, STAFF_PASS, testApp } from './helpers.mjs';

test('a loop of public-guest session creates from one client is throttled', () => {
  const { app } = testApp({
    WEEKEND_PUBLIC_GUEST: 'true',
    WEEKEND_GUEST_SESSIONS_PER_10MIN: '5',
  });
  const clientKey = '203.0.113.40';
  for (let i = 0; i < 5; i += 1) {
    const out = app.createSession('customer', '', { clientKey });
    assert.equal(out.context.role, 'customer');
  }
  assert.throws(
    () => app.createSession('customer', '', { clientKey }),
    err => err instanceof AppError
      && err.status === 401
      && err.shape.code === 'UNAUTHORIZED'
      && err.shape.message_key === 'session.throttled'
      && err.shape.retryable === true,
  );
  const other = app.createSession('customer', '', { clientKey: '203.0.113.41' });
  assert.equal(other.context.role, 'customer', 'a different client is not locked out');
  const owner = app.createSession('owner', OWNER_PASS, { clientKey });
  assert.equal(owner.context.role, 'owner', 'owner login from the same client is not counted as a guest create');
  const staff = app.createSession('staff', STAFF_PASS, { clientKey });
  assert.equal(staff.context.role, 'staff');
  const authenticated = app.createSession('customer', OWNER_PASS, { clientKey });
  assert.equal(authenticated.context.role, 'customer');
  app.close();
});
