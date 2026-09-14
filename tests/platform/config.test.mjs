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
    () => loadConfig(testEnv({ WEEKEND_OFFICIAL_BOOKING_URL: 'http://example.invalid/book' })),
    err => err instanceof ConfigError && err.variable === 'WEEKEND_OFFICIAL_BOOKING_URL',
  );
});

test('valid local mock config loads', () => {
  const cfg = loadConfig(testEnv());
  assert.equal(cfg.WEEKEND_ENV, 'local');
  assert.equal(cfg.WEEKEND_MODEL_MODE, 'mock');
  assert.equal(cfg.WEEKEND_PHOTO_ENABLED, false);
});
