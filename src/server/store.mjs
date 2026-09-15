import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../db/schema.sql'), 'utf8');

function ensureParentDir(dbPath) {
  if (!dbPath || dbPath === ':memory:') return;
  const dir = dirname(dbPath);
  if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
}

function migrate(db) {
  const cols = db.prepare('PRAGMA table_info(allowed_actions)').all();
  if (!cols.some((c) => c.name === 'payload_json')) {
    db.exec('ALTER TABLE allowed_actions ADD COLUMN payload_json TEXT');
  }
  db.exec(`
    UPDATE permission_receipts
    SET revoked_at = granted_at
    WHERE revoked_at IS NULL
      AND receipt_id IN (
        SELECT receipt_id FROM (
          SELECT receipt_id,
                 ROW_NUMBER() OVER (
                   PARTITION BY subject_id, kind
                   ORDER BY granted_at DESC, receipt_id DESC
                 ) AS rn
          FROM permission_receipts
          WHERE revoked_at IS NULL
        )
        WHERE rn > 1
      )
  `);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS permission_receipts_one_active
    ON permission_receipts (subject_id, kind)
    WHERE revoked_at IS NULL`);
  db.exec(`CREATE TABLE IF NOT EXISTS turns (
    session_id TEXT NOT NULL,
    turn_id TEXT NOT NULL,
    status TEXT NOT NULL,
    response_json TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (session_id, turn_id),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS staff_handoffs (
    handoff_id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    status TEXT NOT NULL,
    received_at TEXT NOT NULL,
    assigned_at TEXT,
    accepted_at TEXT,
    accepted_by TEXT,
    timed_out_at TEXT,
    released_at TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id),
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
  )`);
  const prefCols = db.prepare('PRAGMA table_info(preferences)').all();
  if (!prefCols.some((c) => c.name === 'last_activity_at')) {
    db.exec('ALTER TABLE preferences ADD COLUMN last_activity_at TEXT');
    db.exec('UPDATE preferences SET last_activity_at = created_at WHERE last_activity_at IS NULL');
  }
}

export function openStore(dbPath) {
  ensureParentDir(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  migrate(db);
  const store = {
    db,
    exec(sql) {
      db.exec(sql);
    },
    run(sql, params = []) {
      return db.prepare(sql).run(...params);
    },
    get(sql, params = []) {
      return db.prepare(sql).get(...params) ?? null;
    },
    all(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    transaction(fn) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = fn();
        db.exec('COMMIT');
        return result;
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch { /* no open transaction */ }
        throw err;
      }
    },
    probe() {
      const row = db.prepare('SELECT 1 AS ok').get();
      return row?.ok === 1;
    },
    close() {
      db.close();
    },
  };
  return store;
}
