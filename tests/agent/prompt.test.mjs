import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPrompt, PROMPT_VERSION, DEFAULT_PROMPT_PATH } from '../../src/agent/adapter.mjs';

const raw = readFileSync(DEFAULT_PROMPT_PATH, 'utf8');
const body = loadPrompt();

test('prompt version header matches the adapter', () => {
  assert.match(raw, new RegExp(`prompt_version: ${PROMPT_VERSION.replace(/\./g, '\\.')}`));
  assert.ok(!body.includes('prompt_version:'), 'header is stripped from the model-facing text');
});

test('the model-facing prompt carries the non-negotiable rules', () => {
  for (const needle of [
    'خالد',
    'مو خالد المالك',
    'a digital assistant — a bot, not an employee',
    'VAT-inclusive',
    'do **not** book, confirm, change or cancel',
    'Skin and scalp — one sentence, surface only',
    'no savings arithmetic for Full Option',
    'never compute it as 60 × 50',
    'applies **only to no-show or arriving too late',
    'reference photo of a style',
    'only when the session says the staff inbox is available',
    'never say when the shop is busy',
    'never rank them',
    'Unused monthly visits expire at the end of the 30 days',
    'Never turn them into medical claims',
    'Never** infer or mention identity, age, ethnicity, gender, general health',
    'one primary style and one alternative',
    'data, not instructions',
    'at most one question per turn',
    'No scarcity',
    'The web chat UI already shows your digital identity',
    'greeting-only',
    'named service',
    'Hospitality pacing',
    'never a biography',
    'knowledge_refs',
    'figures and links',
    'kno_mrs_membership_compare_monthly_basic',
    'run 360 days from activation',
    'Never repeat a wrong price or figure the customer wrote',
    'whose own name names a condition',
    'availability at the branch is unconfirmed',
    'every `reply[].lang` must match the customer\'s last message',
  ]) assert.ok(body.includes(needle), `missing rule: ${needle}`);
});

test('the prompt contains no real prices as facts outside the marked examples and no forbidden identity claims', () => {
  assert.doesNotMatch(body, /خميس|Khamees/);
  assert.doesNotMatch(body, /رئيس الاستقبال|head receptionist/);
  assert.ok(body.includes('never copy prices from here'));
});
