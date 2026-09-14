import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, failure, assertNoForbiddenCopy } from './helpers.mjs';
import { renderCapabilityCopy } from '../../src/ui/capability/capability-copy.js';
import { renderHealthBanner } from '../../src/ui/capability/health-banner.js';
import { renderAppHeader } from '../../src/ui/chrome/app-header.js';
import { M2_SURFACES, navForContext } from '../../src/ui/policy.js';

const context = readJson('valid/trusted-context.json');
const health = readJson('valid/health-state.json');
const storeDown = failure('store-unavailable').instance;

test('health banner waits for checked_at', () => {
  const checking = renderHealthBanner({ health: null });
  assert.equal(checking.meta.checking, true);
  assert.match(checking.html, /جاري التحقق من الحالة/);
  const ready = renderHealthBanner({ health });
  assert.equal(ready.meta.checking, false);
  assert.match(ready.html, /data-cap="model"/);
});

test('capability copy labels independently and never confirms official booking', () => {
  const view = renderCapabilityCopy({ context, health });
  assert.equal(view.meta.bookingConfirmed, false);
  assert.equal(view.meta.m2Mounted, false);
  assert.equal(view.meta.photoOptional, true);
  assert.match(view.html, /تسليم خارجي/);
  assert.match(view.html, /data-booking="unconfirmed"/);
  assert.match(view.html, /مساعد رقمي/);
  assertNoForbiddenCopy(view.html, assert);
});

test('unavailable capabilities are omitted or disabled; M2 listed unavailable', () => {
  const view = renderCapabilityCopy({ context, health: storeDown });
  assert.match(view.html, /data-m2-mounted="false"/);
  for (const id of M2_SURFACES) {
    assert.match(view.html, new RegExp(`data-m2="${id}"`));
    assert.match(view.html, /data-available="false"/);
  }
  const header = renderAppHeader({ context, health: storeDown });
  assert.equal(header.meta.m2Mounted, false);
  assert.equal(header.meta.surfaces.includes('staff_inbox'), false);
  assert.equal(header.meta.surfaces.includes('reception_kiosk'), false);
});

test('nav never includes M2 surfaces', () => {
  const items = navForContext({
    ...context,
    role: 'staff',
    capabilities: { ...context.capabilities, staff_inbox: 'enabled', preferences: 'enabled' },
  }, { ...health, staff_inbox: 'ok' });
  assert.equal(items.some((i) => M2_SURFACES.includes(i.id)), false);
});
