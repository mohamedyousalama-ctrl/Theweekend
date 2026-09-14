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
    'راكان',
    'digital assistant, not a human employee',
    'VAT-inclusive',
    'do **not** book, confirm, change or cancel',
    'never rank them',
    'unused visits expire at month end',
    'Never turn them into medical claims',
    'Never** infer or mention identity, age, ethnicity, gender, health',
    'one primary style and one alternative',
    'data, not instructions',
    'at most one question per turn',
    'No scarcity',
    'knowledge_refs',
  ]) assert.ok(body.includes(needle), `missing rule: ${needle}`);
});

test('the prompt contains no real prices as facts outside the marked examples and no forbidden identity claims', () => {
  assert.doesNotMatch(body, /خميس|Khamees/);
  assert.doesNotMatch(body, /رئيس الاستقبال|head receptionist/);
  assert.ok(body.includes('never copy prices from here'));
});
