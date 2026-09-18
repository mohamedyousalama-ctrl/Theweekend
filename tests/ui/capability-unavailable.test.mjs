import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, failure, assertNoForbiddenCopy } from './helpers.mjs';
import { renderCapabilityCopy } from '../../src/ui/capability/capability-copy.js';
import { renderHealthBanner } from '../../src/ui/capability/health-banner.js';
import { renderAppHeader } from '../../src/ui/chrome/app-header.js';
import { M2_SURFACES, navForContext } from '../../src/ui/policy.js';
import { capabilityLabel } from '../../src/ui/copy.js';

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
  assert.match(ready.html, /الحجز:/);
  assert.equal(ready.html.includes('booking_handoff:'), false);
  assert.equal(ready.html.includes('photo_analysis'), false);
});

test('capability copy labels independently and never confirms official booking', () => {
  const view = renderCapabilityCopy({ context, health });
  assert.equal(view.meta.bookingConfirmed, false);
  assert.equal(view.meta.m2Mounted, false);
  assert.equal(view.meta.photoOptional, true);
  assert.match(view.html, /صفحة الحجز الرسمية/);
  assert.match(view.html, /data-booking="unconfirmed"/);
  assert.match(view.html, /مساعد رقمي/);
  assert.equal(view.html.includes('booking_handoff:'), false);
  assert.equal(view.html.includes('value_text'), false);
  assertNoForbiddenCopy(view.html, assert);
});

test('unavailable capabilities are omitted or disabled; M2 listed unavailable only in gallery', () => {
  const view = renderCapabilityCopy({ context, health: storeDown });
  assert.match(view.html, /data-m2-mounted="false"/);
  assert.equal(view.html.includes('reception_kiosk'), false);
  const gallery = renderCapabilityCopy({ context, health: storeDown, gallery: true });
  for (const id of M2_SURFACES) {
    assert.match(gallery.html, new RegExp(`data-m2="${id}"`));
    assert.match(gallery.html, /data-available="false"/);
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

test('capabilityLabel escapes unknown fallback values', () => {
  const html = capabilityLabel('model', '<script>alert(1)</script>', 'en');
  assert.match(html, /&lt;script&gt;/);
  assert.equal(html.includes('<script>'), false);
  const known = capabilityLabel('photo', 'enabled', 'en');
  assert.match(known, /enabled/);
  assert.equal(known.includes('&lt;'), false);
});
