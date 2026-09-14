import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, DESIGN_HASH } from './helpers.mjs';
import { createHash } from 'node:crypto';
import { M2_SURFACES } from '../../src/ui/policy.js';
import { renderCapabilityCopy } from '../../src/ui/capability/capability-copy.js';
import { renderAppHeader } from '../../src/ui/chrome/app-header.js';
import { renderConversation } from '../../src/ui/conversation/view.js';
import { readJson } from './helpers.mjs';

function walk(dir, acc = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

test('design/reference SHA-256 is unchanged', () => {
  const buf = readFileSync(join(ROOT, 'design/reference/rakan-guest-memory.dc.html'));
  const hex = createHash('sha256').update(buf).digest('hex');
  assert.equal(hex, DESIGN_HASH);
  const sums = readFileSync(join(ROOT, 'design/reference/SHA256SUMS'), 'utf8');
  assert.equal(sums.includes(DESIGN_HASH), true);
});

test('M2 screens are not mounted in M1 chrome or conversation', () => {
  const context = readJson('valid/trusted-context.json');
  const health = readJson('valid/health-state.json');
  const header = renderAppHeader({ context, health });
  const cap = renderCapabilityCopy({ context, health });
  const convo = renderConversation({ context, output: readJson('valid/chat-turn-output.json'), allowedActions: [] });
  const html = header.html + cap.html + convo.html;
  assert.equal(header.meta.m2Mounted, false);
  assert.equal(cap.meta.m2Mounted, false);
  assert.equal(html.includes('data-m2-mounted="false"'), true);
  assert.equal(html.includes('reception_kiosk') && html.includes('data-available="false"'), true);
  for (const id of ['isS1', 'kDetect', 'scanline', 'guest-directory']) {
    assert.equal(html.includes(id), false, id);
  }
  void M2_SURFACES;
});

test('UI source does not invent AllowedAction kinds', () => {
  const files = walk(join(ROOT, 'src/ui')).filter((p) => p.endsWith('.js') || p.endsWith('.html'));
  const invented = [
    'prepare_booking_request',
    'simulate_booking',
    'create_booking',
    'modify_booking',
    'cancel_booking',
    'start_service',
    'saveCapture',
  ];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const kind of invented) {
      assert.equal(text.includes(kind), false, `${file} contains ${kind}`);
    }
  }
});

test('served styles match styles/ tokens (ground, red, fonts URL)', () => {
  const tokens = readFileSync(join(ROOT, 'styles/tokens.css'), 'utf8');
  const served = readFileSync(join(ROOT, 'src/ui/styles/tokens.css'), 'utf8');
  assert.equal(served, tokens);
  assert.match(tokens, /#07090F/);
  assert.match(tokens, /#E11D2E/);
  const fonts = readFileSync(join(ROOT, 'styles/fonts.css'), 'utf8');
  assert.match(fonts, /fonts.googleapis.com\/css2\?family=IBM\+Plex\+Sans\+Arabic/);
  assert.match(fonts, /Archivo\+Black/);
});
