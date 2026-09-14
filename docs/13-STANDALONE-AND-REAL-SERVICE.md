# 13 — Decision: standalone Weekend project and real-service experience

**Recorded:** 13 September 2026. **Authority:** founder's latest conversation direction approving the pre-build approach and adding complete project separation, natural real-service behavior, useful visual/style consultation and customer-selected next actions.

**Decision state:** accepted product direction; not evidence of implementation, business authorization, clinical correctness, live integrations or production release. This amendment takes precedence over earlier conflicting scope/reuse suggestions. It does not weaken existing safety/privacy/transaction rules.

## D1 — A separate product, not a Kivo tenant

The project is The Weekend, with its dedicated Rakan persona, grooming/style knowledge, approved catalog/policies, evaluation material, code ownership and operational lifecycle. Kivo is not its control plane or runtime.

| Boundary | Required isolation |
|---|---|
| Source | Theweekend repository; no required sibling checkout/submodule or moving Git dependency |
| Knowledge | Dedicated reviewed Weekend content and retrieval namespace; no Kivo data/food pack |
| Runtime | Own application/deployment configuration and release pipeline |
| Secrets | Dedicated project credentials/scopes; no Kivo production keys |
| Data | Separate databases/storage/indexes/customer memory and retention operations |
| Channels | Dedicated authorized messaging configuration; no borrowing Kivo numbers or sessions |
| Operations | Own logs, cost attribution, staff queue, incident ownership and release decision |

Generic code can be imported selectively under [11](11-REUSE-MANIFEST.md), after rights/dependency/test review, and then maintained locally. That reuses engineering work without sharing live infrastructure. No shared package or service is required; future changes to this boundary need a new explicit decision.

## D2 — Real capability, not scripted appearance

The product must process the customer's actual permitted input using configured real model/tools, not static demonstration answers. Naturalness means relevant follow-ups, concise Saudi Arabic, correct context, remembered approved preferences, practical choices and reliable follow-through. It does not mean claiming to be a human, inventing a biography, false familiarity or hiding AI identity.

Test fixtures remain required and isolated. A private preview discloses simulated/unconnected functions. Customer-facing mode cannot silently use mock model responses, pretend a stock check succeeded, invent an appointment reference or claim a staff member accepted a case. Missing required configuration disables the affected capability with a clear fallback.

Integration-limited booking can be a real staffed request service, but must say the appointment awaits confirmation. Do not advertise instant booking without the corresponding verified capability.

## D3 — Genuine cosmetic consultation with limits

Rakan must consider the image's quality, visible hair/beard features, approximate relevant proportions, customer's own goals and approved grooming guidance. It offers practical alternatives with reasons, maintenance and feasibility checks. It must not simply reuse a generic haircut answer.

Correctness is assessed with permissioned cases and qualified grooming review; it is not promised by selecting a model. Aesthetic advice is subjective and customer preference wins. Exact anatomical/follicle measurements, medical diagnoses, disease causes and treatment guarantees are outside scope. Medical-looking or reported concerns need appropriate professional assessment, not an upsell.

[05](05-VISUAL-CONSULTATION-AND-PRODUCTS.md) is the detailed visual contract. Photo permissions and deletion are enforced before real-photo use, not added later.

## D4 — Customer chooses the next action

At useful decision points Rakan offers two or three context-relevant options, while accepting free text and changes of mind. Options include choosing/adapting a style, asking about maintenance, inspecting approved products, checking appointments, editing a brief or speaking to staff. Actions depend on current state, permissions and actual supported capabilities.

Buttons never grant broad consent. Choosing a style does not authorize a transaction or photo storage. [12](12-CUSTOMER-NEXT-ACTIONS.md) defines states, examples and server validation.

## D5 — Build and launch are different gates

The first full customer experience should join consultation to a real supported next step. Engineering may build orchestration, tests, booking and vision in stages; it must not describe a partial internal preview as the finished product. Avoid adding voice/previews/proactive marketing before the core is useful and trustworthy.

The current repository amendment finishes planning artifacts only. The next bounded build task should specify exact paths, candidate imports, synthetic tests, permitted model calls/budget and completion evidence. Live customer use still needs merchant approval, catalog/provider truth, media/privacy controls, staff coverage, specialist review and passed feature-specific tests.

## D6 — Remaining open work

No application, extracted module, test harness, configured model, photo evaluation, deployment, live booking, payment or messaging integration has been completed by this amendment. No real customer image/data has been processed. There is no claim of production isolation already being provisioned; the matrix above is a build requirement. Completion reports must preserve these distinctions.
