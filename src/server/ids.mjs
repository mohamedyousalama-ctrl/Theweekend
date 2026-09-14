import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function newId(prefix) {
  return `${prefix}${randomBytes(12).toString('hex')}`;
}

export function hashPasscode(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

export function passcodeMatches(expectedHex, value) {
  if (typeof expectedHex !== 'string' || expectedHex.length !== 64) return false;
  const got = hashPasscode(value);
  try {
    return timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(got, 'hex'));
  } catch {
    return false;
  }
}

export function signSession(sessionId, secret) {
  const hmac = createHmac('sha256', secret).update(sessionId).digest('hex');
  return `${sessionId}.${hmac}`;
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
