/**
 * Fail-explicit Weekend configuration. No secret defaults. No Kivo fallback.
 * Owner/staff hashes may be supplied as scrypt/legacy SHA-256, or as plain
 * WEEKEND_*_PASSCODE values that are hashed in memory at start.
 */
import { hashPasscode, isPasscodeHash } from './ids.mjs';

const NAMES = [
  'WEEKEND_ENV',
  'WEEKEND_MODEL_MODE',
  'WEEKEND_MODEL_PROVIDER',
  'WEEKEND_MODEL_ID',
  'WEEKEND_VISION_MODEL_ID',
  'WEEKEND_MODEL_API_KEY',
  'WEEKEND_SPEND_CAP_USD_PER_DAY',
  'WEEKEND_MAX_CALLS_PER_SESSION',
  'WEEKEND_REQUEST_TIMEOUT_MS',
  'WEEKEND_PHOTO_ENABLED',
  'WEEKEND_UPLOAD_MAX_BYTES',
  'WEEKEND_BOOKING_HANDOFF_MODE',
  'WEEKEND_OFFICIAL_BOOKING_URL',
  'WEEKEND_DB_PATH',
  'WEEKEND_SESSION_SECRET',
  'WEEKEND_BRANCH_ID',
];

export class ConfigError extends Error {
  constructor(name) {
    super(`Missing required configuration: ${name}`);
    this.name = 'ConfigError';
    this.variable = name;
  }
}

const BOOKING_HOSTS = new Set(['theweekendhairstyling.com', 'www.theweekendhairstyling.com']);

function officialBookingUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ConfigError('WEEKEND_OFFICIAL_BOOKING_URL');
  }
  if (parsed.protocol !== 'https:') throw new ConfigError('WEEKEND_OFFICIAL_BOOKING_URL');
  if (parsed.username || parsed.password) throw new ConfigError('WEEKEND_OFFICIAL_BOOKING_URL');
  if (parsed.port !== '') throw new ConfigError('WEEKEND_OFFICIAL_BOOKING_URL');
  if (!BOOKING_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new ConfigError('WEEKEND_OFFICIAL_BOOKING_URL');
  }
  return parsed.href;
}

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function intField(env, name, min) {
  if (!present(env[name])) throw new ConfigError(name);
  const n = Number(env[name]);
  if (!Number.isSafeInteger(n) || n < min) throw new ConfigError(name);
  return n;
}

function optionalIntField(env, name, fallback, min) {
  if (!present(env[name])) return fallback;
  return intField(env, name, min);
}

function resolvePasscodeHash(env, hashKey, plainKey, required) {
  if (present(env[hashKey])) {
    const hash = env[hashKey].trim();
    if (!isPasscodeHash(hash)) throw new ConfigError(hashKey);
    return hash;
  }
  if (present(env[plainKey])) {
    return hashPasscode(env[plainKey]);
  }
  if (required) throw new ConfigError(hashKey);
  return null;
}

export function loadConfig(env) {
  if (!env || typeof env !== 'object') throw new ConfigError('WEEKEND_ENV');
  for (const name of NAMES) {
    if (!present(env[name])) throw new ConfigError(name);
  }
  const weekendEnv = env.WEEKEND_ENV.trim();
  const modelMode = env.WEEKEND_MODEL_MODE.trim();
  const photoEnabled = env.WEEKEND_PHOTO_ENABLED.trim();
  const handoff = env.WEEKEND_BOOKING_HANDOFF_MODE.trim();
  const url = officialBookingUrl(env.WEEKEND_OFFICIAL_BOOKING_URL.trim());
  const branchId = env.WEEKEND_BRANCH_ID.trim();

  if (!['local', 'owner-review'].includes(weekendEnv)) throw new ConfigError('WEEKEND_ENV');
  if (!['real', 'mock'].includes(modelMode)) throw new ConfigError('WEEKEND_MODEL_MODE');
  if (modelMode === 'mock' && weekendEnv !== 'local') throw new ConfigError('WEEKEND_MODEL_MODE');
  if (!['true', 'false'].includes(photoEnabled)) throw new ConfigError('WEEKEND_PHOTO_ENABLED');
  if (!['official_link', 'pending_request'].includes(handoff)) {
    throw new ConfigError('WEEKEND_BOOKING_HANDOFF_MODE');
  }
  if (!/^br_[A-Za-z0-9_-]{1,80}$/.test(branchId)) throw new ConfigError('WEEKEND_BRANCH_ID');
  if (env.WEEKEND_SESSION_SECRET.trim().length < 16) throw new ConfigError('WEEKEND_SESSION_SECRET');

  const publicGuestRaw = present(env.WEEKEND_PUBLIC_GUEST)
    ? env.WEEKEND_PUBLIC_GUEST.trim()
    : (weekendEnv === 'owner-review' ? 'true' : 'false');
  if (!['true', 'false'].includes(publicGuestRaw)) throw new ConfigError('WEEKEND_PUBLIC_GUEST');

  const guestSessionsPer10Min = optionalIntField(env, 'WEEKEND_GUEST_SESSIONS_PER_10MIN', 5, 1);

  const ownerHash = resolvePasscodeHash(env, 'WEEKEND_OWNER_PASSCODE_HASH', 'WEEKEND_OWNER_PASSCODE', true);
  const staffHash = resolvePasscodeHash(env, 'WEEKEND_STAFF_PASSCODE_HASH', 'WEEKEND_STAFF_PASSCODE', true);
  const localCustomerHash = resolvePasscodeHash(
    env,
    'WEEKEND_LOCAL_CUSTOMER_PASSCODE_HASH',
    'WEEKEND_LOCAL_CUSTOMER_PASSCODE',
    weekendEnv === 'local',
  );

  // Optional: 1 only behind a platform proxy that appends the client address to X-Forwarded-For (Railway).
  const trustProxyRaw = String(env.WEEKEND_TRUST_PROXY ?? '0').trim();
  if (!['0', '1', 'true', 'false'].includes(trustProxyRaw)) throw new ConfigError('WEEKEND_TRUST_PROXY');

  return {
    WEEKEND_ENV: weekendEnv,
    WEEKEND_TRUST_PROXY: trustProxyRaw === '1' || trustProxyRaw === 'true',
    WEEKEND_MODEL_MODE: modelMode,
    WEEKEND_MODEL_PROVIDER: env.WEEKEND_MODEL_PROVIDER.trim(),
    WEEKEND_MODEL_ID: env.WEEKEND_MODEL_ID.trim(),
    WEEKEND_VISION_MODEL_ID: env.WEEKEND_VISION_MODEL_ID.trim(),
    WEEKEND_MODEL_API_KEY: env.WEEKEND_MODEL_API_KEY.trim(),
    WEEKEND_SPEND_CAP_USD_PER_DAY: intField(env, 'WEEKEND_SPEND_CAP_USD_PER_DAY', 0),
    WEEKEND_MAX_CALLS_PER_SESSION: intField(env, 'WEEKEND_MAX_CALLS_PER_SESSION', 1),
    WEEKEND_REQUEST_TIMEOUT_MS: intField(env, 'WEEKEND_REQUEST_TIMEOUT_MS', 1),
    WEEKEND_PHOTO_ENABLED: photoEnabled === 'true',
    WEEKEND_UPLOAD_MAX_BYTES: intField(env, 'WEEKEND_UPLOAD_MAX_BYTES', 1),
    WEEKEND_BOOKING_HANDOFF_MODE: handoff,
    WEEKEND_OFFICIAL_BOOKING_URL: url,
    WEEKEND_DB_PATH: env.WEEKEND_DB_PATH.trim(),
    WEEKEND_SESSION_SECRET: env.WEEKEND_SESSION_SECRET.trim(),
    WEEKEND_OWNER_PASSCODE_HASH: ownerHash,
    WEEKEND_STAFF_PASSCODE_HASH: staffHash,
    WEEKEND_LOCAL_CUSTOMER_PASSCODE_HASH: localCustomerHash,
    WEEKEND_BRANCH_ID: branchId,
    WEEKEND_PUBLIC_GUEST: publicGuestRaw === 'true',
    WEEKEND_GUEST_SESSIONS_PER_10MIN: guestSessionsPer10Min,
  };
}

export const CONFIG_NAMES = NAMES;
