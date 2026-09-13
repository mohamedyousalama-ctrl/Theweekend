# 10 — Coverage map

**Version:** 0.2 planning baseline, 13 September 2026. Traces the original 40 specification sections and the broader vision onto the current document set.

Status values: `specified` (written, not built) · `partial` (owned but needs merchant input) · `deferred` (roadmap only) · `excluded` (will not do).

## 1. Forty specification sections

| § | Topic | Home | Slice | Status |
|---|---|---|---|---|
| 1 | North-star / satisfied completed visits | [01](01-PRODUCT-SPECIFICATION.md), [07](07-ACCEPTANCE-AND-METRICS.md) | P1 measure | specified |
| 2 | Primary channel WhatsApp | [01](01-PRODUCT-SPECIFICATION.md), [06](06-PRIVACY-SECURITY-AND-HANDOFF.md) | P1 | partial — WABA not provisioned |
| 3 | Identity / name Rakan | [02](02-PERSONA-AND-CONVERSATION.md) | P0 | partial — brand approval open |
| 4 | Persona | [02](02-PERSONA-AND-CONVERSATION.md) | P1 | specified |
| 5 | Language | [02](02-PERSONA-AND-CONVERSATION.md) | P1 | specified |
| 6 | Conversation principles | [02](02-PERSONA-AND-CONVERSATION.md) | P1 | specified |
| 7 | Core capabilities list | [01](01-PRODUCT-SPECIFICATION.md) | P1–P4 | specified / staged |
| 8 | Weekend Style Profile | [01](01-PRODUCT-SPECIFICATION.md), [05](05-VISUAL-CONSULTATION-AND-PRODUCTS.md) | P1 basic / P3 rich | specified |
| 9 | Photo consultation | [05](05-VISUAL-CONSULTATION-AND-PRODUCTS.md) | P2 | specified, gated |
| 10 | Photo safety boundary | [05](05-VISUAL-CONSULTATION-AND-PRODUCTS.md), [00 R08–R12](00-REVIEW-AND-CORRECTIONS.md) | P2 | specified |
| 11 | Reference-style flow | [05](05-VISUAL-CONSULTATION-AND-PRODUCTS.md) | P2 | specified |
| 12 | Barber matching | [01](01-PRODUCT-SPECIFICATION.md), [03](03-TRUTH-AND-INTEGRATION.md) | P1 eligible list / P3 ranking | partial — no roster |
| 13 | Booking experience | [04](04-BOOKING-STATE-AND-TOOLS.md) | P1 | specified |
| 14 | First-time booking | [01](01-PRODUCT-SPECIFICATION.md), [02](02-PERSONA-AND-CONVERSATION.md) | P1 | specified |
| 15 | Product recommendation | [05](05-VISUAL-CONSULTATION-AND-PRODUCTS.md) | P2 | specified, needs catalog |
| 16 | Product selling principle | [02](02-PERSONA-AND-CONVERSATION.md), [05](05-VISUAL-CONSULTATION-AND-PRODUCTS.md) | P2 | specified |
| 17 | Service upselling | [01](01-PRODUCT-SPECIFICATION.md), [02](02-PERSONA-AND-CONVERSATION.md) | P1 | specified |
| 18 | Membership sales | [01](01-PRODUCT-SPECIFICATION.md), [03](03-TRUTH-AND-INTEGRATION.md) | P3 | partial — terms unverified |
| 19 | Occasion mode | [01](01-PRODUCT-SPECIFICATION.md) | P1 copy / P3 packs | specified as context, not bundles |
| 20 | Repeat customer | [01](01-PRODUCT-SPECIFICATION.md) | P1 if identity | specified |
| 21 | Post-visit flow | [01](01-PRODUCT-SPECIFICATION.md), [07](07-ACCEPTANCE-AND-METRICS.md) | P3 | specified |
| 22 | Complaints | [01](01-PRODUCT-SPECIFICATION.md), [06](06-PRIVACY-SECURITY-AND-HANDOFF.md) | P1 handoff | specified |
| 23 | Rebooking engine | [01](01-PRODUCT-SPECIFICATION.md), [06](06-PRIVACY-SECURITY-AND-HANDOFF.md) | P3 | specified, permissioned |
| 24 | Memory rules | [01](01-PRODUCT-SPECIFICATION.md), [06](06-PRIVACY-SECURITY-AND-HANDOFF.md) | P1–P3 | specified |
| 25 | Live truth system | [03](03-TRUTH-AND-INTEGRATION.md) | P1 | specified, sources empty |
| 26 | Tool contracts | [04](04-BOOKING-STATE-AND-TOOLS.md) | P1 subset | specified |
| 27 | Human handoff | [06](06-PRIVACY-SECURITY-AND-HANDOFF.md) | P1 | specified |
| 28 | Sales guardrails | [02](02-PERSONA-AND-CONVERSATION.md) | P1 | specified |
| 29 | Personalization levels | [01](01-PRODUCT-SPECIFICATION.md) | P1–P3 | specified |
| 30 | Analytics | [07](07-ACCEPTANCE-AND-METRICS.md) | P1 | specified |
| 31 | Business KPIs | [07](07-ACCEPTANCE-AND-METRICS.md) | P1 measure | specified |
| 32 | Quality assessment | [07](07-ACCEPTANCE-AND-METRICS.md) | P1 | specified |
| 33 | Hard failures | [07](07-ACCEPTANCE-AND-METRICS.md) | all | specified |
| 34 | Acceptance suite | [07](07-ACCEPTANCE-AND-METRICS.md) | P1+ | specified, tests not run |
| 35 | V1 / slice scope | [01](01-PRODUCT-SPECIFICATION.md), [08](08-DELIVERY-PLAN-AND-INPUTS.md) | — | specified |
| 36 | Visual preview | [05](05-VISUAL-CONSULTATION-AND-PRODUCTS.md) | P4 | deferred |
| 37 | Benchmark journey | [01](01-PRODUCT-SPECIFICATION.md), [02](02-PERSONA-AND-CONVERSATION.md) | P1–P2 | specified |
| 38 | Product promise | [01](01-PRODUCT-SPECIFICATION.md) | P0 | specified, unapproved copy |
| 39 | Business inputs | [08](08-DELIVERY-PLAN-AND-INPUTS.md) | P0 | listed, not received |
| 40 | Final principle (one app) | [01](01-PRODUCT-SPECIFICATION.md), [03](03-TRUTH-AND-INTEGRATION.md) | all | specified |

## 2. Vision items outside the numbered forty

| Idea | Home | Slice | Status |
|---|---|---|---|
| Skip consultation and book | [01](01-PRODUCT-SPECIFICATION.md), [02](02-PERSONA-AND-CONVERSATION.md) | P1 | specified |
| Customer-approved barber brief | [05](05-VISUAL-CONSULTATION-AND-PRODUCTS.md) | P1 text / P2 photo | specified |
| Website chat / Instagram / voice | [01](01-PRODUCT-SPECIFICATION.md) | P4 | deferred |
| In-store camera analytics | — | — | excluded |
| Facial recognition | [01 §35](01-PRODUCT-SPECIFICATION.md) | — | excluded |
| Attractiveness scoring | [00 R09](00-REVIEW-AND-CORRECTIONS.md) | — | excluded |
| Multi-agent fleet | [00 R26](00-REVIEW-AND-CORRECTIONS.md) | — | excluded as architecture |
| Donation-per-haircut as agent fact | [00 R23](00-REVIEW-AND-CORRECTIONS.md), [09](09-SOURCES-AND-EVIDENCE.md) | — | blocked pending verification |
| BATCI / unaudited interiors / ratings | [00 R23](00-REVIEW-AND-CORRECTIONS.md) | — | blocked pending verification |

## 3. Correction register coverage

R01–R30 in [00](00-REVIEW-AND-CORRECTIONS.md) are treated as binding. Each correction is implemented in docs 01–07 as design rules. None is implemented in software.

## 4. Document completeness

| File | Role | Present |
|---|---|---|
| README.md | Status and index | yes |
| AGENTS.md | Assistant / developer rules | yes |
| docs/00–04 | Review, spec, persona, truth, booking | yes |
| docs/05 | Visual / products / brief | yes — this closure set |
| docs/06 | Privacy / security / handoff | yes — this closure set |
| docs/07 | Acceptance / metrics | yes — this closure set |
| docs/08 | Delivery / inputs / decision log | yes — this closure set |
| docs/09 | Evidence register | yes — this closure set |
| docs/10 | This map | yes |

Code, prompts, fixtures, evals and provider adapters remain **absent**. Completing this map does not complete P0 authorization for live use ([08 §6](08-DELIVERY-PLAN-AND-INPUTS.md)).

## 5. Honest remainder

Still required before a customer ever meets Rakan: brand authorization, a real catalog, a chosen pilot branch, a staffed queue, a truthful privacy notice, and a bounded implementation task. This file only proves the written vision is traceable.
