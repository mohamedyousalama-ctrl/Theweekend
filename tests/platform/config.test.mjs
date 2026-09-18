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

test('WEEKEND_PUBLIC_GUEST defaults to false in every environment; true only when set explicitly', () => {
  const local = loadConfig(testEnv());
  assert.equal(local.WEEKEND_PUBLIC_GUEST, false);
  const env = testEnv({ WEEKEND_ENV: 'owner-review', WEEKEND_MODEL_MODE: 'real' });
  delete env.WEEKEND_PUBLIC_GUEST;
  const review = loadConfig(env);
  assert.equal(review.WEEKEND_PUBLIC_GUEST, false);
  const optedIn = loadConfig(testEnv({ WEEKEND_ENV: 'owner-review', WEEKEND_MODEL_MODE: 'real', WEEKEND_PUBLIC_GUEST: 'true' }));
  assert.equal(optedIn.WEEKEND_PUBLIC_GUEST, true);
});

test('WEEKEND_PUBLIC_GUEST rejects values other than true or false', () => {
  assert.throws(
    () => loadConfig(testEnv({ WEEKEND_PUBLIC_GUEST: 'yes' })),
    err => err instanceof ConfigError && err.variable === 'WEEKEND_PUBLIC_GUEST',
  );
});
