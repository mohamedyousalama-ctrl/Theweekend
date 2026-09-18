import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { renderAppHeader } from '../../src/ui/chrome/app-header.js';
import { renderWaHeader } from '../../src/ui/try/wa-header.js';

test('customer and app shells render Khalid with the digital subtitle', () => {
  for (const shell of ['customer', 'app']) {
    const header = renderAppHeader({ locale: 'ar', shell });
    assert.match(header.html, /data-identity-chrome="true"/);
    assert.match(header.html, />خالد</);
    assert.match(header.html, /مساعد رقمي · ذا ويكند/);
    const en = renderAppHeader({ locale: 'en', shell });
    assert.match(en.html, />Khalid</);
    assert.match(en.html, /Digital assistant · The Weekend/);
  }
  const customerHtml = readFileSync(join(ROOT, 'src/ui/customer.html'), 'utf8');
  const appHtml = readFileSync(join(ROOT, 'src/ui/app.html'), 'utf8');
  assert.match(customerHtml, /data-shell="customer"/);
  assert.match(appHtml, /data-shell="app"/);
  const tryHeader = renderWaHeader({ locale: 'ar' });
  assert.match(tryHeader.html, />خالد</);
  assert.match(tryHeader.html, /مساعد رقمي · ذا ويكند/);
});
