# Evidence index — The Weekend public sources, 2026-09-13

All calls were anonymous `GET` requests against the shop's own storefront platform (Rekaz) exactly as the public website issues them, plus the public website itself. No login, no API key, no access-control bypass, no write. Requests to `platform.rekaz.io/api/app/...` carry the storefront's `__tenant` header; its value is embedded in the public site bundle (E09) and is not reproduced here (`grep -o '__tenant[^,]*' main.js` on a fresh download of the bundle shows it).

Classification key: **anonymous read-only** = returns without credentials to any client; **public page** = HTML served to any visitor.

## 1. Endpoints and hashes

| ID | Endpoint / URL | Classification | Retrieved (UTC) | SHA-256 of saved raw response | Items | Completeness |
|---|---|---|---|---|---|---|
| E01 | `https://platform.rekaz.io/api/app/branch/public-branches` | GET, anonymous, `__tenant` header | 2026-09-13T18:04:10Z | `2808cfeb06673b2e316ea7cf3bcdb1d1e688c040f78598848783465c1684ffbd` | 5 objects | complete (single response, no paging) |
| E02 | `https://platform.rekaz.io/api/app/provider/read-only-list` | GET, anonymous, `__tenant` header | 2026-09-13T20:01:37Z | `2449a6aef67d6623ffdd940b5be68e5a049a259c27ce408d716be411a7e49cea` | 21 objects | complete; identical bytes on two retrievals (18:04 and 20:01 UTC) |
| E03 | `https://platform.rekaz.io/api/app/product/product-list-v2` | GET, anonymous, `__tenant` header | 2026-09-13T19:57:11Z | `5756f21a0c6fe023bb566ad6b7a16acef85794160f97372f82663d5016701adf` | 28 objects | complete as returned; 217,868 bytes; NOT committed raw (privacy/scope inspection below) |
| E04 | `https://platform.rekaz.io/api/app/product-category/website-list` | GET, anonymous, `__tenant` header | 2026-09-13T19:57:11Z | `fab75e8875dd3a10091449ea9af8a39f89f8cead0af9589d995739ad3e326e31` | 4 objects | complete |
| E05 | `https://platform.rekaz.io/api/app/setting-manager/website-options` | GET, anonymous, `__tenant` header | 2026-09-13T19:57:12Z | `8d5e32c50444d50f6076b601f5afca47be8c23c1f7bd91b1dc74d769f2c43bcb` | 1 object | complete |
| E06 | `https://platform.rekaz.io/api/app/setting-manager/onboarding` | GET, anonymous, `__tenant` header | 2026-09-13T19:57:13Z | `4926a9f924145cd54382bb73bce84916b4a5f723a112e440cb1d051e3ac06bea` | 1 object (currentTenant + 82 settings) | complete; contains a payment publishable key, a VAT registration number, contact channels and a pixel id → values NOT reproduced |
| E07 | `https://platform.rekaz.io/api/app/reservation-v2/availabilities?StartDate&EndDate&PriceId&MinQuantity&ProvidersIds` | GET, anonymous, `__tenant` header (one call, made by the auditor agent) | 2026-09-13T20:11:53Z | `6c772d530266e9aac98a50ab9fc43adb1841aff9708aa9bbb17bf560a545a0ec` | 153 slot objects | one date window, one price id, one provider; response shape only is reproduced |
| E08 | `https://theweekendhairstyling.com/` | GET, public page | 2026-09-13T18:02:55Z | `b67518156cce32023efbef878ec20e83d2b4452a171b2cfb6d1d41914682ad10` | HTML | complete |
| E09 | `https://theweekendhairstyling.com/<hashed asset path>` | GET, public site bundle (Rekaz storefront) | 2026-09-13T18:03:20Z | `032bc4e91258c06d2d32b843bc5216d6e58b803ea930b23fe18a696c4a4e07c6` | 681,401 bytes | complete; used only to read routes/params |
| E10 | `https://platform.rekaz.io/api/app/customer-review/public-reviews-list?SkipCount=<n>&MaxResultCount=50` | GET, anonymous, `__tenant` header; 22 page calls (SkipCount 0…1050) | 2026-09-13T18:04:27Z → 2026-09-13T18:04:36Z | see per-page table below | 1,034 review objects across 21 non-empty pages; page 22 empty | complete: `totalCount` = 1034 = objects retrieved; ids unique |
| E11 | `https://platform.rekaz.io/api/app/customer-review/public-reviews-list` (first probe, MaxResultCount=10) | GET, anonymous | 2026-09-13T18:03:46Z | `c90f1690c5c26ecc728699cf9009a25fa31dbae5f270b060f51a99c87f0e7867` | 10 objects | superseded by E10 |

### Review pages (E10)

Paging uses the platform's standard `SkipCount` / `MaxResultCount` parameters (the site bundle contains `MaxResultCount`). `totalCount` was 1034 on every page; page SkipCount=1050 returned 0 items, so the sample is the complete public list at retrieval time.

| Page (SkipCount) | Retrieved (UTC) | SHA-256 | Items |
|---|---|---|---|
| 0 | 2026-09-13T18:04:27Z | `17166515034027973cfa5448a71cec1a921c0c73d531ffceb2d208b6e3aae953` | 50 |
| 50 | 2026-09-13T18:04:27Z | `3c1869ea15f75b9e720e2683e34a18b545ee9b745e6608a29f67e5de2fc64929` | 50 |
| 100 | 2026-09-13T18:04:28Z | `8e3bbbead33204440446f582722a3d2d6fef4b8cdde2410119e79699c64972af` | 50 |
| 150 | 2026-09-13T18:04:28Z | `73862a3e064c635d32bccb5d05110be18c0b02556190ab54fb610bc563359bcf` | 50 |
| 200 | 2026-09-13T18:04:28Z | `9db73dcbb7ff98f499bf56699908a335e5a5e0ff07e72a5c0bcfced4e22da1bb` | 50 |
| 250 | 2026-09-13T18:04:29Z | `712b52e9ed87e5835221aa3917c69784d152762945f4a6ae75788f74aa9f932d` | 50 |
| 300 | 2026-09-13T18:04:29Z | `63e95550ea71be91fcaa4411209837ba60f2a6ac00d7a0b5f2cd0ca174bfc2db` | 50 |
| 350 | 2026-09-13T18:04:30Z | `d9b612eed513c35a3d2f30358cb2da69b6fa1e10df783292692aad578997ed1a` | 50 |
| 400 | 2026-09-13T18:04:30Z | `ee5d11bb4bb4e790ca5006a2531abd22522962380853f4aa854cdbb384179029` | 50 |
| 450 | 2026-09-13T18:04:31Z | `381b369fe320d05edf0c434f9f2f1185c030b81696613ec22c2a6528c03f0a7d` | 50 |
| 500 | 2026-09-13T18:04:31Z | `602b53a66cafc5e6a85bff914000bc75f407215e3e95d8ce3f8d23b8763005b0` | 50 |
| 550 | 2026-09-13T18:04:31Z | `cd33b847781ff29fe8c54c373abbf21515bd8bc850a1cd4bf630c4efb59eb9f6` | 50 |
| 600 | 2026-09-13T18:04:32Z | `4304da09fa4332c8fcc5277ad5d3731d5055be7b85e9f41560aa2cb46e356190` | 50 |
| 650 | 2026-09-13T18:04:32Z | `de55240626e5e80ffbb5ad0a48c3200536f5e465e8e81f159ea5485f87578af4` | 50 |
| 700 | 2026-09-13T18:04:32Z | `37c7334794082d3bb9c4a5fede2d730831e0997015caa86eaf902dbfb8d6a0bb` | 50 |
| 750 | 2026-09-13T18:04:33Z | `d5ec7c78b56962676137eab9eeac150418ff4bf97879c540bc7ef23f7040ed25` | 50 |
| 800 | 2026-09-13T18:04:33Z | `142e267393ec1ad51182c9fcb9722e9bc884018ada5325c673b53c51ce96f3d8` | 50 |
| 850 | 2026-09-13T18:04:34Z | `ee8a1df7f915b2d649298d585025a6560828b62a344ec402a810f4dca8a5ec0b` | 50 |
| 900 | 2026-09-13T18:04:34Z | `9e0126c9896bddc11eb6e2d97f76bdedd39e241cee2626e84fd1b7ab02b1f065` | 50 |
| 950 | 2026-09-13T18:04:35Z | `1eea7f4d601123bb4d638480578222ecd849c0f47a227d60ae37ca1487ddfe61` | 50 |
| 1000 | 2026-09-13T18:04:35Z | `bf06f23c95c540a7fc387145652622a24bf81b3cc475b5e33b597290d168fe6c` | 34 |
| 1050 | 2026-09-13T18:04:36Z | `a943ce4dc32423586dd56ed50e2f6bccfcf3ade08d8395373f88b4e9583c41ec` | 0 |

### Failed / incomplete retrievals (not retried, no broadening)

| Probe (relative to api/app/) | Result |
|---|---|
| `booking-service/public-list` | empty / no usable body — not retried, no broader probing |
| `catalog/public-list` | empty / no usable body — not retried, no broader probing |
| `service` | empty / no usable body — not retried, no broader probing |
| `service/public-list` | empty / no usable body — not retried, no broader probing |
| `service/public-services` | empty / no usable body — not retried, no broader probing |
| `service/read-only-list` | empty / no usable body — not retried, no broader probing |

Also `failed / incomplete retrieval`: Instagram profile pages (HTTP 429 twice; social facts recorded as `unknown`, not guessed). The 14-agent research workflow (session limit) — its partial results were discarded.

## 2. Field pointers per requirement of #4

| Requirement | Evidence | Fields used | Completeness | Uncertainty |
|---|---|---|---|---|
| Active branches and IDs | E01 | `id`, `name`, `addressUrl` | 5 records, complete | The list is the storefront's branch list, not proof that five locations operate today. One record (روشن Zone i) has no map link. `localizedName` and `locationLabel` are null in all five. |
| Staff names and branch/service mapping | E02, E03 | `name`, `branchIds`, `schedules[].scheduleItems[]{day,startAt,endAt}`, `schedules[].from/to`, `scheduleOverrides` (count only); E03 `enableCustomerToChooseProvider` | 21 records, complete; twice fetched with identical bytes | Records are "reported" team entries; they do not prove current availability or expertise. One record is the platform's default provider. The name «مروان» appears in three records at three branches (one person or three: `unknown`). No per-service staff mapping exists in the public data; services expose only a "customer may choose provider" flag. |
| Service variants, branch prices, duration, tax/display, approval status | E03, E05, E06 | `typeString`, `name`, `localizedName`, `amount`, `discountedAmount`, `duration`, `branchIds`, `pricing[]{name,amount,duration}`, `addOns[]{label,amount}`, `isGiftable`; E06 `Platform.Tax.Percentage`, `Platform.Invoice.TaxIsEnabled`, `Platform.Business.ShowVat` | 17 reservation items, complete | Whether displayed amounts include the configured 15 % tax is `unknown` (the availability response shows `priceWithTax: 0`, which is uninformative). Items with an empty `branchIds` cannot be attributed to branches from public data. Approval status of every price: **none merchant-approved**. |
| Product names/variants, labels, cosmetic claims | E03 | as above plus `description` (HTML), `badgeLabel`, `pricing[].stock` | 7 merchandise items, complete | Claims are the shop's own marketing text (public observation of a claim, not evidence the claim is true). Two items are titled "(Copy)" in English. Stock fields (`pricing[].stock`): the two bundles report `isUnlimited: true`; the other five carry finite quantities — perfume 201, spray 24, shampoo 142, concealer 50 ml 21, **concealer 30 ml 0** (`availableQuantity: 0`, `remainingQuantity: 0`) — while `isOutOfStock` is `false` on all seven. Stock truth for the 30 ml item is therefore contradictory and `unknown`. |
| Membership fee, entitlement, eligible services/branches, caps, expiry, renewal | E03, E05 | `pricing[]{billingPeriod, billingCycle, package.totalQuantity}`, `customFields[]{label,isRequired}`, `isGiftable`, `branchIds`; E05 `allowCustomersToPauseSubscription` | 4 subscription items, complete | The public data gives visit counts and period only. Which services a "visit" covers, rollover/expiry of unused visits, renewal, cross-branch use and the purpose of the mandatory subscriber photo are `unknown` (descriptions give partial wording only). |
| Official customer booking URL(s) | E08, E09 | site routes in the bundle: `/book`, `/book-options`, `/products/$productId`, `/memberships/$productId`, `/memberships/$productId/checkout` (validates only `priceId`), `/packages/...`, `/gifts/...`, `/checkout/done/$checkoutId`; root handles `?branchId=` by writing a 30-day `SelectedBranchId` cookie then redirecting | complete for what the bundle declares | No guessed checkout parameters are used. `/book` declares no search-parameter validation, so service/barber/time cannot be pre-filled by URL. Booking creation requires a 4-digit OTP and a Turnstile captcha (bundle observation). |
| Review sample count, duplicates, public/private status, counting method | E10, E11 | `totalCount`, `averageRating`, `ratingBreakdown`, `items[]{id, rating, creationTime, description, adminReply}`; `customerName` present but not used | 1,034 objects, complete; ids unique | Only publicly listed reviews are visible; nothing about unpublished ones can be known from this endpoint. |
| Context of `autoApprovalMinRating` | E05 | `autoApprovalMinRating: 5`, `allowCustomerRating: true` | complete | See EXCERPTS §8. The setting describes automatic publication of 5-star ratings; it does not show what happens to lower ratings. |
| Slot format and read capability | E07 | `isLocationApplicable`, `slots[]{from,to,isAvailable,availableProvidersCount,availableProviderIds,amounts{...},maxConnectedTo}` | one window, one price, one provider; 153 slots on a 15-minute grid, each 35 minutes | Demonstrates that availability is readable anonymously for a given price id and provider id. It is **not** proof that Rakan may book, and general hours/iCal are not proof of bookability. |

## 3. What the evidence does not establish

- That five locations are open today, or which barbers currently work.
- That any price is final for a customer (tax display `unknown`, promotions may exist).
- That any review count says anything about skill (see `CORRECTIONS.md` #1).
- That lower-star reviews were or were not manually approved (see `CORRECTIONS.md` #2).
- That the shop authorizes any automated booking or any use of its API (public reads are not authorization).
