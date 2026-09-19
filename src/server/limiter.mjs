const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const GLOBAL_WINDOW_MS = 60 * 1000;
const GLOBAL_MAX_FAILURES = 30;

/**
 * In-process passcode attempt limiter. Per client address (5 failures / 15 min) plus a global budget
 * (30 failures / minute across all addresses) so a spoofed or rotating address cannot buy unlimited tries.
 */
export class AttemptLimiter {
  constructor(now = () => Date.now(), { windowMs = WINDOW_MS, maxFailures = MAX_FAILURES, globalWindowMs = GLOBAL_WINDOW_MS, globalMaxFailures = GLOBAL_MAX_FAILURES, maxKeys = 5000 } = {}) {
    this.now = now;
    this.windowMs = windowMs;
    this.maxFailures = maxFailures;
    this.globalWindowMs = globalWindowMs;
    this.globalMaxFailures = globalMaxFailures;
    this.maxKeys = Number.isInteger(maxKeys) && maxKeys > 0 ? maxKeys : 5000;
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

  sweep() {
    const now = this.now();
    for (const [key, list] of this.byKey) {
      const kept = list.filter((t) => now - t < this.windowMs);
      if (kept.length) this.byKey.set(key, kept); else this.byKey.delete(key);
    }
    this.global = this.global.filter((t) => now - t < this.globalWindowMs);
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
    while (this.byKey.size > this.maxKeys) this.byKey.delete(this.byKey.keys().next().value);
  }
}

/**
 * Sliding-window counter for successful public-guest events (session creates, turns).
 * Check-and-add is one step so two concurrent calls cannot both pass the max.
 */
export class WindowCounter {
  constructor(now = () => Date.now(), { windowMs, max, maxKeys = 5000 } = {}) {
    this.now = now;
    this.windowMs = windowMs;
    this.max = max;
    this.maxKeys = Number.isInteger(maxKeys) && maxKeys > 0 ? maxKeys : 5000;
    this.byKey = new Map();
  }

  prune(key) {
    const now = this.now();
    const list = (this.byKey.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length) this.byKey.set(key, list); else this.byKey.delete(key);
    return list;
  }

  sweep() {
    const now = this.now();
    for (const [key, list] of this.byKey) {
      const kept = list.filter((t) => now - t < this.windowMs);
      if (kept.length) this.byKey.set(key, kept); else this.byKey.delete(key);
    }
  }

  isLimited(key) {
    return this.prune(key).length >= this.max;
  }

  /** Records one event when under the max. Returns false when the key is already at the max. */
  tryRecord(key) {
    const list = this.prune(key);
    if (list.length >= this.max) return false;
    list.push(this.now());
    this.byKey.set(key, list);
    while (this.byKey.size > this.maxKeys) this.byKey.delete(this.byKey.keys().next().value);
    return true;
  }

  release(key) {
    const list = this.byKey.get(key);
    if (!list || !list.length) return;
    list.pop();
    if (!list.length) this.byKey.delete(key);
  }
}
