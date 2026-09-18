import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };
const SCRYPT_KEYLEN = 32;

export function newId(prefix) {
  return `${prefix}${randomBytes(12).toString('hex')}`;
}

export function isPasscodeHash(value) {
  if (typeof value !== 'string') return false;
  if (/^[a-f0-9]{64}$/.test(value)) return true;
  return /^scrypt\$[a-f0-9]{16,64}\$[a-f0-9]{32,256}$/.test(value);
}

export function hashPasscode(value) {
  const salt = randomBytes(16);
  const derived = scryptSync(String(value), salt, SCRYPT_KEYLEN, SCRYPT_OPTS);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function passcodeMatches(stored, value) {
  if (typeof stored !== 'string' || typeof value !== 'string') return false;
  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    if (salt.length === 0 || expected.length === 0) return false;
    const actual = scryptSync(value, salt, expected.length, SCRYPT_OPTS);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  if (/^[a-f0-9]{64}$/.test(stored)) {
    const actual = createHash('sha256').update(value, 'utf8').digest();
    const expected = Buffer.from(stored, 'hex');
    return expected.length === 32 && timingSafeEqual(actual, expected);
  }
  return false;
}

export function signSession(sessionId, secret) {
  const hmac = createHmac('sha256', secret).update(sessionId).digest('hex');
  return `${sessionId}.${hmac}`;
}

/** HMAC-SHA256 of a client address with WEEKEND_SESSION_SECRET. Digest hex only — never store the raw address. Prefixed so the digest cannot equal a session-token signature. */
export function hmacClientKey(clientKey, secret) {
  return createHmac('sha256', secret).update(`client:${String(clientKey || 'unknown')}`, 'utf8').digest('hex');
}

export function readSignedSession(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const i = token.indexOf('.');
  const sessionId = token.slice(0, i);
  const hmac = token.slice(i + 1);
  const expected = createHmac('sha256', secret).update(sessionId).digest('hex');
  try {
    if (!timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))) return null;
  } catch {
    return null;
  }
  if (!/^ses_[A-Za-z0-9_-]{1,80}$/.test(sessionId)) return null;
  return sessionId;
}

export function nowIso(clock) {
  return clock();
}
