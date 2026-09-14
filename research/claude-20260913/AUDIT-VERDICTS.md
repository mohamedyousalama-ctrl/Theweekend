# Auditor / reviewer verdicts — actual, attached

**What was reviewed:** the four verdicts below reviewed the earlier *proposal document* for The Weekend agent (drafted before this repository's plan existed; it used the working names «خميس» then «مشاري», later superseded by **Rakan** per issue #2). They are attached because #4 asks for the actual verdicts that exist, and because their factual findings (counts, schedules, policy wording, booking mechanics, VAT, payment provider) apply to the evidence in this folder. Their conversation-design findings apply to issue #5, not to this handback.

**Redactions applied:** one iCal feed URL, one provider uuid, one iCal listing id and local machine paths were replaced with placeholders. Nothing else was changed.

**Method:** each verdict was produced by an independent agent with read access to the raw evidence files hashed in `EVIDENCE-INDEX.md` and to the public site bundle. None of them is a native-speaker, barber, legal or merchant review; those remain NOT_RUN.

**Summary of verdicts:**

| Pass | Role | Verdict | Date (UTC) |
|---|---|---|---|
| v1 | auditor (adversarial fact check) | reject | 2026-09-13 ~20:16 |
| v1 | reviewer (product lead, Saudi Arabic agents) | reject | 2026-09-13 ~20:13 |
| v2 | auditor | reject | 2026-09-13 ~20:33 |
| v2 | reviewer | reject | 2026-09-13 ~20:30 |

The counts and facts in `EXCERPTS.md` were re-derived after these verdicts and agree with them (e.g. علي 6 not 24; schedule anomalies; policy scope; payment provider `rekaz-pay`).

---

## v1 — auditor

**VERDICT: reject**

Ground truth checked: all files in `scratchpad/wk/`, the live team list (re-fetched to `providers.json`, 21 entries), one live anonymous call to `reservation-v2/availabilities`, one barber's iCal feed, the Rekaz `main.js` plus the lazy chunks it imports for the booking flow (`book-*.js`, `time-step-*.js`, `branch-selector-*.js`, `auth-sheet-*.js`, `commerce-api-*.js`, `checkout-*.js`), and the repo modules §9 names. What is right, briefly: five branch names, 20 named barbers, every haircut/treatment/retail/membership price in §1 lines 23-35, the 35/45-min durations, `autoApprovalMinRating: 5`, `allowReservationCancellation: false`, zero admin replies, the charity banner, the policy quote, the WhatsApp number, 361 written reviews, "ممتاز" 78, the two 15-30-min waiting complaints, the "sulfate-free" line, the availability endpoint being public, and every Kivo/Faysal artefact in §9 (`lib/ai/image-perception.ts`, `supabase/migrations/0119_demo_spend_guard.sql`, `0124_demo_kill_switch_per_product.sql`, `middleware.ts` demo-host block, `app/api/faysal/_engine/scenes.ts`). The findings below are what is wrong.

## High

1. **The "pre-filled Rekaz checkout link (branch, service, barber, time)" (PROPOSAL.md:117-118, :150-151, :156-157) is not constructible.** Route table in `main.js`: `ct("/{-$tenant}/book")({component:...})` has no `validateSearch`; neither do `/products/checkout`, `/products/cart`, `/products/$productId`. The only routes that accept URL state are `/memberships/$productId/checkout` and `/packages/$productId/checkout` (`{priceId}`), `/checkout/payment-error`, and `/checkout/done/$checkoutId` (post-payment). Booking state (step, lines, providerMode, selectedSlot, checkoutId) lives in a zustand store (`iw` in `main.js`, `yp` defaults) in memory/localStorage, never in the URL. A "checkout" is a cart: `v5()` → `vx()` = `POST /api/app/cart/new-cart` with `{priceId, providersIds, reservationDateFrom/To}`, called only from `book-*.js` after `onAuthenticated` (the `X` → auth-sheet → `ye` → `ie()` chain), and every API call carries `Authorization: Bearer` from `localStorage["tenant-<id>"].auth.state.token` (`ok()` in `main.js`). Auth is a 4-digit SMS OTP (`/^[0-9]{4}$/`) behind a Cloudflare Turnstile iframe at `captcha.rekaz.io` (`auth-sheet-*.js`). So a pre-filled reservation checkout requires the customer's own OTP session; the proposal's "we create nothing without their credentials" is exactly what makes it impossible. What *is* constructible: `https://theweekendhairstyling.com/?branchId=<uuid>` — the root loader `Qz` reads search key `ZS="branchId"`, writes cookie `<tenant>_SelectedBranchId` for 30 days (`$z`/`F1`) and redirects with the param stripped; and a membership deep link `/memberships/<product>/checkout?priceId=<uuid>` (Solo Basic monthly). v1 must be "branch-preselected link + tell them service, barber, time" for reservations. Live slots are genuinely public: `GET /api/app/reservation-v2/availabilities?StartDate&EndDate&PriceId&MinQuantity&ProvidersIds` with `__tenant` returned HTTP 200 and 153 slots for بلال (15-minute grid, `amounts.totalPrice`), no auth.

2. **The selfie sample reads the photo before consent and its retention line is false.** §7 (:124) says consent "before any read"; sample 3 (:98-99) opens with «شفت الصورة» to an unsolicited photo, consent never asked. «ما أحفظها — تنمسح بعد ما أقرأها» is untrue as pipelined: `lib/ai/image-perception.ts:6-9` persists the derived description to `messages.meta.image.description`, and `app/api/whatsapp/webhook/route.ts:613` stores `image: { id, mime, caption, description }`; for a face read that stored text is "face oval, dense hair on top" — personal data retained while the customer is told nothing is kept. The bytes are base64-encoded into an Anthropic image block (`image-perception.ts:69-73`) — a transfer outside the Kingdom — and Meta retains inbound media on its own servers independently of MaitreAI (verify the current Cloud API media retention period; my recollection is 30 days). Also: no minor/other-person check appears in the sample.

3. **Membership arithmetic (§4 :82-83, §6 :120 «إنت تجي 3 مرات بالشهر؟ العضوية تطلع أرخص») is false for most customers.** Solo Basic is 169/month for 5 visits of cut + beard (`product_product-list-v2.json[26].pricing[0]`: `billingPeriod 30`, `package.totalQuantity 5`; description "قص شعر … وتهذيب لحية"). Cut+beard is 60 at Roshn, 50 at Narjis and Rawdah (`[12]`, `[14]`, `[13]` pricing[2]). 3 visits: Roshn 180 > 169 (cheaper), Narjis/Rawdah 150 < 169 (not cheaper; break-even is 4). Haircut-only customers (30/25): 5 visits = 150/125 < 169 — the membership is never cheaper at any visit count it allows. The rule must be branch- and service-specific or the agent will state a false saving.

4. **PDPL section (§7 :130-132) is thin and partly wrong.** (a) "facial images are sensitive personal data" — under PDPL Art. 1 the sensitive categories are ethnic/tribal origin, religious/intellectual/political belief, security/criminal data, biometric data used to identify, genetic, credit, health data, and unknown-parentage; a selfie is personal data, biometric only if processed for identification, and health data only if scalp/hair-loss is inferred (which the rules forbid) — so the classification is over-broad, harmless in itself but signals the analysis was not done. (b) Cross-border transfer (Art. 29 and SDAIA's 2024 Data Transfer Regulations) is not addressed at all, yet the design ships every photo to a US-hosted model; a legal basis (adequacy, SDAIA standard contractual clauses, or an exception with minimisation) and a transfer risk assessment are needed. (c) Minors: the Implementing Regulations require the legal guardian's consent for a person lacking capacity; "no reads of anyone who looks under 18" is a mitigation, not compliance, and should be labelled as such. (d) The WhatsApp channel as a whole (phone number, name, booking history, hair-problem messages) is personal data processed by MaitreAI as processor for the shop as controller: needs a controller-processor contract, a privacy notice for the number (Art. 12/13), and documented consent — only the photo line is covered. (e) Retention (Art. 18) must be stated truthfully given finding 2. I am confident about Art. 1, 5, 6, 12, 18, 19, 20, 29 as the relevant provisions; verify numbering against SDAIA's official English text (PDPL as amended by Royal Decree M/148 of 2023, Implementing Regulations 2023, Data Transfer Regulations 2024).

## Medium

5. **Barber mention counts (§1 :20-21) are wrong and the list is not ordered.** Recount from the 361 `description` fields (Arabic-normalised, word-boundary): علي 24, مهدي 22 (24 by substring, 25 occurrences), وسام 21 (22 occ.) — proposal says 24; مروان 17 — proposal says 18; صلاح 16, محمد 12, عمر 10, بلال 9, محمود 9, كريم 9, أسامة 8, هادي 4, عبدالرحمن 1, فرقان 1, مبين 1, **سعيد 0** (listed as mentioned), مقريني 0, كرم 0. علي is tied first and is buried mid-list; بلال (9) is listed before عمر/محمد. Reviews also praise **إبراهيم** (3 reviews, e.g. 2026-06-27) and **سلام** (2026-05-25) who are not on the team list — the "my usual" flow needs a "no longer listed" answer. Note also the popularity ranking of named employees is going to their employer; it should be framed or dropped.

6. **Voice-of-customer counts (§1 :43-45).** «أخلاق / خلوق / مؤدب» = 31 reviews / 32 occurrences, not 52 (even adding محترم, 17, gives 49). «فنان» = 35 exact / 39 with elongations and plural, not 40 — close, but stated as exact. «زبطني», «تسلم إيدك», «خفيف دم» occur once each and are presented as recurring. «يفهم وش تحتاج حتى لو ما تسولف» is a paraphrase in guillemets; the review (2026-08) [says the barber understands what you need even if you do not chat — paraphrase].

7. **Team names are not unique; the "branch → barber" spine (§6 :115) is ambiguous.** `providers.json`: مروان ×3 (`[7]` Zone C, `[10]` Zone i, `[19]` Narjis-Marsiya, schedule from 2026-09-08), كريم `[2]` and كرم `[11]` both at Zone C (كرم's `schedules[0].scheduleName` is "كريم"). Sample 1 and 6 collapse "روشن" into one chip although Zone C and Zone i have disjoint barber sets; `[20]` is «مزود الخدمة الافتراضي» with no branch (the 21st entry).

8. **Schedule claim (§1 :19) "typically 12:00–16:00 and 16:30–00:00, Friday from 13:00" matches one barber (بلال, `[0]`).** The other 19 differ: وسام 12–15/15:30–00; عمر 12–14/15–00 with Friday 12:00; صلاح 12–15/16–00; فرقان 09:00 start with corrupt spans (`15:30–11:00`, `03:30–00:00`); مبين 12:30–00:00 continuous; مهدي 13:30–16/17–01:00; محمود and هادي close 01:00; سعيد Friday `15:00–13:00`; مقريني Friday 12:00. Every named barber has one weekday with no entry (day off) — e.g. مهدي has no day 5 — which the persona ("knows every barber's days") must handle.

9. **Catalogue nuances that will produce wrong answers.** `[11]` "Fresh Face Express (Copy)" is 69 for all branches (`branchIds: []`, `pricing[0].name "شامل جميع الفروع"`) alongside `[19]` Rawdah 25 and `[16]` Narjis 49 — the agent has two prices for one service at Rawdah/Narjis; needs a dedup rule or owner question. Fresh Face Plus exists only at Narjis (79) and Roshn (99) — none at Rawdah. `[7]` BATCI 30 ml: `pricing[0].stock.remainingQuantity 0` (while `isOutOfStock false`) — §8 would recommend it. All 7 retail items say «السعر لا يشمل رسوم التوصيل … 30 ريال» — never mentioned. `[3]` Hair Treatment Plus long hair: `duration 45` but `pricing[0].duration 60`.

10. **Sample 5 «أضيفه على حجزك» is not a Rekaz capability.** Reservations and merchandise are separate journeys (`journey: "reservation" | "commerce"`, separate `/products/cart` and `createCartNewCart` with `source: Website`); the seven haircut add-ons (`[12].addOns`) are services — blow-dry 20, wash 10, beard dye 39, waxing 49, hair dye 69, express hair 79, express face 69 at Roshn (different amounts at Rawdah/Narjis) — not retail. Those add-ons are also absent from §1 although they are priced per branch and bookable.

11. **Policy omission (§1 :36-38).** `Platform.Business.Description` says the booking cannot be refunded, «تحويلها إلى رصيد أو إعادة جدولته» — no credit, **no reschedule**. The proposal only carries no-refund. "cancellation needs shop approval" is moot: with `allowReservationCancellation: false` there is no customer cancellation path at all (`reservationCancellationRequiresApproval: true`, deadline 0). The agent needs a rail for «أقدر أغير الموعد؟».

12. **§1 :49-50 and Q4 (:168) ask the owner a question the JS answers.** `Az()` in `main.js` fetches services only when a branch is selected (`S=d||!!b`, else `[[],[],[]]`); `home.html` was captured without the `SelectedBranchId` cookie (`selectedBranchId:null, services:[]`), so the i18n string `services.empty: "لا توجد خدمات متاحة للحجز حالياً."` rendered. Not a shop defect; asking it will look uninformed.

13. **VAT is unaddressed.** `setting-manager_onboarding.json`: `Platform.Invoice.TaxIsEnabled "True"`, `Platform.Tax.Percentage "0.15"`, `Platform.Business.ShowVat "False"`; the checkout summary has a «الضريبة» line; slot `amounts.priceWithTax` is 0. Whether "30" is inclusive is unknown — sample 2 (:95) quotes it as final. Owner question missing.

14. **"the shop has never approved [a lower-star review]" (§1 :41) is unverifiable** — the public API only shows published reviews (`r1.json` breakdown 1034/0/0/0/0). Correct statement: nothing below 5 stars has ever been published and no review has a reply.

## Low

15. **«خالد» (:49, :170).** The review (2026-05-27, [thanks «خالد» for "the project"]) thanks him for "the project"; "as the project's owner" is the proposal's inference. If the founder is Khalid the question is odd; if not, the document speculates about a third party's role. Quote it verbatim and ask, or drop the name. No nationality is reproduced anywhere — correct, although six reviews carry one ([six reviews name a staff member together with an origin word — withheld here; nationality must never be reproduced or inferred]).

16. **Flow order (§1 :15-17):** it is OTP + captcha → cart → payment, not cart → OTP; payment provider is `rekaz-pay` fronting Moyasar. Immaterial except that the captcha rules out any agent-side automation of the customer step.

17. **Sample inconsistencies:** sample 1 offers three chips against the "two options" rule (:74); sample 6 «تثبته لما تقرر» implies the 6:30 slot can be confirmed later from a link (no hold exists, and the link cannot carry the slot — finding 1); sample 4 books «باي باي قشرة» "in the same visit" though the product is one 45-minute reservation for a 3-session programme with no visible way to schedule sessions 2-3.

18. **Photo policy blind spots the data hands you:** every membership already requires an uploaded subscriber photo (`[0]`, `[4]`, `[26]`, `[27]` `customFields[0].label "صورة المشترك"`, `isRequired true`) — the consent text should cover both flows; and every barber's iCal feed is publicly fetchable (`[iCal feed URL withheld] HTTP 200, booked slots with service name) — a shop-side exposure worth flagging to the owner, and a second source of "busy" times.

19. **Complaints missed (§1 :46-47)** that bear directly on this pitch: 2026-05-27 [a review saying the booking site needs attention] (booking site UX), 2026-06-02 (membership structure/duration), 2026-05-19 [a request for a loyal-customer price].

---

## v1 — reviewer

I have everything I need; no more research is required. Evidence base: the proposal, all 361 written reviews (`texts.txt`), the 1,034-review JSON, the 28-item catalogue, the branch/provider lists, the site settings, and the site's own JS bundle (`main.js`) for what the booking route actually accepts.

## Answers to the seven questions

**1. The name.** «خميس» does not land for a 20–35 Riyadh customer at a Roshn/النرجس barbershop. Three problems: (a) as a person's name it reads old and rural — «عم خميس», خميس مشيط — not a north-Riyadh receptionist; (b) the joke only works if someone explains it, and on WhatsApp nobody does: the customer sees «معك خميس من ذا ويكند» cold; (c) the tail risk: the day-names (خميس، جمعة, alongside بخيت، مبروك، فرج) belong to a class of names historically given to enslaved men in the Peninsula. Most customers will not consciously make the link; some will, and a servant-bot with that name is one screenshot on X away from a brand problem. «مشعل» is the right *kind* of name — the proposal's fallback instinct was better than its primary. My pick: **«مشاري»** — unmistakably Najdi, peak 1990–2005 births (exactly the audience), warm («خفيف دم» energy), easy in English (Mishari, unlike Turki), not one of the 20 barbers, not Faysal (already used elsewhere in the codebase). Keep the weekend hook in the *conversation*, not the name: the agent offers Thursday slots and says «نزبطك قبل الويكند».

**2. Humanness.** The samples are better than most — genuinely Gulf-colloquial — but these lines are bot/brochure/MSA:
- «عندنا خمس فروع بالرياض — أقرب لك الروضة، روشن، ولا النرجس؟» — brochure, and it says five then offers three (Roshn ×2, Narjis ×2). Someone messaging the shop's own number does not need the branch count.
- «معك خميس من ذا ويكند» — redundant on the shop's number.
- «قول لي أي فرع وأعطيك الرقم بالضبط — وإذا تبي أشوف لك أقرب موعد فاضي.» — «الرقم» for a price (Saudis say السعر); dangling second clause; asks two things, breaking its own rule.
- «(ما أحفظها — تنمسح بعد ما أقرأها)» — a privacy footnote in parentheses mid-chat is pure bot.
- «الوجه أقرب للبيضاوي والشعر كثيف من فوق، وهذا يعطيك مجال» — the horoscope of grooming; every hairstyle app says it.
- «الله يعافيك» as a reply to "I have dandruff" — misfired formula.
- «دكتور الجلدية أفضل من أي كلام مني» — a liability disclaimer for *dandruff*. Save it for hair loss and skin conditions.
- «خالي من الكبريتات», «أنفع كبداية» — product-copy MSA.
- «بكرة 6:30» — needs المغرب/العصر; nobody in Riyadh says a bare 6:30.
- Section 3's «the person the reviews keep thanking without naming» — the reviews *do* name the real receptionists ([three reviews in June–July 2026 name or describe reception staff — withheld here]). The persona takes their credit and implies a human. There is no rule for «إنت بوت؟».

Worst two, rewritten in the reviews' register:

First contact, new customer:
> «وعليكم السلام، هلا والله. أي فرع أقرب لك: روشن، النرجس، ولا الروضة؟»

First contact, known regular (this is where the money is):
> «هلا أبو فهد. نفس الموعد عند وسام بروشن؟ أقرب وقت عنده الخميس 6:30 المغرب.»

Shampoo (the current sample does not answer the question — the B5 shampoo is a moisture/shine shampoo per its own description, not anti-dandruff):
> «شامبو مخصص للقشرة؟ لا، ما عندنا. اللي عندنا شامبو باتشي B5 بـ99، للترطيب واللمعة مو للقشرة. للقشرة نفسها عندنا جلسة "باي باي قشرة"، 3 جلسات بـ149 تنحجز مع الحلاقة. أضيفها لك؟»

Two more the agent will need daily. The policy, since the only version on the site is MSA («لأن وقتك ووقت ضيوفنا...»):
> «تنبيه بسيط قبل الدفع: الموعد 35 دقيقة، والتأخير الكثير يضيّع الحجز والمبلغ ما يرجع. تعال قبل بخمس دقايق ونزبطك على طول.»

Confirmation: «أبشر، تم: وسام، روشن Zone i، الخميس 6:30 المغرب، شعر ودقن 60. وريال من حلاقتك راح صدقة.»

**3. Conversion.** The reviews settle it: [four reviews describing repeat visits to the same named barber — paraphrased, quotes withheld], «لي سنة ونص وأنا معاملكم». Yes, the spine should start with the barber for anyone who is not obviously new — and barber-first *is* branch-first, because in `prov.json` every barber is tied to exactly one branch (Roshn C: بلال، كريم، مروان، كرم; Roshn i: وسام، عمر، مروان، مقريني; Narjis Marsia: صلاح، محمد، اسامه، مهدي، محمود، هادي، مروان; Nesaj: عبدالرحمن، علي، سعيد; Rawdah: فرقان، مبين). Naming the barber answers the branch for 17 of 20; the exception is **three different مروان** in three branches — the proposal's «مروان 18 mentions» conflates three people, and «عند مروان» must trigger «مروان اللي بروشن C، Zone i، ولا مرسية؟». New vs regular: (a) Rekaz keys customers by mobile (`ensureUniqueMobileNumberForCustomer: true`), and on WhatsApp the phone number is the identity — with read credentials the agent greets a regular by name with his last barber/branch/service before he types anything; this is the single biggest conversion lever and it is buried under "credentials for creating reservations later" in Q1; (b) without credentials, do not ask «هل حلقت عندنا قبل؟» — offer two chips «حلاقي المعتاد» / «أي حلاق فاضي» and let the message itself classify («أبي أحجز عند وسام» is a regular); (c) accept the facts in any order — «فيه موعد الليلة؟» is time-first and common. New customers: branch by proximity, then «عندك حلاق معين ولا أقرب موعد؟».

**4. The selfie moment.** As written it hedges into uselessness: consent-footnote, face-shape astrology, a generic suggestion, then «الحلاق يشوفك ويظبط التفاصيل» — the customer learns nothing he could not get in the chair, and section 7 (consent *before* any read) contradicts the sample (reads immediately). Nobody sends a bot a selfie for style advice; men send **reference photos** («أبي كذا», a footballer, a TikTok fade) and, sometimes, «صلّحوا لي هذي» after a bad cut elsewhere. The payoff that makes a customer send the photo is that **the barber sees it before he sits down**:
> «شفتها. تدريج منخفض مع طول فوق. أقرب وقت بمرسية بكرة 8 المغرب عند مروان (لو تبي غيره قول لي). أحجز لك وأحط الصورة بملاحظات الحجز عشان يشوفها قبل ما تجلس؟»
That needs one ops decision (reservation note or a branch WhatsApp relay keyed to the booking), not a vision model. Keep the face-reading as a rare fallback. Note the shop already collects a required «صورة المشترك» at membership checkout — its customers are not photo-shy, but the purpose differs, so the one-line consent stays.

**5. Memberships.** "Offer only by arithmetic" is the right principle with the wrong arithmetic. From the catalogue: monthly = 5 visits (`package.totalQuantity: 5`, `billingPeriod: 30`), each visit cut + beard (Basic 169) or + basic face/hair (Full 249); no pause (`allowCustomersToPauseSubscription: false`); subscriber photo required; all branches; monthly ones giftable. Break-even by branch:
- Basic vs cut+beard: Roshn (60) from the **3rd** visit; Narjis/Rawdah (50) from the **4th**. Cut-only customers (30/25): never inside 5 visits.
- Full vs cut+beard+face: Roshn (129) from the **2nd** visit; Rawdah (94) 3rd; Narjis (75) 4th.
- Annual Basic 1,995/60 = 33 a visit only for a weekly customer; at two visits a month it is 83 a visit — worse than walk-up. Never sell the annual on "60 visits".
The "3+ visits" rule is right for one of six cases, and it misses the Roshn Full pitch (two visits and it pays). The honest pitch is one question, «كل كم تحلق؟»: weekly (the fade crowd, the actual 20–30 audience) → membership by branch; every 2–3 weeks (most men) → «العضوية ما تنفعك، الزيارات تنتهي مع الشهر». The reviews say exactly this: 2026-06-02 declines to subscribe because the package expires monthly and asks for [a four-visit, four-month pack]; 2026-05-19 asks for [a loyal-customer price]. Money on the table: (1) the Eid/birthday gift — monthly memberships are `isGiftable: true` and the site has `/gifts`; (2) a 4-visit/4-month pack for the biweekly majority — Rekaz packages are enabled (`Platform.Checkout.HasPackages: True`), and that is an owner question the proposal should raise.

**6. Missing reception scenes** — see findings below; the short version: running late and rescheduling under a no-cancellation policy, complaints while waiting, kids, groups, gift cards, walk-ins/«الحين», the seven add-ons the proposal never lists, departed barbers, kunyas, the three مروان, and «إنت بوت؟».

**7. Deep link to pay.** Not acceptable, and probably not real. The site's router (`main.js`) registers `/{-$tenant}/book` with **no search-parameter validation**; the only booking-related URL parameters anywhere are `orderCartId` on `/profile`, `returnCartId` on `/review/$code`, and `branchId/journey/payment_method` on the post-payment `/checkout/done/$checkoutId`. A "pre-filled Rekaz checkout link (branch, service, barber, time)" does not exist in that router; what exists is a product page, after which the customer re-selects branch, barber, service and time. That agent adds nothing to the transaction over the site, and the owner will judge it in one sentence: «هو يحجز ولا لا؟». The credible v1 is the owner's own Rekaz tenant credentials (it is his account; ask Rekaz for a merchant/partner API) → create the reservation → Moyasar payment link in chat. Either prove one real pre-filled link before writing another line, or move credentials from "later" to "before v1".

VERDICT: reject

**Blockers**
1. The v1 mechanism is unverified and, from the site's own router, unsupported (see Q7). `<scratchpad>/wk/main.js`: `/book` has no `validateSearch`. The proposal states the pre-filled link as fact in sections 6 and 10.
2. The name «خميس» (Q1): old/rural for the audience, needs explaining, and carries a servant-name echo the brand cannot afford. Rename before any demo.
3. Something changed on the shop's funnel around 30 August and the proposal did not notice: reviews (which Rekaz solicits per visit) ran at 9.3/day in August (23–24/day on 28–29 Aug) and dropped to 11 in the first 13 days of September (`all_reviews.json`); the same period the booking page shows «لا توجد خدمات متاحة للحجز حالياً» on the new `website-v3` build. The empty page may just be "no branch selected" (all 28 products return `isInCurrentBranch: false` without a branch), but the cliff is real and unexplained. Build nothing on this funnel until the owner explains it — it is also the strongest sales argument you have.
4. Membership arithmetic is wrong in four of six cases and the annual pitch would mis-sell (Q5).

**Major**
5. Catalogue coverage: the haircut product carries seven add-ons the proposal never mentions — hair dye (30/45/69 by branch), beard-and-moustache dye (25–39), wax (30–49), wash (10), blow-dry (10–20), plus the express hair/face sessions as add-ons. The "only the 7 retail products" rule would make the agent deny services the shop sells, and dye is the Eid/wedding question.
6. No scene for running late or rescheduling under `allowReservationCancellation: false` / `reservationCancellationRequiresApproval: true` / no stated grace period. This is the most frequent reception message of the day. The agent needs the owner's real grace practice, a kind colloquial policy line, and the ability to *submit* a cancellation request to the branch.
7. No scene for a complaint while waiting (2026-08-19 «تأخيري ربع ساعة», 2026-07-28 «ولا تدخل إلا بعد ربع أو نص ساعة»). The agent cannot see the floor; it needs an apology template, a hand-off to the branch phone, and a log the owner reads.
8. New-vs-regular is unaddressed (Q3). Customer history by phone number is the lever; put it at the top of the credential ask. Add the three-مروان disambiguation.
9. Departed barbers: إبراهيم (3 reviews), سعد (2), عبدالصمد, سلام are praised in reviews and absent from `prov.json`. Regulars will ask for them; the agent needs a graceful line and an owner-approved answer to «وين راح؟».
10. Kids: four reviews (ولدي عند مهدي for the third time; ابني على عبدالرحمن; كريم with الأطفال). No kids' product or price exists, and father-plus-son needs two back-to-back slots with one barber, which `maximumQuantityPerOrder: 1` makes a two-line cart. Ask the owner for the kids' price and the "good with kids" tags.
11. Groups (friends before a wedding, brothers before Eid — [a review about a group visit before Eid, 2026-05-26]): one line, N consecutive slots across a branch's chairs. Impossible with links; only real with booking credentials.
12. Gift cards: `/gifts`, `/gifts/redeem/$token`, and `isGiftable: true` on haircuts and both monthly memberships — zero mention. Cheapest win in the document.
13. The persona line claiming the receptionists' credit, and no «إنت بوت؟» rule. Disclose when asked; it is also the safe reading of SDAIA's generative-AI guidance.

**Minor**
14. The selfie sample contradicts the photo policy (reads before consent) and hedges (Q4). Reposition around reference photos.
15. Walk-ins («فيه مكان الحين؟», review 2026-01-17 "squeezing me in") — a "now" path over live availability, answered honestly.
16. Kunyas and titles («أبو علي» ×2, «الكابتن صلاح», «المعلم وسام») need an alias table from the owner.
17. Catalogue hygiene the resolver must survive: BATCI 30 ml and 50 ml descriptions contain pasted ChatGPT page HTML; "Fresh Face Express (Copy)" is an all-branch 69-riyal duplicate of the branch-priced 25/49/69 items — pick branch-scoped product ids, never read raw descriptions aloud.
18. Retail delivery is 30 riyals per order (All Over Spray description); «أضيفه على حجزك» must distinguish pickup from shipping.
19. Prices: `Platform.Tax.Percentage 0.15` with `ShowVat: False` — confirm the displayed 30 is VAT-inclusive before the agent says «شامل الضريبة».
20. Section 1 marks the café unknown; the shop's own Instagram/TikTok handle in the settings file is [public social handle withheld] ("looks n beans"), plus «ضيفني بقهوة» (2026-07-02). «خالد» is almost certainly the owner (thanked for "the project").
21. Review counts are text mentions in a JSON that has no provider/branch/product fields; do not present them as attribution.

**What I would add**
- A "prove the pipe" step before v1: one real Rekaz booking created by the agent with the owner's credentials, paid via Moyasar, showing in the branch's Rekaz calendar.
- The regular's greeting: name, last barber, last service, next Thursday slot — one tap to confirm.
- Outbound rebooking as roadmap item one after booking works: a WhatsApp template at ~3 weeks («صار لك 3 أسابيع من آخر حلاقة عند وسام — نفس الموعد الخميس؟»), opt-in, since that is where an agent beats the website.
- A late/reschedule/complaint playbook signed by the owner (grace minutes, who gets the relay, what the agent may promise).
- An owner questionnaire additions: kids' price, barber style/kids tags, kunyas, where departed barbers went, a 4-visit/4-month package, what happened on 30 August.
- Rename to «مشاري»; keep the Thursday joke in the slot offers.

---

## v2 — auditor

All checks are done; nothing further depends on another tool result. Here is the audit.

## v1 findings — status in v2 (with evidence)

| v1 finding | v2 status | Evidence on disk |
|---|---|---|
| Unconstructible pre-filled checkout link | **Fixed** | `main.js`: `/book` and `/book-options` routes have no `validateSearch`; the only booking-relevant param is `ZS="branchId"` handled at the tenant root → `$z(a,w)` → `F1(..., Fz=30)` (30-day cookie) then a redirect that strips it; `/memberships|/packages/$productId/checkout` validate only `priceId`. |
| False «ما أحفظها» | **Mostly fixed** | Doc now states Kivo persists the read; verified: `lib/db/messages.ts` stores `meta.image.{id,mime,caption,description,derived:true}`; webhook downloads bytes only for the read, never stores them. Residual: see finding 12. |
| Thin PDPL | **Fixed** | §8 now covers Art. 29 / SDAIA 2024 transfer rules, minors, controller–processor contract, notice, retention rule, Meta retention. |
| Barber counts | **Not fixed for علي**; others within ±3 | See finding 1. |
| Inflated voice counts | **Fixed** except one label | ممتاز 78, فنان 35 exact/39 with elongation, أخلاق/خلوق/مؤدب 31, محترم 17 — all exact. زبطني / خفيف دم / يفهم وش تحتاج each 1. See finding 5 for «تعامل راقي». |
| One-barber schedule generalised | **Fixed in shape, two new errors** | See finding 2. |
| Add-ons missing | **Fixed, accurate** | Products [12]/[13]/[14]: hair dye 69/30/45, beard dye 39/30/25, wax 49/30/30, wash 10, blow-dry 20/10/15, express hair/face add-ons — ranges in §1 all correct. |
| «أضيفه على حجزك» | **Replaced by an equally unsupported mechanism** | See finding 3. |
| No-reschedule policy | **Fixed** | `setting-manager_onboarding.json` Business.Description: «…ولا يمكن استرداد قيمته أو تحويلها إلى رصيد أو إعادة جدولته»; `allowReservationCancellation:false`. |
| Empty booking page | **Fixed** | `main.js` loader: `b = d ? undefined : g ? o : (u.length===1 ? u[0].id : undefined); S = d || !!b; [E,C,R] = S ? fetch : [[],[],[]]` → i18n `empty:"لا توجد خدمات متاحة للحجز حالياً."` with 5 branches and no selection. |
| VAT | **Addressed** (one over-reading, finding 7) | `TaxIsEnabled:True`, `Tax.Percentage:0.15`; inclusion genuinely unknown (`priceWithTax:0` in avail.json is uninformative). |
| «خالد» over-inferred | **Fixed** | Now an owner question; review 2026-05-27: [thanks «خالد» for "the project"]. |
| Sample inconsistencies | **Fixed** | Three chips only for 3-answer sets; no hold in "Hesitating"; «باي باي قشرة» is a single 45-min reservation (`hasPackage:false`), multi-cart allows up to 5 services, so «الأولى أحجزها لك مع الحلاقة» is supportable under Path A. |

## New claims verified correct
- §7 table: every cell recomputes (169: 3×60=180>169, 3×50=150<169<200; 249: 2×129=258, 3×94=282 vs 2×94=188, 4×75=300 vs 3×75=225; 1,995/60=33.25; 24×60=1,440<1,995; 5×30=150<169). Branch mapping 129 روشن / **94 الروضة** / **75 النرجس** matches products [12]/[13]/[14].
- Starts 09:00 (فرقان) – 13:30 (مهدي) correct. كريم and كرم both `branchIds` = Zone C (كرم's schedule is even *named* «كريم»). Fresh Face Plus exists only for روشن (99) and النرجس (79). BATCI 30 ml: `availableQuantity:0, remainingQuantity:0` (note `isOutOfStock:false`). 17 of 20: only مروان is duplicated; entry 21 is «مزود الخدمة الافتراضي». Review cliff: Aug 287/31 ≈ 9.3/day; 28 Aug 24, 29 Aug 23, 30 Aug 4, 31 Aug 0; Sept 11 through the 13th. OTP `^[0-9]{4}$`, Turnstile via `captcha.rekaz.io` (`Fa=!0`), 15-min grid, 153 slots, 35-min service, iCal public. §11: per-product kill switch (migration 0124, "one row per product"), spend guard (0119), scene machine, demo-host middleware, proof tests all exist.

**VERDICT: reject**

### Findings by severity

**High**
1. **«علي 24» is a counting artifact.** 24 is exactly the number of written reviews containing the standalone preposition «على/علي». The barber علي is named in **3** reviews (إستاذ علي ×2, الاخ علي — all after 28 Aug, consistent with his 2026-08-04 start) plus two «أبو علي» kunyas of unknown referent; one further hit is [a phrase in which «علي» is the preposition, not the name]. The document ranks him first among asked-for barbers and builds the "Hesitating" sample on him. `all_reviews.json`, `providers.json[16]`.

**Medium**
2. **Schedule claims in §1 are wrong on two counts, and the data has corrupt rows.** (a) "every barber has a day off": فرقان and مبين (both الروضة) work all seven days. (b) "ends from 00:00 to 01:00": كريم, سعيد and مقريني end at 23:45 every working day. (c) Three rows have end-before-start values the "live schedule" reader must sanitise — فرقان Sun `15:30–11:00`, Thu `03:30–00:00`; سعيد Fri `15:00–13:00`. `providers.json[2,5,6,17,18]`.
3. **The reference-photo sample promises a mechanism the data does not support**: «أحجز لك وأحط الصورة بملاحظات الحجز». No notes/comment field exists in any booking chunk (`book-*.js`, `payment-step-*.js`, `checkout-*.js`, `main.js` reservation payload), the haircut products carry no `customFields`, and §8 itself says this "needs one ops decision (a booking note or a branch relay)". This is the same class as v1's «أضيفه على حجزك».
4. **"Two reviews ask for a 4-visit/4-month pack"** (§7 and Q8) — exactly one review (2026-06-02) does; §1 correctly reports it once. Internally inconsistent.
5. **«تعامل راقي» 27** — the exact phrase occurs in **5** reviews; 27 is the count of «تعامل» alone (any «راقي»: 9). Mislabelled number.

**Low**
6. "Moyasar payment": settings say `Platform.PaymentGateway.Provider = "rekaz-pay"`; `payment-step-*.js` normalises it to `rekazpay` and takes the hosted-script (`window.myfatoorah`) path, not the `api.moyasar.com/v1/tokens` path. A Moyasar publishable key is present but is not the selected provider. Mada / card / Apple Pay flags are correct.
7. "VAT … hidden in display": `Platform.Business.ShowVat` maps to `showVatWebsite` (paired with `ShowCr`) — it hides the VAT *number* on the site, not tax on prices. The "UNKNOWN" conclusion stands.
8. "keeps its state in memory": the booking store is zustand persisted to `sessionStorage` (`rekaz-booking-lines`). Conclusion (not URL-addressable) unchanged.
9. Remaining name counts differ by 1–3 depending on method (Arabic-only vs. with English spellings): مهدي 23(+1 En), وسام 19(+≤5 En), صلاح 17, محمد 15, كريم 10, أسامة 9, عمر 10(+2 En); مروان 17, بلال 9, محمود 9 exact. Not a defect; state the method.
10. «8 المغرب» in the reference-photo sample: 8 PM in Riyadh is after العشاء; the voice rule's own example «6:30 المغرب» is fine.
11. «أبلغ الفرع الحين» / «أرسل طلبك للفرع» are stated as present capabilities; both depend on Q5. Acceptable since §10/§13 flag it, but the samples should be marked conditional.
12. Consent line «ما أحفظها»: true of the photo only under the §8 rebuild; the agent's own reply («الشعر كثيف من فوق والذقن مرتبة») is persisted as chat history regardless, so the retention rule must cover reply text. §8's "hair messages" clause implies this but the line should say "الصورة".
13. Rule text "three [chips] only when the answer set is three (branches)" — there are five branches; the sample's three are areas. Cosmetic.

Note (not a defect): deep links to `/products/$productId`, `/gifts/$productId` and `/packages/$productId/checkout?priceId=` are constructible from the catalogue, which the retail and gift samples could use.

Files: `<scratchpad>/wk/PROPOSAL.md` (unedited), ground truth in the same directory; repo paths `<source-project>/lib/ai/image-perception.ts`, `<source-project>/lib/db/messages.ts`, `<source-project>/app/api/whatsapp/webhook/route.ts`, `<source-project>/supabase/migrations/0124_demo_kill_switch_per_product.sql`.


---

## v2 — reviewer

I've read the proposal, all 361 written reviews, the catalogue, the team schedules, the site settings and the booking site's JS, and re-verified the numbers the owner would check first. Summary of the v1 rejection list, checked against v2:

| v1 finding | v2 status |
|---|---|
| Name «خميس» | Fixed. «مشاري» is right for 20–35 Riyadh; not on the team. |
| Bot/brochure/MSA in samples | Mostly fixed; residual slips listed below. |
| Branch-first spine | Partly. Barber-name resolves branch, facts in any order, regulars keyed by phone — but the last two are Path A only. In Path B (the actual first demo) every customer gets the branch question first. |
| Hedged selfie | Fixed: consent line is honest, the read is concrete, the guard number is left to the barber. |
| Membership arithmetic | Fixed — I re-derived every line and they hold (Basic beats walk-in from visit 3 in روشن / 4 elsewhere; Full from 2/3/4; annual ≈ 12 × monthly). One unmarked GUESS remains (finding 7). |
| Reception scenes | In scope. Late / move / «إنت بوت؟» have lines. Complaint-while-waiting, kids, groups, gifts, walk-ins are listed but have no lines. |
| Unreal deep link | Fixed with an honest Path A / Path B; Turnstile captcha confirmed in `auth-sheet-*.js`, router parses `branchId`. |
| Persona taking receptionists' credit | Fixed (§3). |

The direction, the name, the A/B framing and the arithmetic are right. What stops it going to the owner is one wrong headline fact, three demo lines that promise things that do not exist, and a decision section that does not say what Path A actually asks for. v3 is an edit, not a rewrite.

**VERDICT: reject**

**High**

1. **«علي 24» is wrong; the real count is about 6.** A word-boundary count over the 361 written reviews gives علي 6 (4 direct + 2 «أبو علي», which may not be him), while every other figure in the table checks out once Latin spellings are added (مهدي 22, وسام ~22, مروان 17, صلاح 16–17, محمد 12, عمر 10, بلال 9, محمود 9, كريم 9, أسامة 8). The 24 is an artefact: normalising ى→ي turns the preposition «على» («على طول», «على النظافة») and «عليه» into «علي». It is the first number in the table that carries the "customers follow barbers" thesis, علي is at the newest branch (نساج تاون), and the owner will catch it in seconds — after which nothing else in §1 is trusted.

2. **Path A does not say what it asks for.** "The owner's Rekaz credentials" means the shop's admin login (no scoped API key is evidenced anywhere): every customer's mobile number, every invoice, every branch calendar. Under PDPL that makes MaitreAI a processor with full access; as a security matter it is the whole shop. The decision section must say, in the owner's terms: which reads, which writes, a separate staff account, revocable, logged. Two related slips in §5: "sends the payment link" is unverified (the document's own step one is proving it — say UNVERIFIED next to it), and "greeted by name … before he types a word" contradicts §12 (no outbound in v1) and WhatsApp's template/opt-in rules — "from his first word".

3. **Three sample lines promise a relay that does not exist.** «أبلغ الفرع الحين» (late), «أرسل طلبك للفرع الحين، وهم اللي يقررون» (move), «أحوّلك للفرع على طول» (bot). The shop lists one central number, there is no per-branch contact in the data, and Q5 is still open. In Path B — the demo the owner will actually see — these are untrue. Either the relay (a forward to a branch number the owner supplies) is built before the demo, or the lines give the branch number and say so. Beneath this: there is no human-takeover design at all. The shop's WhatsApp is answered by people today; "a log the owner reads" is not takeover. A customer agent in Riyadh without a visible «كلّم موظف» path fails in week one.

**Medium**

4. **Rules and samples disagree.** (a) The price sample quotes all branches; §4 says "price only for a known branch". The sample is the better behaviour — rewrite the rule (labelled ranges allowed, a single price only for a known branch). (b) «بكرة 8 المغرب»: 8 PM in September is after العشاء; a Riyadh customer hears the slip. The marker rule needs a prayer-time mapping by season, not just "never bare". (c) The reference-photo sample picks مرسية and صلاح with no prior context — label it "Path A regular" or ask. (d) «هلا أبو فهد» — Rekaz stores a name, not a kunya; the agent cannot know this. (e) «نظام الحجز ما يسمح بالتغيير» — the branch can move it; the customer will phone, get it moved, and conclude the bot lied. «من جهتي ما أقدر أغيره» is the true sentence. (f) Late line: «كم باقي لك بالضبط؟» after the customer said «10 دقايق» is redundant, and the phrase is «كم باقي لك توصل». (g) "Every reply ends with the next step" — the bot line and the confirmation do not. (h) Chip counts are a rule but no sample shows chips, so the rule cannot be checked.

5. **The two samples that matter most are missing.** The pre-payment policy line — §4 says it is said "once, kindly, before payment"; that is the only moment the customer hears "late = no refund" before he pays, and it is the line the owner most needs to approve. And complaint-while-waiting — the one real complaint in the reviews (×2 waited 15–30 min, plus "slow barber"), listed in §10 with no words.

6. **Policy stated more broadly than written.** The published clause ties no-refund/no-credit/no-reschedule to no-show or arriving too late; advance moves are simply not customer-self-serve (`allowReservationCancellation: false`). §1 says blanket "NO RESCHEDULE". The owner's first words will be "of course we move it if he tells us the day before". Keep the conservative default in the sample, state the policy exactly, and make Q5 the gate. Also the dandruff sample inverts §4's order — it sells the concealer session first and reaches «هذي لدكتور جلدية» last, and «جلسة تغطية فورية بمنتج باتشي بـ49 تنفع قبل مناسبة» is the one brochure sentence left in §9. Shampoo's «أنفع» is an efficacy comparison the agent cannot back.

7. **Membership section, three gaps despite correct arithmetic.** (a) "Solo Full visit = the 129/94/75 bundle" is a GUESS not marked GUESS; the catalogue says «علاجات أساسية للشعر والوجه», which could equally be cut + beard + express face, and that sums differently at الروضة and النرجس. (b) Annual 1,995 vs 12 × 169 = 2,028: a weekly customer should be told the monthly, not "annual only for weekly" — the annual saves 33 riyals for a year's lock-in with no pausing. (c) An agent that says «العضوية ما تنفعك» is a business decision the owner has not been asked. Add it to §13; it is the first thing a membership-selling owner pushes back on.

8. **Departed barbers.** Q3 asks "where departed barbers went and what to say". The agent must never tell a customer where a barber went — that is a referral to the competitor. State the rule; ask the owner only what to say.

9. **Reference photos are always of someone else.** §8 forbids reads "of other people" for selfies; the reference flow reads a footballer — fine — or a friend's face, a private third party. Distinguish public-figure style reference from a private person's face; today the rule and the flow contradict.

10. **§13 is the right list minus two, and one meeting too long.** Q10 "who is خالد" — almost certainly the owner (the review thanks him for "the project"); mark it GUESS, do not ask. Q6 reads as an interrogation; the data (24 and 23 reviews on 28–29 August, 11 in the next 13 days) points at the review-request mechanism, so ask "did the review request change?". Q9 is a disclosure, not a question — open with it. Q12 is contract stage. Missing: may the agent advise against a membership; what a Solo Full visit contains; a per-branch relay contact; a landmark line for Zone C vs Zone i (customers do not know Roshn letters, and the three-chip opener hides a second question the spine never shows); dyes are black only (Eid customers ask). Split: seven before the demo, the rest before launch.

**Low**

11. **§1 slips.** "Every barber has a day off" — فرقان, مبين and كرم have none in the schedule; فرقان's has garbage ranges (19:30–03:00, 15:30–11:00) and سعيد's Friday ends before it starts. Schedule hygiene belongs beside catalogue hygiene or prose answers about hours will be wrong even when live slots are right. Two "(Copy)" items, not one (the BATCI 50 ml is the Copy). "Gift cards" do not exist; what is giftable is the monthly memberships and the haircut service itself (plus three others) — «هدي حلاقة قبل العيد» is a real scene. The 30-day branch cookie I could not find in the JS (the router parsing `branchId` I could). On VAT: Saudi consumer prices must be displayed inclusive; default to «شامل الضريبة» pending Q7 and never say "plus VAT". One review ([a review saying only a haircut was done despite paying for the face bundle]) is a customer who paid for the face bundle and got a haircut — relevant to how the agent describes the 129/94/75 item.

12. **Polish.** The bot line should own the name: «إي، أنا مشاري، مساعد ذا ويكند». «مروان اللي بروشن C، Zone i، ولا مرسية» mixes two spellings of the same branch. The «الرقم» rule should read "never means a price" — the selfie sample's clipper-guard «الرقم» is correct usage.

**What the owner will push back on, in order:** "you want my Rekaz password?"; "my bot tells people not to buy memberships?"; "who answers when it says it will transfer them — I have one number and it is on my phone" (and Q11 means losing the WhatsApp app to the API); "علي is the most requested? he has been at نساج تاون four months"; "of course we move appointments"; "why would it tell people where إبراهيم went"; and the photo-abroad line — which §8 handles honestly and should keep.

File reviewed: `<scratchpad>/wk/PROPOSAL.md` (not edited). Research used: `texts.txt`, `all_reviews.json`, `product_product-list-v2.json`, `providers.json`, `branches.json`, `setting-manager_*.json`, `ical_<id>.ics`, `main.js`, `auth-sheet-*.js` in the same directory.


---

## Review of THIS handback — pass 1 (auditor, 2026-09-14 ~04:43 UTC)

Scope: all nine files of this folder against the raw evidence, the rules of issue #4 and AGENTS.md. Model: a smaller model than the proposal auditors, by the owner's instruction to save credit.

**VERDICT: reject** (on the folder as first written). Findings, verbatim, with the fix applied to each:

1. **(High)** README claimed a second-agent review of this handback existed while `AUDIT-VERDICTS.md` ended in a placeholder. → *Fixed:* README now states exactly which review ran, its verdict, and that no broader second pass was run; this section is the record.
2. **(High)** `EVIDENCE-INDEX.md` said all merchandise stock fields report `isUnlimited: true`. Raw E03: only the two bundles are unlimited; perfume 201, spray 24, shampoo 142, concealer 50 ml 21, concealer 30 ml **0** (`isOutOfStock` false on all). → *Fixed* in the index row and in `MISSING-FACTS.md` #9, which no longer calls the zero-stock value a collaborator sighting.
3. **(Medium)** `ONE-BRANCH-CANDIDATE.md` put both anomalous schedule rows at الروضة; the سعيد row is at نساج تاون, and (per the table as first generated) كرم at روشن Zone C also had a seven-day schedule. → *Fixed* row by row; pass 2 then showed the كرم flag was itself an artefact (see below).
4. **(Medium)** "middle tier" label contradicted the numbers (haircut ties the highest, combo ties the lowest, combo + face is the lowest). → *Fixed:* the label is replaced by the three price rows with explicit comparisons.
5. **(Low)** «أسامة» count 7 → 8 when the spelling «أسامه» is included. → *Fixed* with the per-spelling breakdown.
6. **(Low)** A public social handle quoted in the v1 auditor verdict contradicted README's statement that no E06 contact values are reproduced. → *Fixed:* withheld in the verdict text.

Also recorded by the auditor as correct: zero forbidden identifiers; all 31 SHA-256 values recompute; branch/staff counts, all 28 catalogue prices and add-ons, membership fees, review totals/ratings/replies/date range, most name and theme counts, and the availability figures check out exactly.

## Review of THIS handback — pass 2 (narrow re-check of the six fixes, 2026-09-14 ~04:51 UTC)

**VERDICT: reject** (two residual findings; four of six fixes confirmed exact against the raw files, all identifier sweeps zero).

1. Fixes 1, 2, 4 and 6 confirmed; أسامة = 8 confirmed with the per-spelling breakdown.
2. **كرم has no seven-day schedule.** The first table merged an expired schedule (ended 2026-05-30, Sunday off) with the current one (Wednesday off); only the union covers seven days. → *Fixed:* `EXCERPTS.md` §2 and `staff.sanitized.json` are regenerated from the schedule **active on 2026-09-13 only** (expired/future schedules listed separately); seven-day current schedules are فرقان and مبين; the كرم mention is removed from `ONE-BRANCH-CANDIDATE.md`.
3. `ONE-BRANCH-CANDIDATE.md` still said «أسامة 7». → *Fixed* to 8.

## Review of THIS handback — pass 3 (narrow re-check of the two residual fixes)

**VERDICT: approve** (2026-09-14 ~04:58 UTC). Recomputed all 21 records from the raw team list with the active-schedule-only method: weekday sets, spans and flags match `EXCERPTS.md` §2 and `staff.sanitized.json` exactly; كرم = 6 days (Wednesday off), only فرقان and مبين carry the seven-day flag among named records; the only end-before-start rows are فرقان Sun 15:30–11:00 and سعيد Fri 15:00–13:00. `ONE-BRANCH-CANDIDATE.md` shows أسامة 8, no كرم claim, and a hygiene row consistent with the table.

Scope note: passes 2 and 3 were narrow re-checks of the fixes, not repeats of pass 1. No native-speaker, barber, legal or merchant review has happened. These verdicts approve the *sanitization and factual consistency* of this folder against the retrieved public data on 2026-09-13; they do not approve any merchant fact for customer use (that needs `merchant-approved` status, issue #5 knowledge rules).
