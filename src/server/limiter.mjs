const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const GLOBAL_WINDOW_MS = 60 * 1000;
const GLOBAL_MAX_FAILURES = 30;

/**
 * In-process passcode attempt limiter. Per client address (5 failures / 15 min) plus a global budget
 * (30 failures / minute across all addresses) so a spoofed or rotating address cannot buy unlimited tries.
 */
export class AttemptLimiter {
  constructor(now = () => Date.now(), { windowMs = WINDOW_MS, maxFailures = MAX_FAILURES, globalWindowMs = GLOBAL_WINDOW_MS, globalMaxFailures = GLOBAL_MAX_FAILURES } = {}) {
    this.now = now;
    this.windowMs = windowMs;
    this.maxFailures = maxFailures;
    this.globalWindowMs = globalWindowMs;
    this.globalMaxFailures = globalMaxFailures;
    this.byKey = new Map();
    this.global = [];
  }

  prune(key) {
    const now = this.now();
    const list = (this.byKey.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length) this.byKey.set(key, list); else this.byKey.delete(key);
    this.global = this.global.filter((t) => now - t < this.globalWindowMs);
    return list;
  }

  isGloballyLimited() {
    const now = this.now();
    this.global = this.global.filter((t) => now - t < this.globalWindowMs);
    return this.global.length >= this.globalMaxFailures;
  }

  isLimited(key) {
    return this.prune(key).length >= this.maxFailures || this.isGloballyLimited();
  }

  recordFailure(key) {
    const list = this.prune(key);
    list.push(this.now());
    this.byKey.set(key, list);
    this.global.push(this.now());
  }
}
