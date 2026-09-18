import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isNegativeProbeEnabled,
  NEGATIVE_PROBE_DEFAULT_SKIP,
  textOnlyTurnBlocker,
  TEXT_ONLY_TURN_BLOCKER,
  handoffSkip,
  HANDOFF_NOT_RUN,
  HANDOFF_SKIP_BLOCKER,
  walkthroughExitCode,
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

test('missing talk_to_staff records not_run and a non-zero exit', () => {
  assert.equal(handoffSkip({ kind: 'talk_to_staff', action_id: 'act_staff' }), null);
  const skip = handoffSkip(null);
  assert.equal(skip.not_run, HANDOFF_NOT_RUN);
  assert.equal(skip.blocker, HANDOFF_SKIP_BLOCKER);
  assert.equal(walkthroughExitCode({ blockers: [] }), 0);
  assert.equal(walkthroughExitCode({ blockers: [skip.blocker] }), 1);

  const script = readFileSync(join(ROOT, 'scripts/owner-walkthrough.mjs'), 'utf8');
  assert.match(script, /handoffSkip\(talk\)/);
  assert.match(script, /not_run\.push\(skippedHandoff\.not_run\)/);
  assert.match(script, /blockers\.push\(skippedHandoff\.blocker\)/);
  assert.match(script, /process\.exit\(walkthroughExitCode\(report\)\)/);
});

test('walkthrough main still runs when the script is invoked through a symlink', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wk-walkthrough-'));
  const link = join(dir, 'symlink.mjs');
  const env = { ...process.env };
  delete env.WEEKEND_WALKTHROUGH_URL;
  delete env.WEEKEND_OWNER_PASSCODE;
  delete env.WEEKEND_STAFF_PASSCODE;
  try {
    symlinkSync(join(ROOT, 'scripts/owner-walkthrough.mjs'), link);
    const result = spawnSync(process.execPath, [link], { env, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /WEEKEND_WALKTHROUGH_URL is required/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
