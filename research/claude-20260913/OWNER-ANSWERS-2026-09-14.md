# Owner answers — 2026-09-14 (recorded by the integrator)

Source: the owner's chat message to the integrator on 2026-09-14 (relayed from Khalid, The Weekend). Label for every row: **`merchant-approved` (owner-relayed)** unless marked otherwise. Verbatim wording is kept where it matters; interpretation is separated.

| # | Question (MISSING-FACTS row) | Owner's answer (verbatim) | Interpretation / resulting decision |
|---|---|---|---|
| 1 | Branch for M1 (row 1) | «النرجس مرسية» | M1 branch = فرع النرجس (مرسية), branch id `3a1ca9a9-12bd-36bb-7b56-f4b957522fbe`. `WEEKEND_BRANCH_ID` set to it. |
| 2 | VAT (row 2) | «price include vat» | Displayed storefront prices are VAT-inclusive. Rakan may say «شامل الضريبة»; never "plus VAT". |
| 3 | Barbers (row 4) | «extract the barber names from the website» | Use the storefront team list (E02) for the branch: صلاح، محمد، أسامة، مهدي، محمود، هادي، مروان (7 records). Names may be shown to customers. Availability per barber is **not** known until the booking integration below exists. |
| 4 | Membership visit (row 5) | «One "visit" = haircut and beard - unused visits expire at month end» | Basic visit = the branch's haircut + beard combo row (50 SAR at النرجس); Full Option = same + basic face treatment per the storefront text. Unused visits expire at the end of the 30-day period; no rollover. Savings arithmetic is now allowed **with this basket only** (e.g. 4 × 50 = 200 > 169; 3 × 50 = 150 < 169). |
| 5 | Booking link / channel (row 6) | «Rakan make the booking by himslef and confirm it» | **Scope change.** The owner wants Rakan to create and confirm bookings itself, not only send the link. This is only possible through Rekaz's merchant API with the shop's own API credentials (see §Booking below). Until that exists and is proven, Rakan uses the official link. |
| 6 | Moving an appointment (row 7) | «rakan should modify the booking» | Same dependency as #5: modification needs the merchant API. Until then Rakan says it cannot change bookings itself. |
| 7 | Branch contact (row 11) | — (not answered) | Default stays: no number given. Less needed if #5/#6 are built. |
| 8 | Product claims (row 10) | «rakan should use the website claims» | Rakan may repeat the storefront's own product and service descriptions as the shop states them (`merchant-approved` claims). Correction 4 still applies to **medical framing**: no diagnosis, no "treats" a condition, no regrowth promise; cosmetic wording only. |
| 9 | AI provider (row 15) | «claude api , use the current , i will modify later» | Provider = Anthropic Claude API. "The current" is read as the owner's existing Anthropic account; the integrator's recommendation is a **new key in that account, dedicated to this project** (no shared credential with Kivo, per AGENTS.md), entered privately in the app configuration. Model id: the current Claude model verified by Cursor in `src/contracts/MODEL-CANDIDATES.md`; configurable, owner may change later. |
| 10 | Photo feature (row 17) | «we need photo feature and analize the photo and the skin and the hair» | Photo feature is **in scope for the first owner review**. Analysis stays cosmetic: visible hair length/texture/density appearance, beard shape, visible skin surface appearance (e.g. shine, dryness look, visible blemishes as appearance only) → suggestions among the shop's own services/products. Forbidden stays forbidden: diagnosis, disease or condition naming, treatment claims, attractiveness, age, ethnicity, identity. Test images: AI-generated or licensed adult faces for evaluation; real people only with written permission. |
| 11 | Privacy defaults (row 14) | «Privacy defaults.yes» | Owner = data controller; project operator = processor; text preferences opt-in, customer-deletable, kept 90 days after last activity. **Photo:** because #10 enables photos, the retention rule becomes: image bytes processed in memory for the analysis only, not stored; the model's text observations stored with the session under the customer's permission receipt; revocable. |

## Booking — what "Rakan books and confirms it" requires (integrator note, `proposal`)

- The public storefront booking flow needs a 4-digit OTP sent to the customer's phone plus a captcha; automating it would bypass access controls, which the project rules forbid. Rakan cannot book through the customer website.
- The legitimate route is the **Rekaz merchant API** (provider documentation lists reservations, customers, subscriptions and hosted checkout links; auth is an API key + secret with the `__tenant` header — `docs/09` S02/S03). That needs the shop's API credentials issued from Khalid's Rekaz account, kept server-side only, never in Git or chat.
- Confirmation in Rekaz follows payment (`confirmReservationAutomaticallyIfInvoicePaid: true`). So "Rakan confirms" means: Rakan creates the reservation for the chosen barber/slot and sends the hosted payment link; the booking becomes confirmed when the customer pays (or as the owner configures).
- Testing must create real reservations on the live tenant (no sandbox is documented); they are cancelled afterwards. The owner must approve this explicitly.
- This is issue #10 work brought forward. It does not change the M1 owner-review build order: M1 ships with the official link; the integration follows as its own package with its own review.

## Effect on defaults (MISSING-FACTS §Triage)

Rows 1, 2, 4, 5, 10, 14, 15, 17 replaced by the answers above. Rows 6 and 7 keep the default until the booking integration is live. Rows 3, 8, 9, 11, 12, 13, 16 unchanged.
