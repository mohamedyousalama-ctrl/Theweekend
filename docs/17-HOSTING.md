# 17 — Hosting decision for the owner-review build (stream C)

**Decision (integrator, 2026-09-14, owner asked for the easiest correct option):** host the owner-review application on **Railway** (railway.com) as one small always-on Node service with a persistent volume, under the owner's own Railway account. Label: `implemented` (project + GitHub deploy from `main`) — **not** `released`. `GET /health` is not green until `WEEKEND_MODEL_API_KEY` is set on the service.

## Why Railway

| Need | Railway | Why not the alternatives |
|---|---|---|
| Runs Cursor's server unchanged (`node:http`, `npm start`, Node 22) | yes, auto-detected | Vercel/Netlify are serverless: no persistent disk for SQLite and the server would need a rewrite |
| Persistent disk for the dedicated SQLite file (`WEEKEND_DB_PATH`) | volume mounted at `/data` | a separate Postgres would add a vendor and an async rewrite of the store |
| Secrets outside Git | project variables in the Railway UI | same discipline as `.env.example` |
| Auto-deploy on every merge to `main` | GitHub integration | keeps the "continue the project" flow: merge = deploy |
| HTTPS URL to share with the owner | generated domain (custom domain later) | — |
| Separation from Kivo | separate account/project, separate store and keys | the Kivo Vercel/Supabase resources are not touched (AGENTS.md) |
| Cost | Hobby plan, about USD 5/month plus small usage | — |

## Code requirements for Cursor (issue #7, after the PR #14 fixes)

1. Bind to `0.0.0.0` and `process.env.PORT` when set (keep `127.0.0.1:8787` as the local default).
2. `GET /health` returning `HealthState` with HTTP 200 only when the store and configuration are OK (Railway health check path).
3. `WEEKEND_DB_PATH` may point into the volume (`/data/weekend.sqlite`); create parent directories at start.
4. Passcodes: accept `WEEKEND_OWNER_PASSCODE` and `WEEKEND_STAFF_PASSCODE` as plain values in the environment and hash them at start (scrypt, per the PR #14 review); the `_HASH` variants stay supported. Update `.env.example` accordingly.
5. `railway.json` (or `nixpacks.toml`) with the start command `npm start`, the health check path, restart policy, Node 22.
6. Serve the static UI from `src/ui/` on the same service (no second service).
7. Log only ids and counts; Railway keeps stdout logs.

## Owner steps (unblocked 2026-09-15; project created the same day)

C2 (PR #24) and the consent/brief UI (PR #25) are on `main` (`4bfe6b5`). This is not a customer-facing release.

**Created (2026-09-15, owner Railway account `mohamed.you.salama@gmail.com`, CLI):**

| Item | Value |
|---|---|
| Project | `Theweekend` (`cca3895c-f31a-4ce8-afe6-820c76dd0fd8`) — separate from other workspace apps |
| Service | `rakan`, GitHub repo `mohamedyousalama-ctrl/Theweekend` branch `main` |
| Volume | `rakan-volume` mounted at `/data`; `WEEKEND_DB_PATH=/data/weekend.sqlite` |
| Domain | `https://rakan-production-7ae6.up.railway.app` |
| Deployed commit | `4bfe6b526daa5bc5ebe448e2c90abc3f8415e673` |
| Health | **crashed** — start fails `ConfigError: WEEKEND_MODEL_API_KEY` (fail-explicit; not mocked) |

All names from the table below except `WEEKEND_MODEL_API_KEY` are already set on the `rakan` service. Owner and staff passcodes are the Railway variables `WEEKEND_OWNER_PASSCODE` and `WEEKEND_STAFF_PASSCODE` (read them in the Railway Variables tab; they are not in Git or this file).

**Owner still does:**

1. In Railway → project `Theweekend` → service `rakan` → Variables: paste the dedicated Anthropic key as `WEEKEND_MODEL_API_KEY` (never a Kivo key, never Git, never chat). Railway will redeploy.
2. Confirm `GET https://rakan-production-7ae6.up.railway.app/health` returns 200.
3. Share that URL and the owner passcode (from the Variables tab) with Khalid for the #8 walkthrough.

The original numbered signup steps (1–5) are done except the model key. Names remaining for reference:

| Name | Owner-review value (description only) |
|---|---|
| `WEEKEND_ENV` | `owner-review` |
| `WEEKEND_MODEL_MODE` | `real` |
| `WEEKEND_MODEL_PROVIDER` | `anthropic` |
| `WEEKEND_MODEL_ID` | current Claude id from `src/contracts/MODEL-CANDIDATES.md` |
| `WEEKEND_VISION_MODEL_ID` | same id as `WEEKEND_MODEL_ID` |
| `WEEKEND_MODEL_API_KEY` | project-only Anthropic key (never a Kivo key) |
| `WEEKEND_SPEND_CAP_USD_PER_DAY` | integer USD ceiling |
| `WEEKEND_MAX_CALLS_PER_SESSION` | integer per-session ceiling |
| `WEEKEND_REQUEST_TIMEOUT_MS` | integer milliseconds |
| `WEEKEND_PHOTO_ENABLED` | `true` or `false` |
| `WEEKEND_UPLOAD_MAX_BYTES` | integer byte limit |
| `WEEKEND_BOOKING_HANDOFF_MODE` | `official_link` (M1) |
| `WEEKEND_OFFICIAL_BOOKING_URL` | allowlisted `https://…` booking page |
| `WEEKEND_DB_PATH` | `/data/weekend.sqlite` (volume mount) |
| `WEEKEND_SESSION_SECRET` | ≥16 characters |
| `WEEKEND_OWNER_PASSCODE` or `WEEKEND_OWNER_PASSCODE_HASH` | plain (hashed at start) or `scrypt$…` |
| `WEEKEND_STAFF_PASSCODE` or `WEEKEND_STAFF_PASSCODE_HASH` | plain or `scrypt$…` |
| `WEEKEND_BRANCH_ID` | `br_…` for فرع النرجس (مرسية) |
| `WEEKEND_TRUST_PROXY` | `1` |
| `PORT` | set by Railway; do not invent a value |

`WEEKEND_LOCAL_CUSTOMER_PASSCODE_HASH` is **not** used in `owner-review`. `railway.json` starts `npm start` and health-checks `GET /health`. Code for bind/health/volume parents is on `main` (PR #14). The generated domain exists; the process is **not released** until `/health` is 200 with the real key.

Deployment protection for the review period is the app's own passcode gate plus the unguessable Railway domain; no public launch is implied.

## Later modifications the owner mentioned

Moving to another host later is a configuration change, not a code change, as long as the service keeps a disk for SQLite; a move to Postgres is a stream C task with its own review.
