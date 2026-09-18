import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHttpServer, listenTarget } from '../../src/server/http.mjs';
import { openStore } from '../../src/server/store.mjs';
import { testApp, testEnv } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc\s*=)/i;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    server.on('error', reject);
  });
}

function uiHtmlPaths() {
  return readdirSync(join(ROOT, 'src/ui'))
    .filter((name) => name.endsWith('.html'))
    .map((name) => join(ROOT, 'src/ui', name));
}

function uiCssPaths() {
  return readdirSync(join(ROOT, 'src/ui/styles'))
    .filter((name) => name.endsWith('.css'))
    .map((name) => join(ROOT, 'src/ui/styles', name));
}

function hostsAllowedByCsp(header) {
  const hosts = new Set();
  for (const token of String(header || '').split(/[\s;]+/)) {
    if (!/^https?:\/\//i.test(token)) continue;
    hosts.add(new URL(token).host);
  }
  return hosts;
}

function externalHostsFromHtml(html) {
  const hosts = new Set();
  for (const tag of String(html).matchAll(/<link\b[^>]*>/gi)) {
    const href = tag[0].match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!href || !/^https?:\/\//i.test(href[1])) continue;
    hosts.add(new URL(href[1]).host);
  }
  return hosts;
}

function externalHostsFromCss(css) {
  const hosts = new Set();
  for (const match of String(css).matchAll(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/gi)) {
    if (!/^https?:\/\//i.test(match[1])) continue;
    hosts.add(new URL(match[1]).host);
  }
  return hosts;
}

test('health is 503 when the store is closed', async () => {
  const { app, config } = testApp();
  app.close();
  const server = createHttpServer(app, config);
  const port = await listen(server);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 503);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    const json = await res.json();
    assert.equal(json.store, 'unavailable');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('store creates missing parent directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'weekend-parent-'));
  const dbPath = join(root, 'nested', 'dir', 'app.sqlite');
  const store = openStore(dbPath);
  assert.equal(store.probe(), true);
  store.close();
  rmSync(root, { recursive: true, force: true });
});

test('PORT selects 0.0.0.0; unset keeps the local loopback default', () => {
  const previous = process.env.PORT;
  delete process.env.PORT;
  assert.deepEqual(listenTarget(), { host: '127.0.0.1', port: 8787 });
  process.env.PORT = '3456';
  assert.deepEqual(listenTarget(), { host: '0.0.0.0', port: 3456 });
  if (previous === undefined) delete process.env.PORT;
  else process.env.PORT = previous;
});

test('hosting doc unblocks Railway after C2 and the UI handback', () => {
  const hosting = readFileSync(join(ROOT, 'docs/17-HOSTING.md'), 'utf8');
  assert.match(hosting, /unblocked 2026-09-15/);
  // Privacy guard (AGENTS.md: public repository — no private contacts, no review-domain leak).
  for (const file of ['docs/17-HOSTING.md', 'docs/18-HANDOVER-INTEGRATOR.md', 'CONTINUE.md']) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    assert.doesNotMatch(text, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, `${file} contains an e-mail address`);
    assert.doesNotMatch(text, /up\.railway\.app/, `${file} contains the Railway review domain`);
  }
  assert.match(hosting, /WEEKEND_MODEL_API_KEY/);
  // The pin lines must agree; CONTINUE.md §5 is the source (the pin moves with every merge).
  const cont = readFileSync(join(ROOT, 'CONTINUE.md'), 'utf8');
  const pin = cont.match(/Current `main` pin \([^)]*\): `([0-9a-f]{40})`/)?.[1];
  assert.ok(pin, 'CONTINUE.md names the current main pin');
  const baseline = readFileSync(join(ROOT, 'docs/16-C-BASELINE.md'), 'utf8');
  assert.match(baseline, new RegExp(pin));
  assert.match(hosting, new RegExp(pin.slice(0, 7)));
  const handover = readFileSync(join(ROOT, 'docs/18-HANDOVER-INTEGRATOR.md'), 'utf8');
  assert.match(handover, new RegExp('`main` = `' + pin.slice(0, 7) + '`'), 'docs/18 §2 names the same main pin');
});

test('railway and nixpacks pin npm start, /health, and Node 22', () => {
  const railway = JSON.parse(readFileSync(join(ROOT, 'railway.json'), 'utf8'));
  assert.equal(railway.deploy.startCommand, 'npm start');
  assert.equal(railway.deploy.healthcheckPath, '/health');
  const nixpacks = readFileSync(join(ROOT, 'nixpacks.toml'), 'utf8');
  assert.match(nixpacks, /NIXPACKS_NODE_VERSION\s*=\s*"22"/);
  const envExample = readFileSync(join(ROOT, '.env.example'), 'utf8');
  assert.match(envExample, /WEEKEND_TRUST_PROXY=/);
  assert.match(envExample, /WEEKEND_OWNER_PASSCODE=/);
  assert.match(envExample, /WEEKEND_DB_PATH=/);
});

test('static UI is served with clickjacking and sniffing protections', async () => {
  const { app, config } = testApp();
  const server = createHttpServer(app, config);
  const port = await listen(server);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(res.headers.get('cache-control'), 'no-store');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.close();
  }
});

test('src/ui HTML pages have no inline script', () => {
  const files = uiHtmlPaths();
  assert.ok(files.length > 0);
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    assert.equal(INLINE_SCRIPT.test(html), false, `${file} contains an inline script`);
  }
});

test('CSP allows every external host used by UI link tags and CSS @import', async () => {
  const { app, config } = testApp();
  const server = createHttpServer(app, config);
  const port = await listen(server);
  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    const header = health.headers.get('content-security-policy');
    assert.equal(header, CONTENT_SECURITY_POLICY);
    assert.equal(header.includes("'unsafe-inline'"), false);
    const allowed = hostsAllowedByCsp(header);
    const used = new Set();
    for (const file of uiHtmlPaths()) {
      for (const host of externalHostsFromHtml(readFileSync(file, 'utf8'))) used.add(host);
    }
    for (const file of uiCssPaths()) {
      for (const host of externalHostsFromCss(readFileSync(file, 'utf8'))) used.add(host);
    }
    assert.ok(used.size > 0, 'expected at least one external UI host');
    for (const host of used) {
      assert.ok(allowed.has(host), `${host} is used by the UI but is not allowed by CSP`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.close();
  }
});

test('Content-Security-Policy is on /, /customer.html, /staff.html, /health, JSON errors and 404', async () => {
  const { app, config } = testApp();
  const server = createHttpServer(app, config);
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;
  try {
    const pages = [
      { path: '/', status: 200, type: /^text\/html/ },
      { path: '/customer.html', status: 200, type: /^text\/html/ },
      { path: '/staff.html', status: 200, type: /^text\/html/ },
      { path: '/health', status: 200, type: /^application\/json/ },
    ];
    for (const page of pages) {
      const res = await fetch(base + page.path);
      assert.equal(res.status, page.status, page.path);
      assert.match(res.headers.get('content-type') || '', page.type);
      assert.equal(res.headers.get('content-security-policy'), CONTENT_SECURITY_POLICY);
    }

    const jsonError = await fetch(`${base}/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'customer', passcode: 'nope' }),
    });
    assert.equal(jsonError.status, 401);
    assert.match(jsonError.headers.get('content-type') || '', /^application\/json/);
    assert.equal(jsonError.headers.get('content-security-policy'), CONTENT_SECURITY_POLICY);

    const missing = await fetch(`${base}/no-such-route`);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('content-security-policy'), CONTENT_SECURITY_POLICY);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.close();
  }
});

test('test env still loads after parent-dir config', () => {
  const env = testEnv();
  mkdirSync(join(env.WEEKEND_DB_PATH, '..'), { recursive: true });
  assert.ok(env.WEEKEND_LOCAL_CUSTOMER_PASSCODE_HASH);
});
