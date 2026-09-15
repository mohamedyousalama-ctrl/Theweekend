import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { openStore } from '../../src/server/store.mjs';

const SCHEMA = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../db/schema.sql'),
  'utf8',
);

test('migrate keeps one active consent when a store already has duplicates', () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), 'weekend-dup-consent-')), 'app.sqlite');
  const raw = new DatabaseSync(dbPath);
  raw.exec(SCHEMA);
  raw.exec(`
    INSERT INTO subjects (subject_id, role, created_at)
    VALUES ('sub_dup_consent', 'customer', '2026-01-01T00:00:00.000Z');
    INSERT INTO permission_receipts (
      receipt_id, subject_id, kind, notice_version, granted_at, revoked_at,
      retention_policy_key, granted_via
    ) VALUES
      ('rcp_older', 'sub_dup_consent', 'text_preferences', 'notice_prefs_v1',
       '2026-01-01T00:00:00.000Z', NULL, 'ret_text_prefs_v1', 'customer_ui'),
      ('rcp_newer', 'sub_dup_consent', 'text_preferences', 'notice_prefs_v1',
       '2026-01-02T00:00:00.000Z', NULL, 'ret_text_prefs_v1', 'customer_ui');
  `);
  raw.close();

  const store = openStore(dbPath);
  const active = store.all(
    `SELECT * FROM permission_receipts
     WHERE subject_id = ? AND kind = ? AND revoked_at IS NULL`,
    ['sub_dup_consent', 'text_preferences'],
  );
  assert.equal(active.length, 1);
  assert.equal(active[0].receipt_id, 'rcp_newer');
  const older = store.get('SELECT * FROM permission_receipts WHERE receipt_id = ?', ['rcp_older']);
  assert.equal(older.revoked_at, older.granted_at);
  store.close();
});

test('migrate adds last_activity_at to existing preference rows', () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), 'weekend-pref-activity-')), 'app.sqlite');
  const raw = new DatabaseSync(dbPath);
  raw.exec(`
    CREATE TABLE subjects (
      subject_id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE preferences (
      preference_id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      value_text TEXT NOT NULL,
      source TEXT NOT NULL,
      provenance TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
    );
    INSERT INTO subjects (subject_id, role, created_at)
    VALUES ('sub_pref_old', 'customer', '2026-01-01T00:00:00.000Z');
    INSERT INTO preferences (
      preference_id, subject_id, kind, value_text, source, provenance, version, created_at, revoked_at
    ) VALUES (
      'prf_old', 'sub_pref_old', 'note', 'بدون عطر', 'customer_typed', 'approved_preference',
      1, '2026-01-01T00:00:00.000Z', NULL
    );
  `);
  raw.close();

  const store = openStore(dbPath);
  const cols = store.all('PRAGMA table_info(preferences)');
  assert.equal(cols.some((c) => c.name === 'last_activity_at'), true);
  const row = store.get('SELECT * FROM preferences WHERE preference_id = ?', ['prf_old']);
  assert.equal(row.last_activity_at, '2026-01-01T00:00:00.000Z');
  store.close();
});
