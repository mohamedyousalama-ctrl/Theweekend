import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

test('dev REPL prints a neutral weekend> prompt', () => {
  const src = readFileSync(join(ROOT, 'src/agent/chat.mjs'), 'utf8');
  assert.match(src, /process\.stdout\.write\(`weekend> \$\{m\.text\}\\n`\)/);
  assert.equal(src.includes('راكان>'), false);
});
