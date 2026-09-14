# 14 - Reconciled review and implementation amendments

Review date: 2026-09-13. Base: `517272d31280515b75a7d6a1b8b74cb49742d055`.
This is an assistant-led review of the changes attributed to Grok by the owner, not an independent security, clinical or production certification.

## Custody and scope

The review started when main was `bef0c3a...` (11 files). It advanced to `517272d...` (13 files) during inspection as docs 09 and 10 arrived. The pasted seven-file review describes an earlier snapshot. All six new documents 05-10 are retained byte-for-byte on this review branch. Nothing on main is overwritten or force-pushed.

Our earlier commit `9152e1d099b8ed3efc937bdb9792416a19fceb7a` exists but is not an ancestor of the inspected main history. Do not cherry-pick it wholesale over Grok's documents. Recover only the reviewed standalone/reuse decisions; rewrite next-action references to match the current test IDs.

To avoid two editors rewriting the same documents, the corrections below are the explicit normative amendment to the cited passages. On a conflict, this amendment governs only the listed topic; all other safety and transaction rules remain in force. README and AGENTS point here. A later document consolidation must preserve these corrections, not choose one author's whole version.

## Findings and decisions

| ID | Disposition | Correction or decision |
|---|---|---|
| CR01 | Keep | Grok's concise staff brief, executed-style provenance, direct-booking shortcut and minimal model tool surface are useful. |
| CR02 | Correct review | Kivo separation is intentional, not an accidental product remnant. Dedicated Weekend source, data, knowledge, credentials, channels and releases remain mandatory. Selected local source reuse is separately reviewed. |
| CR03 | Correct review | One pilot location is not inconsistent with multiple public branch labels. Adult-managed child booking is not permission for child-photo processing. Public marketing is not approved operational truth. |
| CR04 | Amend 08 section 6 | Separate build readiness from live release. Internal synthetic tests, prompt work and isolated domain components do not require a live WABA, staffing rota or production tenant. These remain gates before enabling affected customer-facing functions. No paid service, customer outreach or live data processing is authorized here. |
| CR05 | Amend 08 section 2 | Eight is a target for model-visible booking tools, not a cap on application controls. Consent, authorization, request queues, reconciliation, webhook verification and barber-brief receipts remain required even if implemented as deterministic application services. Product and photo capabilities are separately gated. |
| CR06 | Amend 06 section 3 | Booking reference plus last-visit date is not sufficient authorization. Require a verified subject-to-booking relationship server-side; sensitive recovery needs a secure, expiring, rate-limited challenge to a previously verified channel or approved staff verification. Never request banking OTPs in chat. Shared/reassigned accounts do not automatically reveal another person's history. |
| CR07 | Amend 05 sections 4 and 9 | A selected look creates a customer-confirmed preference, NOT a verified anatomical observation. Keep source image observations, customer reports, chosen style and confirmed executed style as distinct provenance types. |
| CR08 | Amend 05 sections 2 and 4 | Allow approximate visible proportions for cosmetic choices, without identity, ethnicity, attractiveness, disease or precise anatomical claims. Establish adult subject status from the permitted workflow, not by guessing age from a face. Unknown status pauses photo inference, not text-based help. |
| CR09 | Amend 05/06 retention | Do not promise global deletion 'after the turn' unless the actual storage, vendor, staff-copy and backup behavior supports it. Configure explicit retention per store; no durable photo history by default. Explain residual mandatory/vendor retention and require approved processing terms before optional photos. Withdrawal must be enforceable; an inaccessible deletion promise is not a control. |
| CR10 | Amend 07 metric table | Net cash collected = settled receipts minus completed refunds and settled chargebacks for the defined cohort/period. Do NOT subtract discounts again when already reflected in receipts. Cash collected is not accounting revenue or profit; disclose tax/fees separately and use matched appointment cohorts for attendance. |
| CR11 | Amend 09 evidence interpretation | The Winnipeg pin and donation line are collaborator-reported observations, not independently reproduced in this pass. Keep quarantined pending a saved public source and merchant verification. Public map data must never directly seed booking directions. |
| CR12 | Keep and clarify | No forced three-message ceiling. Fast path is desirable, but ambiguous 'after evening prayer', unverified identity, fees or pending payments need clarification. Cosmetic advice and real appointments need separate evidence. |
| CR13 | Licensing decision open | Do not attach MIT or another license merely because LICENSE is absent. Owner must choose reuse terms; existing third-party notices still apply. No source extraction is performed here. |
| CR14 | Capability, not theatre | Rakan should use real configured models and permitted images when enabled. Never pass scripted outputs off as live consultation. Synthetic policy tests remain necessary and do not prove the real model understands Arabic or analyses hair correctly. |

## Evidence check in this review

- Brand homepage: https://theweekendhairstyling.com/ - retrieved public text supports broad grooming, membership and product categories; it is not a verified price/staff/slot feed. Booking-page retrieval failed in this pass.
- Rekaz: https://docs.rekaz.io/docs/getting-started and https://docs.rekaz.io/docs/webhooks - official search-index excerpts retrieved; direct opens failed in this pass. They describe server-side credentials, hosted checkout and authenticated notifications. They do not establish merchant access or barber/resource scheduling for this tenant.
- WhatsApp: https://business.whatsapp.com/policy - retrieved policy requires permission, template/window compliance and clear escalation. It does not require that every escalation use an in-chat queue if another supported direct path is provided.
- Authorization: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html - retrieved guidance supports per-request, object-level, server-side authorization; a guessed lookup ID is not authority.
- Hair loss: https://www.aad.org/public/diseases/hair-loss/treatment/diagnosis-treat - public clinical education; no clinical protocol or medical diagnosis is implemented here.
- SDAIA: official indexed Implementing Regulation, knowledge-center `PDPL2` on https://dgp.sdaia.gov.sa/ - consent withdrawal procedures and downstream destruction obligations require a real implementation. This is not a legal compliance finding.
- Linktree and direct Meta interactive-message documentation were not successfully retrieved. No newly verified map address or native-button limit is claimed. Google review-policy direct retrieval returned 429; earlier review-integrity requirements remain product policy, not newly reverified evidence.

## Concrete work, not another roadmap

This branch adds a candidate Rakan system prompt, a clearly fictional catalog, a small dependency-free next-action selector and 30 synthetic scenario contexts with 40 Node unit tests. The selector has no network/transaction side effects and accepts only server-validated state. It is not the booking engine, an identity verifier, a medical guard or a model evaluation runner.

Checks: `node --test tests/*.test.mjs` passed 40/40 locally on Node v22.16.0. The natural-language lines are not interpreted by those tests. No real model, photograph, WhatsApp webhook, provider API, deployment, transaction, native-speaker panel or barber evaluation was run. Do not report the G01-G13 production gates as passed.

## Merge protocol and next bounded task

Do not merge while another writer owns overlapping paths. Fresh-read main, compare paths/blob hashes, reconcile any new changes and rerun checks. No force push, broad reset or automatic squash over concurrent work. This review is delivered as a pull request, not a deployment.

Next bounded build: connect a small web conversation surface to a chosen, approved model adapter and mocked transaction adapter, validate the candidate prompt and keep capability labels honest. Before real customer use: approved catalog/provider mode, brand authorization, reviewed privacy/retention, supported human route, native/barber review and passed transaction/security tests. Photo inference cannot be enabled merely because the UI has an upload button.
