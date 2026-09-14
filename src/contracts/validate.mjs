/**
 * Closed-schema validator for Rakan contract v0.1.0.
 * Draft 2020-12 subset only: no Ajv, no network, no new dependencies.
 * Unknown fields fail. This is structural validation, not authorization.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_FILE = /\.schema\.json$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HTTPS = /^https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*(?::\d+)?(?:\/[\w.~:/?#\[\]@!$&'()*+,;=%-]*)?$/;

export class ContractValidationError extends Error {
  constructor(errors) {
    super(errors[0] || 'VALIDATION_ERROR');
    this.name = 'ContractValidationError';
    this.code = 'VALIDATION_ERROR';
    this.errors = errors;
  }
}

function plain(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    && [Object.prototype, null].includes(Object.getPrototypeOf(v));
}

function same(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => same(x, b[i]));
  }
  if (typeof a === 'object') {
    const ak = Object.keys(a), bk = Object.keys(b);
    return ak.length === bk.length && ak.every(k => Object.hasOwn(b, k) && same(a[k], b[k]));
  }
  return false;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}

function matchesType(expected, actual, value) {
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  if (expected === 'integer') return actual === 'integer';
  if (expected === 'string' || expected === 'boolean' || expected === 'object'
    || expected === 'array' || expected === 'null') return actual === expected;
  return false;
}

function validDateTime(s) {
  if (typeof s !== 'string' || !ISO_UTC.test(s)) return false;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return false;
  const iso = new Date(ms).toISOString();
  return iso === s || iso.replace('.000Z', 'Z') === s;
}

function validUri(s) {
  return typeof s === 'string' && HTTPS.test(s) && !s.includes(' ');
}

function pointer(base, key) {
  const escaped = String(key).replaceAll('~', '~0').replaceAll('/', '~1');
  return base ? `${base}/${escaped}` : `/${escaped}`;
}

export function loadSchemaRegistry(dir = HERE) {
  const registry = new Map();
  for (const name of readdirSync(dir).filter(n => SCHEMA_FILE.test(n))) {
    const schema = JSON.parse(readFileSync(join(dir, name), 'utf8'));
    registry.set(name, schema);
    if (schema.$id) registry.set(schema.$id, schema);
  }
  return registry;
}

function resolveRef(ref, current, registry) {
  const [doc, frag] = ref.split('#');
  let base = current;
  if (doc) {
    const file = doc.split('/').pop();
    if (!registry.has(file) && !registry.has(doc)) {
      throw new ContractValidationError([`unresolved $ref ${ref}`]);
    }
    base = registry.get(file) || registry.get(doc);
  }
  if (!frag) return base;
  let node = base;
  for (const part of frag.split('/').filter(Boolean)) {
    const key = part.replaceAll('~1', '/').replaceAll('~0', '~');
    if (!node || !Object.hasOwn(node, key)) {
      throw new ContractValidationError([`unresolved $ref ${ref}`]);
    }
    node = node[key];
  }
  return node;
}

function check(schema, value, path, ctx) {
  const errors = [];
  const fail = msg => { errors.push(`${path || '/'}: ${msg}`); };

  if (schema === true) return errors;
  if (schema === false) { fail('false schema'); return errors; }
  if (!plain(schema)) { fail('invalid schema'); return errors; }

  if (Object.hasOwn(schema, '$ref')) {
    errors.push(...check(resolveRef(schema.$ref, ctx.root, ctx.registry), value, path, ctx));
  }

  if (Object.hasOwn(schema, 'const') && !same(value, schema.const)) fail('const mismatch');
  if (schema.enum && !schema.enum.some(e => same(e, value))) fail('not in enum');

  if (Object.hasOwn(schema, 'type')) {
    const actual = typeOf(value);
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expected.some(t => matchesType(t, actual, value))) {
      fail(`expected ${expected.join('|')}, got ${actual}`);
      return errors;
    }
  }

  if (schema.format === 'date-time' && value != null && !validDateTime(value)) fail('format date-time');
  if (schema.format === 'uuid' && value != null && (typeof value !== 'string' || !UUID.test(value))) fail('format uuid');
  if (schema.format === 'uri' && value != null && !validUri(value)) fail('format uri');

  if (typeof value === 'string') {
    const chars = [...value];
    if (schema.minLength != null && chars.length < schema.minLength) fail('minLength');
    if (schema.maxLength != null && chars.length > schema.maxLength) fail('maxLength');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail('pattern');
  }

  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) fail('minimum');
    if (schema.maximum != null && value > schema.maximum) fail('maximum');
    if (schema.exclusiveMinimum != null && value <= schema.exclusiveMinimum) fail('exclusiveMinimum');
    if (schema.exclusiveMaximum != null && value >= schema.exclusiveMaximum) fail('exclusiveMaximum');
  }

  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) fail('minItems');
    if (schema.maxItems != null && value.length > schema.maxItems) fail('maxItems');
    if (schema.uniqueItems) {
      for (let i = 0; i < value.length; i += 1) {
        for (let j = i + 1; j < value.length; j += 1) {
          if (same(value[i], value[j])) fail('uniqueItems');
        }
      }
    }
    if (schema.items) {
      value.forEach((item, i) => {
        errors.push(...check(schema.items, item, pointer(path, i), ctx));
      });
    }
  }

  if (plain(value) && (schema.properties || schema.required || Object.hasOwn(schema, 'additionalProperties'))) {
    const props = schema.properties || {};
    const keys = Object.keys(value);
    for (const req of schema.required || []) {
      if (!Object.hasOwn(value, req)) fail(`missing ${req}`);
    }
    for (const key of keys) {
      if (Object.hasOwn(props, key)) {
        errors.push(...check(props[key], value[key], pointer(path, key), ctx));
      } else if (schema.additionalProperties === false) {
        fail(`unknown field ${key}`);
      } else if (plain(schema.additionalProperties)) {
        errors.push(...check(schema.additionalProperties, value[key], pointer(path, key), ctx));
      }
    }
    if (schema.minProperties != null && keys.length < schema.minProperties) fail('minProperties');
    if (schema.maxProperties != null && keys.length > schema.maxProperties) fail('maxProperties');
  }

  if (schema.allOf) {
    for (const sub of schema.allOf) errors.push(...check(sub, value, path, ctx));
  }
  if (schema.anyOf) {
    const ok = schema.anyOf.some(sub => check(sub, value, path, ctx).length === 0);
    if (!ok) fail('anyOf');
  }
  if (schema.oneOf) {
    const hits = schema.oneOf.filter(sub => check(sub, value, path, ctx).length === 0);
    if (hits.length !== 1) fail('oneOf');
  }
  if (Object.hasOwn(schema, 'if')) {
    const matched = check(schema.if, value, path, ctx).length === 0;
    if (matched && schema.then) errors.push(...check(schema.then, value, path, ctx));
    if (!matched && schema.else) errors.push(...check(schema.else, value, path, ctx));
  }
  return errors;
}

export function validateInstance(schema, instance, registry = loadSchemaRegistry()) {
  const errors = check(schema, instance, '', { root: schema, registry });
  return { ok: errors.length === 0, errors };
}

const OBJECT_FILES = {
  TrustedContext: 'trusted-context.schema.json',
  ChatTurnInput: 'chat-turn-input.schema.json',
  ChatTurnOutput: 'chat-turn-output.schema.json',
  CosmeticObservations: 'cosmetic-observations.schema.json',
  Preference: 'preference.schema.json',
  KnowledgeRecord: 'knowledge-record.schema.json',
  AllowedAction: 'allowed-action.schema.json',
  ActionResult: 'action-result.schema.json',
  PermissionReceipt: 'permission-receipt.schema.json',
  BarberBrief: 'barber-brief.schema.json',
  DeliveryReceipt: 'delivery-receipt.schema.json',
  ErrorShape: 'error-shape.schema.json',
  HealthState: 'health-state.schema.json',
  ModelUsageRecord: 'model-usage-record.schema.json',
};

export const CONTRACT_OBJECTS = Object.keys(OBJECT_FILES);

export function schemaFor(objectName, registry = loadSchemaRegistry()) {
  const file = OBJECT_FILES[objectName];
  if (!file || !registry.has(file)) {
    throw new ContractValidationError([`unknown contract object ${objectName}`]);
  }
  return registry.get(file);
}

export function validateContract(objectName, instance, registry = loadSchemaRegistry()) {
  return validateInstance(schemaFor(objectName, registry), instance, registry);
}

export function assertContract(objectName, instance, registry = loadSchemaRegistry()) {
  const result = validateContract(objectName, instance, registry);
  if (!result.ok) throw new ContractValidationError(result.errors);
  return true;
}
