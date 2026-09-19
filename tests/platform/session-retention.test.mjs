import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { CLIENT_KEY_RETENTION_MS, SESSION_RETENTION_MS } from '../../src/server/app.mjs';
import { testApp } from './helpers.mjs';

const SCHEMA = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../db/schema.sql'),
  'utf8',
);

const DIGEST = 'ab'.repeat(32);
const PREFERENCE_TEXT = 'بدون عطر — تفضيل محفوظ';

function isoMinus(nowIso, ms) {
  return new Date(Date.parse(nowIso) - ms).toISOString();
}

function seedSession(raw, { subjectId, sessionId, expiresAt, createdAt }) {
  raw.prepare(`
    INSERT INTO subjects (subject_id, role, created_at)
    VALUES (?, 'customer', ?)
  `).run(subjectId, createdAt);
  raw.prepare(`
    INSERT INTO sessions (
      session_id, subject_id, role, token_hmac, verified, expires_at, created_at, guest, client_key
    ) VALUES (?, ?, 'customer', 'hmac_seed', 1, ?, ?, 1, ?)
  `).run(sessionId, subjectId, expiresAt, createdAt, DIGEST);
  raw.prepare(`
    INSERT INTO turns (session_id, turn_id, status, response_json, created_at)
    VALUES (?, ?, 'complete', ?, ?)
  `).run(sessionId, `trn_${sessionId}`, JSON.stringify({ text: `customer text for ${sessionId}` }), createdAt);
  raw.prepare(`
    INSERT INTO allowed_actions (
      action_id, kind, label_ar, label_en, session_id, subject_id, object_id,
      object_version, requires_receipt_kind, expires_at, url, consumed_at, payload_json
    ) VALUES (?, 'talk_to_staff', 'تحدث مع الفريق', 'Talk to staff', ?, ?, ?, 1, NULL, ?, NULL, NULL, '{}')
  `).run(`act_${sessionId}`, sessionId, subjectId, sessionId, expiresAt);
  raw.prepare(`
    INSERT INTO action_results (action_id, outcome, receipt_id, message_key, created_at)
    VALUES (?, 'pending', NULL, 'handoff.queued', ?)
  `).run(`act_${sessionId}`, createdAt);
  raw.prepare(`
    INSERT INTO staff_handoffs (
      handoff_id, subject_id, session_id, status, received_at,
      assigned_at, accepted_at, accepted_by, timed_out_at, released_at
    ) VALUES (?, ?, ?, 'received', ?, NULL, NULL, NULL, NULL, NULL)
  `).run(`hnd_${sessionId}`, subjectId, sessionId, createdAt);
  raw.prepare(`
    INSERT INTO pending_requests (request_id, subject_id, session_id, status, created_at)
    VALUES (?, ?, ?, 'pending', ?)
  `).run(`req_${sessionId}`, subjectId, sessionId, createdAt);
  raw.prepare(`
    INSERT INTO usage_records (
      usage_id, session_id, turn_id, provider, model_id, prompt_version,
      input_tokens, output_tokens, latency_ms, cost_estimate_minor, outcome, created_at
    ) VALUES (?, ?, ?, 'anthropic', 'claude-opus-5', 'v0.9', 40, 120, 900, 3, 'ok', ?)
  `).run(`use_${sessionId}`, sessionId, `trn_${sessionId}`, createdAt);
}

function dependentsOf(store, sessionId) {
  return {
    turn: store.get('SELECT * FROM turns WHERE session_id = ?', [sessionId]),
    action: store.get('SELECT * FROM allowed_actions WHERE session_id = ?', [sessionId]),
    result: store.get('SELECT * FROM action_results WHERE action_id = ?', [`act_${sessionId}`]),
    handoff: store.get('SELECT * FROM staff_handoffs WHERE session_id = ?', [sessionId]),
    pending: store.get('SELECT * FROM pending_requests WHERE session_id = ?', [sessionId]),
    usage: store.get('SELECT * FROM usage_records WHERE session_id = ?', [sessionId]),
  };
}

test('startup sweep deletes sessions 30 days past expiry and keeps a 2-day-old row after client-key nulling', () => {
  assert.equal(SESSION_RETENTION_MS, 30 * 24 * 60 * 60 * 1000);
  assert.ok(SESSION_RETENTION_MS > CLIENT_KEY_RETENTION_MS);

  const now = '2026-09-19T12:00:00.000Z';
  const oldExpires = isoMinus(now, 40 * 24 * 60 * 60 * 1000);
  const recentExpires = isoMinus(now, 2 * 24 * 60 * 60 * 1000);
  const dbPath = join(mkdtempSync(join(tmpdir(), 'weekend-session-retention-')), 'app.sqlite');
  const raw = new DatabaseSync(dbPath);
  raw.exec(SCHEMA);
  seedSession(raw, {
    subjectId: 'sub_old_retention',
    sessionId: 'ses_old_retention',
    expiresAt: oldExpires,
    createdAt: isoMinus(oldExpires, 8 * 3600000),
  });
  seedSession(raw, {
    subjectId: 'sub_recent_retention',
    sessionId: 'ses_recent_retention',
    expiresAt: recentExpires,
    createdAt: isoMinus(recentExpires, 8 * 3600000),
  });
  raw.prepare(`
    INSERT INTO preferences (
      preference_id, subject_id, kind, value_text, source, provenance, version,
      created_at, last_activity_at, revoked_at
    ) VALUES (
      'prf_keep_text', 'sub_old_retention', 'note', ?, 'customer_typed', 'approved_preference',
      1, ?, ?, NULL
    )
  `).run(PREFERENCE_TEXT, isoMinus(oldExpires, 8 * 3600000), now);
  raw.prepare(`
    INSERT INTO photo_observations (image_ref, session_id, subject_id, observations_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('img_old_retention', 'ses_old_retention', 'sub_old_retention', '{}', now);
  raw.prepare(`
    INSERT INTO images (image_ref, subject_id, session_id, byte_length, content_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('img_old_retention', 'sub_old_retention', 'ses_old_retention', 1024, 'image/jpeg', now);
  raw.prepare(`
    INSERT INTO photo_observations (image_ref, session_id, subject_id, observations_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('img_recent_retention', 'ses_recent_retention', 'sub_recent_retention', '{}', now);
  raw.prepare(`
    INSERT INTO images (image_ref, subject_id, session_id, byte_length, content_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('img_recent_retention', 'sub_recent_retention', 'ses_recent_retention', 2048, 'image/png', now);
  raw.close();

  const { app } = testApp({
    WEEKEND_PUBLIC_GUEST: 'true',
    WEEKEND_DB_PATH: dbPath,
  }, { clock: () => now });

  assert.equal(app.store.get('SELECT * FROM sessions WHERE session_id = ?', ['ses_old_retention']), null);
  const oldGone = dependentsOf(app.store, 'ses_old_retention');
  assert.equal(oldGone.turn, null);
  assert.equal(oldGone.action, null);
  assert.equal(oldGone.result, null);
  assert.equal(oldGone.handoff, null);
  assert.equal(oldGone.pending, null);
  assert.equal(oldGone.usage, null, 'usage_records for the old session is gone: session-keyed, no other retention');
  const oldPhotoObs = app.store.get('SELECT * FROM photo_observations WHERE image_ref = ?', ['img_old_retention']);
  const oldPhotoImg = app.store.get('SELECT * FROM images WHERE image_ref = ?', ['img_old_retention']);
  assert.equal(oldPhotoObs, null, 'photo_observations for the old session is gone (defensive backstop)');
  assert.equal(oldPhotoImg, null, 'images for the old session is gone (defensive backstop)');

  const recent = app.store.get('SELECT * FROM sessions WHERE session_id = ?', ['ses_recent_retention']);
  assert.ok(recent, 'a session only 2 days past expiry is kept');
  assert.equal(recent.client_key, null, 'the same pass nulls client_key before any session delete');
  const recentKept = dependentsOf(app.store, 'ses_recent_retention');
  assert.ok(recentKept.turn);
  assert.equal(JSON.parse(recentKept.turn.response_json).text, 'customer text for ses_recent_retention');
  assert.ok(recentKept.action);
  assert.ok(recentKept.result);
  assert.ok(recentKept.handoff);
  assert.ok(recentKept.pending);
  assert.ok(recentKept.usage, 'a recent session keeps its usage_records row');
  const recentPhotoObs = app.store.get('SELECT * FROM photo_observations WHERE image_ref = ?', ['img_recent_retention']);
  const recentPhotoImg = app.store.get('SELECT * FROM images WHERE image_ref = ?', ['img_recent_retention']);
  assert.ok(recentPhotoObs, 'a recent session keeps its photo_observations row');
  assert.ok(recentPhotoImg, 'a recent session keeps its images row');

  const subject = app.store.get('SELECT * FROM subjects WHERE subject_id = ?', ['sub_old_retention']);
  assert.ok(subject, 'subjects are never deleted by the session sweep');
  const preference = app.store.get('SELECT * FROM preferences WHERE preference_id = ?', ['prf_keep_text']);
  assert.ok(preference);
  assert.equal(preference.value_text, PREFERENCE_TEXT);
  assert.equal(preference.revoked_at, null);
  app.close();
});
