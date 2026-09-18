import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, loadConfig } from '../../src/server/config.mjs';
import { testEnv } from './helpers.mjs';

test('missing required name is reported', () => {
  const env = testEnv();
  delete env.WEEKEND_MODEL_API_KEY;
  assert.throws(() => loadConfig(env), err => err instanceof ConfigError && err.variable === 'WEEKEND_MODEL_API_KEY');
});

test('mock is rejected in owner-review', () => {
  assert.throws(
    () => loadConfig(testEnv({ WEEKEND_ENV: 'owner-review', WEEKEND_MODEL_MODE: 'mock' })),
    err => err instanceof ConfigError && err.variable === 'WEEKEND_MODEL_MODE',
  );
});

test('non-https booking url is rejected', () => {
  assert.throws(
    () => loadConfig(testEnv({ WEEKEND_OFFICIAL_BOOKING_URL: 'http://theweekendhairstyling.com/book' })),
    err => err instanceof ConfigError && err.variable === 'WEEKEND_OFFICIAL_BOOKING_URL',
  );
});

test('booking url host must be the allowlisted shop domains, without credentials or a port', () => {
  const ok = loadConfig(testEnv({ WEEKEND_OFFICIAL_BOOKING_URL: 'https://www.theweekendhairstyling.com/book' }));
  assert.equal(ok.WEEKEND_OFFICIAL_BOOKING_URL, 'https://www.theweekendhairstyling.com/book');
  for (const url of [
    'https://example.invalid/book',
    'https://theweekendhairstyling.com:8443/book',
    'https://user:pass@theweekendhairstyling.com/book',
    'https://evil.theweekendhairstyling.com/book',
  ]) {
    assert.throws(
      () => loadConfig(testEnv({ WEEKEND_OFFICIAL_BOOKING_URL: url })),
      err => err instanceof ConfigError && err.variable === 'WEEKEND_OFFICIAL_BOOKING_URL',
      url,
    );
  }
});

test('valid local mock config loads', () => {
  const cfg = loadConfig(testEnv());
  assert.equal(cfg.WEEKEND_ENV, 'local');
  assert.equal(cfg.WEEKEND_MODEL_MODE, 'mock');
  assert.equal(cfg.WEEKEND_PHOTO_ENABLED, false);
  assert.ok(cfg.WEEKEND_LOCAL_CUSTOMER_PASSCODE_HASH);
});

test('owner-review does not require a local customer passcode', () => {
  const env = testEnv({ WEEKEND_ENV: 'owner-review', WEEKEND_MODEL_MODE: 'real' });
  delete env.WEEKEND_LOCAL_CUSTOMER_PASSCODE_HASH;
  const cfg = loadConfig(env);
  assert.equal(cfg.WEEKEND_LOCAL_CUSTOMER_PASSCODE_HASH, null);
});

test('owner-review defaults WEEKEND_PUBLIC_GUEST to true; local defaults to false', () => {
  const local = loadConfig(testEnv());
  assert.equal(local.WEEKEND_PUBLIC_GUEST, false);
  const env = testEnv({ WEEKEND_ENV: 'owner-review', WEEKEND_MODEL_MODE: 'real' });
  delete env.WEEKEND_PUBLIC_GUEST;
  const review = loadConfig(env);
  assert.equal(review.WEEKEND_PUBLIC_GUEST, true);
});

test('WEEKEND_PUBLIC_GUEST rejects values other than true or false', () => {
  assert.throws(
    () => loadConfig(testEnv({ WEEKEND_PUBLIC_GUEST: 'yes' })),
    err => err instanceof ConfigError && err.variable === 'WEEKEND_PUBLIC_GUEST',
  );
});

test('WEEKEND_GUEST_SESSIONS_PER_10MIN defaults to 5 and rejects non-integers below 1', () => {
  const env = testEnv();
  delete env.WEEKEND_GUEST_SESSIONS_PER_10MIN;
  assert.equal(loadConfig(env).WEEKEND_GUEST_SESSIONS_PER_10MIN, 5);
  assert.equal(loadConfig(testEnv({ WEEKEND_GUEST_SESSIONS_PER_10MIN: '2' })).WEEKEND_GUEST_SESSIONS_PER_10MIN, 2);
  for (const value of ['0', '-1', '1.5', 'yes']) {
    assert.throws(
      () => loadConfig(testEnv({ WEEKEND_GUEST_SESSIONS_PER_10MIN: value })),
      err => err instanceof ConfigError && err.variable === 'WEEKEND_GUEST_SESSIONS_PER_10MIN',
      value,
    );
  }
});

test('WEEKEND_GUEST_TURNS_PER_MIN defaults to 6 and WEEKEND_OWNER_RESERVED_USD_PER_DAY defaults to 20% of the cap', () => {
  const env = testEnv({ WEEKEND_SPEND_CAP_USD_PER_DAY: '5' });
  delete env.WEEKEND_GUEST_TURNS_PER_MIN;
  delete env.WEEKEND_OWNER_RESERVED_USD_PER_DAY;
  const cfg = loadConfig(env);
  assert.equal(cfg.WEEKEND_GUEST_TURNS_PER_MIN, 6);
  assert.equal(cfg.WEEKEND_OWNER_RESERVED_MINOR, 100);
  assert.equal(loadConfig(testEnv({ WEEKEND_GUEST_TURNS_PER_MIN: '2' })).WEEKEND_GUEST_TURNS_PER_MIN, 2);
  assert.equal(loadConfig(testEnv({ WEEKEND_OWNER_RESERVED_USD_PER_DAY: '1', WEEKEND_SPEND_CAP_USD_PER_DAY: '5' })).WEEKEND_OWNER_RESERVED_MINOR, 100);
  assert.throws(
    () => loadConfig(testEnv({ WEEKEND_OWNER_RESERVED_USD_PER_DAY: '6', WEEKEND_SPEND_CAP_USD_PER_DAY: '5' })),
    err => err instanceof ConfigError && err.variable === 'WEEKEND_OWNER_RESERVED_USD_PER_DAY',
  );
  for (const value of ['0', '-1', '1.5', 'yes']) {
    assert.throws(
      () => loadConfig(testEnv({ WEEKEND_GUEST_TURNS_PER_MIN: value })),
      err => err instanceof ConfigError && err.variable === 'WEEKEND_GUEST_TURNS_PER_MIN',
      value,
    );
  }
});

test('WEEKEND_GUEST_UPLOADS_PER_DAY defaults to 3 and rejects non-integers below 1', () => {
  const env = testEnv();
  delete env.WEEKEND_GUEST_UPLOADS_PER_DAY;
  assert.equal(loadConfig(env).WEEKEND_GUEST_UPLOADS_PER_DAY, 3);
  assert.equal(loadConfig(testEnv({ WEEKEND_GUEST_UPLOADS_PER_DAY: '1' })).WEEKEND_GUEST_UPLOADS_PER_DAY, 1);
  for (const value of ['0', '-1', '1.5', 'yes']) {
    assert.throws(
      () => loadConfig(testEnv({ WEEKEND_GUEST_UPLOADS_PER_DAY: value })),
      err => err instanceof ConfigError && err.variable === 'WEEKEND_GUEST_UPLOADS_PER_DAY',
      value,
    );
  }
});
