import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRACT_OBJECTS,
  assertContract,
  loadSchemaRegistry,
  schemaFor,
  validateContract,
} from '../src/contracts/validate.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FIX = join(ROOT, '../fixtures/contracts');
const SCHEMA_DIR = join(ROOT, '../src/contracts');
const KEBAB = {
  TrustedContext: 'trusted-context',
  ChatTurnInput: 'chat-turn-input',
  ChatTurnOutput: 'chat-turn-output',
  CosmeticObservations: 'cosmetic-observations',
  Preference: 'preference',
  KnowledgeRecord: 'knowledge-record',
  AllowedAction: 'allowed-action',
  ActionResult: 'action-result',
  PermissionReceipt: 'permission-receipt',
  BarberBrief: 'barber-brief',
  DeliveryReceipt: 'delivery-receipt',
  ErrorShape: 'error-shape',
  HealthState: 'health-state',
  ModelUsageRecord: 'model-usage-record',
};
const FAILURE_CODES = [
  'MODEL_UNAVAILABLE',
  'BUDGET_EXCEEDED',
  'TIMEOUT',
  'CONSENT_REQUIRED',
  'STALE_ACTION',
  'UPLOAD_REJECTED',
  'CONFLICT',
  'CAPABILITY_UNAVAILABLE',
];
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const listJson = dir => readdirSync(dir).filter(n => n.endsWith('.json'));
const objectFromFile = name => {
  const kebab = name.replace(/\.json$/, '').split('.')[0];
  const hit = Object.entries(KEBAB).find(([, k]) => k === kebab);
  return hit ? hit[0] : null;
};

const registry = loadSchemaRegistry(SCHEMA_DIR);

test('contract registry covers every v0.1 object', () => {
  assert.deepEqual(CONTRACT_OBJECTS.slice().sort(), Object.keys(KEBAB).sort());
  for (const name of CONTRACT_OBJECTS) {
    const schema = schemaFor(name, registry);
    assert.equal(schema.title, name);
    assert.equal(schema.additionalProperties, false);
    assert.ok(schema.required.includes('contract_version'));
  }
});

test('node:sqlite imports on this Node', async () => {
  const sqlite = await import('node:sqlite');
  assert.equal(typeof sqlite.DatabaseSync, 'function');
});

for (const file of listJson(join(FIX, 'valid'))) {
  const objectName = objectFromFile(file);
  test(`valid fixture ${file}`, () => {
    assert.ok(objectName, `filename ${file} must start with a contract kebab`);
    const result = validateContract(objectName, readJson(join(FIX, 'valid', file)), registry);
    assert.equal(result.ok, true, result.errors.join('; '));
  });
}

for (const file of listJson(join(FIX, 'invalid'))) {
  const objectName = objectFromFile(file);
  test(`invalid fixture ${file}`, () => {
    assert.ok(objectName, `filename ${file} must start with a contract kebab`);
    const result = validateContract(objectName, readJson(join(FIX, 'invalid', file)), registry);
    assert.equal(result.ok, false, `${file} should fail`);
  });
}

for (const file of listJson(join(FIX, 'failures'))) {
  test(`failure fixture ${file}`, () => {
    const { object, instance } = readJson(join(FIX, 'failures', file));
    const result = validateContract(object, instance, registry);
    assert.equal(result.ok, true, `${file}: ${result.errors.join('; ')}`);
  });
}

test('every contract object has valid and invalid fixtures', () => {
  const valids = new Set(listJson(join(FIX, 'valid')).map(objectFromFile));
  const invalids = new Set(listJson(join(FIX, 'invalid')).map(objectFromFile));
  for (const name of CONTRACT_OBJECTS) {
    assert.ok(valids.has(name), `missing valid fixture for ${name}`);
    assert.ok(invalids.has(name), `missing invalid fixture for ${name}`);
  }
});

test('section 12 failure shapes are present', () => {
  const texts = listJson(join(FIX, 'failures'))
    .map(f => readFileSync(join(FIX, 'failures', f), 'utf8'))
    .join('\n');
  for (const code of FAILURE_CODES) {
    assert.match(texts, new RegExp(code === 'STALE_ACTION' ? 'stale|STALE_ACTION' : code));
  }
  assert.match(texts, /"store": "unavailable"/);
});

test('unknown fields are rejected', () => {
  const ctx = readJson(join(FIX, 'valid', 'trusted-context.json'));
  const result = validateContract('TrustedContext', { ...ctx, extra: 1 }, registry);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('unknown field')));
});

test('assertContract throws on invalid input', () => {
  assert.throws(() => assertContract('ErrorShape', { contract_version: '0.1.0' }, registry));
});

test('arabic text length uses code points', () => {
  const input = readJson(join(FIX, 'valid', 'chat-turn-input.json'));
  assert.equal(validateContract('ChatTurnInput', input, registry).ok, true);
  const long = { ...input, text: 'س'.repeat(2001) };
  assert.equal(validateContract('ChatTurnInput', long, registry).ok, false);
});
