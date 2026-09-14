# The Weekend / Rakan

Rakan (راكان) is The Weekend's proposed digital grooming concierge: practical style choices, trustworthy booking assistance and a customer-approved barber brief.

## Status — 13 September 2026

**Reviewed planning plus a small tested implementation scaffold. Not a running agent or a customer release.**

This revision reconciles the documents attributed to Grok with the owner's latest instructions and our unfinished changes. Existing documents 00–10 are preserved; [14 — Collaborative review](docs/14-COLLABORATIVE-REVIEW.md) explicitly corrects the identified passages and records source limitations. Read that amendment before implementing the older specifications. This is an assistant-led review, not an independent audit, legal approval or clinical certification.

## Completely separate from Kivo

The Weekend owns its Rakan persona, grooming knowledge, code, customer records, credentials, deployment, messaging configuration and release lifecycle. It is not a Kivo tenant. No Kivo live service, production data, voice donor asset, moving dependency or shared customer memory is used. Selected source reuse requires review and then local Weekend ownership; see [11](docs/11-REUSE-MANIFEST.md) and [13](docs/13-STANDALONE-AND-REAL-SERVICE.md). No source extraction has been completed.

## What is actually here

- The product, persona, booking, privacy, visual-consultation and evidence documents.
- A candidate [system prompt](prompts/rakan.system.md), not model-tested or production-approved.
- A clearly fictional [catalog fixture](fixtures/catalog.synthetic.json), not The Weekend's prices or availability.
- A dependency-free [next-action selector](src/domain/next-actions.mjs) and [30 synthetic scenario contexts](evals/next-actions.synthetic.json).
- [40 local unit tests](tests/next-actions.test.mjs) for action selection and malformed input. They do not evaluate language understanding, images, real transactions or authentication.

Run with Node supporting the built-in test runner:

```sh
node --test tests/*.test.mjs
```

Verified locally on Node v22.16.0. No dependency installation, API key or provider call is needed. There is no chat server or deployed UI in this scaffold.

## Document map

| Document | Purpose |
|---|---|
| [00 — Review](docs/00-REVIEW-AND-CORRECTIONS.md) | Historical R01–R30 requirements corrections |
| [01 — Product](docs/01-PRODUCT-SPECIFICATION.md) | All 40 original specification sections |
| [02 — Persona](docs/02-PERSONA-AND-CONVERSATION.md) | Saudi Arabic character and ethical selling |
| [03 — Truth/integration](docs/03-TRUTH-AND-INTEGRATION.md) | Authority sources and integration discovery |
| [04 — Transactions](docs/04-BOOKING-STATE-AND-TOOLS.md) | Booking/payment states and tool contracts |
| [05 — Visual consultation](docs/05-VISUAL-CONSULTATION-AND-PRODUCTS.md) | Cosmetic advice, products and staff brief |
| [06 — Privacy/handoff](docs/06-PRIVACY-SECURITY-AND-HANDOFF.md) | Permissions, retention and human operations |
| [07 — Acceptance](docs/07-ACCEPTANCE-AND-METRICS.md) | Proposed production gates and metrics |
| [08 — Delivery/inputs](docs/08-DELIVERY-PLAN-AND-INPUTS.md) | Staged implementation and merchant inputs |
| [09 — Evidence](docs/09-SOURCES-AND-EVIDENCE.md) | Earlier source observations; read review qualifications in 14 |
| [10 — Coverage](docs/10-COVERAGE-MAP.md) | Original 40-section coverage; historical pre-scaffold status |
| [11 — Reuse](docs/11-REUSE-MANIFEST.md) | Candidate imports, not completed extraction |
| [12 — Next actions](docs/12-CUSTOMER-NEXT-ACTIONS.md) | Customer choices and executable policy boundary |
| [13 — Standalone decision](docs/13-STANDALONE-AND-REAL-SERVICE.md) | Owner-approved separation and real-service direction |
| [14 — Reconciled review](docs/14-COLLABORATIVE-REVIEW.md) | Current corrective amendment, evidence and limits |
| [AGENTS](AGENTS.md) | Contributor authority and collaboration rules |

## Product invariants

Help the customer choose, book accurately, brief the barber and learn only from permitted feedback. Customers may skip consultation, photos and marketing permission. Be natural while clearly identifying Rakan as a digital assistant; no fake employee biography.

Never invent a price, slot, product, stock check, staff skill or completed action. Selected time, checkout link and payment screenshot do not prove a confirmed appointment. Separate booking, payment, notification and brief-delivery outcomes.

Photo advice is cosmetic, approximate and optional. No diagnosis, disease-treatment sales, identity recognition, demographic inference or attractiveness score. Separate permission for analysis, storage, staff sharing and marketing. No customer data or credentials in this public repository.

## Build versus release

Internal fixtures and isolated components do not need a live merchant tenant. Actual customer use does require approved business representation, current catalog/policy truth, a supported booking or request-only route, real support, privacy/retention controls, qualified grooming/native review and feature-specific tests. A real configured consultation must never silently become scripted demo output. Unsupported operations remain unavailable or truthfully become staff requests.

The work is proposed through a separate review branch/PR to protect concurrent edits. No main rewrite, deployment, paid API use, live message, booking, payment or real customer-photo processing is part of this revision. Licensing remains an owner decision; [NOTICE](NOTICE.md) does not grant a new license.
