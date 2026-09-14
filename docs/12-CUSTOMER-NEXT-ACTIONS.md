# 12 - Customer-selected next actions

Status: interaction design plus a small tested presentation-policy module. Not an implemented chat UI, authentication layer or booking engine.

Answer the current need, explain the relevant trade-off and offer normally two or three useful options. Free text always remains available. No forced selfie, automatic product addition or mandatory consultation. The number of actions is a product choice; verify the selected WhatsApp API's current interactive limits before integrating native buttons/lists.

| Point in journey | Useful choices | Meaning |
|---|---|---|
| First contact | Book / choose a look / ask a question | Direct booking remains available |
| Style recommendation | First look / second look / adjust | Selects a style, not a purchase or memory grant |
| Style chosen | Appointments / styling instructions / relevant products | Products omitted after refusal |
| Photo intake | Review permission / continue without photo / staff | Declared adult subject and privacy gates precede inference |
| Quote | Confirm / edit / back | Binds to exact fresh quote and verified subject |
| Uncertain operation | Check existing operation / staff | No second create or payment |
| Confirmed appointment | Details / prepare brief / staff | Each record and sharing action is checked separately |
| Concern or complaint | Professional guidance where appropriate / real support | No treatment or product upsell |

Suggested Arabic labels are concise: `احجز موعد`, `اختار لي لوك`, `عندي سؤال`. These are copy proposals requiring native/brand review.

## Executable boundary

[src/domain/next-actions.mjs](../src/domain/next-actions.mjs) returns semantic action IDs from already validated server context. It has no side effects, network, model, database or credentials. It is NOT a permission verifier or safe booking executor. A public API must never accept the flags in this module directly from a browser/model as trusted authority.

The future server must bind each displayed action to authenticated subject/session, object ID, quote/state version, expiry and capability. A click rechecks these plus specific consent and idempotency before any write. Choosing a style is not consent to keep its photograph. A request-only submission is not a confirmed booking.

## Evidence

[30 synthetic action scenarios](../evals/next-actions.synthetic.json) and [unit tests](../tests/next-actions.test.mjs) exercise action selection and malformed context. User utterances are review stimuli; the tests do not prove natural-language understanding, medical safety, image quality or provider correctness. The existing G01-G13 release gates in [07](07-ACCEPTANCE-AND-METRICS.md) still require integration and human evaluation.
