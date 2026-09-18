# Stream A — the Rakan brain (issue #5)

| Piece | File | Status |
|---|---|---|
| Persona and rules | `prompts/rakan.system.md` (`rakan.system.v0.7`) | `proposal` — native-speaker and barber review NOT_RUN |
| Knowledge pack | `knowledge/build.mjs` → `knowledge/marsiya.v1.json` (47 records, revision 3) | built from `research/claude-20260913/` + the owner's answers; every record validates against `KnowledgeRecord` |
| Adapter | `src/agent/adapter.mjs` | Claude API via the official SDK, structured JSON output, grounding check, contract validation, in-memory bounded history, photo bytes in memory only |
| Deterministic tests | `tests/agent/*.test.mjs` (38) | run by `npm test` with a fake client — no network, no key |
| Real-model evaluation | `src/agent/eval.mjs` + `tests/agent/cases.json` (30 text cases, optional images) | **NOT RUN** until the owner's key exists on the host. Exit 0 only with `--images` (at least one image case passed) or `--text-only`; otherwise prints `vision: NOT RUN` and exits 1. |

## How a turn works

1. The server (stream C) validates the session, consent and caps, then calls `adapter({ context, input, now, image_bytes })`.
2. The adapter sends: the frozen prompt (cached), the enabled knowledge records (cached), the trusted session facts (locale, capabilities, permissions, allowed action kinds), the bounded conversation history, and the customer's text and permitted photo.
3. The model must answer with JSON in `MODEL_OUTPUT_SCHEMA` (`output_config.format`).
4. The adapter maps that JSON into a `ChatTurnOutput`: messages ≤ 3, style options ≤ 2, actions filtered by capabilities, unknown knowledge ids dropped, observations only with a photo and a receipt, brief as a **draft**.
5. **Grounding:** every amount quoted must appear in a cited knowledge record; otherwise one corrective retry, then a closed `error` state — a wrong price never reaches the customer.
6. The output is validated against the contract; the usage record carries tokens, latency and a cost estimate (list prices) for the server's daily cap.

## What it never does

Book, confirm or change appointments; state availability, waiting time or stock; rank barbers; make medical claims; infer identity, age, ethnicity, gender, health or attractiveness from a photo; obey instructions found in customer text or images.

## Running

```
npm test                                  # deterministic, fake client
npm run build:knowledge                   # regenerate knowledge/marsiya.v1.json (must equal the committed file)
WEEKEND_MODEL_API_KEY=… npm run chat:agent            # terminal chat with the real model (first try before the web UI)
WEEKEND_MODEL_API_KEY=… npm run eval:agent -- --images ./permitted-faces   # required for exit 0 (vision ran and passed)
WEEKEND_MODEL_API_KEY=… npm run eval:agent:text-only   # or: npm run eval:agent -- --text-only
# without --images and without --text-only: prints "vision: NOT RUN" and exits 1 even if every text case passed
```

Model id defaults to `claude-opus-5` (Claude API docs default); `claude-sonnet-5` is the cheaper alternative and needs no code change. Any model id must have a price entry in `PRICES_USD_PER_MTOK`, otherwise the adapter refuses to start (the daily cap depends on it). The model never proposes `delete_preference`; deletion is issued by the preference view server-side.
