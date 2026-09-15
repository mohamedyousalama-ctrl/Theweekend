# Rakan shared contract v0.1.0 — definitions

Consumers: A (agent) produces `ChatTurnOutput`, `CosmeticObservations`, `BarberBrief` drafts and `ModelUsageRecord`s; C (server) is the only producer of `TrustedContext`, `AllowedAction`, `PermissionReceipt`, `DeliveryReceipt`, `KnowledgeRecord` enablement and every persisted state; B (UI) renders what C sends and never invents ids, URLs, booleans or prices.

Conventions: JSON; `snake_case`; timestamps ISO-8601 UTC; ids are opaque strings issued by C (`ses_`, `sub_`, `act_`, `rcp_`, `brf_`, `kno_`, `use_`, `img_` prefixes); money as integer minor units (`amount_minor`, SAR); every top-level object carries `contract_version: "0.1.0"`. Unknown fields are rejected (closed schemas). Breaking change ⇒ bump to 0.2.0 and update fixtures.

## 1. TrustedContext (C → A, C → B) — session/capability snapshot

| Field | Type | Notes |
|---|---|---|
| `session_id` | id | |
| `subject_id` | id | the customer or staff member behind the session |
| `role` | `customer` · `staff` · `owner` | server-decided |
| `verified` | bool | passcode/session verified server-side; UI role checks are not authorization |
| `branch_id` | string \| null | the one M1 branch when known |
| `locale` | `ar` · `en` | |
| `capabilities` | object | `{ model: real\|mock\|unavailable, photo: enabled\|disabled, booking_handoff: official_link\|pending_request\|unavailable, staff_inbox: enabled\|unavailable, preferences: enabled\|unavailable }` |
| `consents` | PermissionReceipt[] (active only) | |
| `issued_at` | timestamp | |

## 2. ChatTurnInput (B → C → A)

`session_id`, `turn_id` (client-generated uuid, idempotent), `text` (string, 1–2000 chars, may be empty only when `client_action_id` or `image_ref` present), `image_ref` (id \| null; a C-issued scoped upload id, never a URL), `client_action_id` (id \| null; an `AllowedAction.action_id` the user clicked), `locale_hint` (`ar` \| `en` \| `auto`).

## 3. ChatTurnOutput (A → C → B)

| Field | Type | Notes |
|---|---|---|
| `turn_id` | id | echoes input |
| `state` | `ok` · `unavailable` · `error` | `unavailable` carries `ErrorShape` with a capability code; UI shows an honest state |
| `messages` | `[{ text, lang }]` (1–3) | customer-facing text; no markdown tables |
| `observations` | CosmeticObservations \| null | only when an image was permitted and supplied this turn |
| `style_options` | StyleOption[] (0–2) | `{ option_id, name_ar, name_en, why_ar, upkeep_ar, feasible_in_person: true\|unknown, reference_kind: none\|public_style }` |
| `proposed_actions` | `[{ kind, label_ar, label_en, payload }]` (0–3) | **proposals**; C converts accepted ones into `AllowedAction`s bound to a real object id+version. `payload` may include `preference_id`, `brief_id`, `image_ref`, `option_id`, and for a new save, `preference_kind` + `value_text`. |
| `knowledge_refs` | id[] | every merchant fact used must reference an enabled `KnowledgeRecord`; ungrounded price/staff/stock claims fail validation |
| `brief_draft` | BarberBrief (status `draft`) \| null | |
| `usage_ref` | id | the `ModelUsageRecord` |
| `flags` | string[] | e.g. `refusal_medical`, `injection_suspected`, `handoff_requested`, `no_offer_after_decline` |

## 4. CosmeticObservations (A) — separate from preferences

`image_ref`, `observed: { hair_length: short\|medium\|long\|uncertain, hair_texture: straight\|wavy\|curly\|coily\|uncertain, beard: none\|stubble\|short\|full\|uncertain, top_density_visible: full\|thinning_visible\|uncertain, face_visible: full\|partial\|covered }`, `limitations` (string[] — lighting, angle, blur, covered), `confidence: low\|medium\|high`, `not_inferred` (constant array `["identity","age","ethnicity","health","attractiveness","gender"]`, always present so the UI can show the limit), `retention: ephemeral\|stored_with_receipt` (set by C, not A).

## 5. Preference (text only, C persisted)

`preference_id`, `subject_id`, `kind: style\|barber\|branch\|do_not\|note`, `value_text` (≤ 300), `source: customer_typed\|customer_selected\|staff_recorded`, `provenance: proposal\|approved_preference\|executed_result` (M1 never writes `executed_result`), `version`, `created_at`, `revoked_at` \| null. Retention key `ret_text_prefs_v1`: C revokes rows 90 days after last activity. Listing never returns expired rows.

## 6. KnowledgeRecord (A authors, C enables)

`knowledge_id`, `kind: branch\|service\|price\|addon\|product\|membership\|policy\|staff\|claim\|faq`, `branch_id` \| null, `ref` (product/price/provider id from evidence or null), `text_ar`, `text_en`, `source` (evidence id like `E03` or `owner-2026-09-20`), `source_hash` (SHA-256 of the raw response or document), `status: collaborator_reported\|verified_public\|merchant_approved\|retired`, `enabled` (bool; C flips it; only `merchant_approved` or explicitly owner-allowed `verified_public` records may be enabled for customer answers), `version`, `valid_from`, `valid_to` \| null.

## 7. AllowedAction and ActionResult (C only)

`AllowedAction`: `action_id`, `kind: open_official_booking\|request_pending_booking\|share_brief_text\|share_photo_ref\|save_preference\|delete_preference\|talk_to_staff\|decline\|continue_without_photo`, `label_ar`, `label_en`, `bound: { session_id, subject_id, object_id, object_version }`, `requires_receipt_kind` \| null, `expires_at`, `url` (only for `open_official_booking`, from the allowlist).
`ActionResult`: `action_id`, `outcome: done\|external_handoff\|pending\|rejected\|expired\|revoked\|stale`, `receipt_id` \| null, `message_key`. Clicks re-validate consent and capability server-side; a stale or replayed action returns `stale`/`expired`, never a success.

## 8. PermissionReceipt (C)

`receipt_id`, `subject_id`, `kind: photo_analysis\|text_preferences\|staff_sharing_text\|staff_sharing_photo`, `notice_version`, `granted_at`, `revoked_at` \| null, `retention_policy_key` (points to the configured, truthful retention text), `granted_via: customer_ui\|staff_ui`. Owner approval is never a subject's receipt.

## 9. BarberBrief and DeliveryReceipt

`BarberBrief`: `brief_id`, `subject_id`, `branch_id`, `barber_preference` (string \| null — a preference, not an allocation), `requested_look: { option_id \| null, text_ar }`, `do_not` (string[] ≤ 5), `reference: { kind: none\|photo_ref, image_ref \| null, receipt_id \| null }`, `provenance: { approved_by_subject_at \| null, version }`, `status: draft\|approved\|delivered\|acknowledged\|withdrawn`. `withdrawn` is set when the subject revokes `staff_sharing_text`; the delivery receipt stays as audit and staff listings omit it.
`DeliveryReceipt`: `brief_id`, `delivered_at`, `staff_view_id`, `acknowledged_at` \| null, `acknowledged_by` \| null. **Acknowledgement is not a booking.**

## 10. ErrorShape and HealthState

`ErrorShape`: `code` ∈ `VALIDATION_ERROR, UNAUTHORIZED, NOT_FOUND, CONSENT_REQUIRED, CAPABILITY_UNAVAILABLE, MODEL_UNAVAILABLE, BUDGET_EXCEEDED, TIMEOUT, STALE_ACTION, CONFLICT, UPLOAD_REJECTED`, `message_key`, `retryable` (bool), `details` (object, no customer text).
`HealthState`: `{ model, photo, booking_handoff, staff_inbox, preferences, store }` each `ok\|degraded\|unavailable`, plus `checked_at`. Never reports `ok` for a capability whose configuration is missing.

## 11. ModelUsageRecord (A → C persisted)

`usage_id`, `session_id`, `turn_id`, `provider`, `model_id`, `prompt_version`, `input_tokens`, `output_tokens`, `latency_ms`, `cost_estimate_minor` (USD cents or null), `outcome: ok\|error\|timeout\|budget`, `created_at`. Contains no customer text and no image bytes.

## 12. Failure shapes every consumer must handle

Unavailable model (`state: unavailable` + `MODEL_UNAVAILABLE`), budget reached, timeout, consent missing for photo, stale action, upload rejected, conflict on preference version, store unavailable. Fixtures for each are part of the #3 implementation.

## 13. HTTP surfaces (C)

`POST /briefs/:brief_id/share-actions` — customer or owner session only. Issues bound share controls for that owned brief. The body must be a JSON object (`{}` is allowed). A non-object body (`null`, array, scalar) is `400 VALIDATION_ERROR` (`http.invalid_json`). Staff receive `401 UNAUTHORIZED` (`brief.role`) without learning whether the brief exists. Another subject's brief is `404 NOT_FOUND` (`brief.not_found`). Success `200` envelope: `{ contract_version: "0.1.0", allowed_actions: AllowedAction[] }`. The list always includes `share_brief_text` bound to that `brief_id` and version; `share_photo_ref` is included only when the photo capability is enabled and this session already has an image. Displayed action IDs do not authorize execution.

`GET /staff/briefs` — staff or owner session. Each item is a delivered or acknowledged `BarberBrief` for the configured branch plus `observations`: the stored `CosmeticObservations` for that brief's photo reference, or `null`. Never image bytes or URLs. `withdrawn` briefs are omitted. Observations older than the 24 h `ret_photo_v1` window are omitted.

`POST /staff/briefs/:brief_id/ack` — staff or owner session. Acknowledges a brief that is already `delivered` or `acknowledged` for this branch. `approved`, `draft`, or `withdrawn` briefs (and unknown ids) are `404 NOT_FOUND` (`brief.not_found`); acknowledgement cannot place a brief in the inbox or restore a withdrawn one. Acknowledgement is not a booking.

`talk_to_staff` records a staff handoff in status `received` (never `accepted` until a later staff accept). Autonomous model turns for that session then fail `403 CAPABILITY_UNAVAILABLE` (`handoff.queued`) while the row is `received` or `accepted`. Timeout after 30 minutes applies only to unclaimed `received` rows and is not acceptance. Staff release or that timeout lets model turns resume. Booking clicks and other `client_action_id` executions still run.

`GET /staff/handoffs` — staff or owner session. Lists `received` and `accepted` handoffs (ids and timestamps only; no customer text). Timed-out and released rows are omitted. Customers receive `401 UNAUTHORIZED` (`staff.required`).

`POST /staff/handoffs/:handoff_id/accept` — staff or owner session. Claims a `received` row: sets `assigned_at`, `accepted_at`, and `accepted_by`. Timeout and unknown ids are `404 NOT_FOUND` (`handoff.not_found`); a timeout cannot be accepted afterwards. Repeating accept as the same staff is idempotent. Another staff session receives `409 CONFLICT` (`handoff.accepted`) and does not steal the assignment.

`POST /staff/handoffs/:handoff_id/release` — staff or owner session. Claims a `received` or `accepted` row to `released`. Timeout, unknown, or already-timed-out ids are `404 NOT_FOUND` (`handoff.not_found`); a second release of the same released row is idempotent.
