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
  assert.match(basic.text_ar, /تنتهي مع نهاية الـ30 يوم/);
  const copy = pack.records.find((r) => r.knowledge_id.endsWith('_copy'));
  assert.equal(copy.enabled, false, 'the storefront duplicate product row stays disabled');
  assert.match(byId.get('kno_mrs_staff_list').text_ar, /أسامة/);
  for (const r of pack.records) assert.ok(!/…$/.test(r.text_ar) || r.text_ar.length >= 200, `${r.knowledge_id} clipped too early`);
  assert.ok(pack.records.every((r) => !/^.{0,60}"[^"]*$/.test(r.text_ar) || !r.text_ar.includes('"')), 'no orphan quotes');
  assert.match(byId.get('kno_mrs_policy_changes').text_ar, /ما يوعد بتغيير/);
});

test('post-merge review: product availability, treatment claims, annual expiry and citable arithmetic', () => {
  const byId = new Map(pack.records.map((r) => [r.knowledge_id, r]));
  assert.equal(pack.pack_revision, 3);
  assert.equal(pack.records.length, 47);
  const perfume = byId.get('kno_mrs_product_the_weekend_oud_perfume');
  assert.match(perfume.text_ar, /يُباع في الفرع/, 'a product the storefront lists for the branch');
  assert.equal(perfume.status, 'merchant_approved');
  for (const id of ['kno_mrs_product_batci_hair_concealer_30_ml', 'kno_mrs_product_batci_pro_vitamin_b5_shampoo_500_ml']) {
    const r = byId.get(id);
    assert.doesNotMatch(r.text_ar, /يُباع في الفرع/, `${id}: no branch claim without a branch in the source`);
    assert.match(r.text_ar, /ما أقدر أأكد توفره في فرع مرسية/);
    assert.match(r.text_en, /unconfirmed/);
    assert.equal(r.status, 'verified_public');
  }
  const dandruff = pack.records.find((r) => r.knowledge_id.startsWith('kno_mrs_service_dandruff'));
  assert.equal(dandruff.enabled, false, 'a service whose name names a condition waits for the owner');
  for (const r of pack.records.filter((x) => x.enabled)) {
    assert.doesNotMatch(`${r.text_ar}\n${r.text_en}`, /قشرة|dandruff|تساقط|hair ?loss|صلع|bald|حب الشباب|acne|إكزيما|eczema|صدفية|psoriasis/iu, `${r.knowledge_id} names a condition`);
  }
  assert.match(dandruff.text_en, /availability at Marsiya is unconfirmed/);
  assert.doesNotMatch(dandruff.text_en, /is confirmed/);
  assert.doesNotMatch(dandruff.text_ar, /إزالة القشرة|يقوي جذوره|تنظيف فروة/);
  assert.match(dandruff.text_ar, /باي باي قشرة: 149 ريال شامل الضريبة، المدة 45 دقيقة/);
  assert.doesNotMatch(byId.get('kno_mrs_product_batci_pro_vitamin_b5_shampoo_500_ml').text_ar, /يقوّيه من الجذور/);
  for (const r of pack.records.filter((x) => x.enabled && (x.kind === 'product' || x.kind === 'service'))) {
    assert.doesNotMatch(r.text_ar, /مغذ|تعزز|يعزز|يقوي|يقوّي|يغذي|جذور|إزالة القشرة|يعالج/, `${r.knowledge_id} still carries a nourish/strengthen/treatment claim`);
  }
  for (const r of pack.records.filter((x) => x.kind === 'membership' && x.text_ar.includes('360 يوم') && !x.knowledge_id.includes('compare'))) {
    assert.match(r.text_ar, /مدة العضوية 360 يوم من التفعيل؛ ترحيل الزيارات غير المستخدمة بعد نهاية المدة غير مؤكد/, r.knowledge_id);
    assert.doesNotMatch(r.text_ar, /نهاية السنة|تنتهي مع نهاية فترة العضوية/);
    assert.match(r.text_en, /unconfirmed — ask the branch/);
  }
  const monthly = byId.get('kno_mrs_membership_compare_monthly_basic');
  assert.match(monthly.text_ar, /4 زيارات = 200 ريال، 5 زيارات = 250 ريال/);
  assert.match(monthly.text_ar, /3 زيارات = 150 ريال/);
  assert.equal(monthly.status, 'merchant_approved');
  const annual = byId.get('kno_mrs_membership_compare_annual_basic');
  assert.match(annual.text_ar, /40 زيارة/);
  assert.match(annual.text_ar, /1995 ÷ 50/);
  assert.doesNotMatch(annual.text_ar, /3000/);
  assert.equal(annual.status, 'verified_public', 'annual break-even waits for the owner; the text says تقريبية');
  assert.match(annual.text_ar, /^حسبة تقريبية من أسعار الموقع/);
  assert.equal(annual.source, 'E03', 'storefront figures, not the owner answers');
  assert.doesNotMatch(annual.text_ar, /تنتهي/);
  assert.equal(monthly.source, 'OWNER-ANSWERS-2026-09-14');
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
