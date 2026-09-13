# The Weekend / Rakan

**Rakan (راكان)** is the proposed digital grooming concierge for The Weekend: useful styling consultation, appropriate product advice, trustworthy booking assistance, and a customer-approved style history.

## Status — 13 September 2026

**DOCUMENTATION ONLY. NOT IMPLEMENTED. NOT RELEASED FOR LIVE CUSTOMER USE.**

The repository owner requested a review of the complete proposed experience before implementation. This is the corrected planning baseline, not proof of a functioning agent, integration, commercial result, or legal compliance. Rakan is a working name requiring brand approval. This is an assistant-led requirements review, **not an independent audit or certification**.

## Start here

| Document | Purpose |
|---|---|
| [Review and corrections](docs/00-REVIEW-AND-CORRECTIONS.md) | Errors, unsupported claims, scope problems and their corrections. |
| [Complete product specification](docs/01-PRODUCT-SPECIFICATION.md) | Revised coverage of all 40 original specification sections. |
| [Persona and conversations](docs/02-PERSONA-AND-CONVERSATION.md) | Saudi Arabic character, transparent identity, sales rules and examples. |
| [Business truth and integration](docs/03-TRUTH-AND-INTEGRATION.md) | Verified public observations, missing merchant data and integration discovery. |
| [Booking states and tool contracts](docs/04-BOOKING-STATE-AND-TOOLS.md) | Correct transactions, confirmation, payment separation and failure recovery. |
| [Visual consultation and products](docs/05-VISUAL-CONSULTATION-AND-PRODUCTS.md) | Cosmetic photo advice, product suitability and the barber brief. |
| [Privacy, security and handoff](docs/06-PRIVACY-SECURITY-AND-HANDOFF.md) | Permissions, retention, channel rules, human operations and security. |
| [Acceptance and metrics](docs/07-ACCEPTANCE-AND-METRICS.md) | Proposed tests, release gates and honest business measurement. |
| [Delivery plan and required inputs](docs/08-DELIVERY-PLAN-AND-INPUTS.md) | Small releases, the 25 original business inputs and decision log. |
| [Sources and evidence](docs/09-SOURCES-AND-EVIDENCE.md) | Primary-source URLs, observations and limitations. |
| [Coverage map](docs/10-COVERAGE-MAP.md) | Traceability of the original vision and all 40 specification sections. |
| [Repository instructions](AGENTS.md) | Rules for future assistants and developers. |

## Product direction

**Help me choose -> book accurately -> brief the barber -> learn from feedback.**

Customers who only want an appointment must be able to skip consultation. Photos are optional. Product advice serves the customer's expressed goal, not a sales quota. Natural conversation must not conceal that Rakan is a digital assistant.

The proposed pilot is one location, an approved service/product catalog, one authorized booking workflow, a staffed handoff, and optional cosmetic photo consultation after its privacy and quality gates. This pilot boundary is not a claim about the brand's number of locations.

The roadmap preserves style history, barber matching, memberships, occasions, feedback, website chat, Instagram, voice and hairstyle previews. These are staged rather than all promised in the first release.

## Non-negotiables

- No invented services, prices, staff qualifications, appointments, inventory, promotions or completed actions.
- A selected slot, sent request, checkout link or payment screenshot is not a confirmed booking.
- No medical diagnosis, disease-treatment promises, attractiveness scoring, facial recognition or identity inference from customer images.
- No customer photos, conversations, credentials, signed URLs, private staff data or private business exports in this **public repository**.
- Photo consultation permission does not authorize permanent storage, advertising, model training or marketing messages.
- No selective positive-review solicitation, fake scarcity or repeated upselling after refusal.
- Public website information does not demonstrate access to the merchant's operational systems.

## Current evidence

The public brand pages support premium grooming, memberships and curated products, but the observed booking pages expose no bookable services. That does **not** establish that the business has stopped taking bookings. A Rekaz-hosted asset is visible, and Rekaz publishes merchant integration documentation, but the merchant tenant, credentials and permitted capabilities remain unverified. See [evidence](docs/09-SOURCES-AND-EVIDENCE.md).

## Next gate

Resolve brand authorization, catalog/policy truth, booking-provider access, human operations, privacy design and the pilot boundary. Then prepare and test the implementation/prompt package. This documentation work does not authorize deployment, real appointments, customer outreach, paid provider usage or processing real customer photos.

Unless labeled as verified evidence, names, conversations, prices, identifiers, thresholds and release boundaries are examples or proposals. Referencing The Weekend here does not assert a signed commercial partnership.
