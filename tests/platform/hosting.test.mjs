import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHttpServer, listenTarget } from '../../src/server/http.mjs';
import { openStore } from '../../src/server/store.mjs';
import { testApp, testEnv } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    server.on('error', reject);
  });
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
  assert.match(hosting, /4bfe6b5/);
  const baseline = readFileSync(join(ROOT, 'docs/16-C-BASELINE.md'), 'utf8');
  assert.match(baseline, /4bfe6b526daa5bc5ebe448e2c90abc3f8415e673/);
});
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

test('test env still loads after parent-dir config', () => {
  const env = testEnv();
  mkdirSync(join(env.WEEKEND_DB_PATH, '..'), { recursive: true });
  assert.ok(env.WEEKEND_LOCAL_CUSTOMER_PASSCODE_HASH);
});
