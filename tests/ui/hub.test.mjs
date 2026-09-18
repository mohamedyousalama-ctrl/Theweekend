import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { COPY } from '../../src/ui/copy.js';
import { renderWaHeader } from '../../src/ui/try/wa-header.js';
import { renderConversation } from '../../src/ui/conversation/view.js';
import { createHttpServer } from '../../src/server/http.mjs';
import { testApp } from '../platform/helpers.mjs';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    server.on('error', reject);
  });
}

test('visible assistant name is Khalid with a digital subtitle', () => {
  assert.equal(COPY.ar.product, 'خالد');
  assert.match(COPY.ar.wa_subtitle, /مساعد رقمي/);
  assert.match(COPY.ar.wa_welcome, /مساعد ذا ويكند الرقمي/);
  assert.equal(COPY.ar.landing_eyebrow.includes('راكان'), false);
  assert.equal(COPY.en.product, 'Khalid');
  assert.match(COPY.en.wa_subtitle, /Digital assistant/);
  assert.deepEqual(Object.keys(COPY.ar).sort(), Object.keys(COPY.en).sort());
});

test('WhatsApp-looking header never claims a live WhatsApp account', () => {
  const header = renderWaHeader({ locale: 'ar', health: { model: 'ok' } });
  assert.match(header.html, /خالد/);
  assert.match(header.html, /مساعد رقمي · ذا ويكند/);
  assert.match(header.html, /عادةً يرد خلال لحظات/);
  assert.equal(/WhatsApp|واتساب|✓✓|read receipt/i.test(header.html), false);
  const down = renderWaHeader({ locale: 'ar', health: { model: 'unavailable' } });
  assert.equal(down.html.includes('عادةً يرد خلال لحظات'), false);
  assert.equal(down.html.includes('متصل الآن'), false);
});

test('try conversation shows welcome replies and does not confirm a booking', () => {
  const view = renderConversation({
    locale: 'ar',
    variant: 'whatsapp',
    quickReplies: true,
    thread: [{ from: 'khalid', text: COPY.ar.wa_welcome, lang: 'ar' }],
    allowedActions: [],
  });
  assert.match(view.html, /أبغى فيد/);
  assert.match(view.html, /أفتح صفحة الحجز/);
  assert.equal(view.meta.bookingConfirmed, false);
  assert.equal(/WhatsApp|✓✓/.test(view.html), false);
});

test('hub routes stay split: public pages, locked team shells, JSON /health', async () => {
  const { app, config } = testApp();
  const server = createHttpServer(app, config);
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;
  try {
    const home = await (await fetch(`${base}/`)).text();
    assert.match(home, /جرّبه الآن/);
    const tryPage = await fetch(`${base}/try`);
    const tryHtml = await tryPage.text();
    assert.equal(tryPage.status, 200);
    assert.match(tryHtml, /data-shell="try"/);
    assert.match(tryHtml, /whatsapp.css/);
    for (const path of ['/journey', '/how', '/brief']) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 200, path);
    }
    const team = await (await fetch(`${base}/team`)).text();
    assert.match(team, /data-shell="staff"/);
    const health = await fetch(`${base}/health`);
    assert.equal(health.headers.get('content-type')?.includes('application/json'), true);
    const body = await health.json();
    assert.equal(body.contract_version, '0.1.0');
    const status = await fetch(`${base}/status`);
    assert.equal(status.headers.get('content-type')?.includes('text/html'), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.close();
  }
});

test('try skin and hub pages do not ship WhatsApp trademarks or demo shame copy', () => {
  const tryCss = readFileSync(join(ROOT, 'src/ui/styles/whatsapp.css'), 'utf8');
  const tryHtml = readFileSync(join(ROOT, 'src/ui/try.html'), 'utf8');
  const home = readFileSync(join(ROOT, 'src/ui/index.html'), 'utf8');
  for (const src of [tryCss, tryHtml, home]) {
    assert.doesNotMatch(src, /WhatsApp|Meta Business|✓✓/);
    assert.doesNotMatch(src, /This is not a real reservation|owner review|ديمو/i);
  }
});
