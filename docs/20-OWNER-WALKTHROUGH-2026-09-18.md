# 20 — Issue #8 owner walkthrough record (2026-09-18)

**Status:** `tested` for unauthenticated live probes and static-file comparison; authenticated session turns **skipped** in this pass (Railway CLI on this runner was logged out; passcodes were not present in the environment and are not requested in Git). **Not** G01–G13. **Not** released. Vision **NOT RUN**. Khalid phone walkthrough **NOT RUN**. Native-speaker and qualified-barber scoring **NOT RUN**.

This is M1 owner-review evidence, not permission for unrestricted customers.

Method: `node scripts/owner-walkthrough.mjs` with `WEEKEND_WALKTHROUGH_URL` supplied only in the runner environment (HTTPS origin; value not recorded here). Started 2026-09-18 ~12:26 UTC. No customer photographs. No passcodes, tokens or API keys in this file.

## Checkout versus live static UI

| Object | Observation |
|---|---|
| Git `main` at this record | `0e3c687a910a47b1514cfac5b5cc8662a4c5bdb6` (includes B4 PR #34) |
| Live `GET /app.js` SHA-256 | `4eb5e30ebcf4a378897030744bfc21aa3fe3895eb4f7556fa8b398515aca1f62` (22695 bytes) |
| That hash on `main` | matches `4bfe6b5` (PR #25 UI third handback), not `0e3c687` |
| Live `GET /staff/handoff-list.js` | HTTP 404 |
| Same path on this checkout | present (PR #29) |
| Live `GET /` | HTTP 200, `lang="ar"` `dir="rtl"` |
| Live tokens | `--wk-ground: #07090F`, `--wk-red: #E11D2E` (same bytes as this checkout) |
| `cache-control` on `/app.js` | `no-store` (not a CDN explanation) |

Auto-deploy of `main` after PR #25 is **not verified**. A phone walkthrough against the current live process exercises PR #25 UI plus whatever server that deploy contains, not the B4 retry/copy package.

## Health

`GET /health` HTTP **200** at 2026-09-18 12:22:55 UTC:

| Field | Value |
|---|---|
| `contract_version` | `0.1.0` |
| `model` | `ok` |
| `photo` | `ok` |
| `booking_handoff` | `ok` |
| `staff_inbox` | `ok` |
| `preferences` | `ok` |
| `store` | `ok` |

Health 200 is process/store readiness, not a substitute for the eight walkthrough steps, `eval:agent`, or production release.

## The eight steps

| # | Required | This pass |
|---|---|---|
| 1 | Access-controlled URL on a phone; dark/red RTL system | **partial.** Live index is `lang=ar` `dir=rtl` with the design tokens. Headless mobile (390×844) and desktop screenshots of the login gate were captured as runner artifacts, not stored in Git. **Khalid’s phone NOT RUN.** |
| 2 | Speak freely; real model replies | **skipped** (no session passcodes in this environment). |
| 3 | Branch-aware service question with a cited record or an honest gap | **skipped** (same). |
| 4 | Text-only help **or** consented adult image with cosmetic observations | **text-only path intended.** No customer or permitted-face image was sent. Authenticated “continue without photo” **skipped**. Vision pack **NOT RUN**. |
| 5 | Choose/adjust a style; next actions; decline products and photos without losing service | **skipped** (session). |
| 6 | Approve a text brief; same text in a separate staff session | **skipped** (session). |
| 7 | Save a preference; retrieve after reopen; another user cannot read it; not a completed haircut | **skipped** (session). |
| 8 | Official booking page or honestly pending request; click is not confirmation | **skipped** (session). The live `booking_handoff` capability is `ok` on `/health`. |

## Security probes (live, no session)

| Probe | HTTP | `code` / `message_key` |
|---|---|---|
| `GET /staff/briefs` | 401 | `UNAUTHORIZED` / `session.invalid` |
| `GET /staff/handoffs` | 401 | `UNAUTHORIZED` / `session.invalid` |
| `GET /context` | 401 | `UNAUTHORIZED` / `session.invalid` |
| `GET /preferences` | 401 | `UNAUTHORIZED` / `session.invalid` |
| `GET /booking/handoff` | 401 | `UNAUTHORIZED` / `session.invalid` |
| `POST /session` staff + wrong passcode | 401 | `UNAUTHORIZED` / `session.passcode` (`retryable: false`) |
| `POST /actions/act_forged` forged bearer | 401 | `UNAUTHORIZED` / `session.invalid` |
| `POST /uploads` unauthenticated JPEG | 401 | `UNAUTHORIZED` / `session.invalid` |

Forged/expired action **after** a valid session, cross-subject preference isolation, photo-before-consent, withdrawal, invalid upload and unavailable-model were **not** exercised on the live host in this pass (they remain covered by `tests/platform` and `tests/integration` on the checkout).

## Suites on this checkout

A green `npm test` on this checkout was **387 pass / 0 fail / 0 skipped** (includes the walkthrough-record privacy test). That count is still not G01–G13.

Text eval remains `docs/19-EVAL-AGENT-2026-09-15.md` (28/30 on prompt v0.4; two-case recheck on v0.5). That is not a full-pack pass on v0.5 and is not this walkthrough.

## Hard stops observed

No data leak in the unauthenticated probes. No image processing was attempted. No booking confirmation was claimed. Silent real-to-mock fallback was **not** directly proven or disproven on a paid turn in this pass.

## Still blocking #8 acceptance

1. Confirm Railway auto-deploy of `0e3c687` (or newer) in the dashboard; live `/app.js` still matches PR #25.
2. Re-run `npm run walkthrough:owner` with owner and staff passcodes in the runner environment only.
3. Khalid phone walkthrough of the eight steps.
4. Vision pack on owner-approved permitted faces, never customer photos in Git.
5. Native Saudi and qualified-barber scoring.

Issue #8 stays open. This file does not close it.
