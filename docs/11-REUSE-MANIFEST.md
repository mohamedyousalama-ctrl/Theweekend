# 11 — Reuse candidate manifest and local ownership

**Status:** candidate plan only. No files have been copied, no dependencies audited and no extraction tests run in this revision. This is not a claim of completed reuse.

## Decision

The Weekend stays completely standalone. Reuse means selected reviewed source or general engineering lessons become Weekend-owned local components; it does not mean a shared live Kivo engine, database, API, customer memory or release dependency. The latest founder direction overrides the earlier possible future shared-package suggestion for this implementation.

Do not require a third repository or generic multi-industry platform. Do not import the whole restaurant application or rename its order/cart concepts into appointments.

## Candidate inventory

The following paths come from the earlier source inspection at MaitreAI commit `5720610c9d1e4a6e0de6680a4d2579a150787f39`. They are provenance pointers, not a fresh audit, approval or guarantee they remain suitable.

| Source candidate | Intended treatment | Must establish before copying |
|---|---|---|
| lib/ai/llm/types.ts | Candidate local model/tool contracts | Actual dependencies; adapt use cases; provider compatibility |
| lib/ai/llm/index.ts and adapter modules | Selectively adapt routing/testing pattern | No silent production mock; no inherited credentials/model prices/config |
| lib/ai/personas/khalid.ts | Curate Saudi-language register; new Rakan persona | Remove food/order claims, invented confirmations and biography; native review |
| lib/ai/personas/khalid-playbooks.ts | Reference behavioral patterns only | Rewrite for styling/customer choices; remove restaurant policy assumptions |
| lib/ai/personas/khalid-dialect-linter.mjs | Candidate evaluation helper | Allowed language switching, no rigid rejection of customer dialect |
| lib/ai/human-request.ts | Candidate explicit-request detector | Remove restaurant imports; expand Rakan handoff policy separately |
| lib/ai/image-perception.ts | Reference adapter/media plumbing only | New cosmetic schema, genuine image quality/uncertainty, retention/permissions |
| lib/messaging/respond-and-send.ts | Inspect selected send/ownership/idempotency ideas | Dependency closure; no restaurant persistence or production connection |
| lib/ai/customer-turn.ts and lib/ai/prompt.ts | Architecture reference, not wholesale import | Restaurant coupling is substantial; build small Weekend orchestration |
| Existing test patterns and language material | Reuse only suitable rights-cleared portions | No customer data, confidential content or invalid inherited assertions |

Forbidden imports: production credentials, restaurant/customer/booking exports, food knowledge, shared memories/indexes, voice donor recordings/provider voice IDs without separate rights, live endpoints, database migrations for unrelated restaurant operations and default-on legacy feature flags.

## Per-import record

Each actual import needs source owner/repository, immutable commit, path/blob hash, license/rights review, destination, transitive dependencies, intended behavior, local modifications, tests retained/added, known defects, security review and responsible maintainer. Source familiarity or public visibility is not proof of reuse rights. Keep attribution/license notices as applicable.

A candidate becomes `approved_for_import` only after review, then `imported_unverified`, then `verified_local` after its tests. Record rejected candidates too. Never report a reuse percentage before mapping the actual dependency graph and running the extraction check.

## Extraction proof

Choose one small useful unit; read source and tests; remove restaurant/environment coupling; give it a Weekend namespace and explicit injected interfaces; run unit tests with no Kivo secrets or network access. Prove the build starts without any sibling checkout or Kivo resource.

Check lockfiles, environment examples, URL literals, database identifiers, imports and test fixtures for hidden source-project coupling. A grep alone is insufficient: verify actual network and access boundaries in the authorized environment. New booking/styling/product logic and its tests remain Rakan-specific.

## Update policy

After import, The Weekend's local component is its source of truth. External fixes are advisory input, manually reviewed and independently tested before local adoption. No tracking of a moving branch, silent remote import, submodule, shared runtime or automatic deployment coupling.

A future shared library would require a separate explicit decision and must not become an unstated dependency now. Source reuse can save engineering effort without sharing operational data or control.
