# Exact missing facts (owner or merchant-side answers needed)

This is the complete list of facts M1 needs that public sources cannot supply. It is not a research plan; each row is a question with a named answerer. Until answered, Rakan must treat the fact as `unknown` and say so.

| # | Missing fact | Why M1 needs it | Answerer |
|---|---|---|---|
| 1 | Which single branch M1 is built for | one-branch scope (issue #2) | owner |
| 2 | Whether displayed prices include the configured 15 % VAT | every price line Rakan says | owner / storefront invoice |
| 3 | Which of the five branch records operate today, and the correct public name for each (e.g. how customers say "Zone C" vs "Zone i") | branch-aware answers | owner |
| 4 | Which of the 20 barber records are current staff at the chosen branch; whether the three «مروان» records are one person; permission to show names | brief, preference and barber-continuity copy | owner / branch manager |
| 5 | What one membership "visit" includes (cut only? cut + beard? add-ons?), rollover/expiry of unused visits, renewal, cross-branch use, and the purpose of the mandatory subscriber photo | any membership answer; correction 3 | owner |
| 6 | The exact official booking URL to allowlist (today: `https://theweekendhairstyling.com/book`, optionally after `?branchId=` preselection), and whether WhatsApp/phone bookings are accepted at all | `EXTERNAL_HANDOFF` target | owner |
| 7 | What staff actually do when a customer asks to move an appointment in advance (published policy covers no-show/late only; self-cancellation is off in settings) | policy copy without over-stating | owner |
| 8 | Whether any rating below 5 was ever manually approved, and who moderates | correction 2; honest review copy | owner |
| 9 | Stock truth for the BATCI concealer 30 ml: the storefront's own stock field shows 0 available / 0 remaining while `isOutOfStock` is false (E03, `catalogue.sanitized.json`); the other items show finite quantities or unlimited. Also whether product delivery (30 SAR fee) is something Rakan should offer | product answers | owner |
| 10 | Which cosmetic claims from the product descriptions may be repeated (SFDA registration, "2–15 days", "sulfate-free", keratin "for weeks") | correction 4; knowledge status `merchant-approved` | owner + qualified reviewer |
| 11 | A per-branch contact route for late/move messages (settings list one central number; WhatsApp button is off) | late/move scenes | owner |
| 12 | Whether «خالد» thanked in one May review is the owner (`hypothesis`) | nothing operational; avoids a wrong assumption in copy | owner |
| 13 | Rekaz iCal exports: whether the owner wants them disabled/token-protected (see README exposure report) | data protection | owner → Rekaz |
| 14 | Data-protection roles: who is controller for chat/photo data, retention period the owner will honour, notice text | consent receipts (issue #7) | owner (+ legal review NOT_RUN) |
| 15 | Approved project-only model provider, credentials route and spend cap (no values in Git) | real inference (issues #3, #5) | owner |
| 16 | Hosting/store choice for the dedicated Weekend application and who holds the accounts | issue #3 item 7 | owner |
| 17 | Permitted adult test subjects/images for the cosmetic-vision evaluation | issue #5 acceptance | owner |

Not needed for M1 (deferred with issues #9/#10): live availability, booking creation, POS, WhatsApp Business API, per-branch calendars.

## Triage (integrator, 2026-09-14) — what blocks M1 and what is defaulted

The owner asked for only the important questions. Rows not listed below are **defaulted** as stated; a default is a conservative behaviour, not a fact, and can be replaced by the owner's answer at any time.

**Owner must answer (short answers are enough):** rows 1, 2, 4, 5, 6, 7, 10, 11, 15, 17, and a yes/no on the row-14 defaults.

| Row | Default applied until the owner answers | Effect on Rakan |
|---|---|---|
| 1 | proposal النرجس (مرسية) (`ONE-BRANCH-CANDIDATE.md`) | knowledge and staff view scoped to that branch |
| 2 | prices quoted "as shown on the website"; Rakan never adds or asserts VAT | no "plus VAT" / "includes VAT" wording |
| 3 | only the chosen branch is described; other branches by name and map link only | no claims about other branches' hours or staff |
| 4 | Rakan does not name barbers; it says the customer picks the barber on the booking page | staff names appear only in the staff view after approval |
| 5 | memberships described with the storefront wording only (fee, period, visit count, Basic = haircut + beard, Full = + basic face treatments); no savings claim; link to the membership page | correction 3 respected |
| 6 | official link `https://theweekendhairstyling.com/book`, branch preselected by `?branchId=` when known; no WhatsApp/phone booking offered | `EXTERNAL_HANDOFF` only |
| 7 | published policy stated as written (no-show/late); for advance changes Rakan says it cannot change bookings itself and points to the shop's contact page | no promise of moving appointments |
| 8 | Rakan never cites ratings, review counts or reviews | correction 2 respected |
| 9 | Rakan never claims stock; product delivery is not offered in M1 (product page link only) | no stock or delivery promises |
| 10 | Rakan repeats product names, sizes and prices; **no benefit claims** (no SFDA, "2–15 days", "sulfate-free", keratin "for weeks") until the owner approves a list | correction 4 respected |
| 11 | no branch number is given; "contact the shop" via the site | late/move relay stays unavailable |
| 12 | «خالد» in a review is not used anywhere | none |
| 13 | recommendation to the owner only; Rakan never reads iCal | none |
| 14 | owner = data controller, project operator = processor; photo disabled; text preferences opt-in, customer-deletable, retained 90 days after last activity; Arabic notice text drafted by stream A for owner approval | consent receipts configured with these values |
| 15 | no real model calls until the owner creates a project-only key and a daily cap (proposal: Claude via a new Anthropic key, cap USD 5/day, 40 calls/session; model id verified by Cursor against provider docs in #3) | `model = unavailable` until then |
| 16 | run locally for the first owner walkthrough; hosting decided when #7 is ready | none now |
| 17 | first owner-review build **without** the photo feature unless the owner supplies 3–5 permitted adult test photos | `photo = disabled` |
