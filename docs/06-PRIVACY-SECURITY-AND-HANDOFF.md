# 06 — Privacy, security and human handoff

**Version:** 0.2 planning baseline, 13 September 2026. **Status:** proposed controls. This is not a legal opinion, DPIA, PDPL certification or security audit.

Rakan will process conversational data and, if P2 is enabled, images. The merchant is expected to be the controller for customer personal data; vendors are processors only under written terms. Confirm roles before any live processing. Indexed official sources: [09 S04, S05](09-SOURCES-AND-EVIDENCE.md).

## 1. Design principles

- Collect the minimum needed for the current task.
- Separate purposes. Consent or another lawful basis is purpose-specific.
- Booking can complete without photo, marketing or durable style memory.
- The model never receives raw credentials, full payment payloads or unrestricted data stores.
- Withdrawal and deletion must be implementable, not only promised.
- A public repository must not contain customer, staff-performance or credential material ([AGENTS.md](../AGENTS.md)).

These principles guide product design. They do not replace counsel or SDAIA guidance.

## 2. Purpose register (proposed)

| Purpose ID | What happens | Default | Notes |
|---|---|---|---|
| `svc_conversation` | Answer and route the current chat | operational, session | Minimize logs |
| `svc_booking` | Quote, create, change, cancel, notify | operational | Provider is system of record |
| `svc_handoff` | Staff case with minimal context | operational | Pause autonomous replies |
| `pref_style` | Store confirmed look / do-not list | off | Customer-initiated |
| `media_analyse` | Process image this turn | off | Notice required |
| `media_retain` | Keep photo beyond the turn | off | Period required |
| `media_staff_share` | Send photo/brief to assigned staff | off | Distinct from analyse |
| `mkt_lifecycle` | Reminders / offers outside service messages | off | Channel + quiet hours |
| `analytics_ops` | Pseudonymous product events | operational, minimized | No raw chat/photos |

Do not bundle `media_retain` or `mkt_lifecycle` into booking confirmation. Record notice version, time, channel identity and scope on every grant or withdrawal.

## 3. Identity

Bind the session to the verified channel account (for WhatsApp, the Cloud API user identifier), not to a phone number typed in free text.

Shared and reassigned numbers happen. Before revealing history, changing a booking or exporting data:

- require a challenge consistent with the provider and risk (for example booking reference + last visit date);
- refuse face identification;
- if uncertainty remains, hand off.

A website login must not automatically expose a WhatsApp history ([01 §2](01-PRODUCT-SPECIFICATION.md)).

## 4. Children and family bookings

Adult-managed booking of an allowed kids service may be in scope if the merchant catalog supports it and identity of the booking adult is bound.

Until a reviewed guardian process exists:

- no photo consultation of a child;
- no style memory that profiles a child from an image;
- no age or guardianship inference from a photograph.

If the conversation indicates the subject is a child and a photo arrives, do not analyse it. Explain the limit and continue with text booking if appropriate.

## 5. Retention (to be numbered before launch)

Proposed starting policy — **not approved retention periods**:

| Data | Working proposal to decide with the merchant |
|---|---|
| Session / tool traces | Short operational window, then delete or heavily redact |
| Booking / payment / invoice | Provider and statutory financial retention |
| Handoff case | Until resolved + short audit window |
| Confirmed style preference | Until withdrawal or inactivity rule |
| Photographs | Delete after the turn unless `media_retain`; if retained, short explicit expiry |
| Staff copy of a photo | Visit window only |
| Marketing suppression | Keep the suppression, not the campaign profile |

Withdrawal of optional permissions must not silently erase legally required financial records, and must not keep optional media “because it might be useful.”

Downstream deletion: model vendor, object storage, staff devices, backups. If a vendor cannot delete on request, do not send them optional media.

## 6. Channel rules (WhatsApp proposed primary)

Public WhatsApp Business policy requires approved templates for business-initiated messages outside the customer-service window, and a prompt human escalation path when automation is used ([09 S04](09-SOURCES-AND-EVIDENCE.md)).

Proposed product rules:

- Service messages (booking confirmation, change, reminder the customer asked for) use the correct template category and exact approved variables.
- Marketing and win-back use a separate permission and template set.
- Quiet hours and frequency caps are configured, not left to the model.
- Opt-out is immediate and honored across automated sends.
- Do not scrape personal WhatsApp status or profile photos.
- Interactive lists and buttons are preferred over long menus; they do not change consent rules.

Exact Cloud API numbers, WABA IDs and template names stay in private operations, not this repository.

## 7. Human handoff

Handoff is a real queue, not a sentence.

### 7.1 Triggers

Customer asks for a person; repeated misunderstanding; payment mismatch; complaint; safety/medical-adjacent stop; policy exception; unknown write outcome; out-of-scope request; suspected child-photo case.

### 7.2 States

`queued` → `assigned` → `accepted` → `resolved` | `expired` | `failed_to_queue`

Customer copy:

- “سجلت الطلب برقم [case]” only after `queued` exists;
- “زميل استلم الطلب” only after `accepted`;
- out-of-hours: actual staffed hours and a real fallback (call the branch, official booking link), never a invented callback time.

While a human owns the thread, the assistant does not sell or send autonomous operational promises. It may still supply tools to the human if that is the operator console design.

### 7.3 Context pack

Minimum necessary: customer-facing name if any, booking references they already own, last intent, open operation IDs, permissions in force. No full photo history unless `media_staff_share` covers it.

## 8. Security baseline (engineering)

When implementation is separately authorized:

- separate dev / staging / production;
- secrets in a private manager, never in Git;
- scoped service accounts per provider;
- typed tools only — no `execute_sql`, no open URL fetch, no arbitrary admin methods;
- allowlisted media types and size; strip unexpected metadata where feasible;
- signed webhooks verified on the raw body ([09 S02](09-SOURCES-AND-EVIDENCE.md) for Rekaz's published HMAC header);
- idempotency keys and reconciliation for writes ([04](04-BOOKING-STATE-AND-TOOLS.md));
- output sanitization so retrieved product text cannot become a new system rule;
- staff overrides logged with actor and reason.

Untrusted inputs include customer text, images, OCR, reference URLs and catalog copy. None of them grants tool authority.

Hosting region, model vendor and subprocessors are **not selected in this baseline**. A server in Saudi Arabia does not prove that vision or LLM inference stays in Saudi Arabia. Cross-border transfer rules must be reviewed against current SDAIA transfer regulation before personal data leaves the Kingdom ([09 S05](09-SOURCES-AND-EVIDENCE.md)).

## 9. Data-subject requests

Expose `request_data_access` and `request_data_deletion` as case-opening tools, not as instant silent wipes of financial systems.

Flow: verify identity → scope the request → gather provider + local stores → complete or explain lawful retention → record the outcome honestly. Do not promise a deadline the operations team cannot meet.

## 10. Incidents

If personal data is exposed, follow the merchant's incident process and applicable PDPL notification duties. This repository must not receive incident evidence. Product rule: take the affected feature offline rather than invent a customer-facing technical story.

## 11. What this document does not do

It does not appoint a DPO, set final retention days, approve a vendor, or authorize production. Those are [08](08-DELIVERY-PLAN-AND-INPUTS.md) inputs.

Related: [Truth](03-TRUTH-AND-INTEGRATION.md) · [Tools](04-BOOKING-STATE-AND-TOOLS.md) · [Visual](05-VISUAL-CONSULTATION-AND-PRODUCTS.md) · [Acceptance](07-ACCEPTANCE-AND-METRICS.md).
