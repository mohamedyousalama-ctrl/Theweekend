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

test('C serves src/ui/index.html without new route handlers', async () => {
  const { app, config } = testApp();
  const server = createHttpServer(app, config);
  const port = await listen(server);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /rakan-root/);
    assert.match(html, /app.js/);
    assert.equal(html.includes('support.js'), false);
    const css = await fetch(`http://127.0.0.1:${port}/styles/tokens.css`);
    assert.equal(css.status, 200);
    const js = await fetch(`http://127.0.0.1:${port}/app.js`);
    assert.equal(js.status, 200);
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
  assert.match(a, /\.wk-lead\s*\{/);
  assert.match(a, /max-width:\s*56ch/);
});
