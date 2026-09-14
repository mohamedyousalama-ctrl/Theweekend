const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

/**
 * In-process passcode attempt limiter. Keyed by client address, not identity.
 */
export class AttemptLimiter {
  constructor(now = () => Date.now(), { windowMs = WINDOW_MS, maxFailures = MAX_FAILURES } = {}) {
    this.now = now;
    this.windowMs = windowMs;
    this.maxFailures = maxFailures;
    this.byKey = new Map();
  }

  prune(key) {
    const now = this.now();
    const list = (this.byKey.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.byKey.set(key, list);
    return list;
  }

  isLimited(key) {
    return this.prune(key).length >= this.maxFailures;
  }

  recordFailure(key) {
    const list = this.prune(key);
    list.push(this.now());
    this.byKey.set(key, list);
  }
}
