# 00 — Review and corrections

**Reviewed:** 13 September 2026. **Scope:** the complete conversational vision and the numbered 40-section V1 specification. **Method:** assistant-led requirements review, primary-source checks and consistency review. No application, merchant API, model evaluation, customer trial, legal assessment or independent audit has been completed.

## Conclusion

Keep the differentiated experience: optional photo-based cosmetic consultation, service and product advice, accurate booking, a barber brief and customer-controlled style memory. Do not turn it into a generic FAQ bot. However, the original specification was too broad for a first live release, sometimes treated examples as business facts, and omitted important transaction, privacy and measurement controls.

The corrected baseline is **proceed with staged design; not ready for production**. Commercial benefit is a hypothesis to measure, not a promised revenue increase.

## Correction register

| ID | Earlier weakness | Binding correction |
|---|---|---|
| R01 | Human-sounding persona could imply a real Saudi employee in his late twenties. | Rakan is a named digital/AI assistant. Saudi Arabic is a language style, not a fabricated biography. Transparent introduction, truthful answers about being AI. |
| R02 | Earlier messages asserted current branches, barber abilities, available times and payment capabilities without operational evidence. | Treat examples as synthetic. Merchant-approved records and authorized live provider responses are required. No invented branch/barber names in customer output. |
| R03 | The plan implied the public website was enough to connect booking. | Public pages support the brand direction, not API access. Rekaz has public integration documentation, but The Weekend's tenant/provider capabilities remain unverified. [S01, S02] |
| R04 | Choosing a time was immediately followed by a confirmed booking message. | Show the full appointment and total, obtain consent, submit once, and confirm only when the authoritative booking record is confirmed. [Design rule] |
| R05 | Payment, booking and delivery of the confirmation were conflated. | Separate appointment, payment and notification state. A payment screenshot is not proof; a paid-but-unconfirmed appointment needs reconciliation and human handling. |
| R06 | Failed/slow tool calls had no ambiguity handling. | An unknown write outcome must be reconciled by operation ID before any retry; prevent duplicate bookings/charges. |
| R07 | Too many V1 capabilities were treated as one launch. | Split into P0 planning, P1 reliable concierge, P2 cosmetic consultation, P3 relationship features and P4 previews/channels. Preserve all later ideas in the roadmap. |
| R08 | Photo analysis sounded like objective face/hair measurement. | Observations are approximate, image-dependent and cosmetic. No exact density, porosity, length or disease claims from a casual photo. Use customer preferences and in-person barber validation. |
| R09 | Face-shape advice implied a scientifically correct look. | Recommendations are aesthetic options, not an attractiveness judgment. Offer one or two styles with trade-offs and respect a customer's preferred look. |
| R10 | The product sales flow said to 'diagnose' the need. | Say 'understand the grooming goal.' No medical diagnosis, hair-regrowth promise or sale of a salon session as disease treatment. [S06] |
| R11 | Product hold, finish, suitability, stock and allergy safety were implied from the photo. | Ground attributes in approved labels/catalog; ask about routine and reported sensitivities where relevant. Unknown ingredients or safety suitability mean human review, not reassurance. |
| R12 | Medical-looking concerns could lead straight to a treatment upsell. | Stop affected-area cosmetic treatment recommendations, explain the limitation and recommend professional assessment. Urgent symptoms follow a clinician-reviewed escalation script. [S06] |
| R13 | Photos and style history were automatically persistent. | Consultation, saving preferences, keeping photos, sharing a barber reference and marketing have separate controls; no durable photo retention by default. [S05; proposed stricter product design] |
| R14 | A WhatsApp phone number was treated as sufficient identity forever. | Bind to verified channel identity, handle shared/reassigned numbers and verify ownership before revealing history or modifying bookings. Never identify a person by face. |
| R15 | Child/family services lacked an authorization path. | Retain adult-managed family bookings if supported; children's photo consultation remains off until a reviewed guardian process is implemented. Do not infer age or guardianship from a photo. [S01, S05] |
| R16 | 'Transferred to the team' was used as if a person had already accepted. | Track queued, assigned, accepted, resolved and expired handoff states. Tell the customer exactly what happened and provide a real fallback route. [S04] |
| R17 | Reminders, win-back messages and replenishment were automatic. | Separate service and promotional messages; apply permission, quiet hours, channel rules, frequency limits, suppression and immediate opt-out. WhatsApp has template/window rules and requires escalation paths. [S04] |
| R18 | Happy customers would be asked for public reviews; unhappy ones would not. | Remove review gating. Recovery follows dissatisfaction, but neutral review eligibility must not depend on score. No incentives or scripted positive reviews. [S07] |
| R19 | A single overall 'quality score' could hide a critical failure. | Safety, privacy and transaction failures are hard release gates. Report test counts and category results, not an arbitrary readiness percentage. |
| R20 | Revenue influenced by the agent was treated like incremental revenue. | Separate assisted revenue, collected net revenue and experimentally estimated uplift. Deduplicate bookings and account for cancellations, refunds, discounts and operating cost. |
| R21 | Barber recommendations could be biased by unsupported ratings or open chairs. | Use approved skill tags, service eligibility, verified schedules and customer preference. Performance data needs sample-size/context review; it must not silently become a punishment system. |
| R22 | Pre-visit advice suggested default timing or extra treatments before every event. | Use service-specific approved guidance and the customer's schedule. Do not recommend a new chemical/skin treatment immediately before an occasion without appropriate staff review. |
| R23 | The initial vision named BATCI, donation-per-haircut, strong public ratings and a particular interior identity as facts. | Not reverified sufficiently in this review. Do not seed these claims into the agent. Retain as merchant-verification questions, not public promises. |
| R24 | Membership selling could ignore eligibility, caps or enrollment restrictions. | Calculate against exact approved terms and the same basket of services. The public site indicates in-branch enrollment for family memberships; do not promise online activation. [S01] |
| R25 | Photo previews could be interpreted as an exact expected result. | Later opt-in simulation only. Preserve identity, label generated references, forbid unrelated retouching and require barber feasibility review. |
| R26 | Many named 'engines' implied a complex multi-agent build. | Implement logical responsibilities within a simple controlled application first. The model proposes; the application authorizes and executes. |
| R27 | A linked Instagram/TikTok photo was assumed readable. | Use permitted fetch only; inaccessible reference links require a customer-supplied image. No invented visual analysis or bypass of access controls. |
| R28 | Free-form memory could preserve inferred or outdated preferences. | Store provenance, confirmation and timestamps; separate inferred observations from confirmed preferences. Current explicit customer instructions override old memory. |
| R29 | A public GitHub repository could become a source of operational data. | Publish specifications and synthetic fixtures only. Keep customer/media/staff/credential information in approved private systems. |
| R30 | The first README used observations that could not all be reproduced in this continuation. | Reword the evidence summary to reflect retrieval limits. A failed page fetch does not mean the business is closed or booking is unavailable. |

## What was actually verified

The accessible Arabic homepage describes grooming, memberships and product categories. Some subsidiary and English pages could not be reliably retrieved in this pass. Rekaz publishes developer/integration material and secure-key guidance; that does not confirm this project's access to The Weekend's systems. WhatsApp's policy, Google's review rules, SDAIA's official indexed regulation text and AAD hair-loss guidance support the targeted corrections. See [the source register](09-SOURCES-AND-EVIDENCE.md).

No live services, exact tariffs, staff, stock, schedules, discount rules, membership entitlements or payment configuration were verified. No sensitive accounts were accessed. No photos or customer conversations were processed.

## Still deliberately ambitious

The goal remains a trusted personal grooming experience, not just FAQ answers. A successful demonstration should show: a direct-booking shortcut; an optional consultation; two practical style choices; a factual product recommendation; a correctly confirmed appointment; and a usable staff brief. Repeated visits should improve continuity only when the customer chooses to keep relevant preferences.

## Source key

S01 brand website; S02 Rekaz documentation; S03 Rekaz credential guidance; S04 WhatsApp policy; S05 SDAIA PDPL/implementing regulation; S06 American Academy of Dermatology; S07 Google Maps contributions policy. Exact URLs and retrieval limitations are in [09](09-SOURCES-AND-EVIDENCE.md).
