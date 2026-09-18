import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

test('AGENTS.md line 19 records pre-#36 working name and D18 awaiting owner confirmation', () => {
  const lines = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8').split('\n');
  const line19 = lines[18];
  assert.match(line19, /The working name before PR #36 was Rakan/);
  assert.match(line19, /the visible name خالد \(D18\) awaits the owner's confirmation on #2/);
  assert.equal(line19.includes('Rakan is a proposed fictional assistant name'), false);
  assert.match(lines[28], /Visible name \(D18\): \*\*خالد\*\*/);
});
