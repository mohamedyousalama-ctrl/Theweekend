# M1 UI second handback — Stream B (issue #6)

**Status:** `implemented` in this repository (plain HTML/CSS/JS, synthetic fixtures only). **Not** visually compared at gold sizes, **not** model/vision tested, **not** released, **not** G01–G13. Superseded as the latest Stream B package by `m1-ui-third-handback.md`; this file remains the record of the second handback.

**Base:** `795f09a78093899fc01b80a0d688fe00de366e34` (`main` after PR #14).
**Branch:** `work/b-rakan-ui`.

## What shipped

Layout from `m1-component-map.md` §8:

| Surface | Modules |
|---|---|
| Customer conversation | `src/ui/conversation/*` |
| Short approved brief | `src/ui/brief/*` |
| Staff inbox / brief panel | `src/ui/staff/*` |
| Preference view | `src/ui/preferences/*` |
| Capability / health | `src/ui/capability/*`, `src/ui/chrome/*` |
| §6 states | `src/ui/states/*` |

Entry shells C already serves from `src/ui/`: `index.html`, `customer.html`, `staff.html`. No new server routes. Live client: `src/ui/app.js` (`GET /health`, `POST /session`, `POST /turns`, `POST /actions/:id`, preferences, staff briefs). Displayed action ids are posted back to C; the browser does not treat them as authority.

CSS lives in `styles/` (map) and an identical copy under `src/ui/styles/` so `node:http` static serving can reach it without a C route change. Request for C on #3: also serve `/styles/` from the repo `styles/` directory **or** add `tests/ui/*.test.mjs` to the npm test glob.

## Tests

- `tests/ui/*.test.mjs` — full Stream B suite (`node --test tests/ui/*.test.mjs`).
- `tests/ui-smoke.test.mjs` — critical assertions picked up by the current `package.json` script (`tests/*.test.mjs`) **without** editing that C-owned file. Removed in PR #23 once `npm test` was set up to run `tests/ui/*.test.mjs` itself; do not recreate it.

`design/reference/**` SHA-256 must remain `7ee86b47bd1b75f21655e30bd2a2770b8a9f4bea8ce1e50af7982f0a80b0d980`.

## Not run

Visual comparison screenshots at 390×844 / desktop; real model / vision / provider; owner-review walkthrough (#8); production deploy.
