import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../db/schema.sql'), 'utf8');

export function openStore(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
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
    close() {
      db.close();
    },
  };
}
