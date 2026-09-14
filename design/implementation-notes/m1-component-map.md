# M1 component map — Rakan customer / staff UI

**Issue:** [#6](https://github.com/mohamedyousalama-ctrl/Theweekend/issues/6) first handback (design mapping only).
**Stream:** B (Grok). **Status label:** `proposal` for this map; second-handback components are `implemented` (not visually compared, not released) — see `m1-ui-second-handback.md`. Third handback (consent, brief approve/share, direct prefs, polish, upload) is `implemented` in `m1-ui-third-handback.md`.
**Base pin:** `4bc182900eca196d8f9bd40d72a7f5e9822c4ddf` (`main` after PR #12). Second handback branched from `795f09a78093899fc01b80a0d688fe00de366e34`.
**Branch:** `work/b-rakan-ui`.
**Second handback:** components under `src/ui/**`, `styles/**`, `tests/ui/**` after #3 schemas/fixtures exist. Implementation notes: `design/implementation-notes/m1-ui-second-handback.md`.

This note consumes `src/contracts/CONTRACT-v0.1.md` **definitions** only. JSON schemas, valid/invalid fixtures and `tests/contracts.test.mjs` are still pending under #3. No fields are invented here. Displayed action IDs never authorize execution.

---

## 1. Design source (read-only)

| Field | Value |
|---|---|
| File | `design/reference/rakan-guest-memory.dc.html` |
| SHA-256 (this checkout) | `7ee86b47bd1b75f21655e30bd2a2770b8a9f4bea8ce1e50af7982f0a80b0d980` |
| Custody | Stream C. **Hash must stay unchanged.** New design versions are new files. |
| Label | `owner-supplied design reference` — not merchant-approved data, not executable production UI |
| Runtime | `./support.js` and the DCLogic host were **not supplied**. The canvas does not run in this repository. Stream B ports appearance and corrected behaviour into application components. **Do not fabricate a working export. Do not edit `design/reference/**`.** |

Inspection already recorded in `design/reference/README.md` (no images, no contacts, no tokens; Google Fonts stylesheet only; all people, branches, prices, visit counts, waits, ratings and health notes are **synthetic**). «خالد العتيبي» coincides with the owner's first name by accident and is not a real record.

The HTML is one Claude Design canvas with a sticky nav and six `sc-if` screens (`isS0`…`isS5`). DCLogic `navLabels` name them: الرحلة، الاستقبال، إشعار الموظف، بطاقة الضيف، التوثيق، الضيوف.

Gold screenshots mentioned in issue #6 / `PROJECT_PLAN.md` are **not in this repository**. They contribute brief/completion *interaction* language, not a gold theme. The navy/red system in the HTML remains the appearance source.

---

## 2. M1 surfaces (what B will actually ship)

Issue #6 names five M1 surfaces. Everything else is **M2 / unavailable** and must be omitted or shown as an honest disabled/unavailable state — never as a finished workflow.

| M1 surface | Purpose in M1 |
|---|---|
| **Customer conversation** | Mobile-first Rakan chat: text, optional image *selection/preview* only when C says `photo=enabled` and a `PermissionReceipt` of kind `photo_analysis` is active, two `StyleOption`s, 0–3 `AllowedAction`s, typing / back / decline. |
| **Short approved brief view** | Customer-facing `BarberBrief` after subject approval: requested look, `do_not`, optional reference, provenance, chosen branch/barber *preference* (not an allocation). |
| **Staff inbox / brief panel** | Authenticated staff, one configured branch, `staff_inbox=enabled`. Renders C's saved briefs and `DeliveryReceipt`s. Empty / loading / pending / error / saved. No success before a receipt. |
| **Preference view** | Text-only `Preference` rows: review / save / correct / delete authorized text. Distinguish `proposal` from `approved_preference`. M1 never writes `executed_result`. |
| **Capability copy** | Honest labels for `TrustedContext.capabilities` and `HealthState`. Official booking is `EXTERNAL_HANDOFF`, never «confirmed». Unavailable features are disabled or omitted. |

Role checks in the UI are **not** authorization. C decides `TrustedContext.role` / `verified` and re-validates every write.

---

## 3. Screen-by-screen map

Each row is a named block in the HTML (nav id + `sc-if` / subsection). Corrections listed in §3 are the issue #6 list; they are called out again in the per-screen tables.

### 3.0 Shared chrome — sticky header + wordmark + nav pills

| | |
|---|---|
| **Design screen** | Sticky top bar (`position:sticky`): LTR wordmark `THE WEEK` + `END` (Archivo Black), divider, six pill buttons generated from `navLabels`. Canvas `dir="rtl"`. |
| **M1 surface** | **Capability copy** + chrome for the five M1 surfaces. Nav items that only open M2 workflows are omitted or rendered unavailable from `HealthState` / capabilities — not shown as live kiosk/profile/capture. |
| **Behaviours kept** | Dark navy ground `#07090F`, red pills `#E11D2E`, wordmark split, 99px pill radius, 12×20 header padding, blur + `rgba(8,11,20,.92)`, 1px `rgba(255,255,255,.08)` hairline, RTL document, IBM Plex Sans Arabic for UI type. |
| **Behaviours corrected** | Do not keep a public six-stop «guest memory journey» that implies face recognition, all-branch profiles or post-visit capture are live. Do not seed synthetic branch names from the HTML into the nav. |
| **Contract consumption** | `TrustedContext` (`role`, `locale`, `capabilities`, `consents`, `branch_id`); `HealthState` for which chrome links exist. |
| **M2 / unavailable** | Reception, full profile, visit capture, guest directory links. |

### 3.1 S0 — الرحلة / «نظام ذاكرة الضيف» (`isS0`)

| | |
|---|---|
| **Design screen** | Intro: red eyebrow «نظام ذاكرة الضيف»; headline that any branch starts from the last visit; body copy describing entrance recognition, barber notification, full guest card, post-service documentation, and an admission that data is experimental and face recognition is a simulation. Four journey cards (01 وصول والتعرّف / 02 إشعار الفريق / 03 بطاقة الضيف / 04 التوثيق بعد الخدمة) plus dashed extras (guest list; cross-branch alert). |
| **M1 surface** | **Capability copy.** Becomes an honest owner-review landing / capability panel, not a biometric guest-memory demo. |
| **Behaviours kept** | 18px card radius, `#0E131F` fill, left-none / 1px hairline cards, red actor chip, Archivo Black numeral watermark, hover `border-color:rgba(225,29,46,.55)` + 3px lift, type scale (`clamp(30px,5vw,50px)` headline, 17/13.5 body). |
| **Behaviours corrected** | Replace the face-recognition journey story with later verified check-in (M2). Do not promise «any branch continues the last visit», visit counts, or a public guest list. Do not copy synthetic branch/staff names from the cards into UI copy or knowledge. |
| **Contract consumption** | `TrustedContext.capabilities`; `HealthState`; `ErrorShape` when a capability is missing. No `BarberBrief` until C has one. |
| **M2 / unavailable** | Cards 01 (kiosk recognition), 04 (visit capture), extras (all-guest directory, cross-branch profile). Cards 02–03 survive only as entry points to the **staff inbox/brief** and **short brief / preference** surfaces when those capabilities are enabled. |

### 3.2 S1 — الاستقبال / kiosk 1080×1920 (`isS1`)

| | |
|---|---|
| **Design screen** | Vertical kiosk framed at 1080×1920 (shown at 0.35). State pills: الانتظار / الفحص / تعرّف ناجح / ضيف جديد. **Idle:** «أهلًا بك في فرع العليا», «انظر إلى الشاشة لنتعرّف عليك», live clock. **Detect:** red scan-line over a face well, «جارٍ التعرّف…». **Found:** named returning guest, «زيارتك رقم 14», assigned barber, 4:30 slot, chair 3, «الانتظار المتوقّع 5 دقائق». **New:** optional mobile-number bind. Footer claims the camera is only for recognising regulars and that no personal data is shown. |
| **M1 surface** | **M2 / unavailable.** Later *verified* check-in design only. No biometric identity feature in M1. Visual tokens may be reused later; this run does not simulate recognition success, waits, chairs or visit numbers. |
| **Behaviours kept (for a future M2 check-in, not shipped now)** | Wordmark + «LOOKS & BEANS» lockup, 40px device radius, navy gradient `#0A0D16 → #12161F`, large Arabic welcome type. Optional *text* identity later is a C-owned verified flow — not this camera well. |
| **Behaviours corrected** | **Replace entrance face-recognition simulation with later verified check-in; no biometric identity.** No fake visit counts or estimated waits. Do not copy «فرع العليا», «فهد», «عبدالله», chair/wait figures, or the camera-as-identity disclaimer into live UI. Optional phone bind is not an M1 public kiosk control (C owns identity). |
| **Contract consumption** | None in M1. A future check-in would still take `TrustedContext` + server-verified subject from C — never a browser face match. |
| **M2 / unavailable** | Entire reception / kiosk, including idle / detect / found / new. Marked unavailable rather than simulated. |

### 3.3 S2 — إشعار الموظف (`isS2`)

| | |
|---|---|
| **Design screen** | Two 390×844 handsets. **Lock-screen push:** brand tile, «وصل ضيفك: عبدالله», «موعد 4:30 — الكرسي 3 — فرع العليا», replay-simulation button. **In-app centre:** «فرع العليا — فهد» / «الإشعارات», four synthetic rows (arrival, walk-in, lateness, unlogged visit). |
| **M1 surface** | **Staff inbox / brief panel.** Keep the two-column phone chrome and notification-card language. Rows become C-issued inbox items (approved briefs awaiting staff view, pending booking *requests* when `booking_handoff=pending_request`, talk-to-staff handoffs) — not arrival theatre. |
| **Behaviours kept** | 44px device radius, 8px `#171B24` bezel, `#0A0D15` sheet, sticky blurred header, 16px cards `#0E121C`, 8px status dots, slide-down push animation, RTL text alignment, empty-area spacing. |
| **Behaviours corrected** | No simulated arrivals, chairs, visit numbers, «replay notification», or cross-branch lateness. No all-branch public customer list via notification taps. Opening a row shows a **brief panel** for an object C says this staff session may see. «إعادة محاكاة الإشعار» is demo-only and is **not** ported. |
| **Contract consumption** | `TrustedContext` (`role=staff`, `staff_inbox`, `branch_id`); `BarberBrief` (`status` `approved` \| `delivered` \| `acknowledged`); `DeliveryReceipt` (`delivered_at`, `staff_view_id`, `acknowledged_at` — acknowledgement is **not** a booking); `AllowedAction` (`talk_to_staff` is customer-side; staff acknowledge via C, not a client-minted id); `ErrorShape` / `HealthState` (`staff_inbox` `unavailable` ⇒ inbox omitted/disabled); `ActionResult` for acknowledge/open outcomes (`done` \| `pending` \| `rejected` \| `expired` \| `stale`). |
| **M2 / unavailable** | Live arrival / chair / wait / «visit not documented» operational notifications. |

### 3.4 S3 — بطاقة الضيف (`isS3`)

One design screen; four different M1/M2 fates. Do not ship the whole card as a public or staff «full profile».

#### 3.4.1 Identity header + nickname + masked phone + branch/barber line

| | |
|---|---|
| **Design screen** | Avatar initial tile, name, tag (ضيف دائم / VIP / جديد), «يحب أن يُنادى بـ …», LTR masked phone, branch + «الحلاق …». Guest tabs: عبدالله / خالد — فرع مختلف. |
| **M1 surface** | Staff **brief panel** header uses only fields C puts on `BarberBrief` / `TrustedContext` (subject display the server allows, `branch_id`, `barber_preference`). Customer **short approved brief view** shows the customer's own approved brief, not a dossier. |
| **Behaviours kept** | 16px avatar tile, 20px name, 99px tags, red/gold/grey tag recipe as *visual* only, card padding 18×16. |
| **Behaviours corrected** | No synthetic names/phones/VIP tags as data. No all-branch «this guest usually visits Olaya with Fahd» banner as operational truth. Phone numbers are never committed or invented in the UI. |
| **Contract consumption** | `BarberBrief.subject_id`, `branch_id`, `barber_preference`; `TrustedContext.subject_id` / `branch_id`; never a client-side guest directory. |
| **M2 / unavailable** | Full identity dossier, cross-branch habitual-visit banner, VIP/new/regular marketing tags. |

#### 3.4.2 Cross-branch gold banner (`crossBranch`)

| | |
|---|---|
| **Design screen** | Gold (`#F2B03D`) alert: guest usually visits another branch with a named barber. |
| **M1 surface** | **M2 / unavailable.** One-branch M1 (`docs/16-C-BASELINE.md`). Gold remains an *accent token*, not a live cross-branch feed. |
| **Behaviours kept** | Gold alert chrome for a future authorized multi-branch notice if C ever sends one. |
| **Behaviours corrected** | Do not copy synthetic branch/barber names. Do not imply all-branch memory. |
| **Contract consumption** | None in M1. |
| **M2 / unavailable** | Yes. |

#### 3.4.3 Stats strip (زيارة / آخر زيارة / المعتاد)

| | |
|---|---|
| **Design screen** | Three-cell grid: visit count (14 / 9), last-visit date, usual weekday/time. |
| **M1 surface** | **M2 / unavailable.** |
| **Behaviours kept** | 14px radius stat well `#0E121C` as a possible layout for *server* counts later. |
| **Behaviours corrected** | **No fake visit counts.** Do not display HTML numbers. A future count is only whatever C persists. |
| **Contract consumption** | None in M1 (no visit-count object in v0.1). |
| **M2 / unavailable** | Yes. |

#### 3.4.4 «حساسيات وتنبيهات» health / product-alert block

| | |
|---|---|
| **Design screen** | Red alert: alcohol-containing products, powder on the neck (synthetic). |
| **M1 surface** | **M2 / unavailable.** Not medical diagnosis; not seeded into knowledge or UI data. Customer `Preference` of kind `do_not` may later carry *customer-typed* avoid-text that C persisted — never these HTML strings. |
| **Behaviours kept** | Red alert card geometry for `ErrorShape` / consent / complaint states, not for inferred health. |
| **Behaviours corrected** | **Do not copy synthetic health notes.** No diagnosis, allergy inference, or disease-treatment copy. Concerning symptoms suspend selling (product rule) and hand off; the UI does not invent clinical alerts. |
| **Contract consumption** | `Preference.kind=do_not` (text the subject or staff recorded); `ChatTurnOutput.flags` e.g. `refusal_medical` as a conversation state — not a health record. |
| **M2 / unavailable** | Dedicated clinical/allergy dossier. |

#### 3.4.5 «آخر 6 زيارات» gallery + «مقارنة صورتين»

| | |
|---|---|
| **Design screen** | 3×2 image placeholders; compare-two toggle. |
| **M1 surface** | **M2 / unavailable.** Optional *this-turn* image preview lives on **customer conversation** only, via C-issued `image_ref` (never a URL) and only with `photo_analysis` receipt. Staff see a photo on a brief only when `BarberBrief.reference.kind=photo_ref` **and** `staff_sharing_photo` receipt exists. |
| **Behaviours kept** | 3:4 tile, 11–12px radius, dashed/solid hairline — usable for a single optional reference thumb on the brief. |
| **Behaviours corrected** | **No forced front-photo capture. Text brief sharing and photo sharing are separate.** No six-visit public gallery. No signed media URLs in source. |
| **Contract consumption** | `CosmeticObservations.image_ref`; `BarberBrief.reference` `{ kind, image_ref, receipt_id }`; `PermissionReceipt` `photo_analysis` \| `staff_sharing_photo`; `AllowedAction.kind=share_photo_ref` (separate from `share_brief_text`); `ErrorShape` `CONSENT_REQUIRED` \| `UPLOAD_REJECTED`. |
| **M2 / unavailable** | Visit history gallery, side-by-side compare, staff photo browse. |

#### 3.4.6 Preference groups (الشعر / اللحية / المنتجات / الإضافات / الضيافة)

| | |
|---|---|
| **Design screen** | Key/value rows (fade, clipper, beard, drink, talkativeness, …) presented as a standing profile. |
| **M1 surface** | **Preference view** (text only). Render `Preference` records C returns. Do not ship the HTML's five-group catalogue as default data. |
| **Behaviours kept** | Section eyebrow in red + tracking; stacked `#0E121C` rows; 14px group radius; 11px / 13px type. |
| **Behaviours corrected** | No synthetic style/product/hospitality values as real preferences. Provenance must show `proposal` vs `approved_preference`. M1 never labels a row «last executed cut». Save success only after C's `ActionResult.outcome=done` + receipt. |
| **Contract consumption** | `Preference` (`kind` `style` \| `barber` \| `branch` \| `do_not` \| `note`, `value_text`, `source`, `provenance`, `version`, `revoked_at`); `AllowedAction` `save_preference` \| `delete_preference`; `PermissionReceipt.kind=text_preferences`; `ActionResult`; `ErrorShape` `CONFLICT` (version) \| `STALE_ACTION` \| `CONSENT_REQUIRED`. |
| **M2 / unavailable** | Executed-style memory, product-usage history, hospitality profile as operational defaults. |

#### 3.4.7 «ملاحظات الفريق»

| | |
|---|---|
| **Design screen** | Staff notes with author names and dates (synthetic). |
| **M1 surface** | Staff **brief panel** may show `BarberBrief.requested_look.text_ar` and `do_not` only. Free-form multi-author history is M2. |
| **Behaviours kept** | 13px note card, 13px radius, byline row in `#6E7689`. |
| **Behaviours corrected** | Do not copy HTML notes or staff identities. Do not invent authors. |
| **Contract consumption** | `BarberBrief`; `DeliveryReceipt.acknowledged_by` when C sets it. |
| **M2 / unavailable** | Longitudinal team notebook. |

#### 3.4.8 «سجل الزيارات» (services, duration, amount, rating)

| | |
|---|---|
| **Design screen** | Visit ledger including `180 ر.س` and `5/5` rows. |
| **M1 surface** | **M2 / unavailable.** |
| **Behaviours kept** | Row layout only, for a future C-authored history. |
| **Behaviours corrected** | **Do not copy synthetic prices, durations or ratings.** No preselected satisfaction. Money, if ever shown, is integer minor units from C — B does not arithmetic. |
| **Contract consumption** | None in M1 (no visit-ledger type in v0.1). |
| **M2 / unavailable** | Guest history. |

#### 3.4.9 Sticky CTA + «تأكيد سريع مع الضيف» sheet

| | |
|---|---|
| **Design screen** | Primary «بدء الخدمة — نفس التفضيلات»; secondary «تعديل». Sheet: four yes/no checklist lines (same cut, clipper 2, same beard, Arabic coffee) then «ابدأ الخدمة». |
| **M1 surface** | Interaction pattern informs **short approved brief view** (customer confirms the brief) and later **M2 completion**. M1 customer actions are `AllowedAction`s (`share_brief_text`, `share_photo_ref`, `save_preference`, `open_official_booking`, …), not «start service». |
| **Behaviours kept** | Sticky gradient footer, 14px red primary, ghost secondary, 26px top-radius sheet, yes/no chips. |
| **Behaviours corrected** | **«Exactly as brief» and «with changes» are mutually exclusive (M2 completion).** Do not ship both as simultaneously true. Do not treat checklist yeses as a booking or as executed style. Bundling photo share into start/save is forbidden. |
| **Contract consumption** | `AllowedAction` + `ActionResult`; `BarberBrief.provenance.approved_by_subject_at` / `version`; `PermissionReceipt` `staff_sharing_text` vs `staff_sharing_photo` (separate). |
| **M2 / unavailable** | Chair start, in-person completion capture. |

### 3.5 S4 — التوثيق بعد الخدمة (`isS4`, cap 1–6)

| | |
|---|---|
| **Design screen** | «توثيق ما بعد الخدمة — أقل من 90 ثانية». Steps: (1) photo — «صورة الأمام إلزامية»; face-in-frame; front/side/back; (2) service/product chips; (3) preference edits + toggles prefilled from last visit; (4) guest satisfaction default **راضٍ جدًا**, notes, voice note, avoid-next, suggest-next; (5) review + «حفظ وتحديث الملف» (local `setState`); (6) «تم تحديث ملف عبدالله» / «متاح الآن لجميع الفروع». |
| **M1 surface** | **M2 / unavailable** as a workflow. Visual patterns reused only as follows: step-3 chips/toggles → **preference view** controls; step-5 summary rows → **short brief** read-only summary; step-6 success glyph → **only** after C `ActionResult.outcome=done`. |
| **Behaviours kept** | Sticky step header + red progress bar; 14px inputs; chip and toggle styling (`chip()` / track `#E11D2E`); 74px success ring. |
| **Behaviours corrected** | **No forced front-photo capture**; booking and text help work without photographs (`continue_without_photo`). **No preselected «very satisfied» rating.** **No browser-only success**; `saveCapture: () => setState({ cap: 6 })` is not authority. **No all-branch «file updated».** Photo share ≠ save preference ≠ book. Do not copy synthetic service/product chips or prices into knowledge. Voice-note button is not an M1 capability (omit). |
| **Contract consumption (when fragments are reused)** | Preference / brief / `ActionResult` / `ErrorShape` `CONFLICT` \| `TIMEOUT` \| `CAPABILITY_UNAVAILABLE` as in §3.4.6 and §6. Visit-capture objects are **not** in v0.1 — do not invent them. |
| **M2 / unavailable** | Entire capture wizard (photos, services-done, satisfaction, all-branch publish). |

### 3.6 S5 — الضيوف (`isS5`)

| | |
|---|---|
| **Design screen** | «الضيوف»: search by name/phone; filters «كل الفروع / العليا / حطين / الياسمين / فهد / ضيف دائم»; tabs «كل الضيوف» / «ضيوف اليوم»; synthetic rows; empty state «أنشئ ملفًا جديدًا»; today column with arrival statuses. |
| **M1 surface** | **M2 / unavailable.** Staff M1 list is the **inbox of briefs for the one configured branch**, not a public or all-branch customer directory. |
| **Behaviours kept** | Search field chrome, pill filters, 16px list cards, empty dashed-circle state — reused on the **staff inbox** for filtering *briefs* C returned (not people-search across branches). |
| **Behaviours corrected** | **No all-branch public customer list.** No phone search over guests. No «create guest file» from the browser. Do not copy synthetic guest names or today-board statuses. |
| **Contract consumption** | Staff inbox uses the objects in §3.3, not a guest-index type (none in v0.1). |
| **M2 / unavailable** | Reception guest directory, today board, create-guest. |

---

## 4. Surfaces the HTML does not contain (M1 still required)

The design is a guest-memory kiosk/staff demo. Issue #6 still requires a customer conversation that the HTML never draws. Second handback invents **no new visual system** — it applies §7 tokens to these layouts:

| Surface | Layout borrow | Contract objects |
|---|---|---|
| Customer conversation | Message stack as `#0E121C` 14–16px cards; composer as sticky footer (S3 CTA); actions as red/ghost pills (nav `pill()`); optional image well as S4 3:4 tile **only if** photo capability + receipt; style options as two cards (S0 journey card). | `ChatTurnInput` / `ChatTurnOutput`; `CosmeticObservations` (incl. `not_inferred`); `StyleOption` (0–2); `proposed_actions` are **proposals** — render executable controls only as C `AllowedAction`s; `ErrorShape`; `HealthState.model`; `ModelUsageRecord` is **not** customer-visible. |
| Short approved brief (customer) | S3 preference rows + S4 summary list; provenance line; separate buttons for `share_brief_text` and `share_photo_ref`. | `BarberBrief`; `PermissionReceipt` `staff_sharing_text` / `staff_sharing_photo`; `AllowedAction`; `DeliveryReceipt` (customer sees delivered/acknowledged only if C sends it). |
| Capability / photo gate copy | S0 intro + S4 photo notice, rewritten. Always offer `continue_without_photo` when a photo action is shown. | `TrustedContext.capabilities.photo`; `PermissionReceipt.photo_analysis`; `AllowedAction.continue_without_photo` \| `decline`; `ErrorShape` `CONSENT_REQUIRED` \| `UPLOAD_REJECTED` \| `CAPABILITY_UNAVAILABLE`. |
| Booking handoff copy | Action pill, not a kiosk appointment card. | `AllowedAction.open_official_booking` (`url` allowlisted by C) or `request_pending_booking`; `ActionResult` `external_handoff` \| `pending` — **never** labelled confirmed. |

`ChatTurnOutput.proposed_actions` must not be clicked as tools. C converts accepted proposals into `AllowedAction`s with server ids (`act_…`), `bound`, `expires_at`, and optional `url`.

B does **not** bind the UI to `src/domain/next-actions.mjs`. That module is presentation-policy / sandbox custody (stream C). Its older ids (`prepare_booking_request`, `simulate_booking`, …) are not v0.1 `AllowedAction.kind` values.

---

## 5. M2 screens — mapped, unavailable, not simulated

| Design screen | M2 name | M1 treatment |
|---|---|---|
| S1 kiosk (all four states) | Reception / verified check-in | Unavailable. No scan animation, no «recognized» success. |
| S3 full card (stats, gallery, visit ledger, health dossier, cross-branch) | Full profile + guest history | Unavailable. Staff see a short brief; customer sees their approved brief + text preferences. |
| S4 cap 1–6 | Visit capture / completion | Unavailable. «Exactly as brief» vs «with changes» reserved for M2 and mutually exclusive. |
| S5 directory + today board | Guest list / reception board | Unavailable. No all-branch list. |
| S2 arrival / chair / wait / unlogged-visit toasts | Live floor operations | Unavailable. Inbox = briefs and authorized requests only. |

No dead operational button is presented as finished functionality.

---

## 6. State matrix (second handback)

Every M1 surface renders these from **C outcomes**, not from `setState` theatre. Copy keys come from `ErrorShape.message_key` / `ActionResult.message_key` (B does not invent codes).

| UI state | Contract signal | Customer conversation | Short brief | Staff inbox / brief | Preference view | Capability copy |
|---|---|---|---|---|---|---|
| **Loading** | No `TrustedContext` yet, or in-flight turn (`turn_id` sent, no `ChatTurnOutput`) | Skeleton message well; composer disabled | Skeleton rows | Skeleton list; no «saved» | Skeleton rows | «جاري التحقق من الحالة» until `HealthState.checked_at` |
| **Validation** | `ErrorShape.code=VALIDATION_ERROR` | Inline under composer; text stays | Field-level; no approve | N/A for list; reject acknowledge | Inline on `value_text` / version | — |
| **Unavailable** | `HealthState.* = unavailable` or `ChatTurnOutput.state=unavailable` + `CAPABILITY_UNAVAILABLE` / `MODEL_UNAVAILABLE` | Honest empty + omit photo/book/staff actions | Hide share if inbox/photo off | Omit inbox if `staff_inbox` unavailable | Omit save/delete if `preferences` unavailable | Each capability named independently (`docs/16` §4) — no single DEMO flag |
| **Timeout** | `ErrorShape.code=TIMEOUT` (`retryable` as C says) | Keep draft text; retry control only if `retryable` | Do not flip to approved | Do not mark delivered | Do not mark saved | Model/store timeout copy |
| **Failed save** | `ActionResult` `rejected` \| `stale` \| `expired` \| `revoked` or `ErrorShape` `CONFLICT` \| `STALE_ACTION` \| `UNAUTHORIZED` \| `CONSENT_REQUIRED` | Action returns to enabled; no success toast | Brief stays previous `version` | No `acknowledged_at` | Previous `Preference.version` remains | — |
| **Budget / model down** | `BUDGET_EXCEEDED` / `MODEL_UNAVAILABLE` | `state=unavailable`; never a mock reply in owner-review | Unchanged | Unchanged | Unchanged | Show model unavailable |
| **Upload rejected** | `UPLOAD_REJECTED` | Preview cleared; text path remains | Photo reference omitted | No photo pane | — | Photo stays optional |
| **Reconnected** | New `HealthState` / `TrustedContext` after `degraded` \| `unavailable` | Replay only via new C actions; no silent retry of unknown writes | Refresh brief from C | Refresh inbox from C | Refresh list from C | Capabilities may reappear; do not assume previous `AllowedAction` ids still work |

Unknown write outcome is **not** permission to retry blindly (product invariant). `ActionResult.outcome=pending` is shown as pending, not done. `external_handoff` is an opened official link, not a confirmed booking.

---

## 7. Visual tokens to preserve

**Do not commit font files.** Use the Google Fonts stylesheet URL only (same as the HTML):

`https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Archivo+Black&display=swap`

plus `preconnect` to `https://fonts.googleapis.com` and `https://fonts.gstatic.com`.

| Token | Value | Use |
|---|---|---|
| Ground | `#07090F` | Page |
| Sheet | `#0A0D15`, `#0A0D16` | Phone / panel |
| Card | `#0E121C`, `#0E131F`, `#0D111A` | Messages, rows |
| Elevated | `#121723`, `#161B27`, `#1B202C` | Sheets, avatars |
| Hairline | `rgba(255,255,255,.07–.12)` | Borders |
| Brand red | `#E11D2E` | Primary, wordmark END, progress |
| Red hover | `#C4162A` | Primary press |
| Red text/link | `#FF5062`, `#FF6C7A`, `#FF8A95` | Links, chips, actor tags |
| Gold accent | `#F2B03D` | Accent **only** — not a theme, not VIP data |
| Muted | `#8F98AB`, `#9AA3B5`, `#767F92`, `#6E7689`, `#5D6478` | Secondary text |
| Ink | `#F4F6FA`, `#FFFFFF` | Primary text |
| Body font | `IBM Plex Sans Arabic`, 300–700 | UI + Arabic |
| Wordmark font | `Archivo Black` | `THE WEEK` / `END`, clock numerals |
| Wordmark | `THE WEEK` white + `END` `#E11D2E`, LTR, tracking ~0.5–2px | Header / kiosk (kiosk itself M2) |
| Radii | 11–14px controls; 14–18px cards; 22px push; 26px sheets; 40–44px device; 99px pills | Match HTML |
| Spacing | 8 / 10 / 12 / 14 / 16 / 18 / 20 / 24 | Match HTML |
| Direction | `dir="rtl"` default; `dir="ltr"` on wordmark and Latin clock | Required |
| Motion | `fadeUp`, `slideDown` (150–450ms) | Keep; **do not** port `scanline` / `pulseDot` recognition |
| Target sizes | Customer/staff UI mobile-first (~390×844); desktop readable. Kiosk 1080×1920 is M2-only. | Issue #6 comparison sizes |

B does not add a framework or bundler (that is a #3 request per `docs/16-C-BASELINE.md` §6). Second handback is plain HTML/CSS/JS components C can serve from `src/ui/`.

---

## 8. Proposed file layout (second handback — created in `m1-ui-second-handback.md`)

Components only. **No** `package.json`, routes, server, or root config. C owns composition/serving.

```
src/ui/
  chrome/
    wordmark.html          (or .js fragment — THE WEEK/END)
    app-header.js          capability-aware nav; omits M2
  conversation/
    transcript.js          ChatTurnOutput.messages (1–3)
    composer.js            ChatTurnInput text / turn_id
    style-option-card.js   StyleOption × 0–2
    action-row.js          AllowedAction[] only
    observation-limits.js  CosmeticObservations.not_inferred + limitations
    optional-image.js      image_ref preview; continue_without_photo
  brief/
    approved-brief.js      BarberBrief read model
    share-controls.js      share_brief_text ⊥ share_photo_ref
  staff/
    inbox-list.js          briefs + DeliveryReceipt list
    brief-panel.js         one brief; acknowledge ≠ booking
  preferences/
    preference-list.js
    preference-editor.js   save/delete + version
  capability/
    health-banner.js       HealthState
    capability-copy.js     honest gates / handoff labels
  states/
    loading.js
    empty.js
    error.js               ErrorShape
    action-result.js       ActionResult
styles/
  tokens.css               §7 variables
  fonts.css                Google Fonts @import / link only
  rtl.css
  chrome.css
  conversation.css
  brief.css
  staff.css
  preferences.css
  states.css
tests/ui/
  conversation.test.mjs
  brief-share-separate.test.mjs
  staff-inbox-states.test.mjs
  preferences-authority.test.mjs
  capability-unavailable.test.mjs
  action-stale.test.mjs
```

Tests assert: no success before `ActionResult`; photo optional; share-text ≠ share-photo; no invented kinds/fields; M2 screens not mounted. Visual comparison screenshots (no personal data) belong in the second handback, not here.

---

## 9. Contract consumption checklist (definitions only)

From `src/contracts/CONTRACT-v0.1.md`. B **renders**; C is the only producer of trusted/persisted objects. Closed schemas: unknown fields rejected when #3 fixtures exist.

| Object | M1 surfaces | Notes for B |
|---|---|---|
| `TrustedContext` | all | `capabilities` five keys; `consents` active `PermissionReceipt[]`; `locale` `ar` \| `en` |
| `ChatTurnInput` | conversation | `turn_id` client uuid, idempotent; `image_ref` is a C id; `client_action_id` is an `AllowedAction.action_id` |
| `ChatTurnOutput` | conversation | `state` `ok` \| `unavailable` \| `error`; `proposed_actions` are not executable |
| `CosmeticObservations` | conversation (optional) | Always display `not_inferred`; `retention` set by C |
| `StyleOption` | conversation | `feasible_in_person` `true` \| `unknown` — never a guarantee |
| `Preference` | preference view | Text ≤ 300; M1 never writes `executed_result` |
| `KnowledgeRecord` | conversation (via output) | B does not author or enable; no HTML prices/names as knowledge |
| `AllowedAction` | conversation, brief, preferences | Kinds: `open_official_booking`, `request_pending_booking`, `share_brief_text`, `share_photo_ref`, `save_preference`, `delete_preference`, `talk_to_staff`, `decline`, `continue_without_photo` |
| `ActionResult` | all writes / clicks | `done` \| `external_handoff` \| `pending` \| `rejected` \| `expired` \| `revoked` \| `stale` |
| `PermissionReceipt` | photo, prefs, share | Kinds: `photo_analysis`, `text_preferences`, `staff_sharing_text`, `staff_sharing_photo` — distinct |
| `BarberBrief` | brief, staff panel | `status` `draft` \| `approved` \| `delivered` \| `acknowledged`; barber field is preference |
| `DeliveryReceipt` | staff panel | Acknowledgement ≠ booking |
| `ErrorShape` | all | Codes in contract §10 only |
| `HealthState` | chrome, capability | Includes `store`; never show `ok` if C says otherwise |
| `ModelUsageRecord` | — | Not rendered to customers |

---

## 10. Intentional safety-copy changes vs the original design

The appearance stays; these strings / claims **must not** ship as live copy. Replacement direction is `proposal` until native/brand review.

| Original (HTML / DCLogic) | Why it is wrong | M1 replacement direction |
|---|---|---|
| «انظر إلى الشاشة لنتعرّف عليك»; «جارٍ التعرّف…»; scan-line camera well; «تُستخدم الكاميرا للتعرّف على ضيوفنا الدائمين» | Biometric identity / face recognition | No camera identity. Later verified check-in is M2. M1: Rakan is a **digital assistant**; text help without a photo. |
| «زيارتك رقم 14»; stats `v: '14'` / `'9'` | Fake visit counts | Omit. No count unless a future C object exists. |
| «الانتظار المتوقّع 5 دقائق»; chair 3; 4:30 as live assignment | Fake waits / floor assignment | Omit. Barber on a brief is `barber_preference`, not allocation. |
| Mood default `راضٍ جدًا` | Preselected very-satisfied rating | No rating control in M1. If M2 adds one, default **unselected**. |
| `saveCapture` → «تم تحديث ملف… متاح الآن لجميع الفروع» | Browser-only save; all-branch publish | Success only after C `ActionResult.done`. One-branch M1. |
| «صورة الأمام إلزامية» | Forced front photo | Photo optional. Always keep booking/text path (`continue_without_photo`). |
| Journey body: entrance recognition + full card + post-service file for every branch | Over-claims M1 | Capability copy: conversation, optional photo, approved brief, staff inbox, text preferences, official-link or pending-request handoff. |
| Guest list search by phone; «كل الفروع»; «إنشاء ملف ضيف» | Public / all-branch directory | Staff: one-branch brief inbox only. |
| Health block (alcohol / powder) | Synthetic health; medical-adjacent | Do not copy. `do_not` text only if C persisted it. No diagnosis. |
| Cross-branch gold: «فرع العليا مع فهد» | Synthetic multi-branch habit | Unavailable in M1. |
| Push «وصل ضيفك» + replay | Simulated arrival | Inbox of real briefs/requests only. |
| «بدء الخدمة — نفس التفضيلات» together with «تعديل» as a soft pair | Must be exclusive at completion | M2: exactly-as-brief **or** with-changes, not both. M1: approve/share brief, separately share photo, separately book/handoff. |
| Names عبدالله الشمري، خالد العتيبي، تركي، فهد، سعود، ماجد؛ branches العليا / حطين / الياسمين؛ amounts 70–200 ر.س | Synthetic; must not become knowledge/UI data | Render only C/A enabled `KnowledgeRecord`s and C persisted records. |
| «نظام ذاكرة الضيف» as a live product name | Memory over-claim | Working product: Rakan / راكان — digital assistant. Durable memory is opt-in text preference + approved brief, not a face file. |

Rakan introduction (when conversation ships): digital/AI assistant, not a human barber. No fabricated staff biography.

---

## 11. `support.js` / DCLogic — explicit note

The HTML loads `<script src="./support.js">` and `class Component extends DCLogic`. **Neither file is in this repository.** Inspection: `design/reference/README.md`.

- Do **not** add a fake `support.js` so the canvas «runs».
- Do **not** commit a reconstructed DCLogic runtime.
- Port corrected behaviour into `src/ui/**` in the **second** handback.
- Leave `design/reference/**` byte-identical (`SHA256SUMS` must still match).

DCLogic in the file is useful only as a specification of simulated states (`kiosk: detect→found`, `mood: 'راضٍ جدًا'`, `filter: 'كل الفروع'`, `saveCapture` local success). Those simulations are the behaviours this map rejects.

---

## 12. Blockers and next gate

| Item | State |
|---|---|
| #3 JSON schemas, fixtures, contract tests | **Landed** on `main` (`795f09a`, PR #14). Map was written against markdown definitions; second handback consumes schemas/fixtures. |
| Executable UI (`src/ui/**`) | **Second handback** — see `m1-ui-second-handback.md`. |
| Routes, root config, API credentials, private media | Out of scope (C / owner). |
| Real model / vision / provider | **NOT RUN.** A prompt/fixture pack elsewhere does not count. |
| Visual comparison at matching sizes | **NOT RUN** (no components yet). Acceptance checkboxes on #6 stay unticked. |
| Merchant-approved catalog / branch pack | Not in the UI. Do not scrape the HTML. |
| Claim on #6 | Required comment text is in the issue thread when posting is possible; this map does not tick READY→ACCEPTED. |

**Next gate:** third handback (consent / brief approve / share-actions / prefs / polish / upload) — see `m1-ui-third-handback.md`. Owner walkthrough (#8) is after that and C2 item 14.

**This handback is not** G01–G13, not owner-review acceptance (#8), and not a customer release.
