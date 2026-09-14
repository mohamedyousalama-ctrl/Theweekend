# Rakan / The Weekend — research evidence handback (A0, issue #4)

**Owner of this folder:** Claude Code (stream A). **Task:** issue #4 (parent #2). **Base:** `main` @ `517272d`. **Retrieval date:** 2026-09-13 (all times UTC).

This folder returns the research that was already completed on 2026-09-13, sanitized for a public repository. No new crawl, no repeated fan-out, no new endpoint probing was done for this handback. Nothing here is merchant-approved.

## Labels used in every file

| Label | Meaning |
|---|---|
| `verified public observation` | Read from the shop's own public storefront or its anonymous read-only API on 2026-09-13; the saved raw response has the SHA-256 listed in `EVIDENCE-INDEX.md`. |
| `collaborator-reported` | Stated by an AI collaborator (Claude, ChatGPT, Grok, the auditor/reviewer agents) without a re-fetch you can hash. |
| `merchant-approved` | Confirmed by the owner (Khalid) or his staff. **None yet.** |
| `hypothesis` | A reading of the data that the data does not prove. |
| `unknown` | Not determinable from public sources. |
| `not verified` / `failed / incomplete retrieval` | As in `docs/09-SOURCES-AND-EVIDENCE.md`. |

## Files

| File | What it is |
|---|---|
| `EVIDENCE-INDEX.md` | Every endpoint used: URL, classification, retrieval time, SHA-256 of the saved raw response, item counts, pagination, field pointers, completeness, uncertainty. Failed probes listed. |
| `EXCERPTS.md` | Sanitized excerpts per requirement of #4 (branches, staff, services/prices, products/claims, memberships, booking URLs, reviews, `autoApprovalMinRating` context, slot format). |
| `catalogue.sanitized.json` | Machine-readable services/merchandise/memberships with branch mapping, prices, durations, add-ons, official product URLs. Source for the future `knowledge/` pack (issue #5). Not approved. |
| `staff.sanitized.json` | Machine-readable team list with branch mapping and schedule shape; sensitive fields removed. |
| `CORRECTIONS.md` | The eight corrections from #4, each with how this handback applies it. |
| `ONE-BRANCH-CANDIDATE.md` | One candidate branch for the owner to select, with the data behind it. Not a selection. |
| `MISSING-FACTS.md` | The exact facts still needed. No open-ended research plan. |
| `AUDIT-VERDICTS.md` | The actual auditor/reviewer verdicts that exist (four, all on the earlier proposal document), plus the status of the review of this handback. |

## What was deliberately excluded and why

- **Raw payloads are not committed** (the 217,868-byte product list, the 1,034 review objects, the settings responses). Hashes are recorded so anyone can re-fetch and compare. The excerpts contain what M1 needs.
- **Review author identifiers:** every review object carries `customerName` and an `id`; none is reproduced, and no review text is quoted verbatim anywhere in this folder (counts and bracketed paraphrases only) so authors cannot be re-identified by search.
- **Settings secrets:** the onboarding settings response contains a payment publishable key, a VAT registration number, a Meta pixel id, contact channels, logo/gallery asset ids. None of these values is reproduced. Only behaviour-relevant booleans and public marketing text are excerpted.
- **Tenant identifier:** the anonymous API calls require a `__tenant` header whose value is embedded in the public site bundle. It is not reproduced here; a reviewer re-deriving it from the bundle needs one `grep` (see `EVIDENCE-INDEX.md`).
- **Staff photos, image URLs, creator ids, iCal listing ids, commission field, holiday/override contents:** removed from the staff excerpt.
- **Per-barber iCal feeds:** see the exposure report below. Not committed, not linked.
- **Site bundle chunks** (`main.js` and lazy chunks): read only to confirm routes and parameters; not committed (third-party code).

## Exposure report (for the owner; nothing published)

Each provider record in the public team list carries an `iCalListingId`. During adversarial verification on 2026-09-13 20:10 UTC the auditor agent fetched **one** provider's iCal export **once**. It returned a calendar with 4 future events (14, 17 and 19 September 2026); each event's title was a catalogue service name; no customer name, phone, note or description was present. So the feed exposes a barber's booked time slots (occupancy), not customer identity. Per #4 the work stopped there: no other feed was fetched, the feed URL pattern and ids are not written anywhere in this repository, the local copy was deleted, and Rakan must never read these feeds. **Recommended owner action:** ask Rekaz whether provider iCal exports can be disabled or token-protected.

## Status statements (honest)

- Auditor and reviewer verdicts **on the earlier proposal document**: four completed (v1 auditor, v1 reviewer, v2 auditor, v2 reviewer). Attached in `AUDIT-VERDICTS.md`.
- Native-speaker review: **NOT_RUN**. Qualified-barber review: **NOT_RUN**. Legal/PDPL review: **NOT_RUN**.
- Review of **this handback**: one adversarial auditor pass on 2026-09-14 returned **reject** with six findings (a placeholder review section asserted as present, a false stock claim, a misattributed schedule anomaly, a wrong price-tier label, one name count off by one, one public social handle quoted in an attached verdict). All six were corrected. A narrow re-check (pass 2) found two residual defects (a seven-day flag produced by merging an expired schedule with the current one; one stale count), both corrected; a final narrow re-check (pass 3) returned **approve**. All three verdicts are in the last sections of `AUDIT-VERDICTS.md`. No broader second full pass was run.
- The original 14-agent research workflow failed on a session limit before completion; its partial outputs were not used. Everything here comes from the direct retrievals listed in the index.

## How to verify a number in this folder

1. Find the claim's evidence id (E01…E11) in `EVIDENCE-INDEX.md`.
2. Re-fetch the URL with the `__tenant` header taken from the public site bundle.
3. Hash the response; if the SHA-256 matches, the excerpt can be checked byte-for-byte; if it differs, the shop changed something after 2026-09-13 and the excerpt is stale.
