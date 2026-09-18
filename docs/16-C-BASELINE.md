# 16 — C baseline: base pin, ownership, capability states, configuration, sequence

**Stream C decisions (Claude Code as integrator; Cursor implements).** Issue #3. Status of each item is tracked in #3 comments, not here.

## 1. Baseline source and rerun (item 1)

| Fact | Value | Label |
|---|---|---|
| Main at planning | `517272d31280515b75a7d6a1b8b74cb49742d055` | verified (git) |
| PR #1 head (Grok pack + sandbox) | `6f6683a0b057536a09e6b9d287d8635bce0a8493` | verified (git) |
| PR #11 head (plan) | `468fbe48d8eb99dbc44d9ed6946e561737a77493`, stacked on PR #1 | verified (git) |
| Baseline suite rerun on `468fbe4` | `node --test tests/*.test.mjs` → **112 pass, 0 fail, 0 skipped** (Node v22.22.2, npm 10.9.7, 2026-09-14 04:35 UTC) | tested, this checkout |
| CodeRabbit on PR #1 | skipped the draft — **not** a pass | recorded |
| Non-author review of PR #1 content | NOT_RUN in this pass (historical reviews in docs 14/15 stand as what they are) | honest status |
| Current `main` after PRs #24–#36 | `55c4c6b7d4314b8f64786ae310b88fca326a6465` | verified (git), 2026-09-18 |
| `npm test` on this walkthrough checkout (`55c4c6b` plus the #8 record) | `npm test` → **396 pass, 0 fail, 0 skipped** (Node v22.14.0, npm 10.9.7, 2026-09-18) | tested, this checkout |

The 112 passing tests exercise the synthetic sandbox (eight mock tools) and next-action policy. They prove nothing about model quality, merchant data or the real application. A green `npm test` pin is still not G01–G13 production release. Text `eval:agent` ran on 2026-09-15 (28/30 on prompt v0.4; two-case recheck on v0.5). Vision **NOT RUN**. Issue #8 live walkthrough on 2026-09-18 recorded unauthenticated probes only (`docs/20`); Khalid’s phone walkthrough was not run.

## 2. Immutable base pin and merge sequence (item 8)

1. (Done on 2026-09-14.) The owner merged **PR #1**, then **PR #11**, then the **C-baseline PR** (this branch), in that order, each with a fresh compare against `main`, no force push.
2. After that merge, the resulting `main` commit is the **immutable base pin**; the integrator posts its SHA in #3 and #2 within the same day.
3. Until it is posted, A/B/C prepare on branches created from the C-baseline PR head (`work/c-rakan-platform`) and **rebase onto the pin before opening a non-draft PR**. Nothing executable may be invented outside the contract in §6.
4. Work branches: `work/a-rakan-agent`, `work/b-rakan-ui`, `work/c-rakan-platform`. One PR per coherent change. Merges per `CONTINUE.md` §3 item 7 (owner until 2026-09-14, then the integrator under D17).
5. (2026-09-15.) Package C2 merged as **PR #24** (`de6da6b`) and the UI third handback as **PR #25** (`4bfe6b5`) onto `main`.
6. (2026-09-18.) Owner instructed Cursor to merge remaining PRs: **#26** docs/health, **#28** eval/prompt v0.5, **#27** retry, **#29** staff inbox follow-up. Resulting `main` at that moment was `2050d452aab515f807de7a83d88eb470648eba0e`.
7. (2026-09-18.) **#30** docs pin (`fcf75f2`); privacy scrub **#31**; C3 **#32**; A3 **#33**; B4 **#34**. Resulting `main` at that moment was `0e3c687a910a47b1514cfac5b5cc8662a4c5bdb6`.
8. (2026-09-18.) **#36** Arabic hub / خالد public `/try`. Resulting `main` is `55c4c6b7d4314b8f64786ae310b88fca326a6465`. Owner-reported 15:17 UTC: live `GET /customer.js` HTTP 200 (CSP build). Auto-deploy of this pin is not independently confirmed in the Railway dashboard.

## 3. Ownership map (items 3, 5 of #2; repeated in `CONTINUE.md`)

| Path | Writer | Notes |
|---|---|---|
| root files (`package.json`, lockfile, `.gitignore`, `.env.example`, `README.md`, `AGENTS.md`, `CONTINUE.md`, `NOTICE.md`), `.github/**` | C | A/B request changes in #3 |
| `src/contracts/**` | C | versioned; A/B consume without modification |
| `src/server/**`, `src/domain/**`, `src/integrations/internal/**`, `db/**`, `tests/platform/**`, `tests/integration/**` | C | |
| `design/reference/**` | C (immutable archive) | hash-checked |
| `src/agent/**`, `prompts/**`, `knowledge/**`, `tests/agent/**`, `research/claude-20260913/**` | A | |
| `src/ui/**`, `styles/**`, `tests/ui/**`, `design/implementation-notes/**` | B | |
| `sandbox/**`, `evals/**`, `fixtures/**` (from PR #1) | C custody; regression fixtures only | not live capabilities |
| `docs/**` | the stream that owns the topic; C for 16+ | |

## 4. Independent capability states (item 5) — no single DEMO flag

Each capability is a separate configured state, surfaced to the UI in the trusted context (`capabilities` in `src/contracts/CONTRACT-v0.1.md` §1). Every state has an explicit **unavailable** value that the UI must render as disabled/omitted, never as a fake control.

| Capability | States | Rule |
|---|---|---|
| `model` | `real` · `mock` · `unavailable` | `mock` only when `WEEKEND_ENV=local`; in `owner-review` a missing/failed model is `unavailable`, never silently mocked. |
| `photo` | `enabled` · `disabled` | `enabled` only after permitted subjects, upload gateway limits and retention configuration exist (#7) **and** the customer's own permission receipt for the session. Text help never depends on it. |
| `booking_handoff` | `official_link` · `pending_request` · `unavailable` | `official_link` = allowlisted existing URL from config, recorded as `EXTERNAL_HANDOFF`. `pending_request` only with a real operator watching the inbox. Integrated booking is **not** an M1 state (deferred, #10). |
| `staff_inbox` | `enabled` · `unavailable` | requires authenticated staff session and the one configured branch. |
| `preferences` | `enabled` · `unavailable` | text-only, opt-in, revocable. |

Combinations are legal in any mix (e.g. `model=real, photo=disabled, booking_handoff=official_link` is the expected first owner-review build).

## 5. Dedicated configuration and boundaries (item 7) — names only

Names live in `.env.example`. Rules:

- **Missing required configuration fails at start** with the variable name in the error; no defaults for secrets, model ids, caps or the booking URL.
- **Project-only**: a new provider account/key for The Weekend; no Kivo/MaitreAI endpoint, account, feature row, kill switch, database or host. The kill switch for this project is its own `WEEKEND_MODEL_MODE`/caps, in this repository.
- **Caps**: `WEEKEND_SPEND_CAP_USD_PER_DAY`, `WEEKEND_MAX_CALLS_PER_SESSION`, `WEEKEND_REQUEST_TIMEOUT_MS`, `WEEKEND_UPLOAD_MAX_BYTES` are mandatory; exceeding them yields `MODEL_UNAVAILABLE` / `BUDGET_EXCEEDED` / `TIMEOUT` error shapes, never a mock answer.
- **Photo retention (`ret_photo_v1`)**: in-memory upload bytes expire after **10 minutes** and the process keeps at most **32** byte entries; stored cosmetic observations expire after **24 hours**. Revoking `photo_analysis` purges that subject's bytes, `images` rows and `photo_observations`. Bytes are never written to SQLite.
- **Text preference retention (`ret_text_prefs_v1`)**: unrevoked preference rows expire **90 days** after last activity (`last_activity_at`, falling back to `created_at`). Listing and saving sweep expired rows to `revoked_at`. Customer delete remains available before that. Revoking `text_preferences` does not by itself delete stored rows.
- **Staff handoff (`talk_to_staff`)**: executing the action inserts a `received` row (not `accepted`). Model turns for that session pause while the row is `received` or `accepted`. Unclaimed `received` rows time out after **30 minutes**; timeout is not acceptance and cannot be accepted afterwards. Staff accept claims `received` → `accepted` (sets `assigned_at` / `accepted_at` / `accepted_by`); staff release claims `received` or `accepted` → `released` and lets model turns resume. The application never claims staff acceptance on its own.
- **Official booking URL**: `WEEKEND_OFFICIAL_BOOKING_URL` must be `https` with host `theweekendhairstyling.com` or `www.theweekendhairstyling.com`, no userinfo and no explicit port. Any other host fails at start.
- **Public-guest session creates**: `WEEKEND_GUEST_SESSIONS_PER_10MIN` (optional, default 5) limits successful empty-passcode customer creates per client address in a rolling 10-minute window. Further creates from that client are `401 UNAUTHORIZED` (`session.throttled`, retryable), the same shape as passcode throttling. Authenticated customer, staff and owner creates are not counted. Passcode failures still use the existing attempt limiter.
- **Public-guest turns and reserved budget**: `WEEKEND_GUEST_TURNS_PER_MIN` (optional, default 6) limits paid public-guest turns per client address in a rolling minute (`429 BUDGET_EXCEEDED`, `session.throttled`, retryable). `WEEKEND_OWNER_RESERVED_USD_PER_DAY` (optional, default 20% of `WEEKEND_SPEND_CAP_USD_PER_DAY`, rounded down to a cent) is a slice of the daily cap that guest spend cannot enter. Owner and staff turns still run inside that reserve after guests have used their share. One log line (counts only) when guest spend first reaches 80% of its share and one at 100%. Guest vision/model calls count against that guest share, not a separate ledger. A guest turn's actual cost is clamped to the remaining guest share when charged to the shared cap; any overage is logged (`ceiling_violation: true`) and further guest turns are refused for the rest of the UTC day.
- **Public-guest uploads**: `WEEKEND_GUEST_UPLOADS_PER_DAY` (optional, default 3) limits photo uploads per client address per UTC day, counted from stored upload records, so a restart does not reset it. Further uploads are `400 UPLOAD_REJECTED` (`upload.rejected`). Authenticated customer, staff and owner uploads are not counted. A guest consent grant is not itself a vision call.
- **Client-key retention**: the client address is HMAC-SHA256'd with `WEEKEND_SESSION_SECRET` before it is stored (`sessions.client_key`, digest hex only) or used as a limiter key. The raw address is never written to SQLite. After the session expires and **24 hours** (a rolling 24 h from expiry, not a UTC-midnight boundary — at least as long as the longest guest limiter window) have passed, the idle retention timer nulls `client_key`. On-request photo/preference sweeps stay separate. Nulling is by that deadline plus at most one 10-minute sweep interval.
- **Secrets route**: values are given by the owner to the person running the app, out of band; never in Git, issues, PR text or logs. Logs contain ids and counts, not customer text or images.
- **Model/version**: the provider, model ids and SDK version are chosen and verified in #3 against the provider's current documentation at that time (not inherited from Kivo docs); recorded in #3 with the date. No value is chosen in this file.

## 6. Runtime selection (item 6)

- **Node 22 LTS** (verified here: v22.22.2), ES modules, `node --test`, **zero runtime dependencies** for the contract/test layer (PR #1 precedent: hand-rolled validation, no Ajv).
- Server: `node:http` (or the smallest reviewed router if #7 needs one — decision recorded in #7 before adding a dependency). Static UI served from `src/ui/` as plain HTML/CSS/JS so the design file's structure carries over without a framework port. Any framework/bundler proposal is a #3 request with a dependency review.
- Store: the dedicated SQLite file at `WEEKEND_DB_PATH` via `node:sqlite` (unflagged on Node ≥ 22.13; verify with `node -e "import('node:sqlite')"` on the target machine and record the version in #7). No shared database.
- Runnable shell and commands are published in #7 once implementation is authorized; this document does not claim one exists.

## 7. Contracts (item 4)

Definitions: `src/contracts/CONTRACT-v0.1.md` (this PR). Implementation (JSON schema files, valid/invalid fixtures, `tests/contracts.test.mjs`) is #3 work for Cursor; A/B may read the definitions now and must not invent fields.

## 8. Not done by this document

No deployment, no paid provisioning, no customer data processing, no model selection, no merchant approval. Acceptance boxes in #3 are ticked only with evidence in #3 comments.
