import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '../..');
export const FIX = join(ROOT, 'fixtures/contracts');
export const DESIGN_HASH = '7ee86b47bd1b75f21655e30bd2a2770b8a9f4bea8ce1e50af7982f0a80b0d980';

export function readJson(rel) {
  return JSON.parse(readFileSync(join(FIX, rel), 'utf8'));
}

export function failure(name) {
  return readJson(`failures/${name}.json`);
}

export const FORBIDDEN_LIVE_COPY = [
  'جارٍ التعرّف',
  'انظر إلى الشاشة لنتعرّف',
  'زيارتك رقم',
  'الانتظار المتوقّع',
  'صورة الأمام إلزامية',
  'كل الفروع',
  'عبدالله الشمري',
  'خالد العتيبي',
  'scanline',
  '180 ر.س',
  'راضٍ جدًا',
  'متاح الآن لجميع الفروع',
  'CONFIRMED',
];

export function assertNoForbiddenCopy(html, assert) {
  for (const needle of FORBIDDEN_LIVE_COPY) {
    assert.equal(html.includes(needle), false, `must not ship ${needle}`);
  }
}

export function listFixtureJson(dir) {
  return readdirSync(join(FIX, dir)).filter((n) => n.endsWith('.json'));
}
