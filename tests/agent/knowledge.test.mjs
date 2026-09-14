import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPack, BRANCH_ID, STOREFRONT_BRANCH_ID } from '../../knowledge/build.mjs';
import { validateContract } from '../../src/contracts/validate.mjs';
import { loadKnowledge, DEFAULT_KNOWLEDGE_PATH } from '../../src/agent/adapter.mjs';

const pack = buildPack();

test('the committed pack equals a fresh deterministic build', () => {
  const committed = JSON.parse(readFileSync(DEFAULT_KNOWLEDGE_PATH, 'utf8'));
  assert.deepEqual(committed, pack);
});

test('every record validates and enabled records carry an allowed status', () => {
  for (const r of pack.records) {
    const v = validateContract('KnowledgeRecord', r);
    assert.ok(v.ok, `${r.knowledge_id}: ${JSON.stringify(v.errors ?? v)}`);
    if (r.enabled) assert.ok(['merchant_approved', 'verified_public'].includes(r.status));
    assert.equal(r.branch_id, BRANCH_ID);
  }
  assert.equal(new Set(pack.records.map((r) => r.knowledge_id)).size, pack.records.length);
});

test('the branch pack carries the owner decisions of 2026-09-14', () => {
  const byId = new Map(pack.records.map((r) => [r.knowledge_id, r]));
  assert.equal(pack.storefront_branch_id, STOREFRONT_BRANCH_ID);
  assert.match(byId.get('kno_mrs_vat').text_ar, /شاملة ضريبة القيمة المضافة/);
  assert.match(byId.get('kno_mrs_booking_url').text_ar, /theweekendhairstyling\.com\/book\?branchId=/);
  assert.equal(pack.records.filter((r) => r.kind === 'staff' && r.ref !== 'team').length, 7);
  assert.match(byId.get('kno_mrs_staff_list').text_ar, /صلاح/);
  assert.match(byId.get('kno_mrs_price_haircut').text_ar, /30 ريال/);
  assert.match(byId.get('kno_mrs_price_haircut_beard_combo').text_ar, /50 ريال/);
  const basic = pack.records.find((r) => r.knowledge_id.startsWith('kno_mrs_membership_solo_basic_membership_169'));
  assert.match(basic.text_ar, /حلاقة شعر \+ تهذيب لحية/);
  assert.match(basic.text_ar, /تنتهي مع نهاية الشهر/);
  assert.match(byId.get('kno_mrs_policy_changes').text_ar, /ما يوعد بتغيير/);
});

test('nothing forbidden is in the pack: no ratings, review counts, stock, phone numbers, iCal', () => {
  const text = JSON.stringify(pack);
  assert.doesNotMatch(text, /تقييم|نجوم|مراجع(ة|ات)|reviews?|rating/i);
  assert.doesNotMatch(text, /متوفر (الآن|حالياً|حاليا) بالمخزون|نفد|out of stock|in stock|available now/i);
  assert.doesNotMatch(text, /(\+?966|05)\d{8}/);
  assert.doesNotMatch(text, /ical|\.ics/i);
  assert.doesNotMatch(text, /يعالج|علاج نهائي|يشفي|cure|regrow/i);
});

test('loadKnowledge exposes only enabled records', () => {
  const k = loadKnowledge();
  assert.equal(k.enabled.length, pack.records.filter((r) => r.enabled).length);
  assert.ok(k.byId.has('kno_mrs_booking_url'));
});
