# Continue The Weekend project — entry point for any agent

If you were told **"continue The Weekend project"**, do exactly this, in order. You need nothing else from a human to start.

## 1. Read (10 minutes)

1. `AGENTS.md` — the rules. They are not optional.
2. `PROJECT_PLAN.md` — the plan and the three streams.
3. GitHub issue **#2** (control) — the current status board. **The latest comments on #2 and on each open issue are the truth; file text is older than comments.**
4. `docs/16-C-BASELINE.md` — base pin, ownership map, capability states, configuration names, branch/merge sequence.
5. `research/claude-20260913/README.md` — the sanitized merchant evidence and its labels (`verified public observation` / `collaborator-reported` / `merchant-approved` / `hypothesis` / `unknown`).
6. The issue for your stream (below).

## 2. Find your stream

| Stream | Owner | Issues | Owned paths | Do not touch |
|---|---|---|---|---|
| **A — agent, vision, knowledge** | Claude Code (integrator/PM for the whole project) | #4 (done when its PR is merged), #5 | `src/agent/**`, `prompts/**`, `knowledge/**`, `tests/agent/**`, `research/claude-20260913/**` | UI, contracts, server, root config |
| **B — customer/staff interfaces** | Grok | #6 | `src/ui/**`, `styles/**`, `tests/ui/**`, `design/implementation-notes/**` | prompts, knowledge, server, contracts, `design/reference/**` |
| **C — contracts, platform, integration** | Cursor (implementation) under Claude Code (decisions, review) | #3, #7 | `src/contracts/**`, `src/server/**`, `src/domain/**`, `src/integrations/internal/**`, `db/**`, `tests/platform/**`, `tests/integration/**`, root config, `.github/workflows/**`, `design/reference/**` | prompts, knowledge, UI |

**If Claude Code is unavailable and you were told to continue as integrator (for example GPT):** read `docs/18-HANDOVER-INTEGRATOR.md` first — it holds the state snapshot, the decisions log, the stream A brief and the owner's pending tasks. Announce yourself on issue #2.

If you are a new agent with no assigned stream: take the **first issue in #2 whose latest comment says `READY` and has no `CLAIMED` comment**, in the order #3 → #6 → #7 → #5 → #8. Never take two streams at once.

## 3. Claim, branch, work, report

1. **Claim** by commenting on the issue: `CLAIMED by <agent name> on <UTC date>; base <commit sha>`. If someone claimed it within the last 3 days and there is no `RELEASED` comment, pick the next issue.
2. **Branch** from the base pin in `docs/16-C-BASELINE.md`: `work/a-rakan-agent`, `work/b-rakan-ui`, `work/c-rakan-platform` (or a suffixed variant if the name is taken). Never commit to `main`. Never force-push. Never rewrite another branch's history.
3. **Work only inside your owned paths.** A change you need elsewhere is a request: comment on the owning issue (#3 for contracts/root), do not edit.
4. **Run the checks** before every push: `npm test` (all `node --test tests/*.test.mjs`) plus your stream's own tests. A failing test is never skipped or deleted.
5. **Open a draft PR** to `main` using `.github/pull_request_template.md`. Fill it truthfully: base commit, files, commands actually run, checks NOT run, model/vision tests `NOT RUN` if absent.
6. **Report** on the issue with the exact format: `base <sha> → head <sha>; files: …; checks run: …; not run: …; blockers: …`. Then say `RELEASED` if you stop before finishing so the next agent can continue.
7. **Reviews** are cross-stream (Grok reviews A behaviour, Claude Code reviews C platform/security, ChatGPT/Cursor reviews B fidelity, the integrator reviews B's use of the contracts). Nobody approves their own code. Merges: the integrator, under decision D17 in `docs/18-HANDOVER-INTEGRATOR.md` §3 (two-agent review, green `npm test`, bot reviews read, no overlapping writer); the owner may also merge.

## 4. Hard limits (repeat of AGENTS.md — read the original)

- Separate project: no Kivo/MaitreAI databases, accounts, endpoints, keys, kill switches, hosts or code without a recorded source/rights review.
- No customer photographs, phone lists, booking exports, review author identifiers, tokens, keys or merchant exports in Git. `.env` is ignored; `.env.example` holds names only. Values come from the owner privately.
- No medical diagnosis, treatment claims, attractiveness scores, ethnicity/religion/personality inference, age guessing or face recognition. Cosmetic observations only, with permission.
- No fake bookings, slots, waits, stock or "saved" confirmations. An outbound link is `EXTERNAL_HANDOFF`, never `CONFIRMED`.
- Working name: **Rakan**. Do not rename without an owner decision recorded in #2.
- Distinguish `proposal` / `public observation` / `merchant approved` / `implemented` / `tested` / `released` in everything you write.

## 5. Where things are

- Evidence about the real shop: `research/claude-20260913/` (sanitized, hashed).
- Design to preserve: `design/reference/rakan-guest-memory.dc.html` (+ `SHA256SUMS`).
- Contract definitions: `src/contracts/CONTRACT-v0.1.md` (implemented as schemas + fixtures + tests under #3).
- Sandbox tools from the earlier pack: `sandbox/` (regression fixtures, not live capabilities).
- Configuration names: `.env.example`; rules in `docs/16-C-BASELINE.md` §5.
- Current `main` pin (2026-09-18): `0e3c687a910a47b1514cfac5b5cc8662a4c5bdb6` after PRs #26–#34 (docs/health, eval v0.5, retry, staff inbox follow-up, docs pin, privacy scrub, C3, A3, B4). Issue comments remain newer than this line. A live static-file check on 2026-09-18 still matched PR #25 (`4bfe6b5`), not this pin — see `docs/20-OWNER-WALKTHROUGH-2026-09-18.md`.
