# The Weekend / Rakan - execution plan

**Recorded:** 13 September 2026. **Control issue:** [#2](https://github.com/mohamedyousalama-ctrl/Theweekend/issues/2).
**Status:** planning artifacts and work assignments created; the new application is not built, deployed or released by this plan.

## 1. Decision and immediate outcome

Deliver a working, access-controlled Rakan agent that Mohamed can show **Khalid, The Weekend owner**. The owner is not the earlier Khalid restaurant-agent project. Keep Rakan and all Weekend source, knowledge, data, credentials and deployment completely independent of Kivo.

M1 is the real agent and a small connected staff experience, not the entire long-term barbershop platform. Use real configured conversation and permitted cosmetic image analysis. No scripted responses masquerading as real inference. Synthetic transaction tests stay separate.

**Integrate our components now; integrate external POS/booking systems later.** An allowlisted existing official booking page is a valid first handoff; a link click is not a booking. A genuine staffed pending-request workflow is optional when authorized. No competing scheduler, invented live slots, guessed checkout links or merchant write access are required for M1.

## 2. One project-management home

GitHub Issues and pull requests are the execution record for this iteration. No parallel Linear tracker. This file indexes decisions and scope; issue #2 records current coordination and individual issues hold task status/evidence. M0-M3 below are planning phases, not claims that native GitHub Milestones or a Projects board were configured.

Role names A/B/C are responsibility assignments, not GitHub user assignments or proof that Claude Code/Grok have received instructions or started. Human handoff of these issue instructions is needed unless an actual authorized worker dispatch is performed.

## 3. Research disposition

Claude Code's pasted report is useful research input, not independently verified operational truth. Its raw catalogue, endpoint receipts, counting method and pending auditor/native-review verdicts were not supplied with the message. Do not repeat the whole failed research fan-out. Task #4 collects the useful existing evidence.

| Reported point | Decision |
|---|---|
| Five branch records, twenty named barbers, different prices | Preserve as collaborator-reported pending sanitized evidence. Use branch-aware data and barber preference; do not seed exact numbers or names merely from prose. |
| 361 written reviews and repeated barber mentions | Treat as a sample-based hypothesis for continuity, not proof all customers prioritize a barber or that mention counts establish skill. |
| Waiting 15-30 minutes is the only complaint | Potential service issue to investigate, not a universal conclusion. Do not promise no waiting or invent a wait estimate. |
| autoApprovalMinRating: 5 | At most evidence about an auto-approval threshold once its context is verified. It does not alone prove no manual approvals/replies, a fabricated score, or suppression of every lower review. |
| Weekly hours, breaks, iCal and a slot request format | Later integration evidence only. Hours/calendars do not prove service-specific live bookability. No collection/publication of appointment-bearing feeds or their tokens. |
| Existing official booking page | Good initial external handoff after URL verification. No confirmation or transaction inference from opening it. |
| Khamees as name/head of reception | Optional naming alternative for the owner. Keep Rakan now; do not invent a human staff biography or assume a name never overlaps staff. |
| B5 shampoo and dandruff sessions as preferred treatment | Reject the medical recommendation. Catalog presence/name does not prove therapeutic benefit or superiority. Approved cosmetic information and professional assessment remain distinct. |
| Three visits means the 169 membership saves money | Reject the blanket claim. Conditional arithmetic using the report's unverified figures: 3 x 25 = 75; 3 x 30 = 90; 3 x 50 = 150; 3 x 60 = 180. Savings require the same included services, branch, fees, caps and terms. Membership automation is deferred. |
| Photo read once and immediately deleted | Do not promise this before verifying storage, provider logs, staff copies, backups and deletion. Owner approval is not the subject's permission. |
| Do not read anyone who looks under 18 | Do not estimate age from appearance. Use declared/verified workflow status; unknown/child status pauses photo inference, not text help. |
| Every face photo is sensitive data under PDPL | Too broad as a legal conclusion. Identifiable photos are personal data; sensitive biometric/health classification depends on processing/content. Protect optional media strictly and review the actual data flow. No legal-compliance certification here. |
| Build under MaitreAI/app/weekend and reuse live kill-switch row | Rejected: conflicts with explicit standalone decision. Selected reviewed code may become Weekend-owned local code; no Kivo runtime, account, table, key or deployment dependency. |
| Scarcity nudge after 'let me think' | Reject pressure and invented availability. Offer a neutral optional next step and accept refusal. |

Outside reference checks in this planning pass: AAD dandruff guidance supports distinguishing documented treatments from generic product marketing; SDAIA's public terminology distinguishes identifying biometric/health data in the sensitive-data definition; GitHub's issue documentation supports task/dependency tracking. These checks do not verify the shop's catalogue or tenant. The public homepage was readable; direct Rekaz getting-started retrieval failed in this pass. No live merchant API or calendar was accessed.

Reference pointers:
- https://www.aad.org/public/everyday-care/hair-scalp-care/scalp/treat-dandruff
- https://dgp.sdaia.gov.sa/ (official law/regulation and terminology; actual assessment remains open)
- https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/about-issues
- https://theweekendhairstyling.com/
- https://docs.rekaz.io/docs/getting-started (retrieval limitation above)

## 4. M1 owner-review journey

Real conversation -> optional permitted adult-photo consultation -> two feasible aesthetic choices -> customer selection -> relevant verified product/service information or honest unknown -> approved brief -> same brief in authenticated staff session -> opt-in text preference survives refresh -> official booking handoff or enabled pending request.

Direct-booking assistance can skip photos, consultation, memory and products. 'Same as last time' needs a verified executed-style record; a chosen preference is not past execution. No diagnosis, identity inference, attractiveness scoring, automatic photo retention or fabricated transaction.

Customer and staff views share persistent authorized records, not unrelated browser simulations. Product advice is present when approved data supports it, not invented to fill a screen. Unknown product attributes or medical concerns suppress affected recommendations.

## 5. Visual contract

The owner's Claude Design HTML remains the appearance reference: dark navy `#07090F`, red `#E11D2E`, Arabic typography, RTL, rounded cards, spacing, navigation and wordmark treatment. Preserve the original separately. Gold screenshots contribute concise brief/completion controls, not a gold theme.

Its custom support.js/DCLogic behavior must be ported, not assumed to be a deployed app. Do not preserve fake recognition success, mandatory front photos, default happy ratings, false saves, private information on public kiosks, or synthetic branch/health data as real functionality.

M1 adds customer chat plus a small staff brief/inbox and minimal preferences. Reception/full profiles/visit capture are mapped but deferred to M2. No dead operational buttons presented as finished functionality.

## 6. Three parallel paths

| Path | Role owner | Issues | Exclusive implementation territory |
|---|---|---|---|
| A | Claude Code | [#4 evidence](https://github.com/mohamedyousalama-ctrl/Theweekend/issues/4), [#5 agent](https://github.com/mohamedyousalama-ctrl/Theweekend/issues/5) | src/agent, prompts, knowledge, tests/agent, own research folder |
| B | Grok | [#6 interface](https://github.com/mohamedyousalama-ctrl/Theweekend/issues/6) | src/ui, styles, tests/ui, design/implementation-notes |
| C | ChatGPT | [#3 foundation](https://github.com/mohamedyousalama-ctrl/Theweekend/issues/3), [#7 platform](https://github.com/mohamedyousalama-ctrl/Theweekend/issues/7) | src/contracts, src/server, src/domain, db, internal adapters, routes/composition, root config/lockfiles, design/reference, integration tests |

A returns model/vision behavior against trusted contracts. B renders them using the approved design. C binds identity, storage, consent, actions and both surfaces. No stream implements a second copy of another stream's responsibility.

Research salvage, UI mapping and foundation checks can begin concurrently. Application code begins from the immutable shared base/contracts published in #3. A/B do not independently redefine API shapes or package versions. Contract/root changes require C's coordinated update and notice to both streams.

Suggested working branches: work/a0-evidence, work/a-rakan-agent, work/b-rakan-ui, work/c-rakan-platform. Names are plans until created by the relevant task, not claims of launched workers.

## 7. Small milestones, strict priority

| Phase | Outcome | Tracking |
|---|---|---|
| M0 | Baseline acceptance, design custody, contracts and dedicated configuration | #3 and #4 |
| M1 | Real owner-review agent, cosmetic consultation, choices, saved preferences, staff brief | #5, #6, #7; acceptance #8 |
| M2 | Approved one-branch arrival, chair, actual completion and next-visit memory | #9 |
| M3 | Authorized external POS/booking/WhatsApp connections, then phased branch expansion | #10 |

M2/M3 must not consume M1's critical path. Voice, photorealistic previews, full memberships, campaigns, elaborate dashboards and all-branch rollout wait. Do not reinterpret phased delivery as abandoning the full vision.

## 8. Evidence and coordination discipline

Issue states in text: READY / IN_PROGRESS / BLOCKED / REVIEW / ACCEPTED. Claim the task before editing and report exact base/head, changed paths, tests/results, not-run checks, dependencies and next handoff. Report a blocker when discovered, not after finishing incompatible code.

Cross-review: Grok reviews A's behavior/requirements, Claude Code reviews C's platform/security, ChatGPT reviews B's fidelity/integration. This does not substitute for qualified native/grooming review. Nobody calls their own implementation independently approved.

Before merging, re-read main and affected branches, compare file changes, preserve concurrent work, run integrated tests. No force push, blanket tree replacement or automatic production deployment. A mergeable PR is not a tested product. CodeRabbit had skipped PR #1 because it was draft; no independent PASS is inferred.

## 9. Owner-review acceptance

[#8](https://github.com/mohamedyousalama-ctrl/Theweekend/issues/8) requires the real walkthrough, actual model/photo tests on permitted inputs, design comparison, cross-session authorization, explicit unavailable states, persistence, consent/revocation checks and correct handoff semantics. Record latency/cost and failures separately. Synthetic tests do not prove language or vision quality.

Configuration blockers: dedicated credentials/model selection, approved spend limit, hosting/store access, privacy/retention settings, one-branch source pack and permitted test images. Never copy Kivo credentials to solve them. Without real model or vision, report that capability as incomplete; do not silently supply demo answers.

A restricted owner-review version is not an unrestricted customer release. No claim of a signed brand partnership, licensed clinical advice, completed PDPL assessment, live availability or confirmed appointments without the corresponding evidence.

## 10. Exact initial handoffs

**Claude Code:** read #2, #4 and #5. Hand back the completed research evidence only under #4, then implement A after #3 publishes contracts. Keep the work outside MaitreAI; no new research fan-out or provider integration on M1's path.

**Grok:** read #2 and #6. Map and port the supplied HTML within B's scope. Preserve design, implement meaningful actions/error states, and wait for #3's API contract before binding live behavior. Do not rewrite agent/server files.

**ChatGPT:** coordinate #2, complete #3, then #7; integrate A/B and collect #8 acceptance. Keep main and concurrent branches intact. The present planning turn creates assignments, not autonomous background execution.
