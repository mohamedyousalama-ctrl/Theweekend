# 03 — Business truth and integration

**Status:** design and discovery requirements. No tenant/API access or production capability has been demonstrated.

## Public observations versus operational truth

The accessible Arabic homepage describes grooming, memberships and product categories. That supports the broad concierge concept, not a complete sellable catalog. The site indicates branch enrollment for family membership; current details still require merchant confirmation. [S01 in 09]

English and subsidiary-page retrieval was incomplete in this pass. Do not infer closure, absence of services, current payment methods or booking availability from a failed or empty fetch. Earlier claims about exact branches, barber skills, BATCI inventory, review scores, donation-per-haircut and interiors are not approved knowledge.

Rekaz publishes developer documentation, a merchant API offering and key-handling guidance. Treat it as an integration candidate, not as confirmed evidence of The Weekend's provider or enabled endpoints. The owner/authorized administrator must identify the actual booking tenant and supported workflow. [S02, S03]

## Authority order

| Fact type | Authoritative source | Fallback |
|---|---|---|
| Booking state and live availability | Authorized provider record/API or explicit staff action entered into that provider | Request-only mode; never infer confirmation |
| Service/variant price and deposit | Approved provider quote or current approved merchant catalog with clear scope | Ask staff; no invented total |
| Branch hours, temporary closure and service eligibility | Merchant-approved branch configuration, with time-specific overrides | Approved contact/official booking route |
| Stock or reservation | Branch-level inventory/reservation source, with freshness | State that stock needs confirmation; do not promise readiness |
| Product characteristics and warnings | Approved manufacturer label plus merchant verification of the exact variant | No unsupported suitability/medical claim |
| Membership benefits and enrollment | Versioned merchant terms and provider entitlement record | Explanation/request only |
| Barber capabilities | Brand-reviewed skills and service permissions | Offer neutral eligible choices |
| Customer preferences | Current explicit customer request, then confirmed stored preference | Ask; do not guess |
| General brand story | Merchant-approved copy | Public pages as research only |

When sources conflict, block the affected promise and create an internal discrepancy. The LLM does not resolve a price conflict by choosing the lower number or treating the newest-looking webpage as authoritative.

## Canonical records

### Common fields

Every operational record has an internal ID, provider/external ID where applicable, branch/tenant scope, active status, source reference, approval owner, version, effective period and last-verified timestamp. Raw credentials never appear in the record returned to the model.

### Branch

Name and customer-facing spelling; address/map link; timezone; regular hours and exceptions; contact; enabled services; booking policy; supported languages/accessibility facts; approved directions. Precise customer location is optional and not persisted by default.

### Service

Service and variant IDs; Arabic/English labels; description; eligible branches/staff; duration; cleanup/setup buffer; resource needs; price in integer minor units and currency; tax-display treatment from merchant settings; deposit; age/guardian constraints where applicable; staff-review flags; contraindication/precaution copy approved for that service.

A category such as hair care is not a bookable SKU. Two combined services may require different staff or resources; never simply add their durations without approved scheduling rules.

### Barber

Provider staff ID; approved public name; assigned branches; service eligibility; languages; verified skill tags; schedule/leave; approved profile text. Keep employee contact, private metrics and HR data out of customer output. No demographic guessing.

### Product

SKU/variant; exact brand/name; approved images; category; size; current price; currency/tax display; label source; ingredients where supplied; manufacturer warnings/directions; documented hold/finish; approved cosmetic claims; stock source; reservation support; discontinued flag. Unknown fields remain unknown.

### Membership/promotion

Version and effective dates; eligibility; fee/renewal; included services; usage caps; excluded branches/times; validity/expiry; booking restrictions; transferability; refund/cancellation; permitted enrollment method; stacking rules. An advertised 'from' price is not a final quote.

### Customer/preference

Channel/account binding; internal customer ID; confirmed preferences; consent receipts; provenance; timestamps; revocation/deletion state. Financial/booking records remain in their appropriate system. Do not use generic conversation summaries as the identity source.

## Integration capability discovery

Before selecting a booking mode, an authorized test must establish:

| Capability | Evidence required |
|---|---|
| Merchant ownership and API scopes | Approved account owner, credentials stored privately, read/write scope inventory |
| List branches/services/staff | Sample sanitized responses and verified ID mapping |
| Query availability | Timezone, duration/resource constraints, freshness, pagination and failure behavior |
| Quote price/deposit | Exact basket, tax display, promo/membership handling and expiry |
| Hold a slot | Whether supported; actual expiry and release semantics |
| Create/read booking | Required fields, provider status meaning, reference, idempotency behavior |
| Amend/cancel booking | Ownership, cutoff/fee rules, atomicity and old-record preservation |
| Payment | Hosted route, verified events, refund responsibility and mismatch reconciliation |
| Webhooks | Available event types, authenticity verification, retry/order/replay behavior |
| Stock/reservation | Branch granularity, freshness, expiry and transactional guarantees |
| Customer/history access | Lawful basis, data minimization, identity linking and allowed operations |
| Rate limits and sandbox | Documented quotas, safe test tenant and support contact |

Do not fabricate endpoint names from a provider marketing page. The proposed tool names in [04](04-BOOKING-STATE-AND-TOOLS.md) belong to our adapter, not necessarily to the provider API. No credentials were requested or created for this documentation review.

## Three truthful operating modes

**DEMO:** synthetic fixtures only, visibly labeled. No live appointments or merchant claims. Suitable for prompt/evaluation development after separately authorized.

**REQUEST_ONLY:** authorized customer-facing assistance using an approved catalog, with staff completing the actual booking in the authoritative system. Rakan says 'request received', not 'booked'. The staff queue, service hours and confirmation path must be functioning. A request is not a hidden parallel booking ledger.

**INTEGRATED:** live reads and writes demonstrated and tested. The provider remains booking/payment truth. Unsupported amend/cancel/reservation functions still route to staff; enabling one API does not enable every feature.

The interface and response policy must expose the active mode. Never silently fall from integrated booking to a fake success in request-only mode.

## Architecture recommendation

Start with one application and these logical responsibilities:

`Channel adapter -> authenticated conversation session -> orchestrator -> permission/state gate -> typed tool adapters -> authoritative systems`

Supporting components: a versioned approved knowledge store; optional private style preferences; a secured media pipeline; a real staff inbox; consent/deletion operations; minimal audit/event logging; and a test harness.

The language model drafts replies and recommends tool calls. Server code decides access and state transitions. Vision produces structured cosmetic observations, never booking authority. A policy check validates outgoing factual claims against the supporting tool response.

Do not build twelve autonomous agents for the named components. Separate them into deployable services only when load, isolation or ownership justifies it. A production model, database, hosting region and messaging provider are deliberately not selected here.

## Provider/model selection criteria

Evaluate candidates on Saudi Arabic task success, instruction adherence, grounded tool use, cosmetic-image reliability, latency, controllable data handling, export/deletion, vendor support and cost. Test the real utterances and failure cases rather than selecting a vendor from marketing benchmarks.

Review processor terms, subprocessor locations, retention, optional training uses and cross-border transfer implications before customer data is sent. A Saudi application server does not prove that all model/media processing stays in Saudi Arabia. More controls are in [06](06-PRIVACY-SECURITY-AND-HANDOFF.md).

## Knowledge freshness and change control

Dynamic facts such as a slot, deposit or stock availability are read at the moment of the action and revalidated before commit. Stable approved brand copy can be cached with versioning. Configure source-specific validity rather than pretending one global cache timeout fits every fact.

The brand needs an owner for catalog/policy corrections, branch closures and staff absence. Editing a fact creates a version and invalidates dependent stale quotes. Require audit history and rollback for merchant changes; do not edit prices directly through a customer chat prompt.

## Unit economics to measure later

Measure cost per conversation, consultation, confirmed appointment and attended appointment. Include text/vision use, messaging, image storage, human handling, integration maintenance, payment/provider fees where applicable and future preview-generation cost.

Set upload-size limits, consultation frequency caps and model/media budgets before launch, with a helpful text-only fallback. Exact limits must be based on provider measurement and usability tests; none are represented as validated in this baseline.

Sources: [09 — Evidence register](09-SOURCES-AND-EVIDENCE.md). Related: [Transactions](04-BOOKING-STATE-AND-TOOLS.md), [Privacy](06-PRIVACY-SECURITY-AND-HANDOFF.md), [Inputs](08-DELIVERY-PLAN-AND-INPUTS.md).
