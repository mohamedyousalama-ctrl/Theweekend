import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isNegativeProbeEnabled,
  NEGATIVE_PROBE_DEFAULT_SKIP,
  textOnlyTurnBlocker,
  TEXT_ONLY_TURN_BLOCKER,
} from '../../scripts/owner-walkthrough.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

const PRIVACY_FILES = [
  'docs/20-OWNER-WALKTHROUGH-2026-09-18.md',
  'scripts/owner-walkthrough.mjs',
];

test('issue #8 walkthrough runner and record exist without secrets or the review domain', () => {
  for (const rel of PRIVACY_FILES) {
    const text = readFileSync(join(ROOT, rel), 'utf8');
    assert.doesNotMatch(text, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, `${rel} contains an e-mail address`);
    assert.doesNotMatch(text, /up\.railway\.app/, `${rel} contains the Railway review domain`);
    assert.doesNotMatch(text, /sk-ant-/);
    assert.doesNotMatch(text, /Bearer [A-Za-z0-9._-]+/);
    assert.doesNotMatch(text, /WEEKEND_OWNER_PASSCODE=/);
  }
  const doc = readFileSync(join(ROOT, 'docs/20-OWNER-WALKTHROUGH-2026-09-18.md'), 'utf8');
  assert.match(doc, /Issue #8/);
  assert.match(doc, /NOT RUN/);
  assert.match(doc, /external_handoff|unauthenticated/);
  const script = readFileSync(join(ROOT, 'scripts/owner-walkthrough.mjs'), 'utf8');
  assert.match(script, /WEEKEND_WALKTHROUGH_URL/);
  assert.match(script, /never prints passcodes/i);
});

test('wrong-passcode probe is opt-in and follows authenticated logins', () => {
  assert.equal(isNegativeProbeEnabled({}), false);
  assert.equal(isNegativeProbeEnabled({ WEEKEND_WALKTHROUGH_NEGATIVE: '' }), false);
  assert.equal(isNegativeProbeEnabled({ WEEKEND_WALKTHROUGH_NEGATIVE: '0' }), false);
  assert.equal(isNegativeProbeEnabled({ WEEKEND_WALKTHROUGH_NEGATIVE: 'true' }), false);
  assert.equal(isNegativeProbeEnabled({ WEEKEND_WALKTHROUGH_NEGATIVE: '1' }), true);
  assert.match(NEGATIVE_PROBE_DEFAULT_SKIP, /default off/);

  const script = readFileSync(join(ROOT, 'scripts/owner-walkthrough.mjs'), 'utf8');
  const ownerLogin = script.indexOf("role: 'customer', passcode: ownerPass");
  const staffLogin = script.indexOf("role: 'staff', passcode: staffPass");
  const probe = script.indexOf("role: 'staff', passcode: 'nope'");
  assert.ok(ownerLogin !== -1 && staffLogin !== -1 && probe !== -1);
  assert.ok(probe > ownerLogin, 'wrong-passcode probe must follow the owner login');
  assert.ok(probe > staffLogin, 'wrong-passcode probe must follow the staff login');
  assert.match(script, /isNegativeProbeEnabled\(\)/);
  assert.doesNotMatch(script, /WEEKEND_STAFF_PASSCODE=/);
});

test('a failed or non-ok style turn records a text-only blocker', () => {
  assert.equal(textOnlyTurnBlocker({ status: 200, json: { output: { state: 'ok' } } }), null);
  assert.equal(textOnlyTurnBlocker({ status: 500, json: { output: { state: 'ok' } } }), TEXT_ONLY_TURN_BLOCKER);
  assert.equal(textOnlyTurnBlocker({ status: 200, json: { output: { state: 'error' } } }), TEXT_ONLY_TURN_BLOCKER);
  assert.equal(textOnlyTurnBlocker({ status: 200, json: { output: {} } }), TEXT_ONLY_TURN_BLOCKER);
  assert.equal(textOnlyTurnBlocker({ status: 200, json: {} }), TEXT_ONLY_TURN_BLOCKER);
  assert.equal(textOnlyTurnBlocker({ status: 0, json: null }), TEXT_ONLY_TURN_BLOCKER);

  const script = readFileSync(join(ROOT, 'scripts/owner-walkthrough.mjs'), 'utf8');
  assert.match(script, /textOnlyTurnBlocker\(style\)/);
});
