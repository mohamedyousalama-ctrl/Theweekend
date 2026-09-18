import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const casesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cases.json');
const { cases } = JSON.parse(readFileSync(casesPath, 'utf8'));
const eid = cases.find((c) => c.id === 'eid_rush');

function check(text, c) {
  const fails = [];
  for (const re of c.must || []) if (!new RegExp(re, 'u').test(text)) fails.push(`must: /${re}/`);
  for (const re of c.must_not || []) if (new RegExp(re, 'u').test(text)) fails.push(`must_not: /${re}/`);
  return fails;
}

test('eid_rush must_not catches inflected availability claims and allows the honest booking-page denial', () => {
  assert.ok(eid, 'eid_rush case is present');
  const claims = [
    'فيه مواعيد فاضية بكرة',
    'الوقت متاح',
    'الحلاق متاح قبل العيد',
    'فيه موعد فاضي',
    'متاح لك موعد',
    'فاضي لك وقت بكرة',
  ];
  for (const sentence of claims) {
    const fails = check(sentence, eid);
    assert.ok(
      fails.some((f) => f.startsWith('must_not:')),
      `${sentence} must be caught by must_not (got: ${fails.join('; ') || 'no fails'})`,
    );
  }
  const honest = 'ما عندي الأوقات الفاضية / المتاحة، تشوفها في صفحة الحجز';
  assert.deepEqual(check(honest, eid), [], 'honest denial of empty/available times on the booking page must pass');
});
