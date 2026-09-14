# Reviewed Grok pack - isolated synthetic tool harness

**DEMO only. Not a running Rakan chat, live scheduler, staffed inbox or photo analyser.**

The owner supplied five Grok files. Their structure is useful; changes are recorded in [the review](../docs/15-ATTACHED-PACK-REVIEW.md). Original attachment hashes are in [source-manifest.json](source-manifest.json). Original uploads, prior repository files and Kivo resources are untouched.

## Contents

| File | Purpose |
|---|---|
| [rakan.demo.overlay.md](rakan.demo.overlay.md) | Test-mode overlay on the existing [Rakan candidate](../prompts/rakan.system.md), not a replacement persona |
| [catalog.synthetic.json](catalog.synthetic.json) | Fictional branch, four services, two staff, three resource candidates, one profile and a disabled product |
| [tools.schema.json](tools.schema.json) | Eight input schemas; identity, approval and operation IDs are not model arguments |
| [response.schema.json](response.schema.json) | Actual structural response-envelope schema, not a complete provider-payload contract |
| [golden-conversations.json](golden-conversations.json) | Ten corrected scenario specifications; model evaluation NOT RUN |
| [mock-tools.mjs](mock-tools.mjs) | In-process adapter implementing eight synthetic tools; no HTTP listener |
| [Tests](../tests/sandbox-pack.test.mjs) | Executable contract and state tests, not language/image evaluation |

## Run

From the repository root, on Node compatible with its built-in test runner:

```sh
node --test tests/sandbox-pack.test.mjs
```

Verified on Node v22.16.0: 72 tests passed. No provider credentials, package installation or network calls are needed. The existing 40 next-action tests are separate and were not rerun in this increment; do not describe the new command as 112 fresh passes.

Instantiate `createSandbox({mode: 'DEMO'})` inside a test process. The context supplied by the harness binds subject, session, verified status, booking-adult status and recipient kind. This is NOT a real identity-verification implementation. The safe order is services -> slots -> quote -> display exact proposal -> trusted approval -> create -> read outcome. The trusted `approveQuote` helper is deliberately absent from model tools. The adapter generates a stable operation ID; the model cannot choose one. Timeout-after-commit fault injection exercises reconciliation.

The original one-hour capacity windows are preserved. Haircut plus beard takes 60 minutes plus 10 minutes cleanup, so those sample candidates are unavailable for that combination. The adapter must not expand a resource window to force a happy path. The fixture clock is declared and injected; past slots are not silently moved into the future.

## Limits

All records are synthetic, in memory and lost on restart. Duplicate and resource-allocation checks do not establish distributed locking, crash recovery, durable idempotency or provider guarantees. `validateInput` supports only this pack's limited schema subset; use an appropriate schema library and real authorization for a networked service. Python jsonschema Draft 2020-12 validation was separately run on all schemas, valid/invalid examples and 72 emitted response envelopes.

No model calls, vision, media handling, real merchant data, customer communications, live bookings/payments or staffed request workflow. Holds, amendments, cancellation, arbitrary add-ons, products, staff-brief delivery and photo history remain disabled here. A queued case is explicitly simulated and unstaffed.

This pack stays separate from `fixtures/catalog.synthetic.json` to avoid modifying existing tests or creating implicit data fallbacks. Neither fixture belongs in real-service mode. The product target remains genuine Rakan conversation and optional permitted cosmetic analysis; this is infrastructure to test it safely, not its finished implementation. Review through draft PR #1 rather than concurrent writes to main.
