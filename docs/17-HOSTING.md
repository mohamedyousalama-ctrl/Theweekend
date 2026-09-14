# 17 — Hosting decision for the owner-review build (stream C)

**Decision (integrator, 2026-09-14, owner asked for the easiest correct option):** host the owner-review application on **Railway** (railway.com) as one small always-on Node service with a persistent volume, under the owner's own Railway account. Label: `decision` — not yet `implemented`, not `released`.

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

## Owner steps (only when the app is ready — the integrator will say when)

1. Sign up at railway.com with the GitHub account that owns this repository; choose the Hobby plan.
2. New Project → Deploy from GitHub repo → `mohamedyousalama-ctrl/Theweekend`, branch `main`.
3. Add a Volume to the service, mount path `/data`.
4. Variables: copy the names from `.env.example` and enter the values (the Claude API key, passcodes, branch id, booking URL, caps), and set `WEEKEND_TRUST_PROXY=1` so the login limiter keys on the real client address behind Railway's proxy. Never paste values anywhere else.
5. Settings → Networking → Generate Domain. Share that URL and the owner passcode with Khalid.

Deployment protection for the review period is the app's own passcode gate plus the unguessable Railway domain; no public launch is implied.

## Later modifications the owner mentioned

Moving to another host later is a configuration change, not a code change, as long as the service keeps a disk for SQLite; a move to Postgres is a stream C task with its own review.
