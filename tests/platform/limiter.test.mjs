import test from 'node:test';
import assert from 'node:assert/strict';
import { AttemptLimiter, WindowCounter } from '../../src/server/limiter.mjs';

test('WindowCounter.sweep drops idle keys after the window', () => {
  let now = 1_000;
  const counter = new WindowCounter(() => now, { windowMs: 10 * 60 * 1000, max: 10 });
  for (let i = 0; i < 20; i += 1) {
    assert.equal(counter.tryRecord(`addr-${i}`), true);
  }
  assert.equal(counter.byKey.size, 20);
  now += 10 * 60 * 1000;
  counter.sweep();
  assert.equal(counter.byKey.size, 0);
});

test('WindowCounter evicts the oldest key when the map is full', () => {
  const counter = new WindowCounter(() => 1_000, { windowMs: 60_000, max: 10, maxKeys: 3 });
  assert.equal(counter.tryRecord('a'), true);
  assert.equal(counter.tryRecord('b'), true);
  assert.equal(counter.tryRecord('c'), true);
  assert.equal(counter.tryRecord('d'), true);
  assert.equal(counter.byKey.size, 3);
  assert.equal(counter.byKey.has('a'), false);
  assert.equal(counter.byKey.has('d'), true);
});

test('AttemptLimiter.sweep drops idle keys after the window', () => {
  let now = 1_000;
  const limiter = new AttemptLimiter(() => now, { windowMs: 15 * 60 * 1000 });
  for (let i = 0; i < 20; i += 1) {
    limiter.recordFailure(`addr-${i}`);
  }
  assert.equal(limiter.byKey.size, 20);
  now += 15 * 60 * 1000;
  limiter.sweep();
  assert.equal(limiter.byKey.size, 0);
});

test('AttemptLimiter evicts the oldest key when the map is full', () => {
  const limiter = new AttemptLimiter(() => 1_000, { maxKeys: 3 });
  limiter.recordFailure('a');
  limiter.recordFailure('b');
  limiter.recordFailure('c');
  limiter.recordFailure('d');
  assert.equal(limiter.byKey.size, 3);
  assert.equal(limiter.byKey.has('a'), false);
  assert.equal(limiter.byKey.has('d'), true);
});

test('WindowCounter.release drops the latest event for a key', () => {
  const counter = new WindowCounter(() => 1_000, { windowMs: 60_000, max: 2 });
  assert.equal(counter.tryRecord('a'), true);
  assert.equal(counter.tryRecord('a'), true);
  assert.equal(counter.tryRecord('a'), false);
  counter.release('a');
  assert.equal(counter.tryRecord('a'), true);
  counter.release('missing');
  counter.release('a');
  counter.release('a');
  assert.equal(counter.byKey.has('a'), false);
});
