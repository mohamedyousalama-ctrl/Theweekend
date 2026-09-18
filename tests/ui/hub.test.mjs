import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { COPY } from '../../src/ui/copy.js';
import { renderWaHeader } from '../../src/ui/try/wa-header.js';
import { renderAppHeader } from '../../src/ui/chrome/app-header.js';
import { renderConversation } from '../../src/ui/conversation/view.js';
import { renderComposer } from '../../src/ui/conversation/composer.js';
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

test('customer and app chrome persist Khalid with the digital subtitle', () => {
  const header = renderAppHeader({ locale: 'ar' });
  assert.match(header.html, /data-identity-chrome="true"/);
  assert.match(header.html, /خالد/);
  assert.match(header.html, /مساعد رقمي · ذا ويكند/);
  const en = renderAppHeader({ locale: 'en' });
  assert.match(en.html, /Khalid/);
  assert.match(en.html, /Digital assistant · The Weekend/);
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

test('WhatsApp composer uses a paperclip control, not a native file caption', () => {
  const composer = renderComposer({ locale: 'ar', variant: 'whatsapp', photoEnabled: true });
  assert.match(composer.html, /wa-input-shell/);
  assert.match(composer.html, /wa-attach/);
  assert.match(composer.html, /class="wa-file"/);
  assert.match(composer.html, /data-photo-input="true"/);
  assert.match(composer.html, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(composer.html, /placeholder="رسالة"/);
  assert.doesNotMatch(composer.html, /class="wk-photo-upload"/);
  assert.doesNotMatch(composer.html, /Choose File/);
});

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('WhatsApp greeting does not dump styles, brief, save, or booking', () => {
  const view = renderConversation({
    locale: 'ar',
    variant: 'whatsapp',
    thread: [
      { from: 'khalid', text: COPY.ar.wa_welcome, lang: 'ar' },
      { from: 'guest', text: 'هلا والله', lang: 'ar' },
      { from: 'khalid', text: 'هلا والله. تبي حلاقة؟', lang: 'ar' },
    ],
    output: {
      state: 'ok',
      messages: [{ text: 'هلا والله. تبي حلاقة؟', lang: 'ar' }],
      style_options: [
        { option_id: 'opt_1', name_ar: 'فيد', name_en: 'fade', why_ar: 'يناسب شعرك', upkeep_ar: 'x', feasible_in_person: 'unknown' },
        { option_id: 'opt_2', name_ar: 'كلاسيك', name_en: 'classic', why_ar: 'أهدى', upkeep_ar: 'x', feasible_in_person: 'unknown' },
      ],
      brief_draft: { status: 'draft', requested_look: { text_ar: 'قصة كلاسيك فيد' } },
      proposed_actions: [],
      flags: [],
    },
    allowedActions: [
      {
        action_id: 'act_syn_book_link_a',
        kind: 'open_official_booking',
        label_ar: 'صفحة الحجز الرسمية',
        label_en: 'Official booking page',
        url: 'https://example.invalid/book',
      },
      {
        action_id: 'act_syn_save_a',
        kind: 'save_preference',
        label_ar: 'حفظ التفضيل',
        label_en: 'Save preference',
      },
      {
        action_id: 'act_syn_nophoto',
        kind: 'continue_without_photo',
        label_ar: 'بدون صورة',
        label_en: 'No photo',
      },
    ],
  });
  assert.equal(view.meta.greetingTurn, true);
  assert.equal(view.meta.styleCount, 0);
  assert.doesNotMatch(view.html, /حفظ التفضيل/);
  assert.doesNotMatch(view.html, /صفحة الحجز الرسمية/);
  assert.doesNotMatch(view.html, /بدون صورة/);
  assert.doesNotMatch(view.html, /data-component="brief-draft"/);
  assert.doesNotMatch(view.html, /data-style-replies/);
  assert.doesNotMatch(view.html, /يناسب شعرك/);
});

test('WhatsApp named service asks to book — no styles, no photo skip', () => {
  const view = renderConversation({
    locale: 'ar',
    variant: 'whatsapp',
    thread: [
      { from: 'khalid', text: COPY.ar.wa_welcome, lang: 'ar' },
      { from: 'guest', text: 'أبغى فيد', lang: 'ar' },
      { from: 'khalid', text: 'أبشر، الفيد قصّة شعر بـ30 ريال شامل الضريبة، المدة 35 دقيقة. أفتح لك صفحة الحجز؟', lang: 'ar' },
    ],
    output: {
      state: 'ok',
      messages: [{ text: 'أبشر، الفيد قصّة شعر بـ30 ريال شامل الضريبة، المدة 35 دقيقة. أفتح لك صفحة الحجز؟', lang: 'ar' }],
      style_options: [
        { option_id: 'opt_1', name_ar: 'فيد', name_en: 'fade', why_ar: 'يناسب شعرك', upkeep_ar: 'x', feasible_in_person: 'unknown' },
        { option_id: 'opt_2', name_ar: 'كلاسيك', name_en: 'classic', why_ar: 'أهدى', upkeep_ar: 'x', feasible_in_person: 'unknown' },
      ],
      flags: [],
    },
    allowedActions: [
      {
        action_id: 'act_syn_book_link_a',
        kind: 'open_official_booking',
        label_ar: 'صفحة الحجز الرسمية',
        label_en: 'Official booking page',
        url: 'https://example.invalid/book',
      },
      {
        action_id: 'act_syn_nophoto',
        kind: 'continue_without_photo',
        label_ar: 'بدون صورة',
        label_en: 'No photo',
      },
    ],
  });
  assert.equal(view.meta.greetingTurn, false);
  assert.equal(view.meta.styleCount, 0);
  assert.match(view.html, /أفتح صفحة الحجز/);
  assert.doesNotMatch(view.html, /بدون صورة/);
  assert.doesNotMatch(view.html, /يناسب شعرك/);
  assert.doesNotMatch(view.html, /data-style-replies/);
  assert.doesNotMatch(view.html, /data-component="brief-draft"/);
});

test('WhatsApp complaint keeps staff handoff and does not offer booking', () => {
  const view = renderConversation({
    locale: 'ar',
    variant: 'whatsapp',
    thread: [
      { from: 'khalid', text: COPY.ar.wa_welcome, lang: 'ar' },
      { from: 'guest', text: 'الحلاقة اللي سويتها لي خربت، ليش صار كذا؟', lang: 'ar' },
      { from: 'khalid', text: 'آسف على اللي صار.', lang: 'ar' },
      { from: 'khalid', text: 'أوصلك لأحد من الفريق؟', lang: 'ar' },
    ],
    output: {
      state: 'ok',
      messages: [
        { text: 'آسف على اللي صار.', lang: 'ar' },
        { text: 'أوصلك لأحد من الفريق؟', lang: 'ar' },
      ],
      flags: ['complaint'],
    },
    allowedActions: [
      {
        action_id: 'act_syn_book_link_a',
        kind: 'open_official_booking',
        label_ar: 'صفحة الحجز الرسمية',
        label_en: 'Official booking page',
        url: 'https://example.invalid/book',
      },
      {
        action_id: 'act_syn_staff_a',
        kind: 'talk_to_staff',
        label_ar: 'كلام مع الفريق',
        label_en: 'Talk to staff',
      },
    ],
  });
  assert.equal(view.meta.greetingTurn, false);
  assert.match(view.html, /كلام مع الفريق/);
  assert.doesNotMatch(view.html, /أفتح صفحة الحجز/);
  assert.doesNotMatch(view.html, /صفحة الحجز الرسمية/);
});

test('WhatsApp shows Khalid style suggestions inside the transcript after a look request', () => {
  const view = renderConversation({
    locale: 'ar',
    variant: 'whatsapp',
    thread: [
      { from: 'khalid', text: COPY.ar.wa_welcome, lang: 'ar' },
      { from: 'guest', text: 'أبغى شكل يناسبني', lang: 'ar' },
      { from: 'khalid', text: 'تمام، عندي خيارين', lang: 'ar' },
    ],
    output: {
      state: 'ok',
      messages: [{ text: 'تمام، عندي خيارين', lang: 'ar' }],
      style_options: [
        { option_id: 'opt_1', name_ar: 'فيد', name_en: 'fade', why_ar: 'يناسب شعرك', upkeep_ar: 'x', feasible_in_person: 'unknown' },
        { option_id: 'opt_2', name_ar: 'كلاسيك', name_en: 'classic', why_ar: 'أهدى', upkeep_ar: 'x', feasible_in_person: 'unknown' },
      ],
      flags: [],
    },
    allowedActions: [
      {
        action_id: 'act_syn_book_link_a',
        kind: 'open_official_booking',
        label_ar: 'صفحة الحجز الرسمية',
        label_en: 'Official booking page',
        url: 'https://example.invalid/book',
      },
    ],
  });
  assert.match(view.html, /wk-transcript[\s\S]*يناسب شعرك/);
  assert.match(view.html, /data-style-replies="true"/);
  assert.doesNotMatch(view.html, /صفحة الحجز الرسمية/);
  assert.doesNotMatch(view.html, /أفتح صفحة الحجز/);
  assert.doesNotMatch(view.html, /data-component="brief-draft"/);
});

test('WhatsApp thread shows an attached photo inside the chat bubble', () => {
  const view = renderConversation({
    locale: 'ar',
    variant: 'whatsapp',
    thread: [
      { from: 'khalid', text: COPY.ar.wa_welcome, lang: 'ar' },
      { from: 'guest', text: '', lang: 'ar', imageUrl: PIXEL },
    ],
  });
  assert.match(view.html, /data-chat-photo="true"/);
  assert.match(view.html, /data-has-photo="true"/);
  assert.ok(view.html.includes(PIXEL));
  const blocked = renderConversation({
    locale: 'ar',
    variant: 'whatsapp',
    thread: [{ from: 'guest', text: 'x', lang: 'ar', imageUrl: 'javascript:alert(1)' }],
  });
  assert.equal(blocked.html.includes('javascript:'), false);
  assert.doesNotMatch(blocked.html, /data-chat-photo="true"/);
});

test('WhatsApp loading keeps the thread and does not replace it with a dark skeleton', () => {
  const view = renderConversation({
    locale: 'ar',
    variant: 'whatsapp',
    loading: true,
    thread: [
      { from: 'khalid', text: COPY.ar.wa_welcome, lang: 'ar' },
      { from: 'guest', text: 'صورتي', lang: 'ar' },
    ],
    allowedActions: [{
      action_id: 'act_syn_nophoto',
      kind: 'continue_without_photo',
      label_ar: 'بدون صورة',
      label_en: 'No photo',
    }],
  });
  assert.match(view.html, /مساعد ذا ويكند الرقمي/);
  assert.match(view.html, /صورتي/);
  assert.match(view.html, /wa-typing/);
  assert.doesNotMatch(view.html, /wk-skeleton/);
  assert.doesNotMatch(view.html, /بدون صورة/);
});

test('WhatsApp brief is a chat bubble, not a black staff card', () => {
  const view = renderConversation({
    locale: 'ar',
    variant: 'whatsapp',
    thread: [
      { from: 'khalid', text: COPY.ar.wa_welcome, lang: 'ar' },
      { from: 'guest', text: 'أبغى فيد', lang: 'ar' },
      { from: 'khalid', text: 'تمام', lang: 'ar' },
      { from: 'guest', text: 'الأول', lang: 'ar' },
      { from: 'khalid', text: 'أبشر', lang: 'ar' },
    ],
    output: {
      state: 'ok',
      messages: [{ text: 'أبشر', lang: 'ar' }],
      style_options: [],
      brief_draft: { status: 'draft', requested_look: { text_ar: 'فيد جانبي مع تهذيب اللحية' } },
      flags: [],
    },
    allowedActions: [{
      action_id: 'act_syn_book_link_a',
      kind: 'open_official_booking',
      label_ar: 'صفحة الحجز الرسمية',
      label_en: 'Official booking page',
      url: 'https://example.invalid/book',
    }],
  });
  assert.match(view.html, /فيد جانبي مع تهذيب اللحية/);
  assert.match(view.html, /wa-brief-kicker/);
  assert.doesNotMatch(view.html, /wk-brief-value/);
  assert.doesNotMatch(view.html, /data-style-replies/);
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
    assert.match(tryHtml, /محادثة تجريبية على موقع ذا ويكند — مو واتساب/);
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
  for (const hex of ['#075e54', '#efeae2', '#d9fdd3', '#25d366']) {
    assert.doesNotMatch(tryCss, new RegExp(hex, 'i'));
  }
  assert.match(tryHtml, /محادثة تجريبية على موقع ذا ويكند — مو واتساب/);
  assert.match(tryHtml, /A trial chat on The Weekend site — not WhatsApp/);
  for (const src of [tryCss, tryHtml, home]) {
    assert.doesNotMatch(src, /Meta Business|✓✓/);
    assert.doesNotMatch(src, /This is not a real reservation|owner review|ديمو/i);
  }
  assert.doesNotMatch(tryCss, /WhatsApp/i);
  assert.doesNotMatch(home, /WhatsApp/i);
  assert.match(tryCss, /\.wa-attach::before/);
  assert.match(tryCss, /\.wa-input-shell/);
  assert.match(tryCss, /clip-path:\s*inset\(50%\)/);
  assert.match(tryCss, /opacity:\s*0/);
  assert.match(tryCss, /::file-selector-button/);
  assert.match(tryCss, /\.wa-typing/);
  assert.match(tryCss, /margin-left:\s*auto/);
});

test('try-page CSS keeps composer in first viewport (DOM shim cannot measure layout)', () => {
  const tryCss = readFileSync(join(ROOT, 'src/ui/styles/whatsapp.css'), 'utf8');
  const waStageRules = [...tryCss.matchAll(/\.wa-stage\s*\{[^}]*\}/g)].map((m) => m[0]);
  assert.ok(waStageRules.length >= 1, 'expected a .wa-stage rule');
  for (const rule of waStageRules) {
    assert.doesNotMatch(rule, /min-height:\s*100vh/);
  }
  assert.match(tryCss, /\.try-body\s+#rakan-root\s*\{[^}]*flex:\s*1/);
  assert.match(tryCss, /\.wa-stage\s*\{[^}]*min-height:\s*100%/);
});
