import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHttpServer, listenTarget } from '../../src/server/http.mjs';
import { openStore } from '../../src/server/store.mjs';
import { testApp, testEnv } from './helpers.mjs';

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

test('test env still loads after parent-dir config', () => {
  const env = testEnv();
  mkdirSync(join(env.WEEKEND_DB_PATH, '..'), { recursive: true });
  assert.ok(env.WEEKEND_LOCAL_CUSTOMER_PASSCODE_HASH);
});
