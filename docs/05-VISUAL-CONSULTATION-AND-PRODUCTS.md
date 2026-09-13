# 05 — Visual consultation, products and the barber brief

**Version:** 0.2 planning baseline, 13 September 2026. **Status:** proposed design. No vision model, product matcher or staff-brief pipeline is implemented or authorized for live customer photographs.

This document defines the P2 cosmetic layer referenced by [01 §9–11, §15–16, §36](01-PRODUCT-SPECIFICATION.md) and [02](02-PERSONA-AND-CONVERSATION.md). Corrections in [00](00-REVIEW-AND-CORRECTIONS.md) take precedence over earlier conversational examples. Privacy and retention rules in [06](06-PRIVACY-SECURITY-AND-HANDOFF.md) take precedence over convenience.

## 1. Purpose

Optional visual consultation exists so a customer who is unsure can get **practical style choices**, not a biometric report. Product advice exists so a documented finish or hold can be matched to an approved SKU. The barber brief exists so staff receive a **short, customer-approved instruction**, not a chat dump.

None of these features is required to book. P1 can ship without photographs.

## 2. Feature gates

Visual consultation stays off until all of the following are true:

1. Brand authorization for processing customer images for the stated purpose.
2. A truthful purpose / processor / retention notice that matches the actual architecture.
3. Separate, recorded permissions for: analyse-this-turn; keep-a-style-summary; keep-the-photo; share-with-assigned-staff; marketing (default off).
4. Upload validation, size limits and a text-only fallback.
5. Qualified review of cosmetic output on representative images (not only marketing photos).
6. A child/guardian path reviewed — until then, refuse photo consultation when the subject is or may be a child. Do not infer age from a face.
7. No training, advertising or unrestricted vendor reuse of customer images.

Hairstyle previews (P4) need an additional likeness, labelling and cost review. They are not enabled by turning photo consultation on.

## 3. Image intake

Accepted inputs, when the feature is on:

- a customer-supplied front image of the person to be styled;
- a side or back image only if the first view is insufficient for the requested style;
- a customer-supplied reference image of a haircut;
- a link only when the application can lawfully fetch it and actually retrieve the bytes.

Rejected or paused inputs:

- inaccessible social links — ask for the image itself; never invent an analysis;
- screenshots of other people's profiles presented as the customer's hair without clarification;
- documents, IDs, payment cards or QR codes;
- images below the quality floor in §4;
- any request to identify, verify or search a person.

Before the first upload in a conversation, present the approved notice and obtain the analyse-this-turn permission. Do not treat a previous booking as photo consent.

### 3.1 Quality floor

The application, not the model, should flag:

- extreme blur, darkness or overexposure;
- face/head largely cropped or covered;
- hair wet, under a cap, or so product-coated that shape is unreadable;
- group photos where the subject is ambiguous;
- resolution or file size outside configured limits.

On failure, ask for one specific improvement. After two inadequate images, continue with description-only advice. Do not keep retrying.

### 3.2 Subject confirmation

Ask whether the photo is **the person who will sit in the chair** or **a style reference**. Mixing those without confirmation produces a brief the barber cannot use.

## 4. Allowed cosmetic observations

From a usable image, the model may propose only visible, image-dependent, non-diagnostic notes:

| May observe (approximate) | Must not claim |
|---|---|
| Apparent length band (short / medium / long) | Millimetres, porosity, density, growth-rate days |
| Visible wave or curl pattern | Hair “type” as a medical or racial category |
| Overall silhouette and beard outline | Face-shape as a scientifically correct look |
| Obvious product shine or visible damage *as an image limitation* | Disease, infection, deficiency, “unhealthy” |
| That lighting, angle or covering limits the view | That unseen areas were assessed |

Every observation is a proposal. The application stores it as `inferred_observation`, not as a confirmed preference, until the customer adopts a style choice.

Framing rule from [02](02-PERSONA-AND-CONVERSATION.md): offer one primary look and one alternative, with maintenance trade-offs. Never score attractiveness or declare a single correct cut.

## 5. Safety stop

Stop affected-area treatment sales and do not “read a diagnosis” from the photo when the customer reports, or the conversation concerns:

- rapid or sudden shedding;
- painful, burning, oozing or severely irritated scalp or skin;
- bald patches the customer is worried about as a medical change;
- a request to treat a disease with a salon session.

Permitted path: offer ordinary cosmetic haircut options if still wanted; explain the assistant cannot determine cause; recommend assessment by an appropriate clinician. Escalation wording needs qualified review before live use. Supporting public guidance is indexed in [09 S06](09-SOURCES-AND-EVIDENCE.md). This is not a triage protocol.

## 6. Consultation output contract

Proposed structured object produced by vision + orchestrator. It is internal. Customer language is generated from it; staff see only approved fields.

```json
{
  "subject": "customer_self | style_reference | unclear",
  "image_quality": "adequate | limited | unusable",
  "limitations": ["angle", "lighting"],
  "visible_notes": {
    "length_band": "medium",
    "pattern": "slight_wave",
    "beard_outline": "full_unspecified",
    "uncertainty": "side_profile_not_visible"
  },
  "options": [
    {
      "id": "opt_a",
      "label_ar": "تدرّج خفيف مع طول طبيعي فوق",
      "label_en": "soft taper, natural length on top",
      "why_it_fits": "matches stated low-maintenance goal",
      "upkeep": "low",
      "feasibility": "barber_must_confirm",
      "do_not": []
    }
  ],
  "selected_option_id": null,
  "product_suggestion_id": null,
  "medical_sales_blocked": false
}
```

All identifiers above are synthetic. Missing fields stay missing. The model must not fill unknown measurements.

## 7. Product matching

Recommend only SKUs in the **approved, active catalog** for the relevant branch. Required grounding:

- exact variant name and size;
- documented intended use, finish or hold if the merchant recorded it;
- label warnings and directions when supplied;
- current price from the catalog/quote path;
- stock status with timestamp, or an explicit “confirm in branch” wording.

Matching logic: customer's stated goal + documented product attributes. A photo may suggest “matte, medium hold would support this look.” It may not invent ingredients, allergy safety, medical effect or that the product is waiting behind the chair.

If the catalog lacks finish/hold/ingredient fields, say so and offer staff review. One optional product after a relevant goal; honor “لا، الحلاقة بس.”

Reservation, paid retail order and a spoken suggestion are different actions ([04](04-BOOKING-STATE-AND-TOOLS.md)).

## 8. Barber brief

The brief is a separate write from booking confirmation. A confirmed appointment with a failed brief is still a confirmed appointment; report the failure.

### 8.1 Customer approval

Show the short brief and obtain permission to share it with the assigned or eligible staff. Sharing a photo is a further permission. The customer can approve text and refuse the image.

### 8.2 Staff-facing card (target: readable in eight seconds)

```text
الخدمة: [approved service]
الفرع / الوقت: [branch] · [exact local datetime]
الحلاق: [assigned or “المتاح المؤهل”]
اللوك: [selected option in ordinary language]
لا تسوي: [customer do-not list]
مرجع صورة: [attached | not permitted | none]
آخر قصة مؤكدة: [text or “غير محفوظة”]
ملاحظة المناسبة: [optional, customer-stated]
```

No attractiveness comments, no inferred ethnicity, no medical guesses, no raw chat log, no private phone if the POS already has the booking identity.

### 8.3 Delivery

Use `share_barber_brief` only after booking identity and staff assignment rules are satisfied. Persist a receipt distinct from the appointment record. If the shop only has a POS note field, write the same short card there — do not invent a staff app.

## 9. Style memory versus photographs

| Artifact | Default | Permission |
|---|---|---|
| Consultation used this turn | ephemeral | analyse-this-turn |
| Confirmed style summary (“تدرّج خفيف…”) | off until asked | save-preference |
| Source photograph | delete after the turn unless kept | keep-photo + retention period |
| Staff copy of brief/photo | only for the visit + approved window | share-with-staff |

Current explicit instructions override old memory. A previous `قص شعر` booking is not a style. Inferred observations never become preferences silently ([01 §8, §24](01-PRODUCT-SPECIFICATION.md)).

## 10. Reference looks and later previews

Reference flow: describe the look, map only supported traits onto the customer's constraints, propose an adaptation, get approval for the brief.

P4 simulation, if ever authorized:

- explicit request and permitted source image;
- label the result as a hairstyle simulation, not a guarantee;
- edit only requested hair/beard regions;
- no age, skin, body or identity alteration;
- barber still confirms feasibility in person.

## 11. Evaluation for this layer

Barbers score usefulness and safety of briefs. Native reviewers score whether customer copy over-claims. Include blurry images, covered hair, child-subject refusals, medical-adjacent messages, inaccessible Instagram links and “analyse this celebrity like it is me.”

Passing a pleasant demo on studio photos is not a P2 release.

Related: [Persona](02-PERSONA-AND-CONVERSATION.md) · [Privacy](06-PRIVACY-SECURITY-AND-HANDOFF.md) · [Acceptance](07-ACCEPTANCE-AND-METRICS.md) · [Sources](09-SOURCES-AND-EVIDENCE.md).
