import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../src/server/config.mjs';
import { hashPasscode } from '../../src/server/ids.mjs';
import { createApp } from '../../src/server/app.mjs';

export const OWNER_PASS = 'owner-test';
export const STAFF_PASS = 'staff-test';
export const LOCAL_CUSTOMER_PASS = 'local-customer-test';

export function testEnv(overrides = {}) {
  return {
    WEEKEND_ENV: 'local',
    WEEKEND_MODEL_MODE: 'mock',
    WEEKEND_MODEL_PROVIDER: 'none',
    WEEKEND_MODEL_ID: 'local-script',
    WEEKEND_VISION_MODEL_ID: 'none',
    WEEKEND_MODEL_API_KEY: 'not-a-real-key',
    WEEKEND_SPEND_CAP_USD_PER_DAY: '5',
    WEEKEND_MAX_CALLS_PER_SESSION: '8',
    WEEKEND_REQUEST_TIMEOUT_MS: '8000',
    WEEKEND_PHOTO_ENABLED: 'false',
    WEEKEND_UPLOAD_MAX_BYTES: '65536',
    WEEKEND_BOOKING_HANDOFF_MODE: 'official_link',
    WEEKEND_OFFICIAL_BOOKING_URL: 'https://theweekendhairstyling.com/book',
    WEEKEND_DB_PATH: join(mkdtempSync(join(tmpdir(), 'weekend-')), 'app.sqlite'),
    WEEKEND_SESSION_SECRET: 'test-session-secret-16',
    WEEKEND_OWNER_PASSCODE_HASH: hashPasscode(OWNER_PASS),
    WEEKEND_STAFF_PASSCODE_HASH: hashPasscode(STAFF_PASS),
    WEEKEND_LOCAL_CUSTOMER_PASSCODE_HASH: hashPasscode(LOCAL_CUSTOMER_PASS),
    WEEKEND_BRANCH_ID: 'br_syn_m1',
    ...overrides,
  };
}

export function testApp(overrides = {}, deps = {}) {
  const env = testEnv(overrides);
  const config = loadConfig(env);
  const app = createApp(config, deps);
  return { app, config, env };
}
