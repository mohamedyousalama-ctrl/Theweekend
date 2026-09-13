# 09 — Sources and evidence

**Compiled:** 13 September 2026. **Method:** public-page retrieval for planning. No merchant account, API key, staff interview or legal retainer was used.

Labels: `public observation` · `provider documentation` · `official guidance` · `not verified` · `failed / incomplete retrieval`.

A URL in this file is not permission to promise the corresponding capability to customers.

## 1. Source key

| ID | Source | Type | URL | Retrieved |
|---|---|---|---|---|
| S01 | The Weekend public site | public observation | https://theweekendhairstyling.com/ | 2026-09-13 |
| S01b | Brand Linktree | public observation | https://linktr.ee/theweekendbarber | 2026-09-13 |
| S02 | Rekaz developer getting started | provider documentation | https://docs.rekaz.io/docs/getting-started | 2026-09-13 |
| S02b | Rekaz webhooks doc | provider documentation | https://docs.rekaz.io/docs/webhooks | 2026-09-13 |
| S02c | Rekaz API reference (index) | provider documentation | https://docs.rekaz.io/reference | 2026-09-13 |
| S03 | Rekaz credential handling in S02 | provider documentation | same as S02 | 2026-09-13 |
| S04 | WhatsApp Business Messaging Policy | official / platform policy | https://business.whatsapp.com/policy | 2026-09-13 |
| S04b | WhatsApp pricing / service window notes | platform documentation | https://developers.facebook.com/docs/whatsapp/pricing | 2026-09-13 |
| S05 | SDAIA regulations index (PDPL + implementing regulation) | official guidance | https://sdaia.gov.sa/en/SDAIA/about/Pages/RegulationsAndPolicies.aspx | 2026-09-13 |
| S05b | National Data Governance Platform knowledge center | official guidance | https://dgp.sdaia.gov.sa/ | 2026-09-13 |
| S06 | American Academy of Dermatology — hair-loss public pages | official guidance (clinical public education) | https://www.aad.org/public/diseases/hair-loss | 2026-09-13 |
| S07 | Google Maps UGC — fake engagement / incentives | platform policy | https://support.google.com/contributionpolicy/answer/7400114 | 2026-09-13 |

Secondary pages (TikTok / Fresha listings / maps pins) were seen during review. They are **not** catalog authorities.

## 2. Observations that held on this pass

### S01 — theweekendhairstyling.com

Observed 13 September 2026:

- Brand presents premium grooming: haircut, beard, skin and hair care, memberships, selected products.
- Online booking chrome is present (“احجز عبر الإنترنت”, branch picker).
- Booking catalog exposed to this retrieval: **لا توجد خدمات متاحة للحجز حالياً.**
- Recurring charity line: **كل حلاقة لك في ذا ويكند، ريال يذهب صدقة.**
- No complete public price list, staff roster or hours were captured in this pass.

**Does not establish:** that the shops are closed; that bookings are impossible by phone or another system; current tariffs; number of operating branches; donation mechanics.

### S01b — Linktree

Observed labels: الشفا، روشن، النرجس، الروضة, plus social and WhatsApp entries.

Data-quality warning: the النرجس pin resolved in that directory to a **Winnipeg** street address. Treat directory geocodes as unreliable until merchant-approved addresses exist. Do not load raw Linktree text into customer-facing tools.

### S02 / S03 — Rekaz public developer material

Published capabilities of the **Merchant API generally** include: public catalog and transaction reads, customer management, reservations and subscriptions, hosted checkout links, signed webhooks. Auth model described: Basic (API key + secret), `__tenant` header, `Accept: application/json`. Credentials must stay on a server. Webhook guidance includes `X-Rekaz-Signature` and HMAC-SHA256 over the raw body.

Explicit published limitation relevant to payment honesty: the merchant API documentation states it does **not** expose card-processing, refund, invoice-retrieval or externally-paid endpoints. Hosted checkout is the published payment direction.

**Does not establish:** that The Weekend's tenant exists, is reachable with our credentials, enables reservation-by-barber-and-slot, or matches the adapter in [04](04-BOOKING-STATE-AND-TOOLS.md). Provider docs are not tenant proof ([00 R03](00-REVIEW-AND-CORRECTIONS.md)).

### S04 — WhatsApp

Business-initiated messages outside the customer-service window require approved templates. Automation used inside the window still requires a prompt human escalation path, including in-chat human transfer. Template category and purpose constraints apply. Always re-read the live policy before configuring a WABA; this row is a planning pointer, not a substitute.

### S05 — PDPL

SDAIA publishes the Personal Data Protection Law, its implementing regulation, and cross-border transfer rules. This project has **not** completed a lawful-basis analysis, RoPA, DPIA or transfer assessment. Product rules in [06](06-PRIVACY-SECURITY-AND-HANDOFF.md) are design constraints inspired by those texts, not a claim of compliance.

### S06 — AAD hair-loss education

Public dermatology guidance supports the product rule: do not diagnose cause from a casual photo; do not sell a salon session as disease treatment; direct concerning shedding or scalp symptoms to appropriate clinical assessment. Rakan is not a medical device. Scripts still need qualified review.

### S07 — Google review integrity

Platform policy disallows incentives for reviews, selective solicitation of only positive reviews, and pressuring revision of negative reviews. Neutral invitations that do not buy a rating remain the only pattern this spec allows.

## 3. Failed or incomplete retrievals

| Target | Result | Do not infer |
|---|---|---|
| English / subsidiary brand pages | Incomplete in this pass | Brand has no English customers; pages do not exist |
| Live bookable SKU list on S01 | Empty / unavailable message | Business stopped taking appointments |
| Rekaz tenant of The Weekend | Not accessed | Integration is finished |
| Exact branch count as operations truth | Public directories disagree in quality | Pilot = all listed pins |
| BATCI, donation ledger, interior identity, review scores as facts | Not reverified to a standard we will seed | Repeat as marketing claims in the agent |

Timestamp failed fetches when implementation starts a new evidence pass. A failed fetch is evidence of a failed fetch.

## 4. Claims the agent must not make from this register

- Named barber availability today.
- A price or duration.
- “تم الحجز” from a website visit.
- That a riyal is donated per haircut, unless merchant-approved current terms are loaded.
- That family memberships can be activated online, unless current terms say so (homepage research previously suggested in-branch family enrollment — reconfirm).
- That Rekaz webhooks are wired.
- That PDPL compliance is achieved.
- Any Winnipeg address for النرجس.

## 5. How to add evidence

New rows need: ID, URL, date, method, observation, limitation, owner. Screenshots of private admin tools do not belong here.

Related: [Review](00-REVIEW-AND-CORRECTIONS.md) · [Truth](03-TRUTH-AND-INTEGRATION.md) · [Delivery](08-DELIVERY-PLAN-AND-INPUTS.md).
