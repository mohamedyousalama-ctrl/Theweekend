# 04 — Booking state, payment separation and tool contracts

**Proposed application contracts.** They are not implemented endpoints and are not claims about any booking provider. Validate actual provider semantics before mapping these states.

## 1. Core invariants

A suggested service is not a quote. A quote is not a hold. A hold is not a booking. A selected time is not confirmation. A payment link is not payment. A payment screenshot is not a verified payment event. A successful appointment write is not proof that its notification or style attachment succeeded.

Only a verified authoritative appointment record with the required booking conditions satisfied permits the phrase 'your booking is confirmed'. The provider ID, customer, branch, service, staff and exact start must match the confirmed proposal.

The customer must approve creation, material changes, cancellation and paid additions. Reads and proposals do not authorize writes. Identity and ownership are enforced server-side, never by trusting a phone number typed into a chat.

## 2. Logical booking state

| State | Meaning | Permitted customer message |
|---|---|---|
| `DRAFT` | Incomplete or unquoted request | Discuss preferences; no promise of price/slot |
| `QUOTED` | Validated basket and currently offered slot, with expiry | Offer the exact details and terms; disclose that final confirmation is pending |
| `HELD` | Provider-supported temporary reservation | State hold and actual expiry; not confirmed |
| `AWAITING_CUSTOMER_CONFIRMATION` | Summary shown; customer has not approved | Ask for explicit approval |
| `SUBMITTING` | Authorized operation dispatched | Say the request is being processed; do not encourage another payment/write |
| `PENDING_PROVIDER` | Provider accepted processing but not confirmed | Report pending state accurately |
| `AWAITING_REQUIRED_PAYMENT` | Provider requires verified payment before final confirmation | Explain actual deposit/payment terms and secure route |
| `CONFIRMED` | Authoritative confirmed appointment, with required conditions met | Return provider reference and complete appointment details |
| `UNKNOWN_OUTCOME` | A write may have succeeded but response is unavailable/ambiguous | Say confirmation is unverified and reconcile before retry |
| `REJECTED` | Provider rejected the request without a booking | Explain the valid reason and offer a new proposal |
| `EXPIRED` | Quote/hold no longer valid | Refresh price/availability and request fresh approval if material details change |
| `CANCELLED` | Authoritative cancellation established | Confirm cancellation and separate any refund state |
| `COMPLETED` / `NO_SHOW` | Provider/staff-recorded outcome | Trigger appropriate permitted follow-up; do not infer merely from the clock |

Quote, hold and confirmation may be separate records in the implementation; this is an external behavior model, not a command to force every provider into one linear database enum.

### Permitted path

`DRAFT -> QUOTED -> [HELD only if supported] -> AWAITING_CUSTOMER_CONFIRMATION -> SUBMITTING -> provider-specific pending/payment states -> CONFIRMED`

Any uncertain write result becomes `UNKNOWN_OUTCOME`. Only reconciliation establishes success/failure. Never blindly restart the path with a new idempotency key. Cancellation is an independent authorized operation on an existing booking.

## 3. Appointment proposal

Before approval, show a summary containing:

- authoritative service/variant and branch;
- exact local date/time and timezone context;
- assigned staff or truthful 'eligible available staff' policy;
- expected service duration and relevant buffers;
- total in the correct currency, tax-display treatment, deposit and remaining balance;
- approved cancellation/no-show terms and any required customer fields;
- the active mode: integrated booking, request-only assistance or synthetic demo.

Use IDs rather than matching staff/service names at write time. Represent money in integer minor units. Do not let the model calculate final totals, apply a discount or activate an entitlement outside approved deterministic rules.

If date, service, price, staff, branch or material terms change after approval, obtain new approval. A reply such as 'the cheaper one' can select an option but does not waive confirmation of a changed basket.

## 4. Payment state is separate

Possible payment states: `NOT_REQUIRED`, `REQUIRES_ACTION`, `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `REFUND_PENDING`, `REFUNDED` and `DISPUTED`. Map these to verified provider definitions.

Use a merchant-approved hosted payment route. Never ask for full card details, banking credentials or an OTP in chat. No credentials or raw payment payloads go to the model or public logs.

A verified payment success can coexist with a pending/rejected appointment. Create a reconciled recovery case; do not charge again or claim the booking exists. A cancelled appointment can coexist with `REFUND_PENDING`; never say refunded until the payment source confirms it.

Refund initiation requires the merchant's permissions and approved policy. An unauthorized assistant can create a refund-review request, not promise or execute compensation.

## 5. Proposed response envelope

```json
{
  "ok": true,
  "status": "CONFIRMED",
  "operation_id": "op_synthetic_001",
  "idempotency_key": "idem_synthetic_001",
  "provider_reference": "booking_synthetic_001",
  "version": 1,
  "source": "sandbox_fixture",
  "observed_at": "2026-09-13T18:00:00Z",
  "expires_at": null,
  "data": {},
  "error": null
}
```

All values above are synthetic; this is not evidence of a booking. Real envelopes contain only fields the caller is allowed to receive. The server supplies authoritative time/source metadata.

Failure responses include a stable error code and retry semantics. Examples: `UNAUTHORIZED`, `OWNERSHIP_MISMATCH`, `CONSENT_REQUIRED`, `UNSUPPORTED_OPERATION`, `QUOTE_EXPIRED`, `SLOT_TAKEN`, `PRICE_CHANGED`, `OUT_OF_STOCK`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE` and `UNKNOWN_OUTCOME`.

The application decides whether retry is safe. A model must not interpret an English error message as permission to change IDs, loosen authorization or retry an uncertain write.

## 6. Proposed tool surface

| Tool | Purpose | Required constraints |
|---|---|---|
| `get_customer_profile` | Read permitted preferences/history | Verified subject and scoped fields; do not expose unrelated records |
| `update_customer_preference` | Save a confirmed preference | Purpose/permission, provenance, expected version and minimal value |
| `get_branches` | Approved location/hours/service coverage | Current effective version and allowed customer-facing fields |
| `get_services` / `get_service_price` | Approved service details | Exact variant/branch; final price comes from quote when available |
| `get_barber_profiles` | Eligible staff/approved skills | Branch/service scope, approved public fields only |
| `get_available_slots` | Query eligible times | Service duration/resources/timezone; availability timestamp and expiry |
| `create_booking_quote` | Calculate a complete basket | Server-owned prices, currency, deposit, terms and expiry |
| `hold_slot` | Optional temporary provider reservation | Only if provider supports it; real expiry; no local fake hold |
| `create_booking` | Execute approved proposal | Subject ownership, unexpired quote, confirmation receipt, idempotency key |
| `get_booking` / `reconcile_operation` | Establish actual outcome | Ownership and provider correlation; no duplicate creation |
| `modify_booking` | Change an existing appointment | Fresh quote, customer approval, expected version and safe provider semantics |
| `cancel_booking` | Cancel the owned appointment | Applicable fee/terms, approval, version and idempotency |
| `get_payment_status` | Read payment/refund status | Verified server/provider record, not screenshot interpretation |
| `get_products` | Approved cosmetic catalog | Exact variant, approved claims/label warnings |
| `check_product_inventory` | Branch stock view | Timestamp, quantity/status scope and uncertainty |
| `reserve_product` | Optional real pickup reservation | Supported adapter, exact SKU/branch/expiry and approval |
| `get_memberships` | Read approved terms/entitlement | Version, effective period and eligibility |
| `calculate_membership_savings` | Compare the same intended services | Deterministic arithmetic with caps/fees/assumptions; no inferred entitlement |
| `record_consent` / `withdraw_consent` | Manage purpose-specific permission | Notice version, scope, identity, timestamp and revocation enforcement |
| `save_style_reference` | Save an optional permitted reference | Media-purpose consent, expiry, provenance and private storage |
| `share_barber_brief` | Send approved minimal staff instructions | Confirmed assignment, permitted fields/media and separate write receipt |
| `record_post_visit_feedback` | Store feedback about an actual visit | Owned completed booking, scale and purpose/retention |
| `create_human_handoff` / `get_handoff_status` | Queue and track staff support | Case receipt, priority, queue, ownership and truthful staffing status |
| `request_data_access` / `request_data_deletion` | Start verified rights handling | Identity checks, scope, downstream reconciliation and honest completion state |

Production schemas must reject unknown fields, malformed IDs, invalid dates and unsupported enum values. No generic `execute_sql`, unrestricted URL fetch or arbitrary backend method is exposed to the assistant.

## 7. Create operation protocol

1. Authenticate the incoming channel/session and bind the customer.
2. Validate all branch/service/staff IDs and resource constraints.
3. Read availability and an authoritative quote; create a real hold only if supported.
4. Present the summary and obtain a recorded approval tied to its hash/version.
5. Revalidate freshness and identity server-side.
6. Persist an operation record and stable idempotency key before dispatch.
7. Execute through the adapter and map the verified result.
8. Reconcile ambiguous results with the provider before deciding what happened.
9. Send confirmation only from the established state. Track notification delivery separately.
10. Share optional style material through a separate authorized tool and receipt.

## 8. Concurrency and event safety

Two customers may select the same slot. Only the authoritative scheduler can allocate it. Use provider concurrency controls and unique operation IDs; a local calendar or cached list cannot guarantee exclusivity.

Handle duplicate channel messages, repeated taps, webhook replays, retries and out-of-order events. Verify webhook authenticity using the provider's actual supported mechanism. Dedupe event IDs and prevent stale events from downgrading a later confirmed/cancelled record. Maintain a reconciliation queue for discrepancies.

Check clock/timezone normalization, Arabic numerals, AM/PM ambiguity, branch exceptions, holiday hours and combinations of services. Do not derive availability only from opening hours.

## 9. Rescheduling and cancellation

Preserve the old confirmed booking until a safe replacement/amendment has succeeded. Do not cancel first and hope a new time remains available. If the provider cannot perform the change safely, disclose the constraint and use a staff-mediated flow.

Read the current booking version, show changed details and any fee, obtain approval and execute once. A failed modification leaves the original booking unchanged unless provider evidence proves otherwise; uncertain outcomes require reconciliation.

Cancellation confirmation reports the actual booking state. Refunds, membership-credit restoration and notifications each have their own state and receipt.

## 10. Request-only mode

If live writes are unavailable but the brand has authorized customer use, create a request in a staffed queue. State that the appointment is not yet confirmed. Staff must enter/verify the booking in the authoritative platform and return a real reference before the system sends confirmation.

No automatic 'تم الحجز' message after a form submission. The customer can follow the official self-service route instead. Queue age, staff acceptance and failed notifications must be visible to operators.

## 11. Audit record and security

Record operation type, pseudonymous customer ID, approved proposal/version, actor, authorization outcome, provider correlation, timestamps and final state. Retain redacted evidence required to explain a decision, not hidden model reasoning, raw credentials or unnecessary photos.

Enforce least privilege, per-customer/branch access and service-account separation. A prompt injection in a product description or photo cannot change tool scope. Staff overrides require identity, reason and audit history.

## 12. Minimum failure tests

Expired quote; slot taken after selection; repeated confirm message; timeout after provider success; successful payment with failed booking; duplicate/out-of-order webhooks; cancellation fee change; wrong-customer ID; reschedule failure preserving old appointment; stock reservation failure; notification failure after success; and successful booking with failed photo attachment.

All require deterministic expected results and a truthful customer message. See [07](07-ACCEPTANCE-AND-METRICS.md) for the acceptance register.
