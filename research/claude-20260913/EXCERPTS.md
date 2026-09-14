# Sanitized excerpts — per requirement of issue #4

Every table below is `verified public observation` (2026-09-13) unless a row says otherwise. Nothing is merchant-approved. Prices are in SAR as returned by the storefront API; tax display is `unknown` (see `MISSING-FACTS.md`).

## 1. Branches (E01)

| # | Name as listed | Map link present | Branch id |
|---|---|---|---|
| 1 | فرع الروضة | yes | `3a1ca9a9-bd6c-aed1-6596-5521e64d1179` |
| 2 | فرع روشن Zone C | yes | `3a1ca9a5-e7ef-54e4-f1c7-73180cef908c` |
| 3 | فرع النرجس (مرسية) | yes | `3a1ca9a9-12bd-36bb-7b56-f4b957522fbe` |
| 4 | النرجس ( نساج تاون ) | yes | `3a2345ca-741e-7f78-0de1-55094159db88` |
| 5 | فرع روشن Zone i | **no** (`addressUrl` null) | `3a215907-6a26-1920-342a-de5862380a70` |

Five **reported** branch records. Confirmed operating locations: `unknown` until the owner confirms. Directory listings seen earlier (Linktree: الشفا، روشن، النرجس، الروضة) do not match this list one-to-one (no الشفا here; two روشن zones and two النرجس sites here) — `not verified` which list is current.

## 2. Team list and branch mapping (E02)

21 records: 20 named barber records (18 distinct names; «مروان» appears three times at three branches) plus the platform's default provider. The list proves what the storefront shows, not who works today or who is skilled at what. Schedule start dates are `schedules[].from` values of the schedule active on 2026-09-13, not employment dates.

| # | Name (as listed) | Branch | Weekly days (current schedule) | Time spans (Riyadh local; an end of 00:00–06:00 means after midnight) | Current schedule from → to | Other schedules on record | Overrides | Flags |
|---|---|---|---|---|---|---|---|---|
| 1 | بلال | فرع روشن Zone C | Mon, Tue, Wed, Thu, Fri, Sat | 12:00–16:00; 13:00–16:00; 16:30–00:00 | 2026-05-29 → 2050-01-01 | — | 0 |  |
| 2 | وسام | فرع روشن Zone i | Sun, Tue, Wed, Thu, Fri, Sat | 12:00–15:00; 13:00–15:00; 15:30–00:00 | 2026-05-29 → 2050-01-01 | — | 0 |  |
| 3 | كريم | فرع روشن Zone C | Sun, Mon, Wed, Thu, Fri, Sat | 12:00–15:00; 13:00–15:00; 15:30–23:45 | 2026-07-20 → 2050-01-01 | — | 0 |  |
| 4 | عمر | فرع روشن Zone i | Sun, Mon, Wed, Thu, Fri, Sat | 12:00–14:00; 15:00–00:00 | 2026-05-29 → 2050-01-01 | — | 0 |  |
| 5 | صلاح | فرع النرجس (مرسية) | Mon, Tue, Wed, Thu, Fri, Sat | 12:00–15:00; 13:00–15:00; 16:00–00:00 | 2026-05-30 → 2050-01-01 | — | 0 |  |
| 6 | فرقان | فرع الروضة | Sun, Mon, Tue, Wed, Thu, Fri, Sat | 03:30–00:00; 09:00–12:00; 15:30–00:00; 15:30–11:00 | 2026-03-24 → 2029-02-26 | 2026-02-17→2026-03-22 (expired) | 5 | 7-day schedule; end-before-start 15:30–11:00 (day Sun) |
| 7 | مبين | فرع الروضة | Sun, Mon, Tue, Wed, Thu, Fri, Sat | 12:00–00:00; 12:30–00:00; 13:30–00:00 | 2026-06-03 → 2050-01-01 | — | 0 | 7-day schedule |
| 8 | مروان | فرع روشن Zone C | Sun, Tue, Wed, Thu, Fri, Sat | 12:00–15:30; 13:00–15:30; 16:00–00:00 | 2026-05-30 → 2050-01-01 | — | 0 |  |
| 9 | محمد | فرع النرجس (مرسية) | Sun, Mon, Tue, Wed, Fri, Sat | 13:00–14:00; 15:00–00:00 | 2026-05-30 → 2050-01-01 | — | 0 |  |
| 10 | اسامه | فرع النرجس (مرسية) | Sun, Mon, Tue, Thu, Fri, Sat | 13:00–15:00; 16:00–00:00 | 2026-05-30 → 2050-01-01 | — | 0 |  |
| 11 | مروان | فرع روشن Zone i | Mon, Tue, Wed, Thu, Fri, Sat | 12:00–15:30; 12:00–16:30; 13:00–16:30; 16:15–00:00; 17:15–00:00 | 2026-05-30 → 2050-01-01 | — | 1 |  |
| 12 | كرم | فرع روشن Zone C | Sun, Mon, Tue, Thu, Fri, Sat | 12:00–14:30; 13:00–14:30; 15:00–00:00 | 2026-05-30 → 2050-01-01 | 2026-05-24→2026-05-30 (expired) | 0 |  |
| 13 | مهدي | فرع النرجس (مرسية) | Sun, Mon, Tue, Wed, Thu, Sat | 13:30–16:00; 17:00–01:00 | 2026-06-19 → 2050-01-01 | — | 0 |  |
| 14 | محمود | فرع النرجس (مرسية) | Sun, Mon, Wed, Thu, Fri, Sat | 13:00–15:00; 16:00–01:00 | 2026-06-28 → 2050-01-01 | — | 0 |  |
| 15 | هادي | فرع النرجس (مرسية) | Sun, Tue, Wed, Thu, Fri, Sat | 13:00–14:00; 15:00–01:00 | 2026-07-15 → 2050-01-01 | — | 0 |  |
| 16 | عبدالرحمن | النرجس ( نساج تاون ) | Sun, Mon, Wed, Thu, Fri, Sat | 12:00–15:30; 13:00–15:30; 16:15–00:00; 16:15–01:00 | 2026-08-01 → 2050-01-01 | — | 0 |  |
| 17 | علي | النرجس ( نساج تاون ) | Sun, Tue, Wed, Thu, Fri, Sat | 12:00–15:00; 13:00–15:00; 15:45–00:00; 15:45–01:00 | 2026-08-04 → 2050-01-01 | — | 0 |  |
| 18 | سعيد | النرجس ( نساج تاون ) | Sun, Mon, Tue, Thu, Fri, Sat | 12:00–14:30; 13:00–14:30; 15:00–13:00; 15:00–23:45 | 2026-08-12 → 2050-01-01 | — | 0 | end-before-start 15:00–13:00 (day Fri) |
| 19 | مقريني | فرع روشن Zone i | Sun, Mon, Tue, Thu, Fri, Sat | 12:00–16:30; 17:15–23:45 | 2026-09-04 → 2050-01-01 | — | 0 |  |
| 20 | مروان | فرع النرجس (مرسية) | Sun, Tue, Wed, Thu, Fri, Sat | 13:00–14:30; 15:15–00:00 | 2026-09-08 → 2050-01-01 | — | 0 |  |
| 21 | مزود الخدمة الافتراضي | — | Sun, Mon, Tue, Wed, Thu, Fri, Sat | 00:00–01:00; 12:00–23:59; 14:00–23:59 | 2025-09-28 → 2125-09-29 | — | 0 | 7-day schedule; no branch (system default provider) |

Observations (public observation of the data, flagged for the owner, not conclusions):
- Method: days, spans and flags come from the schedule active on 2026-09-13 only (a record can carry an expired or future schedule; merging them would invent days). Two records (فرقان, مبين — both الروضة) have a seven-day current schedule; two rows have an end time before the start time on the same day (فرقان Sun 15:30–11:00, سعيد Fri 15:00–13:00). Any prose about hours must be sanitized against these rows.
- Newest schedule starts: علي (2026-08-04), سعيد (2026-08-12), مقريني (2026-09-04), the third «مروان» (2026-09-08).
- Team size by branch: النرجس (مرسية) 7 · روشن Zone C 4 · روشن Zone i 4 · النرجس (نساج تاون) 3 · الروضة 2.
- Every reservation item has `enableCustomerToChooseProvider: true`; no public field maps a barber to a service.

## 3. Services, per-branch prices, durations (E03)

All reservation items are 35 min (haircut/beard) or 45 min (everything else). The haircut item exists as three branch-tier variants, each with four named price rows:

| Price row (as named) | روشن Zone C / Zone i | الروضة | النرجس (مرسية) / النرجس (نساج تاون) |
|---|---|---|---|
| قص الشعر | 30 | 25 | 30 |
| تهذيب اللحية | 30 | 25 | 20 |
| حلاقة الشعر و الدقن (combo) | 60 | 50 | 50 |
| حلاقة الشعر و الدقن مع عناية الوجه | 129 | 94 | 75 |

Add-ons on the haircut item (optional, `isRequired: false`):

| Add-on label | روشن | الروضة | النرجس |
|---|---|---|---|
| غسيل شعر | 10 | 10 | 10 |
| تسريحة شعر (استشوار) | 20 | 10 | 15 |
| صبغة اللحية و الشارب (أسود) | 39 | 30 | 25 |
| صبغة شعر (أسود) | 69 | 30 | 45 |
| إزالة الشعر بالشمع | 49 | 30 | 30 |
| جلسة شعر اكسبرس | 79 | 25 | 49 |
| جلسة تنظيف وجه اكسبرس | 69 | 25 | 49 |

Other reservation items:

| Item (ar / en) | Duration | روشن (C, i) | الروضة | النرجس (both) | No branch ids listed |
|---|---|---|---|---|---|
| جلسة شعر اكسبرس / Hair Treatment Express | 45 | 79 | 25 | 49 | — |
| جلسة تنظيف وجه اكسبرس / Fresh Face Express | 45 | 69 | 25 | 49 | a fourth copy at 69 ("(Copy)" in the English name, giftable) |
| جلسة تنظيف وجه بلس / Fresh Face Plus | 45 | 99 | — | 79 | — |
| جلسة شعر بلس (شعر قصير) / Hair Treatment Plus (Short) | 45 | — | — | — | 249 |
| جلسة شعر بلس (شعر طويل) / Hair Treatment Plus (Long) | 45 | — | — | — | 349 (giftable) |
| باي باي قشرة / Dandruff Clear Treatment | 45 | — | — | — | 149 (description says 3 sessions; the item is a single reservation, `hasPackage: false`) |
| جيم الوجه / Face Gym | 45 | — | — | — | 149 (description says 3 sessions) |
| جلسة إخفاء فوري لعيوب وفراغات الشعر (باتشي) / Batci Hair Concealer Service | 45 | — | — | — | 49 |

"No branch ids listed" means the record's `branchIds` is empty; whether that means all branches or none is `unknown`.

Storefront checkout settings that affect what a customer sees (E05/E06): multi-cart allowed (`disableMultiCart: false`), durations shown (`hideDuration: false`), cart minimum 0, deposit not offered, reservation auto-confirmed when the invoice is paid or zero, customer self-cancellation **off** (`allowReservationCancellation: false`, cancellation requires approval), subscription pause **off**. Payment methods flagged on: Mada, credit card, Apple Pay; off: cash on delivery, Tabby, Tamara, bank transfer, KNET. Payment gateway setting: `rekaz-pay` (hosted). Tax: `TaxIsEnabled: True`, `Tax.Percentage: 0.15`; `ShowVat: False` hides the VAT number on the site (it says nothing about price display).

Published booking policy (public marketing text, E06 `Platform.Business.Description`, ar): «في حال عدم الحضور أو التأخر عن الموعد بما يتعذر معه تقديم الخدمة، يعتبر الحجز منتهيًا ولا يمكن استرداد قيمته أو تحويلها إلى رصيد أو إعادة جدولته.» — this ties no-refund/no-credit/no-reschedule to **no-show or arriving too late**; it does not say that an advance change is impossible. Practice: `unknown`.

Charity banner (E06, ar): «كل حلاقة لك في ذا ويكند، ريال يذهب صدقة. كتب الله أجرنا جميعاً». Mechanics: `unknown`.

## 4. Products, labels and the shop's own cosmetic claims (E03)

| Product (ar / en) | Price | Branches | Label / notes |
|---|---|---|---|
| ذا ويكند عود / The Weekend Oud (perfume) | 119 | all 5 | fragrance description only |
| ذا ويك اند بيسك / The Weekend Basic (all-over spray) | 99 | all 5 | — |
| مكثّف فوري لتغطية فراغات الشعر (باتشي 30 مل) / BATCI Hair Concealer 30 ml | 195 | none listed | description pasted from a chat tool (HTML wrapper present in the source) |
| BATCI Hair Concealer 50 ml | 268 | none listed | English name ends "(Copy)" |
| شامبو برو فيتامين B5 (باتشي 500 مل) | 99 | none listed | — |
| Concealer 30 ml + shampoo bundle | 219 | none listed | badge «خصم» |
| Concealer 50 ml + shampoo bundle | 269 | none listed | badge «خصم» |

Every product description ends with «السعر لا يشمل رسوم التوصيل. رسوم التوصيل للطلب كامل هي 30 ريال سعودي.»

Claims that appear in the shop's descriptions (recorded as **the shop's marketing claims**, not as facts, and not as anything Rakan may repeat until the owner and a qualified reviewer approve):
- Concealer: immediate coverage of thin areas lasting "2 to 15 days" depending on scalp and use; 5-minute application; "natural ingredients, approved by the Saudi Food and Drug Authority" (SFDA registration `not verified`); suitable for daily use, all hair types, men and women.
- Concealer service (49): same coverage claim, 5–10 minutes, "hides gaps, grey or uneven density without permanent dye".
- Shampoo: pro-vitamin B5 "strengthens from root to tip"; avocado oil, olive oil, mango butter, cottonseed extract; sulfate-, paraben-, salt- and menthol-free; "reduces dryness and dullness, protects from breakage".
- «باي باي قشرة» (149): a wash "to remove dandruff and deep-clean the scalp" plus an organic sidr mask. **Correction 4 applies:** a service named "bye bye dandruff" and a B5 label are not evidence of a medical benefit; cosmetic concealment is not regrowth.
- «جيم الوجه» (149): "Japanese technology" face-muscle programme from a named device brand; firming/de-puffing claims.
- Hair Treatment Plus: keratin smoothing "for weeks".

No diagnosis-to-product mapping is recorded anywhere in this folder, by design.

## 5. Memberships (E03, E05)

| Item (ar / en) | Price | Period | Visits in package | Branch ids | Giftable | Required field at purchase |
|---|---|---|---|---|---|---|
| عضوية سولو بيسك / Solo Basic (monthly) | 169 | 30 days | 5 | none listed (name says «تشمل جميع فروع ذا ويكند») | yes | «صورة المشترك» (subscriber photo) |
| عضوية سولو فل اوبشن / Solo Full Option (monthly) | 249 | 30 days | 5 | none listed | yes | subscriber photo |
| عضوية سنوية - سولو بيسك / Solo Basic (annual) | 1,995 | 360 days | 60 | all 5 | no | subscriber photo |
| عضوية سنوية - سولو فل أوبشن / Solo Full Option (annual) | 2,499 | 360 days | 60 | none listed | no | subscriber photo |

Descriptions: Basic = «قص شعر احترافي وتهذيب لحية أنيق»; Full Option adds «علاجات أساسية للوجه» (monthly) / «علاجات أساسية للشعر والوجه» (annual short description). What exactly one "visit" covers, whether add-ons are included, whether unused visits roll over, and how renewal works: `unknown`. Pausing is disabled in settings. **Correction 3 applies** to any savings statement (see `CORRECTIONS.md`).

## 6. Official customer booking URLs (E08, E09)

- Site: `https://theweekendhairstyling.com/` (setting `Platform.PublicDomain` matches).
- Booking page: `https://theweekendhairstyling.com/book` (also `/book-options`). The route declares **no** search-parameter validation → service, barber and time cannot be pre-filled by URL. Booking creation in the bundle requires a 4-digit OTP to the customer's mobile and a Turnstile captcha; cart → hosted payment.
- Branch preselection: the root handles `?branchId=<branch id>` by writing a 30-day `SelectedBranchId` cookie and redirecting to the clean URL. With no selection the booking page shows «لا توجد خدمات متاحة للحجز حالياً» (client-side; the shop is not closed). `docs/09` §3 row "Live bookable SKU list" is explained by this.
- Product pages: `https://theweekendhairstyling.com/products/<product id>`; memberships: `https://theweekendhairstyling.com/memberships/<product id>` (checkout validates only `priceId`); packages and gifts have their own routes. Product ids are in `catalogue.sanitized.json`.
- No guessed checkout parameters are used anywhere in this folder. An outbound click is `EXTERNAL_HANDOFF`, never a confirmation.

## 7. Reviews: count, duplicates, status, method (E10)

| Fact | Value | Method |
|---|---|---|
| Publicly listed reviews | 1,034 | `totalCount` on every page; 21 pages × 50 + 34; ids unique |
| Rating distribution | 1,034 × 5 stars; 0 of any other rating | `ratingBreakdown` and per-item `rating` agree |
| Displayed average | 5 | `averageRating` |
| With written text | 361 | non-empty `description` after trim |
| Distinct texts | 319 | exact-string set; most repeated text is a one-word «ممتاز» (15×) |
| Admin replies | 0 | `adminReply` null on all 1,034 |
| Date range | 2026-01-12 → 2026-09-13 | `creationTime` |
| Public/private | only the public list is visible | nothing can be said about unpublished reviews |

Barber-name mentions in the 361 written reviews (count of **reviews containing the name**, Arabic spelling bounded by non-Arabic characters, no Latin spellings, no kunya expansion). These counts measure how often a name is written in a public review; they do **not** measure skill or demand (`CORRECTIONS.md` #1):

| Name | Reviews | Note |
|---|---|---|
| مهدي | 21 | مرسية |
| وسام | 19 | Zone i |
| صلاح | 16 | مرسية |
| مروان | 16 | three records at three branches — cannot be attributed |
| محمد | 12 | مرسية; also a common given name in other contexts |
| كريم | 9 | Zone C |
| محمود | 9 | مرسية |
| بلال | 8 | Zone C |
| عمر | 8 | Zone i |
| أسامة (spellings اسامه 5 · اسامة 2 · أسامه 1 · أسامة 0) | 8 | مرسية |
| علي | 6 | نساج تاون; **an earlier collaborator figure of 24 was an artefact** of normalising «على»→«علي» (auditor v2: 3 direct + 2 «أبو علي» + 1 other) |
| هادي | 4 | مرسية |
| مبين, عبدالرحمن | 1 each | |
| كرم, فرقان, سعيد, مقريني | 0 | «كرم» is also an ordinary word and was not counted |

Adding Latin spellings raises some counts by 1–5 (collaborator-reported by the v2 auditor: مهدي 23, وسام up to 24, صلاح 17, محمد 15, كريم 10, أسامة 9, عمر 10). Ranking is stable except علي.

Theme counts (reviews containing the pattern; `hypothesis`-level signal only): «ممتاز» 78 · «احتراف/محترف» 41 · «أفضل» 34 · «أخلاق/خلوق» 29 · «نظيف/نظافة» 14 · «سعر/أسعار/غالي» 4 · waiting/delay words 2. "Waiting is the only complaint" and "customers follow barbers" remain **hypotheses** (`CORRECTIONS.md` #1).

Timing (collaborator-reported by the v2 auditor from the same data): 287 reviews in August (24 on 28 Aug, 23 on 29 Aug, 4 on 30 Aug, 0 on 31 Aug), 11 in September through the 13th. Hypothesis: a review-request mechanism changed around 30 August. Ask, do not assert.

## 8. `autoApprovalMinRating` — exact context (E05)

Settings returned by `setting-manager/website-options`: `allowCustomerRating: true`, `autoApprovalMinRating: 5`, `showProviderTeam: true`, `showMapLocation: true`. Reading: ratings of 5 are published automatically; ratings below 5 are held for moderation. **Correction 2 applies:** this setting alone cannot establish that no lower ratings were ever manually approved, that nobody replied, or that the displayed score is fake. What is observable: the public list contains 1,034 five-star reviews, 0 others, and 0 admin replies. Record without accusation.

## 9. Slot format and read capability (E07 — one call, made by the auditor)

Request shape: `reservation-v2/availabilities` with `StartDate`, `EndDate`, `PriceId` (a price row id from E03), `MinQuantity`, `ProvidersIds` (a provider id from E02). Response shape:

```json
{ "isLocationApplicable": true,
  "slots": [ { "from": "2026-09-14T09:00:00Z", "to": "2026-09-14T09:35:00Z",
               "isAvailable": true, "isOutDated": false,
               "availableReservationsCount": 1, "availableProvidersCount": 1,
               "availableProviderIds": ["<provider id>"], "availableResourceIds": [],
               "amounts": { "totalPrice": 30, "effectiveQuantity": 1, "totalAfterDiscount": 30,
                            "depositAmount": null, "basePrice": 0, "priceWithTax": 0 },
               "maxConnectedTo": "2026-09-14T09:50:00Z",
               "allProvidersAvailability": {}, "allResourcesAvailability": {} } ] }
```

Observed: 153 slots over 4 days (14–17 Sept 2026), every slot 35 minutes on a 15-minute grid, all `isAvailable: true` for the requested provider. This shows the format and that reads are anonymous. It is **not** evidence that Rakan may create bookings, and it is not used by M1 (external booking integration is deferred, issue #10).
