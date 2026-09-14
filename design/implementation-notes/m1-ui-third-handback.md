# M1 UI third handback — Stream B (issue #6)

**Status:** `implemented` in this repository (plain HTML/CSS/JS, synthetic fixtures only). **Not** visually compared at gold sizes, **not** model/vision tested, **not** released, **not** G01–G13.

**Base:** `c4a372cbbe4659903a31350ede219fd7a479fe83` (`main` after PR #23).
**Branch:** `cursor/b-rakan-ui-hb3-4adc` (`work/b-rakan-ui` already holds the merged second handback; this is a new branch from `main`, no force-push).

## What shipped

All five items from the 2026-09-14 21:15 UTC note on #6:

| Item | Where |
|---|---|
| Consent step on `403 CONSENT_REQUIRED`, grant `POST /consents` `{ kind, granted_via: "customer_ui" }`, withdraw `POST /consents/:receipt_id/revoke`, then retry the original click | `src/ui/consent/consent-step.js`, `src/ui/app.js` |
| Brief approve `POST /briefs` from `ChatTurnOutput.brief_draft`; then `POST /briefs/:brief_id/share-actions` body `{}`; render `allowed_actions` as `data-executable="true"` | `src/ui/brief/brief-draft.js`, `src/ui/brief/share-controls.js`, `src/ui/app.js` |
| Direct preference save `POST /preferences` when `capabilities.preferences === "enabled"` and no server `save_preference` action | `src/ui/preferences/preference-editor.js`, `src/ui/app.js` |
| Hide M2 ids on the customer capability screen (`?gallery=1` still lists them for reviewers); translate `value_text` / `booking_handoff` / `photo_analysis` / preference kinds; restore focus after `paint()` | `src/ui/capability/capability-copy.js`, `src/ui/copy.js`, `src/ui/focus.js` |
| Photo upload `POST /uploads` (raw image bytes, not JSON) behind photo consent, only when `capabilities.photo === "enabled"`; `state.imageRef` from `{ image_ref }`; `continue_without_photo` kept | `src/ui/conversation/optional-image.js`, `src/ui/app.js` |

Photo share copy is «مشاركة ملاحظات الصورة» (D14: stored observations, never image bytes).

## API surface used (read from `main`, not invented)

- `POST /consents` `{ kind, granted_via }` → `PermissionReceipt`
- `POST /consents/:receipt_id/revoke` `{}` → revoked `PermissionReceipt`
- `POST /briefs` `{ text_ar, do_not, option_id, barber_preference }` → approved `BarberBrief`
- `POST /briefs/:brief_id/share-actions` `{}` → `{ contract_version, allowed_actions }` (issue #7 16:25 UTC; **soft dependency on PR #24** — if the route is not on `main` yet the UI still approves the brief and tests mock the fetch)
- `POST /actions/:id` unchanged
- `POST /preferences` `{ kind, value_text, source, version? }`
- `POST /uploads` raw bytes + `Content-Type: image/jpeg|png|webp` → `{ image_ref }`

`CONSENT_REQUIRED` kinds are taken from the clicked action's `requires_receipt_kind`, else `message_key` / `details.capability` on the ErrorShape (`photo.consent_required` → `photo_analysis`, `preference.consent_required` → `text_preferences`, `brief.share_consent` → `staff_sharing_text`, `brief.photo_consent` → `staff_sharing_photo`). ErrorShape.details on `main` does not currently carry `requires_receipt_kind`.

## Tests

`tests/ui/dom-wiring.test.mjs` extended for consent retry, brief approve + share-actions, direct preference save, focus restore, and upload `imageRef`. Additional cases in `tests/ui/third-handback.test.mjs`.

`design/reference/**` SHA-256 must remain `7ee86b47bd1b75f21655e30bd2a2770b8a9f4bea8ce1e50af7982f0a80b0d980`.

## Not run

Visual comparison screenshots at 390×844 / desktop; real model / vision / provider; owner-review walkthrough (#8); production deploy; live `POST /briefs/:id/share-actions` against `main` until PR #24 merges.
