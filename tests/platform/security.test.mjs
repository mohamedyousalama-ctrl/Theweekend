import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { AppError } from '../../src/server/app.mjs';
import { hashPasscode, passcodeMatches } from '../../src/server/ids.mjs';
import { AttemptLimiter } from '../../src/server/limiter.mjs';
import { loadConfig } from '../../src/server/config.mjs';
import { LOCAL_CUSTOMER_PASS, OWNER_PASS, STAFF_PASS, testApp, testEnv } from './helpers.mjs';

test('passcode hash is salted scrypt and verifies', () => {
  const first = hashPasscode('secret-value');
  const second = hashPasscode('secret-value');
  assert.match(first, /^scrypt\$[a-f0-9]+\$[a-f0-9]+$/);
  assert.notEqual(first, second);
  assert.equal(passcodeMatches(first, 'secret-value'), true);
  assert.equal(passcodeMatches(second, 'wrong'), false);
});

test('legacy sha256 hashes still match', () => {
  const legacy = createHash('sha256').update('legacy-pass', 'utf8').digest('hex');
  assert.equal(passcodeMatches(legacy, 'legacy-pass'), true);
  assert.equal(passcodeMatches(legacy, 'nope'), false);
});

test('local customer passcode is env-named, not a literal', () => {
  const { app } = testApp();
  const local = app.createSession('customer', LOCAL_CUSTOMER_PASS);
  assert.equal(local.context.role, 'customer');
  assert.throws(
    () => app.createSession('customer', 'local-customer'),
    err => err instanceof AppError && err.shape.code === 'UNAUTHORIZED' && err.shape.retryable === false,
  );
  app.close();
});

test('public guest may open a customer session with an empty passcode', () => {
  const { app } = testApp({ WEEKEND_PUBLIC_GUEST: 'true' });
  const out = app.createSession('customer', '');
  assert.equal(out.context.role, 'customer');
  const implied = app.createSession('customer');
  assert.equal(implied.context.role, 'customer');
  assert.throws(
    () => app.createSession('customer', 'wrong'),
    err => err instanceof AppError && err.shape.code === 'UNAUTHORIZED',
  );
  assert.throws(
    () => app.createSession('staff', ''),
    err => err instanceof AppError && err.shape.code === 'UNAUTHORIZED',
  );
  app.close();
});

test('empty customer passcode is rejected when public guest is off', () => {
  const { app } = testApp({ WEEKEND_PUBLIC_GUEST: 'false' });
  assert.throws(
    () => app.createSession('customer', ''),
    err => err instanceof AppError && err.shape.code === 'UNAUTHORIZED',
  );
  app.close();
});

test('owner-review with WEEKEND_PUBLIC_GUEST false rejects an empty customer passcode', () => {
  const { app } = testApp({
    WEEKEND_ENV: 'owner-review',
    WEEKEND_MODEL_MODE: 'real',
    WEEKEND_PUBLIC_GUEST: 'false',
  });
  assert.throws(
    () => app.createSession('customer', ''),
    err => err instanceof AppError && err.status === 401 && err.shape.message_key === 'session.passcode',
  );
  app.close();
});

test('plain owner and staff passcodes hash at start', () => {
  const env = testEnv();
  delete env.WEEKEND_OWNER_PASSCODE_HASH;
  delete env.WEEKEND_STAFF_PASSCODE_HASH;
  env.WEEKEND_OWNER_PASSCODE = OWNER_PASS;
  env.WEEKEND_STAFF_PASSCODE = STAFF_PASS;
  const cfg = loadConfig(env);
  assert.match(cfg.WEEKEND_OWNER_PASSCODE_HASH, /^scrypt\$/);
  assert.match(cfg.WEEKEND_STAFF_PASSCODE_HASH, /^scrypt\$/);
  assert.equal(passcodeMatches(cfg.WEEKEND_OWNER_PASSCODE_HASH, OWNER_PASS), true);
});

test('local env requires a local customer passcode', () => {
  const env = testEnv();
  delete env.WEEKEND_LOCAL_CUSTOMER_PASSCODE_HASH;
  assert.throws(
    () => loadConfig(env),
    err => err.variable === 'WEEKEND_LOCAL_CUSTOMER_PASSCODE_HASH',
  );
});

test('five failed passcodes from one client are throttled', () => {
  const limiter = new AttemptLimiter();
  const { app } = testApp({}, { limiter });
  for (let i = 0; i < 5; i += 1) {
    assert.throws(
      () => app.createSession('staff', 'nope', { clientKey: '203.0.113.9' }),
      err => err instanceof AppError && err.shape.code === 'UNAUTHORIZED' && err.shape.retryable === false,
    );
  }
  assert.throws(
    () => app.createSession('staff', STAFF_PASS, { clientKey: '203.0.113.9' }),
    err => err instanceof AppError && err.shape.code === 'UNAUTHORIZED' && err.shape.retryable === true,
  );
  const other = app.createSession('staff', STAFF_PASS, { clientKey: '203.0.113.10' });
  assert.equal(other.context.role, 'staff');
  app.close();
});

test('a global failure budget stops address rotation from buying unlimited tries', () => {
  const limiter = new AttemptLimiter(() => Date.now(), { globalMaxFailures: 30, globalWindowMs: 60_000 });
  const { app } = testApp({}, { limiter });
  for (let i = 0; i < 30; i += 1) {
    assert.throws(() => app.createSession('staff', 'nope', { clientKey: `198.51.100.${i}` }), err => err instanceof AppError && err.shape.code === 'UNAUTHORIZED');
  }
  assert.throws(
    () => app.createSession('staff', STAFF_PASS, { clientKey: '198.51.100.250' }),
    err => err instanceof AppError && err.shape.code === 'UNAUTHORIZED' && err.shape.retryable === true,
    'a fresh address is throttled once the global budget is spent',
  );
  app.close();
});
