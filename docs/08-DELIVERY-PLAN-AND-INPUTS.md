# 08 — Delivery plan and required inputs

**Version:** 0.2 planning baseline, 13 September 2026. **Status:** proposed sequence. No dates in this file are commitments. Documentation does not authorize implementation, paid APIs, customer messages or live photo processing.

Read [00](00-REVIEW-AND-CORRECTIONS.md) and [README](../README.md) before expanding scope.

## 1. Slices

| Slice | Outcome | Depends on |
|---|---|---|
| **P0** | Reviewed plan, authorization, evidence, missing-doc closure | Brand conversation |
| **P1** | Controlled concierge: catalog FAQ, booking or request-only, handoff, basic prefs | P0 + inputs below |
| **P2** | Optional photo consult, grounded product match, staff brief | P1 reliability + [05](05-VISUAL-CONSULTATION-AND-PRODUCTS.md) / [06](06-PRIVACY-SECURITY-AND-HANDOFF.md) gates |
| **P3** | Style history, honest membership maths, post-visit learning, permissioned messages | P1/P2 measurement |
| **P4** | Simulation previews, extra channels, voice | Proven benefit and extra review |

P1 is the first customer-facing slice worth building. P2 is the first “amazing” differentiator. Do not advertise P4 in P1 marketing.

## 2. Recommended P1 build order

1. Synthetic catalog fixture + DEMO web chat (internal only).
2. System prompt + eight tools: branches, services, slots, quote, create booking, get booking, handoff, optional profile read.
3. Golden conversations and the transaction tests in [07](07-ACCEPTANCE-AND-METRICS.md).
4. Choose mode: `REQUEST_ONLY` with a staffed queue, or `INTEGRATED` after sandbox proof.
5. WhatsApp sandbox against test numbers.
6. Barber-brief text field even without photos.
7. Native + barber review on 30 conversations.
8. One-branch pilot only if authorization and staffing exist.

Rekaz remains a **candidate** adapter. Map real endpoints after tenant access; do not freeze invented paths from marketing pages ([03](03-TRUTH-AND-INTEGRATION.md), [09 S02](09-SOURCES-AND-EVIDENCE.md)).

## 3. Original 25 business inputs

Preserve the original list. Status today: **not supplied as merchant-approved records**. Public pages are research only.

| # | Input | Needed for | Public-repo form |
|---|---|---|---|
| 1 | Branches, addresses, maps | Booking | Synthetic IDs only |
| 2 | Hours and exceptions | Slots | Approved calendar later |
| 3 | Service catalog | Quote | Placeholder SKUs |
| 4 | Prices and currency display | Quote | Integer minor units in private store |
| 5 | Durations and buffers | Slots | Private |
| 6 | Combinable services rules | Baskets | Private |
| 7 | Barber roster | Matching | Public names only if approved |
| 8 | Schedules and leave | Slots | Private |
| 9 | Skill / eligibility tags | Matching | Brand-authored |
| 10 | Booking platform and tenant | Integration | Credentials private |
| 11 | Create / amend / cancel semantics | Tools | Discovery worksheet |
| 12 | Cancellation and no-show policy | Copy | Approved text |
| 13 | Deposit and payment path | Payment state | Hosted route only |
| 14 | Product catalog | Advice | Approved claims only |
| 15 | Product prices | Advice | Private |
| 16 | Stock / reservation semantics | Promises | Discovery |
| 17 | Ingredient / warning labels | Safety | From pack + merchant |
| 18 | Membership terms | Maths | Versioned |
| 19 | Promotions stacking | Quote | Versioned |
| 20 | Lawful customer history access | Repeat flow | Basis documented |
| 21 | Complaint / refund authority | Recovery | Named owner |
| 22 | Handoff contacts and hours | Queue | Private roster |
| 23 | WhatsApp / WABA setup | Channel | Private |
| 24 | Brand tone and naming | Persona | Rakan still unapproved |
| 25 | Official booking URL fallback | Failures | Public URL if stable |

## 4. Additional inputs this review added

Brand authorization to represent the shop; processing purposes and retention; guardian / child photo policy; vendor data-processing terms; approved cosmetic and medical-adjacent scripts; security owners; release sign-off; unit-economics limits; template list for WhatsApp; which single pilot branch.

## 5. Decision log

Record decisions here when they are actually made. Empty rows are not approvals.

| ID | Question | Decision | Date | Owner | Evidence |
|---|---|---|---|---|---|
| D01 | Assistant public name | *open — working name Rakan* | — | Brand | [02](02-PERSONA-AND-CONVERSATION.md) |
| D02 | Pilot branch | *open — spec says one location* | — | Brand | Public list is not a pilot choice |
| D03 | Booking mode at first customer use | *open — DEMO only today* | — | Product + ops | [03](03-TRUTH-AND-INTEGRATION.md) |
| D04 | Provider | *candidate Rekaz; tenant unverified* | — | Ops | [09 S02](09-SOURCES-AND-EVIDENCE.md) |
| D05 | Child photo consultation | *off until guardian process* | 2026-09-13 | Planning baseline | [00 R15](00-REVIEW-AND-CORRECTIONS.md) |
| D06 | Charity-per-haircut in agent copy | *do not seed until merchant verifies* | 2026-09-13 | Planning baseline | [00 R23](00-REVIEW-AND-CORRECTIONS.md) |
| D07 | Model / host / region | *not selected from memory* | — | Engineering | [AGENTS.md](../AGENTS.md) |
| D08 | First live channel | *proposed WhatsApp; not provisioned here* | — | Brand | [01 §2](01-PRODUCT-SPECIFICATION.md) |

## 6. P0 exit (current gate)

P0 is complete enough to start a **bounded implementation task** only when:

- this documentation set is internally consistent (docs 00–10 present);
- brand authorization is explicit;
- catalog/policy owners are named;
- booking mode and pilot branch are chosen;
- handoff hours exist;
- privacy notice text can be truthful;
- a private store for secrets and merchant data exists.

Until then, allowed work is: more documentation, synthetic fixtures, unpublished demos labeled DEMO.

## 7. What a later implementation task should return

Per [AGENTS.md](../AGENTS.md): files and commit changed; checks run; checks not run; remaining dependencies; next authorized gate. Do not treat a good conversation as production.

Related: [Coverage](10-COVERAGE-MAP.md) · [Acceptance](07-ACCEPTANCE-AND-METRICS.md) · [Sources](09-SOURCES-AND-EVIDENCE.md).
