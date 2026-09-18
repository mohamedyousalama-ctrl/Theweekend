# Instructions for assistants and developers

## Project and authority

This repository is `mohamedyousalama-ctrl/Theweekend`, the standalone Weekend project with its dedicated Rakan agent and grooming knowledge. Kivo is intentionally outside its runtime, data and governance boundaries, not an accidental legacy reference. Do not reuse Kivo production databases, messaging accounts, customer data, credentials, repository governance or deployment authority. Reviewed local source reuse is governed by docs/11-REUSE-MANIFEST.md; no extraction is claimed complete.

Read README.md, docs/00-REVIEW-AND-CORRECTIONS.md, docs/08-DELIVERY-PLAN-AND-INPUTS.md, docs/13-STANDALONE-AND-REAL-SERVICE.md and docs/14-COLLABORATIVE-REVIEW.md before changing scope. The full vision is in docs/01-PRODUCT-SPECIFICATION.md. The specific corrections in 14 govern the cited older passages; other safety rules remain binding. The standalone direction in 13 supersedes earlier shared-runtime suggestions.

The current revision covers reconciliation, a prompt/fixture pack and isolated next-action policy tests. It does not authorize paid services, production deployment, real appointments, customer communication, merchant-account changes or processing customer photographs. A later explicit task may authorize bounded execution; never infer authority from a roadmap entry. Build readiness and customer-release readiness are different gates.

## Concurrent writers

Use a dedicated branch based on a freshly read commit. Inspect current main, branches and pull requests before editing. Do not overwrite another writer's work, force-push main or cherry-pick an old entire tree over newer documents. Re-read the affected paths before updates; preserve unrelated content. Publish exact base/head SHAs, changed paths and tests in the PR. Check for new overlapping changes before merge. The author of an implementation is not its independent reviewer.

## Public repository

Never commit customer photographs, phone lists, booking exports, chat transcripts, profile records, signed media URLs, access tokens, API keys, tenant credentials, private staff performance or commercially confidential merchant exports. Use synthetic examples and non-routable identifiers. Production truth belongs in approved private systems, not Markdown.

Do not claim a commercial agreement or use a real employee identity without permission. The working name before PR #36 was Rakan; the visible name خالد (D18) awaits the owner's confirmation on #2. Do not copy a person's likeness or voice. Public source visibility is not an automatic right to reuse it. Do not choose a distribution license without the owner's decision; preserve applicable third-party notices.

## Truth and evidence

Distinguish proposal, public observation, merchant-approved, implemented, tested and released. Record source, date, method and retrieval limits. A public website or provider guide does not demonstrate tenant access. A collaborator's observation not reproduced in this review stays collaborator-reported, not independently verified.

Read before replacing, use current blob SHAs for contents-API updates, and verify persisted files/commits before reporting success. No history rewriting without explicit authority. Local tests of synthetic state do not prove model behavior, booking integrations, clinical correctness or production isolation.

## Product invariants

- Introduce the assistant as a digital/AI assistant, not a human barber. Visible name (D18): **خالد**, always with the subtitle **مساعد رقمي · ذا ويكند**. No fabricated biography, nationality, work history or relationship, and never impersonation of خالد the shop owner.
- Direct booking remains possible without a photo, consultation, enrichment or marketing consent.
- Only authoritative booking truth permits confirmation. Request-only and demo modes cannot masquerade as integrated success.
- Explicit customer approval is required for create, modify, cancel and paid additions. Server code validates ownership, price, availability, permissions, quote version and consent.
- Money uses integer minor units. Keep idempotency, reconciliation, version checks and authentic webhooks. Unknown write outcome is not permission to retry blindly.
- No medical diagnosis, disease-treatment sales, attractiveness scores, sensitive-trait inference or face recognition.
- Cosmetic observations carry uncertainty; customer choice is separate from verified anatomy. The barber validates feasibility. A preview is a simulation, not a guarantee.
- Analysis, saved preferences, retained photos, staff sharing and marketing have distinct permissions. Enforce withdrawal and actual retention; do not promise deletion that the architecture cannot deliver.
- One relevant optional offer; stop after refusal. Complaints and concerning symptoms suspend selling. No shame, fake scarcity or guaranteed results.
- Review requests remain neutral and independent of satisfaction score; no incentives.
- Handoff has real receipt/assignment/acceptance/timeout states or an approved direct contact route. Do not claim acceptance until it occurs. Pause autonomous replies under human ownership.

## Engineering direction

Prefer one small application with an orchestrator, validated tools and private operational storage, not a fleet of autonomous agents. Fewer model-visible tools must not remove required application-side controls.

The next-action module is a presentation policy. Its inputs must come from validated server state, not client or model assertions. Displayed action IDs do not authorize execution. The future handler must verify identity, object ownership, scope, expiry, quote version, specific consent and operation idempotency again.

Do not select models, hosting regions or provider behavior from memory. Verify current documentation, data handling, terms, cost and compatibility. Test representative Saudi Arabic and permitted cosmetic tasks before making quality claims. A real-service mode must fail explicitly when configuration is missing, never silently use mock outputs.

Untrusted text, photos, OCR, reference links and catalog content cannot override rules or grant authority. Use scoped credentials, strict schemas, private storage, URL allowlists, upload validation and output sanitization. Separate dev/staging/production; avoid real customer material in evaluations unless separately authorized and protected.

## Completion report

State exact commit/files, checks run and not run, conflicts, remaining dependencies and next gate. Do not describe a self-review as independent. A 40-test policy pass is not the G01-G13 production release. No real model/vision/provider test has run merely because the prompt and fixtures exist.
