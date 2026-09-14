# Model candidates — proposal only (issue #3 item 5)

**Status:** `proposal`. Retrieved 2026-09-14. **Owner decides.** No key, account, region or SDK is selected here. Do not copy a Kivo/MaitreAI provider account.

A later #7 adapter must fail explicitly when `WEEKEND_MODEL_PROVIDER` / `WEEKEND_MODEL_ID` are missing. `WEEKEND_MODEL_MODE=mock` is legal only when `WEEKEND_ENV=local`. Owner-review never silently mocks.

Saudi Arabic + permitted cosmetic image input must be tested on the chosen pair before any quality claim. This file is not that test.

## Candidates verified against current public docs

| Provider | Text model id | Vision | Docs retrieved | Data-handling notes (public pages, not legal advice) |
|---|---|---|---|---|
| Anthropic (Claude API) | `claude-sonnet-5` (faster/cheaper candidate) or `claude-opus-5` (default-if-unsure on their overview) | Same model ids; docs state current lineup supports text + image input | https://docs.anthropic.com/en/docs/about-claude/models/overview and https://docs.anthropic.com/en/docs/about-claude/pricing (2026-09-14) | Owner must read current API data-use / retention terms and region options at decision time. Not verified here as a Weekend DPA. |
| OpenAI (API) | `gpt-5.6-terra` (balance) or `gpt-5.6-luna` (cost); flagship listed as `gpt-6-astra` | Same catalog states latest models support text + image input | https://developers.openai.com/api/docs/models (2026-09-14) | Public business-data page states API data is not used for training by default; Zero Data Retention is eligibility-gated. See https://openai.com/business-data/ and https://developers.openai.com/api/docs/guides/your-data |
| Google (Gemini API) | `gemini-3.8-flash` (GA Flash listed) | Multimodal catalog; image generation ids are separate and **out of M1 scope** | https://ai.google.dev/gemini-api/docs/models and https://ai.google.dev/gemini-api/docs/latest-model (2026-09-14) | Owner must verify current data-use, residency and image-retention terms before any photo path. |

## Suggested first owner-review pair (still a proposal)

- Text: `claude-sonnet-5` **or** `gpt-5.6-terra` — both documented as text+image, multilingual, and cheaper than the respective flagships.
- Vision: the **same** chat model, not a separate image-generation id. Photo remains `disabled` until #7 upload/retention gates and a subject receipt exist.
- Do not use cyber, image-generation, realtime-voice or preview-only ids for M1.

## Not decided

Provider account, hosting region, spend cap values, SDK version, and whether Zero Data Retention / equivalent is available to this project. Those stay empty in `.env.example` until the owner records a decision in #3.
