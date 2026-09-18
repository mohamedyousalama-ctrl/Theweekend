import test from 'node:test';
import assert from 'node:assert/strict';
import { capabilitiesFor } from '../../src/server/app.mjs';
import { loadConfig } from '../../src/server/config.mjs';
import { OWNER_PASS, testApp, testEnv } from './helpers.mjs';

test('capabilitiesFor: customer staff_inbox follows the staff-inbox store, not the session role', () => {
  const config = loadConfig(testEnv());
  assert.equal(capabilitiesFor(config, 'customer', false, true).staff_inbox, 'enabled');
  assert.equal(capabilitiesFor(config, 'customer', false, false).staff_inbox, 'unavailable');
  assert.equal(capabilitiesFor(config, 'staff', false, false).staff_inbox, 'enabled');
  assert.equal(capabilitiesFor(config, 'owner', false, false).staff_inbox, 'enabled');
});

test('customer session reports staff_inbox enabled when the store is up', () => {
  const { app } = testApp();
  const { token } = app.createSession('customer', OWNER_PASS);
  assert.equal(app.context(token).capabilities.staff_inbox, 'enabled');
  assert.equal(app.health().staff_inbox, 'ok');
  app.close();
});

test('customer session reports staff_inbox unavailable when the store is down', () => {
  const { app } = testApp();
  app.store.probe = () => {
    throw new Error('store down');
  };
  const { token } = app.createSession('customer', OWNER_PASS);
  assert.equal(app.context(token).capabilities.staff_inbox, 'unavailable');
  assert.equal(app.health().staff_inbox, 'unavailable');
  app.close();
});
