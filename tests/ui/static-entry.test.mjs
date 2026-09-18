import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { createHttpServer } from '../../src/server/http.mjs';
import { testApp } from '../platform/helpers.mjs';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    server.on('error', reject);
  });
}

test('C serves src/ui/index.html as the Arabic team hub', async () => {
  const { app, config } = testApp();
  const server = createHttpServer(app, config);
  const port = await listen(server);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /مركز تجربة الضيف/);
    assert.match(html, /href="\/try"/);
    assert.equal(html.includes('rakan-root'), false);
    assert.equal(/ديمو|owner-review|Owner review/i.test(html), false);
    const css = await fetch(`http://127.0.0.1:${port}/styles/tokens.css`);
    assert.equal(css.status, 200);
    const hub = await fetch(`http://127.0.0.1:${port}/styles/hub.css`);
    assert.equal(hub.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.close();
  }
});

test('index.html is RTL, mobile-first, keyboard skip link present in source', () => {
  const html = readFileSync(join(ROOT, 'src/ui/index.html'), 'utf8');
  assert.match(html, /dir="rtl"/);
  assert.match(html, /width=device-width/);
  const app = readFileSync(join(ROOT, 'src/ui/app.js'), 'utf8');
  assert.match(app, /skip-link/);
  assert.match(app, /wk-composer-text|composer/);
});

test('states.css copies stay identical and restore .wk-lead', () => {
  const a = readFileSync(join(ROOT, 'styles/states.css'), 'utf8');
  const b = readFileSync(join(ROOT, 'src/ui/styles/states.css'), 'utf8');
  assert.equal(a, b);
  const original = [
    '.wk-lead {',
    '  margin: 0 0 24px;',
    '  max-width: 56ch;',
    '  font-size: 17px;',
    '  line-height: 1.85;',
    '  color: var(--wk-muted-2);',
    '}',
  ].join('\n');
  assert.equal(a.includes(original), true);
});
