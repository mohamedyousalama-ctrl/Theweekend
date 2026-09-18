/**
 * Builds the Rakan knowledge pack for the M1 branch (النرجس مرسية) from the sanitized evidence
 * in research/claude-20260913/ and the owner's recorded answers. Deterministic; no network.
 *
 *   node knowledge/build.mjs            → writes knowledge/marsiya.v1.json
 *
 * Every record follows src/contracts/knowledge-record.schema.json. Status rules (docs/18 §4.1):
 *   merchant_approved  → covered by an owner decision (OWNER-ANSWERS-2026-09-14.md, D2–D7)
 *   verified_public    → read from the storefront on 2026-09-13, not confirmed by the owner
 * Only enabled records may be used in customer answers. Nothing here is a rating, a stock claim
 * or an availability claim.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const RESEARCH = path.join(ROOT, 'research', 'claude-20260913');

export const PACK_VERSION = 'marsiya.v1';
export const BRANCH_ID = 'br_marsiya';
export const STOREFRONT_BRANCH_ID = '3a1ca9a9-12bd-36bb-7b56-f4b957522fbe';
export const OFFICIAL_BOOKING_URL = 'https://theweekendhairstyling.com/book';
export const VALID_FROM = '2026-09-14T00:00:00Z';

// SHA-256 of the raw storefront responses, as recorded in research/claude-20260913/EVIDENCE-INDEX.md
const EVIDENCE = {
  E01: '2808cfeb06673b2e316ea7cf3bcdb1d1e688c040f78598848783465c1684ffbd', // branch/public-branches
  E02: '2449a6aef67d6623ffdd940b5be68e5a049a259c27ce408d716be411a7e49cea', // provider/read-only-list
  E03: '5756f21a0c6fe023bb566ad6b7a16acef85794160f97372f82663d5016701adf', // product/product-list-v2
  E05: '8d5e32c50444d50f6076b601f5afca47be8c23c1f7bd91b1dc74d769f2c43bcb', // setting-manager/website-options
  E06: '4926a9f924145cd54382bb73bce84916b4a5f723a112e440cb1d051e3ac06bea', // setting-manager/onboarding
};

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

const ADDON_KEYS = {
  'غسيل شعر': 'wash',
  'تسريحة شعر (استشوار)': 'blowdry',
  'صبغة اللحية و الشارب (أسود)': 'beard_dye_black',
  'صبغة شعر (أسود)': 'hair_dye_black',
  'إزالة الشعر بالشمع': 'wax',
  'جلسة شعر اكسبرس': 'hair_express',
  'جلسة تنظيف وجه اكسبرس': 'face_express',
};

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

function clip(text, max = 500) {
  const t = String(text).replace(/\s+/g, ' ').replace(/\s+([،,.:؛])/g, '$1').trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max - 1);
  const cut = Math.max(head.lastIndexOf('. '), head.lastIndexOf('؟ '), head.lastIndexOf('! '), head.lastIndexOf(' '));
  return `${head.slice(0, cut > 40 ? cut : head.length).trim()}…`;
}

/** One short descriptive sentence from a storefront description, never a paragraph (persona review M10). */
function firstSentence(text, max = 220) {
  const t = String(text || '').replace(/\s+/g, ' ').replace(/^[-•"“”«»\s]+/, '').replace(/["“”]/g, '').replace(/^استمتع ب/u, '').trim();
  const m = t.match(/^(.{20,}?[.!؟])(\s|$)/u);
  const s = m ? m[1] : t;
  return clip(s, max);
}

/**
 * Website wording is allowed (owner D7) but never as a treatment claim (persona: no condition names, no
 * "removes", "strengthens roots", "regrows"): a first sentence that makes such a claim is replaced by `fallback`.
 */
const CLAIM_RE = /قشرة|تساقط|يعالج|علاج|يزيل|إزالة|يقوي|يقوّي|تقوية|يغذي|مغذ|تعزز|يعزز|حيوي|مرونة|جذور|الصلع|حب الشباب|إكزيما|التهاب|فطر|ينبت|نمو الشعر|dandruff|treat|cure|regrow|nourish|strengthen|roots|hair loss/iu;
function safeSentence(text, fallback) {
  const sentence = firstSentence(text);
  return CLAIM_RE.test(sentence) ? fallback : sentence;
}

function displayName(name) {
  return String(name).replace(/^اسامه$/u, 'أسامة').replace(/ و /g, ' و').trim();
}

export function buildPack() {
  const catalogue = JSON.parse(readFileSync(path.join(RESEARCH, 'catalogue.sanitized.json'), 'utf8'));
  const staff = JSON.parse(readFileSync(path.join(RESEARCH, 'staff.sanitized.json'), 'utf8'));
  const ownerAnswers = readFileSync(path.join(RESEARCH, 'OWNER-ANSWERS-2026-09-14.md'), 'utf8');
  const OWNER = { source: 'OWNER-ANSWERS-2026-09-14', hash: sha256(ownerAnswers) };

  const records = [];
  const seen = new Set();
  function add(rec) {
    const full = {
      contract_version: '0.1.0',
      knowledge_id: rec.knowledge_id,
      kind: rec.kind,
      branch_id: rec.branch_id === undefined ? BRANCH_ID : rec.branch_id,
      ref: rec.ref ?? null,
      text_ar: clip(rec.text_ar),
      text_en: clip(rec.text_en),
      source: rec.source,
      source_hash: rec.source_hash,
      status: rec.status,
      enabled: rec.enabled,
      version: 1,
      valid_from: VALID_FROM,
      valid_to: null,
    };
    if (seen.has(full.knowledge_id)) throw new Error(`duplicate knowledge_id ${full.knowledge_id}`);
    seen.add(full.knowledge_id);
    records.push(full);
    return full;
  }

  // 1. Branch
  const branch = catalogue.branches.find((b) => b.id === STOREFRONT_BRANCH_ID);
  if (!branch) throw new Error('branch not found in catalogue');
  add({
    knowledge_id: 'kno_mrs_branch',
    kind: 'branch',
    ref: STOREFRONT_BRANCH_ID,
    text_ar: `الفرع: ${branch.name}. الموقع على الخريطة: ${branch.map_url}`,
    text_en: `Branch: The Weekend – Al Narjis (Marsiya). Map: ${branch.map_url}`,
    source: OWNER.source,
    source_hash: OWNER.hash,
    status: 'merchant_approved',
    enabled: true,
  });

  // 2. Booking URL and handoff rule
  add({
    knowledge_id: 'kno_mrs_booking_url',
    kind: 'faq',
    ref: OFFICIAL_BOOKING_URL,
    text_ar: `الحجز يتم من صفحة الحجز الرسمية: ${OFFICIAL_BOOKING_URL}?branchId=${STOREFRONT_BRANCH_ID} — يختار العميل الخدمة والحلاق والوقت بنفسه، والتأكيد يصير من الموقع بعد الدفع. خالد ما يحجز ولا يغيّر الحجز بنفسه في هذه المرحلة.`,
    text_en: `Booking happens on the official page ${OFFICIAL_BOOKING_URL}?branchId=${STOREFRONT_BRANCH_ID}; the customer picks service, barber and time; confirmation comes from the site after payment. Khalid does not create or change bookings in this phase.`,
    source: OWNER.source,
    source_hash: OWNER.hash,
    status: 'merchant_approved',
    enabled: true,
  });

  // 3. VAT and price display
  add({
    knowledge_id: 'kno_mrs_vat',
    kind: 'policy',
    ref: 'vat',
    text_ar: 'الأسعار المعروضة شاملة ضريبة القيمة المضافة (15٪). لا يُضاف شيء فوق السعر المعروض.',
    text_en: 'Displayed prices include VAT (15%). Nothing is added on top of the displayed price.',
    source: OWNER.source,
    source_hash: OWNER.hash,
    status: 'merchant_approved',
    enabled: true,
  });

  // 4. Published booking policy (as written on the storefront), plus what Rakan may say about changes
  add({
    knowledge_id: 'kno_mrs_policy_noshow',
    kind: 'policy',
    ref: 'booking-policy',
    text_ar: 'سياسة الحجز كما هي منشورة: في حال عدم الحضور أو التأخر عن الموعد بما يتعذر معه تقديم الخدمة، يعتبر الحجز منتهيًا ولا يمكن استرداد قيمته أو تحويلها إلى رصيد أو إعادة جدولته.',
    text_en: 'Published booking policy: if the customer does not show up or arrives too late for the service to be delivered, the booking is considered ended and cannot be refunded, credited or rescheduled.',
    source: 'E06',
    source_hash: EVIDENCE.E06,
    status: 'merchant_approved',
    enabled: true,
  });
  add({
    knowledge_id: 'kno_mrs_policy_changes',
    kind: 'policy',
    ref: 'booking-changes',
    text_ar: 'تغيير الموعد أو إلغاؤه ما يتم عن طريق خالد ولا من صفحة الحجز؛ العميل يتواصل مع الفرع مباشرة. خالد ما يوعد بتغيير أو إلغاء.',
    text_en: 'Changing or cancelling an appointment is not done through Khalid or the booking page; the customer contacts the branch directly. Khalid never promises a change or a cancellation.',
    source: OWNER.source,
    source_hash: OWNER.hash,
    status: 'merchant_approved',
    enabled: true,
  });

  // 5. Charity line (storefront banner)
  add({
    knowledge_id: 'kno_mrs_charity_line',
    kind: 'faq',
    ref: 'banner',
    text_ar: 'كل حلاقة لك في ذا ويكند، ريال يذهب صدقة. كتب الله أجرنا جميعاً.',
    text_en: 'For every haircut at The Weekend, one riyal goes to charity.',
    source: 'E06',
    source_hash: EVIDENCE.E06,
    status: 'verified_public',
    enabled: true,
  });

  // 6. Staff (storefront team list for the branch; owner allowed names)
  const team = staff.records.filter((r) => r.branch_ids.includes(STOREFRONT_BRANCH_ID));
  if (team.length !== 7) throw new Error(`expected 7 staff records for the branch, got ${team.length}`);
  const names = team.map((r) => displayName(r.name));
  add({
    knowledge_id: 'kno_mrs_staff_list',
    kind: 'staff',
    ref: 'team',
    text_ar: `حلاقين فرع النرجس (مرسية) حسب قائمة الموقع: ${names.join('، ')}. العميل يختار حلاقه في صفحة الحجز؛ خالد ما يعرف مواعيد فراغ كل حلاق.`,
    text_en: `Barbers at Al Narjis (Marsiya) per the site's team list: ${names.join(', ')}. The customer chooses the barber on the booking page; Khalid does not know each barber's free times.`,
    source: OWNER.source,
    source_hash: OWNER.hash,
    status: 'merchant_approved',
    enabled: true,
  });
  for (const r of team) {
    add({
      knowledge_id: `kno_mrs_staff_${slug(r.provider_id)}`,
      kind: 'staff',
      ref: r.provider_id,
      text_ar: `${displayName(r.name)} — حلاق في فرع النرجس (مرسية).`,
      text_en: `${displayName(r.name)} — barber at Al Narjis (Marsiya).`,
      source: 'E02',
      source_hash: EVIDENCE.E02,
      status: 'merchant_approved',
      enabled: true,
    });
  }

  // 7. Services and prices for the branch
  const atBranch = (s) => s.branch_ids.includes(STOREFRONT_BRANCH_ID);
  const noBranch = (s) => s.branch_ids.length === 0;
  const services = catalogue.services;
  const haircut = services.find((s) => s.name.ar.includes('حلاقة الشعر') && atBranch(s));
  if (!haircut) throw new Error('haircut item for the branch not found');
  // price rows (from EXCERPTS §3: النرجس tier) — recorded verbatim from the storefront pricing rows
  const HAIRCUT_ROWS = [
    ['قص الشعر', 'Haircut', 30],
    ['تهذيب اللحية', 'Beard trim', 20],
    ['حلاقة الشعر والدقن (النرجس)', 'Haircut + beard combo', 50],
    ['حلاقة الشعر والدقن مع عناية الوجه (النرجس)', 'Haircut + beard + face care', 75],
  ];
  for (const [ar, en, amount] of HAIRCUT_ROWS) {
    add({
      knowledge_id: `kno_mrs_price_${slug(en)}`,
      kind: 'price',
      ref: haircut.id,
      text_ar: `${ar}: ${amount} ريال، المدة 35 دقيقة، السعر شامل الضريبة.`,
      text_en: `${en}: ${amount} SAR, 35 minutes, VAT inclusive.`,
      source: 'E03',
      source_hash: EVIDENCE.E03,
      status: 'merchant_approved',
      enabled: true,
    });
  }
  for (const a of haircut.add_ons) {
    add({
      knowledge_id: `kno_mrs_addon_${ADDON_KEYS[a.label] || sha256(a.label).slice(0, 8)}_${a.amount_sar}`,
      kind: 'addon',
      ref: haircut.id,
      text_ar: `إضافة على الحلاقة — ${displayName(a.label)}: ${a.amount_sar} ريال (اختيارية، شاملة الضريبة).`,
      text_en: `Haircut add-on — ${a.label}: ${a.amount_sar} SAR (optional, VAT inclusive).`,
      source: 'E03',
      source_hash: EVIDENCE.E03,
      status: 'merchant_approved',
      enabled: true,
    });
  }
  // A service whose name itself names a condition (dandruff, hair loss…) is kept in the pack but disabled: offering it by name
  // is a treatment framing the persona forbids; MISSING-FACTS row 18 (owner + qualified reviewer) decides whether Rakan may name it.
  const CONDITION_NAME_RE = /قشرة|dandruff|تساقط|hair ?loss|صلع|bald|حب الشباب|acne|إكزيما|eczema|صدفية|psoriasis/iu;
  for (const s of services.filter((x) => x !== haircut && (atBranch(x) || noBranch(x)) && !(x.name.en || '').includes('(Copy)'))) {
    const where = atBranch(s) ? '' : ' معروضة في الموقع، وما أقدر أأكد إنها متوفرة بفرع مرسية — تبين لك في صفحة الحجز لما تختار الفرع.';
    const whereEn = atBranch(s) ? '' : ' Listed on the site; availability at Marsiya is unconfirmed — the booking page shows it once the branch is selected.';
    const en = s.name.en || s.name.ar;
    const durationNote = /concealer/i.test(en) ? ` (الوقت المحجوز ${s.duration_min} دقيقة؛ التطبيق نفسه دقائق حسب وصف الموقع)` : ` المدة ${s.duration_min} دقيقة`;
    add({
      knowledge_id: `kno_mrs_service_${slug(en)}_${s.amount_sar}`,
      kind: 'service',
      ref: s.id,
      text_ar: `${s.name.ar}: ${s.amount_sar} ريال شامل الضريبة،${durationNote}.${where} ${safeSentence(s.description_text, 'الوصف الكامل على صفحة الخدمة في الموقع؛ خالد يذكر الاسم والسعر والمدة فقط.')}`,
      text_en: `${en}: ${s.amount_sar} SAR, ${s.duration_min} minutes, VAT inclusive.${whereEn}`,
      source: 'E03',
      source_hash: EVIDENCE.E03,
      status: atBranch(s) ? 'merchant_approved' : 'verified_public',
      enabled: !CONDITION_NAME_RE.test(`${s.name.ar} ${en}`),
    });
  }

  // 8. Merchandise with the shop's own wording (owner: "use the website claims"); no stock, delivery not offered
  for (const p of catalogue.merchandise) {
    const en = p.name.en || p.name.ar;
    const duplicate = /\(Copy\)/i.test(en); // the site's duplicate 50 ml row (268 next to the 269 bundle) — kept, disabled
    const desc = p.description_text.replace(/السعر لا يشمل رسوم التوصيل\.?.*$/, '').replace(/الفوائد الرئيسية/g, '').trim();
    // An empty storefront branch list proves nothing about the branch (EXCERPTS §4, MISSING-FACTS): say so instead of "sold at the branch".
    const listedAtBranch = atBranch(p);
    const whereAr = listedAtBranch ? 'يُباع في الفرع' : 'معروض في الموقع، وما أقدر أأكد توفره في فرع مرسية — تتأكد من الموقع';
    const whereEn = listedAtBranch ? '' : ' Listed on the site; availability at Marsiya is unconfirmed.';
    add({
      knowledge_id: `kno_mrs_product_${slug(en)}`,
      kind: 'product',
      ref: p.id,
      text_ar: `${p.name.ar.replace(/\s*\|\s*/g, ' — ')}: ${p.amount_sar} ريال شامل الضريبة. ${safeSentence(desc, 'الوصف الكامل على صفحة المنتج في الموقع.')} (${whereAr}؛ التوصيل ما يُعرض عبر خالد.)`,
      text_en: `${en}: ${p.amount_sar} SAR VAT inclusive.${whereEn} Product page: https://theweekendhairstyling.com/products/${p.id}`,
      source: 'E03',
      source_hash: EVIDENCE.E03,
      status: duplicate ? 'retired' : listedAtBranch ? 'merchant_approved' : 'verified_public',
      enabled: !duplicate,
    });
  }

  // 9. Memberships with the owner's basket definition (D5)
  for (const m of catalogue.memberships) {
    const en = m.name.en || m.name.ar;
    const monthly = m.billing_period_days === 30;
    const basket = en.includes('Full')
      ? 'الزيارة = حلاقة شعر + تهذيب لحية + عناية أساسية بالوجه (تفاصيل عناية الوجه غير مؤكدة، فلا يُحسب توفير لها)'
      : 'الزيارة = حلاقة شعر + تهذيب لحية (خدمة الشعر والدقن بـ50 ريال)';
    add({
      knowledge_id: `kno_mrs_membership_${slug(en)}_${m.amount_sar}`,
      kind: 'membership',
      ref: m.id,
      text_ar: `${m.name.ar.replace(/\s+/g, ' ')}: ${m.amount_sar} ريال شامل الضريبة، ${m.package_total_quantity} زيارات خلال ${m.billing_period_days} يوم. ${basket}. ${monthly ? 'الزيارات غير المستخدمة تنتهي مع نهاية الـ30 يوم؛ ما فيه ترحيل.' : `مدة العضوية ${m.billing_period_days} يوم من التفعيل؛ ترحيل الزيارات غير المستخدمة بعد نهاية المدة غير مؤكد — تتأكد من الفرع.`} تشمل جميع الفروع.${monthly ? '' : ' تُذكر فقط إذا سأل العميل عنها.'} صفحة العضوية: https://theweekendhairstyling.com/memberships/${m.id}`,
      text_en: `${en}: ${m.amount_sar} SAR VAT inclusive, ${m.package_total_quantity} visits per ${m.billing_period_days} days. ${en.includes('Full') ? 'Visit = haircut + beard + basic face care' : 'Visit = haircut + beard'}. ${monthly ? 'Unused visits expire at the end of the 30 days; no rollover.' : `The plan runs ${m.billing_period_days} days from activation. Whether unused visits carry over afterward is unconfirmed — ask the branch.`} All branches.`,
      source: OWNER.source,
      source_hash: OWNER.hash,
      status: 'merchant_approved',
      enabled: true,
    });
  }

  // 9b. Owner-approved arithmetic (D5 + the persona's membership rule) as records, so every total Rakan states is citable
  const monthlyBasic = catalogue.memberships.find((m) => m.billing_period_days === 30 && !/Full/i.test(m.name.en || ''));
  const annualBasic = catalogue.memberships.find((m) => m.billing_period_days !== 30 && !/Full/i.test(m.name.en || ''));
  if (!monthlyBasic || !annualBasic) throw new Error('Solo Basic memberships not found');
  add({
    knowledge_id: 'kno_mrs_membership_compare_monthly_basic',
    kind: 'membership',
    ref: monthlyBasic.id,
    text_ar: `مقارنة اشتراك سولو بيسك الشهري (${monthlyBasic.amount_sar} ريال، ${monthlyBasic.package_total_quantity} زيارات) مع الدفع كل زيارة (حلاقة الشعر والدقن 50 ريال): زيارتان = 100 ريال، 3 زيارات = 150 ريال، 4 زيارات = 200 ريال، 5 زيارات = 250 ريال. الاشتراك أوفر عند 4 زيارات أو 5 زيارات في الشهر؛ عند 3 زيارات أو أقل الدفع كل مرة أرخص. ما فيه مقارنة لعضوية فل أوبشن لأن سلة عناية الوجه غير مؤكدة.`,
    text_en: `Solo Basic monthly (${monthlyBasic.amount_sar} SAR, ${monthlyBasic.package_total_quantity} visits) versus paying per visit (haircut + beard 50 SAR): 2 visits = 100 SAR, 3 visits = 150 SAR, 4 visits = 200 SAR, 5 visits = 250 SAR. The membership pays off at 4 visits or 5 visits a month; at 3 visits or fewer, paying per visit is cheaper. No comparison for Full Option (face-care basket unconfirmed).`,
    source: OWNER.source,
    source_hash: OWNER.hash,
    status: 'merchant_approved',
    enabled: true,
  });
  add({
    knowledge_id: 'kno_mrs_membership_compare_annual_basic',
    kind: 'membership',
    ref: annualBasic.id,
    text_ar: `حسبة تقريبية من أسعار الموقع: الاشتراك السنوي سولو بيسك (${annualBasic.amount_sar} ريال، ${annualBasic.package_total_quantity} زيارة خلال ${annualBasic.billing_period_days} يوم) يعادل تقريباً 40 زيارة بسعر 50 ريال (${annualBasic.amount_sar} ÷ 50 ≈ 40)؛ يبدأ يوفر بعد نحو 40 زيارة في السنة، وما يُحسب أبداً كـ${annualBasic.package_total_quantity} × 50. يُذكر فقط إذا سأل العميل عن السنوية.`,
    text_en: `Approximate arithmetic from the storefront prices: Solo Basic annual (${annualBasic.amount_sar} SAR, ${annualBasic.package_total_quantity} visits per ${annualBasic.billing_period_days} days) equals about 40 visits at 50 SAR (${annualBasic.amount_sar} ÷ 50 ≈ 40); it pays off after about 40 visits in the year and is never computed as ${annualBasic.package_total_quantity} × 50. Mentioned only when the customer asks about annual plans.`,
    // Storefront figures (E03) plus arithmetic; the owner's worked example (OWNER-ANSWERS row 4) covers the monthly plan only,
    // so this is verified_public (its text says «تقريبية») until the owner confirms the annual wording.
    source: 'E03',
    source_hash: EVIDENCE.E03,
    status: 'verified_public',
    enabled: true,
  });

  // 10. Not-known facts (explicit, so the prompt can say them honestly)
  add({
    knowledge_id: 'kno_mrs_unknown_availability',
    kind: 'faq',
    ref: 'unknown',
    text_ar: 'خالد ما يعرف: الأوقات الفاضية، مدة الانتظار، ساعات الدوام، المواقف، الدخول بدون موعد، حلاقة الأطفال وأسعارها، بطاقات الهدايا، توفر المنتجات. يقول «ما عندي هذي المعلومة» ويوجّه لصفحة الحجز أو رابط الخريطة، وما يستنتجها من أي شي.',
    text_en: 'Khalid does not know: free slots, waiting time, opening hours, parking, walk-ins, children haircuts and their prices, gift cards, product stock. It says so and points to the booking page or the map link; it never derives them.',
    source: OWNER.source,
    source_hash: OWNER.hash,
    status: 'merchant_approved',
    enabled: true,
  });

  return {
    pack_version: PACK_VERSION,
    pack_revision: 3,
    branch_id: BRANCH_ID,
    storefront_branch_id: STOREFRONT_BRANCH_ID,
    built_from: ['research/claude-20260913/catalogue.sanitized.json', 'research/claude-20260913/staff.sanitized.json', 'research/claude-20260913/OWNER-ANSWERS-2026-09-14.md'],
    records,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pack = buildPack();
  const out = path.join(HERE, `${PACK_VERSION}.json`);
  writeFileSync(out, `${JSON.stringify(pack, null, 2)}\n`);
  process.stdout.write(`wrote ${out} (${pack.records.length} records)\n`);
}
