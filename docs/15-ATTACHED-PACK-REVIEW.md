# 15 - Review of the five attached Grok files

Date: 2026-09-13. Base: `790085426c59b4131f34471883f2f28d35fe56a2` on draft PR #1. This is assistant-led source review and bounded synthetic test implementation, not an independent audit or customer release.

## What was used

All five uploads are useful: the sandbox README, DEMO prompt, richer catalog, eight-tool layout and ten conversation intents. Their hashes are preserved in [source-manifest.json](../sandbox/source-manifest.json). Originals remain unchanged. Reviewed derivatives and executable support are in [sandbox](../sandbox/README.md).

The six documentation commits on main and the five local attachments are different deliveries. This work uses the actual uploaded bytes, not Grok's inaccessible /home/workdir/artifacts/demo path. Existing docs 00-14, the general Rakan prompt, action logic and minimal fixture are retained. Rakan remains entirely separate from Kivo.

## Source findings and our corrections

| ID | Finding in supplied material | Correction in derived pack |
|---|---|---|
| GP01 | G1 asks for confirmation before creating the quote, then calls quote/create together. | Quote -> full summary -> approval bound to version -> create. Correct the written event order. |
| GP02 | Model arguments include customer_confirmed, customer_id and idempotency_key. A schema alone cannot substantiate these claims. | Only quote ID/version are model inputs. Trusted synthetic context/UI approval and generated stable operation IDs are separate. This is not real authentication. |
| GP03 | Prompt/schema refer to a ninth get_handoff_status tool that is not defined. | Keep eight tools; synthetic queued receipt cannot imply accepted or staffed. |
| GP04 | get_booking accepts no selector or multiple conflicting selectors. | Require exactly one, plus trusted subject/session ownership. Unowned and nonexistent IDs have the same outward result. |
| GP05 | The envelope is illustrative type text rather than a validating JSON Schema. | Separate actual input/envelope schemas; success/error semantics, DEMO source and simulated references are constrained. Detailed provider-payload contracts remain future work. |
| GP06 | Combined service needs 60+10 minutes but sample windows last 60 minutes. | Preserve capacity windows and filter/reject that combination. Do not extend staff availability merely to pass the happy path. |
| GP07 | Add-on arrays lack combination, resource and eligibility semantics. | Reject arbitrary add-ons in this bounded adapter; explicit combined SKU still requires a fitting candidate. |
| GP08 | A product can be offered without an enabled product tool; warning suggests asking alone could establish allergy safety. | Product fixture stays disabled. Unknown labels do not justify suitability claims. |
| GP09 | Profile field names differ between input/output and no selection is required. | Require a nonempty allowlisted field selection; use a consistent display_name key. Confirmed preference is not an executed-cut record. |
| GP10 | Substring assertions can reject benign negations/disclaimers and assume fixed generated references. | Preserve ten goals with semantic assertions and event order. All remain model-review NOT_RUN. |
| GP11 | Fixed dates can age into misleading availability. | Inject explicit fixture clock; no automatic date recycling. |
| GP12 | Two full prompts could drift or make the real product permanently demo-only. | Use one existing Rakan candidate and a separate DEMO overlay. |
| GP13 | Cancellation policy suggests an action absent from the tool set. | Mark cancellation unsupported here; allow only a simulated help request. |

These are deliberate review changes, not a verbatim summary of Grok's files. The original source is not rewritten to conceal the differences.

## Implemented and tested

The in-process adapter implements eight tools with typed argument checks, scoped synthetic records, explicit quote approval, expiry/version checks, resource-capacity checks, duplicate-create reuse, timeout-after-commit reconciliation, minimal profile fields and simulated queued support. It is not an HTTP server or agent chat.

On Node v22.16.0: `node --test tests/sandbox-pack.test.mjs` passed 72/72. Python jsonschema Draft 2020-12 separately validated eight input schemas, one envelope schema, eight valid input examples and 72 emitted response envelopes. Targeted invalid arguments were also rejected. Existing 40 next-action tests were not rerun in this increment and are not added to the fresh count.

The new tests do not interpret the ten Arabic/English scenario stimuli. No model, vision, native-speaker review, barber evaluation, private customer record, provider, payment, WhatsApp message, deployment or Kivo resource is used. Test context flags are trusted inputs. Maps in process memory are not distributed locks, durable storage or verified real-world authorization.

## Technical references

Checked for schema/test syntax, not as new business or medical evidence:

- https://json-schema.org/understanding-json-schema/reference/object
- https://nodejs.org/download/release/v22.16.0/docs/api/test.html

No new medical, legal, brand, staff or provider-access claims are made. Existing safety/privacy and standalone requirements remain binding. The PR stays unmerged pending integration review; no main rewrite or live release is part of this increment.
