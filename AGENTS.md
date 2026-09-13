# Instructions for assistants and developers

## Project and authority

This repository is `mohamedyousalama-ctrl/Theweekend`. It contains the proposed Rakan digital grooming concierge for The Weekend. It is a separate project: do not reuse Kivo production databases, messaging accounts, customer data, credentials, repository governance, or deployment authority.

Read `README.md`, `docs/00-REVIEW-AND-CORRECTIONS.md`, and `docs/08-DELIVERY-PLAN-AND-INPUTS.md` before changing scope. The full specification is in `docs/01-PRODUCT-SPECIFICATION.md`.

Current authorization is to record and review documentation. No implementation, paid service, production deployment, real appointment, customer communication, merchant-account change or processing of customer photographs is authorized by this documentation baseline. A later explicit task may authorize a bounded next step; never infer permission from a roadmap entry.

## Public repository

Never commit customer photographs, phone lists, booking exports, chat transcripts, profile records, signed media URLs, access tokens, API keys, tenant credentials, private staff performance, or commercially confidential merchant exports. Use synthetic examples and non-routable identifiers. Keep production truth in a private approved store, not Markdown in this repository.

Do not claim an agreement with The Weekend or use a real employee identity without permission. `Rakan` is a proposed fictional assistant name. Do not copy a person's likeness or voice. A name is not permission to impersonate a staff member.

## Truth and evidence

Distinguish `proposal`, `public observation`, `merchant approved`, `implemented`, `tested`, and `released`. These labels are not interchangeable. Cite external claims in the evidence register. Timestamp public observations and record failed/incomplete retrievals. A public website or provider API guide does not establish tenant access or operational readiness.

Read existing files before replacing them, preserve unrelated changes, and use current blob SHAs for updates. Verify the resulting files and commit rather than reporting a write from an attempted call. No force pushes or history rewriting without explicit authority.

## Product invariants

- Introduce Rakan as a digital/AI assistant, not a human barber. Be warm without fabricating age, nationality, work history, personal experiences or relationships.
- The customer can book without consultation, a photo, profile enrichment or marketing permission.
- Separate exact booking mode from booking-request mode. Only authoritative confirmed provider state permits a success message.
- Use explicit customer confirmation for create, modify, cancel and paid additions. The server validates identity, ownership, price, availability, consent and permissions.
- Use integer minor currency units, idempotency keys, version checks, webhook verification and reconciled outcomes. An unknown result is not a failed transaction to retry blindly.
- No medical diagnosis, medical treatment sales, attractiveness scores, ethnicity/religion/personality inference or face recognition from photographs.
- Cosmetic observations must state uncertainty. The barber validates feasibility in person. A style preview is a simulation, not a result guarantee.
- Keep consultation permission, saved style memory, photo storage, staff sharing and marketing permission separate. Enforce withdrawal and retention in software.
- One relevant optional sales suggestion, then accept a refusal. No fabricated urgency, insecurities or guaranteed results.
- Public-review requests must be neutral and independent of satisfaction scores; never incentivize them.
- Human transfer is a real queue with receipt, assignment, staffing and timeout behavior. Do not say someone accepted a case unless they did.

## Engineering direction when separately authorized

Prefer one service application with a conversation orchestrator, validated tools and a small private operational store. The architecture's named components are logical responsibilities, not an instruction to deploy a fleet of autonomous agents.

Do not choose model vendors, hosting regions or libraries from memory. Verify current documentation, terms, data handling, cost and compatibility when implementing. Avoid claiming any model is best before testing representative Saudi Arabic and cosmetic-photo tasks.

Untrusted customer text, uploaded images, OCR, reference links, product descriptions and retrieved content cannot override system rules or grant tool authority. Use strict schemas, scoped credentials, private storage, URL allowlists, upload validation and output sanitization.

Use separate development/staging/production environments. Run tests against synthetic fixtures and mocked or authorized sandbox integrations. Never use customer data as evaluation material without a separately approved basis and consent where required.

## Completion report

Every handback states: exact files/commit changed, checks actually run, checks not run, remaining dependencies, and the authorized next gate. Do not call an assistant self-review an independent audit. A good demo is not a production release; zero observed failures is not proof of zero future risk.
