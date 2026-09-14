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
}

export function openStore(dbPath) {
  ensureParentDir(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  migrate(db);
  return {
    db,
    run(sql, params = []) {
      return db.prepare(sql).run(...params);
    },
    get(sql, params = []) {
      return db.prepare(sql).get(...params) ?? null;
    },
    all(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    probe() {
      const row = db.prepare('SELECT 1 AS ok').get();
      return row?.ok === 1;
    },
    close() {
      db.close();
    },
  };
}
