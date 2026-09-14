/**
 * Weekend application core: sessions, receipts, actions, preferences, briefs.
 * Displayed action IDs do not authorize execution; every click is rechecked here.
 */
import { assertContract, validateContract } from '../contracts/validate.mjs';
import { runModelTurn } from '../integrations/internal/model-adapter.mjs';
import { newId, passcodeMatches, readSignedSession, signSession } from './ids.mjs';
import { AttemptLimiter } from './limiter.mjs';
import { openStore } from './store.mjs';
import { withTimeout } from './timeout.mjs';

const PREFERENCE_KINDS = new Set(['style', 'barber', 'branch', 'do_not', 'note']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const NOTICE = {
  photo_analysis: 'notice_photo_v1',
  text_preferences: 'notice_prefs_v1',
  staff_sharing_text: 'notice_share_text_v1',
  staff_sharing_photo: 'notice_share_photo_v1',
};
const RETENTION = {
  photo_analysis: 'ret_photo_v1',
  text_preferences: 'ret_text_prefs_v1',
  staff_sharing_text: 'ret_share_text_v1',
  staff_sharing_photo: 'ret_share_photo_v1',
};
const ACTION_LABELS = {
  open_official_booking: { label_ar: 'صفحة الحجز الرسمية', label_en: 'Official booking page' },
  request_pending_booking: { label_ar: 'طلب موعد غير مؤكد', label_en: 'Pending booking request' },
  share_brief_text: { label_ar: 'مشاركة الموجز', label_en: 'Share the brief' },
  share_photo_ref: { label_ar: 'مشاركة مرجع الصورة', label_en: 'Share photo reference' },
  save_preference: { label_ar: 'حفظ التفضيل', label_en: 'Save preference' },
  delete_preference: { label_ar: 'حذف التفضيل', label_en: 'Delete preference' },
  talk_to_staff: { label_ar: 'تحدث مع الفريق', label_en: 'Talk to staff' },
  decline: { label_ar: 'لا شكراً', label_en: 'No thanks' },
  continue_without_photo: { label_ar: 'نكمل بدون صورة', label_en: 'Continue without a photo' },
};

export class AppError extends Error {
  constructor(shape, status = 400) {
    super(shape.message_key);
    this.shape = shape;
    this.status = status;
  }
}

function errorShape(code, messageKey, retryable, details = {}) {
  return { contract_version: '0.1.0', code, message_key: messageKey, retryable, details };
}

function fail(code, messageKey, retryable, details, status) {
  throw new AppError(errorShape(code, messageKey, retryable, details), status);
}

function iso(clock) {
  return clock();
}

function modelCapability(config, realAdapter = false) {
  if (config.WEEKEND_MODEL_MODE === 'mock' && config.WEEKEND_ENV === 'local') return 'mock';
  // Real inference exists only when stream A's adapter is injected (src/server/index.mjs); never assumed.
  if (config.WEEKEND_MODEL_MODE === 'real' && realAdapter) return 'real';
  return 'unavailable';
}

function capabilitiesFor(config, role, realAdapter = false) {
  return {
    model: modelCapability(config, realAdapter),
    photo: config.WEEKEND_PHOTO_ENABLED ? 'enabled' : 'disabled',
    booking_handoff: config.WEEKEND_BOOKING_HANDOFF_MODE,
    staff_inbox: role === 'staff' || role === 'owner' ? 'enabled' : 'unavailable',
    preferences: 'enabled',
  };
}

function healthOf(config, storeUp, realAdapter = false) {
  const store = storeUp ? 'ok' : 'unavailable';
  const model = modelCapability(config, realAdapter);
  return {
    contract_version: '0.1.0',
    model: model === 'real' ? 'ok' : 'unavailable',
    photo: config.WEEKEND_PHOTO_ENABLED ? 'ok' : 'unavailable',
    booking_handoff: 'ok',
    staff_inbox: storeUp ? 'ok' : 'unavailable',
    preferences: storeUp ? 'ok' : 'unavailable',
    store,
    checked_at: new Date().toISOString(),
  };
}

function rowReceipt(row) {
  return {
    contract_version: '0.1.0',
    receipt_id: row.receipt_id,
    subject_id: row.subject_id,
    kind: row.kind,
    notice_version: row.notice_version,
    granted_at: row.granted_at,
    revoked_at: row.revoked_at,
    retention_policy_key: row.retention_policy_key,
    granted_via: row.granted_via,
  };
}

function rowPreference(row) {
  return {
    contract_version: '0.1.0',
    preference_id: row.preference_id,
    subject_id: row.subject_id,
    kind: row.kind,
    value_text: row.value_text,
    source: row.source,
    provenance: row.provenance,
    version: row.version,
    created_at: row.created_at,
    revoked_at: row.revoked_at,
  };
}

function rowAction(row) {
  return {
    contract_version: '0.1.0',
    action_id: row.action_id,
    kind: row.kind,
    label_ar: row.label_ar,
    label_en: row.label_en,
    bound: {
      session_id: row.session_id,
      subject_id: row.subject_id,
      object_id: row.object_id,
      object_version: row.object_version,
    },
    requires_receipt_kind: row.requires_receipt_kind,
    expires_at: row.expires_at,
    url: row.url,
  };
}

function rowBrief(row) {
  return {
    contract_version: '0.1.0',
    brief_id: row.brief_id,
    subject_id: row.subject_id,
    branch_id: row.branch_id,
    barber_preference: row.barber_preference,
    requested_look: { option_id: row.option_id, text_ar: row.text_ar },
    do_not: JSON.parse(row.do_not_json),
    reference: { kind: row.ref_kind, image_ref: row.image_ref, receipt_id: row.receipt_id },
    provenance: { approved_by_subject_at: row.approved_by_subject_at, version: row.version },
    status: row.status,
  };
}

function parsePayload(row) {
  if (!row?.payload_json) return {};
  try {
    const value = JSON.parse(row.payload_json);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function bytesMatchType(bytes, contentType) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) return false;
  if (contentType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png') {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (contentType === 'image/webp') {
    return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
}

export function createApp(config, deps = {}) {
  const clock = deps.clock || (() => new Date().toISOString());
  const store = deps.store || openStore(config.WEEKEND_DB_PATH);
  const adapter = deps.adapter || runModelTurn;
  const realAdapter = Boolean(deps.adapter) && config.WEEKEND_MODEL_MODE === 'real';
  // Upper bound of one turn's provider cost (minor units), reserved in the day ledger BEFORE the paid call and replaced
  // by the real cost afterwards; 0 when nothing is injected (mock mode, tests). The in-flight count per session lives in
  // memory: this application runs as one process on one instance (docs/16 §6), so the synchronous check-and-increment
  // is atomic for concurrent turns.
  const costCeilingMinor = Number.isInteger(deps.costCeilingMinor) && deps.costCeilingMinor > 0 ? deps.costCeilingMinor : 0;
  const inflight = new Map();
  const limiter = deps.limiter || new AttemptLimiter();
  const photoBytes = new Map();

  function activeReceipt(subjectId, kind) {
    return store.get(
      `SELECT * FROM permission_receipts
       WHERE subject_id = ? AND kind = ? AND revoked_at IS NULL
       ORDER BY granted_at DESC LIMIT 1`,
      [subjectId, kind],
    );
  }

  function requireSession(token) {
    const sessionId = readSignedSession(token, config.WEEKEND_SESSION_SECRET);
    if (!sessionId) fail('UNAUTHORIZED', 'session.invalid', false, {}, 401);
    const session = store.get('SELECT * FROM sessions WHERE session_id = ?', [sessionId]);
    if (!session || session.verified !== 1) fail('UNAUTHORIZED', 'session.invalid', false, {}, 401);
    if (Date.parse(session.expires_at) <= Date.parse(iso(clock))) {
      fail('UNAUTHORIZED', 'session.expired', false, {}, 401);
    }
    return session;
  }

  function contextOf(session) {
    const consents = store.all(
      `SELECT * FROM permission_receipts WHERE subject_id = ? AND revoked_at IS NULL`,
      [session.subject_id],
    ).map(rowReceipt);
    const context = {
      contract_version: '0.1.0',
      session_id: session.session_id,
      subject_id: session.subject_id,
      role: session.role,
      verified: true,
      branch_id: config.WEEKEND_BRANCH_ID,
      locale: 'ar',
      capabilities: capabilitiesFor(config, session.role, realAdapter),
      consents,
      issued_at: iso(clock),
    };
    assertContract('TrustedContext', context);
    return context;
  }

  function persistAction(session, kind, objectId, objectVersion, extra = {}) {
    const labels = ACTION_LABELS[kind];
    const url = kind === 'open_official_booking' ? config.WEEKEND_OFFICIAL_BOOKING_URL : null;
    const payload = extra.payload && typeof extra.payload === 'object' ? extra.payload : {};
    const row = {
      action_id: newId('act_'),
      kind,
      label_ar: labels.label_ar,
      label_en: labels.label_en,
      session_id: session.session_id,
      subject_id: session.subject_id,
      object_id: objectId,
      object_version: objectVersion,
      requires_receipt_kind: extra.requires_receipt_kind ?? null,
      expires_at: extra.expires_at || new Date(Date.parse(iso(clock)) + 3600000).toISOString(),
      url,
      payload_json: JSON.stringify(payload),
    };
    store.run(
      `INSERT INTO allowed_actions (
         action_id, kind, label_ar, label_en, session_id, subject_id, object_id,
         object_version, requires_receipt_kind, expires_at, url, consumed_at, payload_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        row.action_id, row.kind, row.label_ar, row.label_en, row.session_id, row.subject_id,
        row.object_id, row.object_version, row.requires_receipt_kind, row.expires_at, row.url,
        row.payload_json,
      ],
    );
    const action = rowAction(row);
    assertContract('AllowedAction', action);
    return action;
  }

  function insertDraftPreference(session, kind, valueText) {
    const pref = {
      contract_version: '0.1.0',
      preference_id: newId('prf_'),
      subject_id: session.subject_id,
      kind,
      value_text: valueText,
      source: 'customer_selected',
      provenance: 'proposal',
      version: 1,
      created_at: iso(clock),
      revoked_at: null,
    };
    assertContract('Preference', pref);
    store.run(
      `INSERT INTO preferences (
         preference_id, subject_id, kind, value_text, source, provenance, version, created_at, revoked_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [pref.preference_id, pref.subject_id, pref.kind, pref.value_text, pref.source,
        pref.provenance, pref.version, pref.created_at],
    );
    return pref;
  }

  function ownedPreference(session, preferenceId) {
    if (typeof preferenceId !== 'string') return null;
    const pref = store.get(
      'SELECT * FROM preferences WHERE preference_id = ? AND revoked_at IS NULL',
      [preferenceId],
    );
    if (!pref || pref.subject_id !== session.subject_id) return null;
    return pref;
  }

  function persistSavePreferenceProposal(session, payload) {
    if (typeof payload.preference_id === 'string') {
      const pref = ownedPreference(session, payload.preference_id);
      if (!pref) return null;
      return persistAction(session, 'save_preference', pref.preference_id, pref.version, {
        requires_receipt_kind: 'text_preferences',
        payload,
      });
    }
    const kind = PREFERENCE_KINDS.has(payload.preference_kind) ? payload.preference_kind : 'note';
    const value = typeof payload.value_text === 'string' ? payload.value_text.trim() : '';
    if (!value) return null;
    const draft = insertDraftPreference(session, kind, value);
    return persistAction(session, 'save_preference', draft.preference_id, draft.version, {
      requires_receipt_kind: 'text_preferences',
      payload: { ...payload, preference_id: draft.preference_id, preference_kind: kind, value_text: value },
    });
  }

  function persistDeletePreferenceProposal(session, payload) {
    const pref = ownedPreference(session, payload.preference_id);
    if (!pref) return null;
    return persistAction(session, 'delete_preference', pref.preference_id, pref.version, { payload });
  }

  function persistShareBriefProposal(session, payload) {
    if (typeof payload.brief_id !== 'string') return null;
    const brief = store.get('SELECT * FROM briefs WHERE brief_id = ?', [payload.brief_id]);
    if (!brief || brief.subject_id !== session.subject_id) return null;
    return persistAction(session, 'share_brief_text', brief.brief_id, brief.version, {
      requires_receipt_kind: 'staff_sharing_text',
      payload,
    });
  }

  function persistSharePhotoProposal(session, payload) {
    if (typeof payload.image_ref !== 'string') return null;
    const image = store.get('SELECT * FROM images WHERE image_ref = ?', [payload.image_ref]);
    if (!image || image.subject_id !== session.subject_id) return null;
    return persistAction(session, 'share_photo_ref', image.image_ref, 1, {
      requires_receipt_kind: 'staff_sharing_photo',
      payload,
    });
  }

  function persistProposedAction(session, proposed) {
    const payload = proposed.payload && typeof proposed.payload === 'object' ? proposed.payload : {};
    switch (proposed.kind) {
      case 'save_preference':
        return persistSavePreferenceProposal(session, payload);
      case 'delete_preference':
        return persistDeletePreferenceProposal(session, payload);
      case 'share_brief_text':
        return persistShareBriefProposal(session, payload);
      case 'share_photo_ref':
        return persistSharePhotoProposal(session, payload);
      case 'open_official_booking':
        return persistAction(session, proposed.kind, 'handoff_official_booking', 1, { payload });
      case 'request_pending_booking':
        return persistAction(session, proposed.kind, 'handoff_pending_booking', 1, { payload });
      case 'talk_to_staff':
        return persistAction(session, proposed.kind, 'handoff_staff', 1, { payload });
      case 'decline':
        return persistAction(session, proposed.kind, 'decline', 1, { payload });
      case 'continue_without_photo':
        return persistAction(session, proposed.kind, 'continue_without_photo', 1, { payload });
      default: {
        const _never = proposed.kind;
        void _never;
        return null;
      }
    }
  }

  function persistUsage(record) {
    assertContract('ModelUsageRecord', record);
    store.run(
      `INSERT INTO usage_records (
         usage_id, session_id, turn_id, provider, model_id, prompt_version,
         input_tokens, output_tokens, latency_ms, cost_estimate_minor, outcome, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.usage_id, record.session_id, record.turn_id, record.provider, record.model_id,
        record.prompt_version, record.input_tokens, record.output_tokens, record.latency_ms,
        record.cost_estimate_minor, record.outcome, record.created_at,
      ],
    );
  }

  function sessionCalls(sessionId) {
    return store.get('SELECT COUNT(*) AS n FROM usage_records WHERE session_id = ?', [sessionId]).n;
  }

  function spendCapMinor() {
    return config.WEEKEND_SPEND_CAP_USD_PER_DAY * 100;
  }

  /**
   * Claims one call and `costMinor` of today's cap in a single UPDATE: the row must still be under the cap and the
   * addition must fit. Returns false when the cap is reached, so two concurrent turns can never both pass the gate.
   */
  function reserveSpend(now, costMinor = 0) {
    const day = now.slice(0, 10);
    const add = Number.isInteger(costMinor) && costMinor > 0 ? costMinor : 0;
    const cap = spendCapMinor();
    store.run(
      `INSERT INTO daily_spend (day, calls, cost_minor) VALUES (?, 0, 0)
       ON CONFLICT(day) DO NOTHING`,
      [day],
    );
    const result = store.run(
      `UPDATE daily_spend
       SET calls = calls + 1, cost_minor = cost_minor + ?
       WHERE day = ? AND cost_minor < ? AND cost_minor + ? <= ?`,
      [add, day, cap, add, cap],
    );
    return result.changes === 1;
  }

  /** After the call: the reserved ceiling is replaced by the real cost — a real cost is always recorded, even past the cap. */
  function settleSpend(now, reservedMinor, actualMinor) {
    const day = now.slice(0, 10);
    const actual = Number.isInteger(actualMinor) && actualMinor > 0 ? actualMinor : 0;
    store.run(
      'UPDATE daily_spend SET cost_minor = MAX(0, cost_minor - ? + ?) WHERE day = ?',
      [reservedMinor, actual, day],
    );
  }

  function rejectPasscode(clientKey) {
    limiter.recordFailure(clientKey);
    fail('UNAUTHORIZED', 'session.passcode', false, {}, 401);
  }

  function createSession(role, passcode, options = {}) {
    if (!['customer', 'staff', 'owner'].includes(role)) {
      fail('VALIDATION_ERROR', 'session.role', false, { field: 'role' });
    }
    const clientKey = typeof options.clientKey === 'string' && options.clientKey
      ? options.clientKey
      : 'unknown';
    if (limiter.isLimited(clientKey)) {
      fail('UNAUTHORIZED', 'session.throttled', true, {}, 401);
    }
    if (role === 'owner' && !passcodeMatches(config.WEEKEND_OWNER_PASSCODE_HASH, passcode)) {
      rejectPasscode(clientKey);
    }
    if (role === 'staff' && !passcodeMatches(config.WEEKEND_STAFF_PASSCODE_HASH, passcode)) {
      rejectPasscode(clientKey);
    }
    if (role === 'customer') {
      const ownerOk = passcodeMatches(config.WEEKEND_OWNER_PASSCODE_HASH, passcode);
      const localOk = config.WEEKEND_ENV === 'local'
        && config.WEEKEND_LOCAL_CUSTOMER_PASSCODE_HASH
        && passcodeMatches(config.WEEKEND_LOCAL_CUSTOMER_PASSCODE_HASH, passcode);
      if (!ownerOk && !localOk) rejectPasscode(clientKey);
    }
    const now = iso(clock);
    const subjectId = newId('sub_');
    const sessionId = newId('ses_');
    store.run('INSERT INTO subjects (subject_id, role, created_at) VALUES (?, ?, ?)', [subjectId, role, now]);
    store.run(
      `INSERT INTO sessions (session_id, subject_id, role, token_hmac, verified, expires_at, created_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [sessionId, subjectId, role, signSession(sessionId, config.WEEKEND_SESSION_SECRET),
        new Date(Date.parse(now) + 8 * 3600000).toISOString(), now],
    );
    const session = store.get('SELECT * FROM sessions WHERE session_id = ?', [sessionId]);
    return { token: signSession(sessionId, config.WEEKEND_SESSION_SECRET), context: contextOf(session) };
  }

  function grantConsent(token, kind, via) {
    const session = requireSession(token);
    if (!NOTICE[kind]) fail('VALIDATION_ERROR', 'consent.kind', false, { field: 'kind' });
    if (via === 'staff_ui' && session.role === 'customer') {
      fail('UNAUTHORIZED', 'consent.via', false, {}, 401);
    }
    const now = iso(clock);
    const receipt = {
      contract_version: '0.1.0',
      receipt_id: newId('rcp_'),
      subject_id: session.subject_id,
      kind,
      notice_version: NOTICE[kind],
      granted_at: now,
      revoked_at: null,
      retention_policy_key: RETENTION[kind],
      granted_via: via === 'staff_ui' ? 'staff_ui' : 'customer_ui',
    };
    assertContract('PermissionReceipt', receipt);
    store.run(
      `INSERT INTO permission_receipts (
         receipt_id, subject_id, kind, notice_version, granted_at, revoked_at,
         retention_policy_key, granted_via
       ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      [receipt.receipt_id, receipt.subject_id, receipt.kind, receipt.notice_version,
        receipt.granted_at, receipt.retention_policy_key, receipt.granted_via],
    );
    return receipt;
  }

  function revokeConsent(token, receiptId) {
    const session = requireSession(token);
    const row = store.get('SELECT * FROM permission_receipts WHERE receipt_id = ?', [receiptId]);
    if (!row || row.subject_id !== session.subject_id) fail('NOT_FOUND', 'consent.not_found', false, {}, 404);
    const now = iso(clock);
    store.run('UPDATE permission_receipts SET revoked_at = ? WHERE receipt_id = ?', [now, receiptId]);
    return rowReceipt({ ...row, revoked_at: now });
  }

  function listPreferences(token) {
    const session = requireSession(token);
    return store.all(
      `SELECT * FROM preferences WHERE subject_id = ? AND revoked_at IS NULL`,
      [session.subject_id],
    ).map(rowPreference);
  }

  function savePreference(token, { kind, value_text, source, version }) {
    const session = requireSession(token);
    if (!activeReceipt(session.subject_id, 'text_preferences')) {
      fail('CONSENT_REQUIRED', 'preference.consent_required', false, { capability: 'preferences' }, 403);
    }
    if (source === undefined) source = 'customer_typed';
    const existing = store.get(
      `SELECT * FROM preferences WHERE subject_id = ? AND kind = ? AND revoked_at IS NULL`,
      [session.subject_id, kind],
    );
    if (existing) {
      if (version !== existing.version) {
        fail('CONFLICT', 'preference.version_conflict', false, { field: 'version' }, 409);
      }
      const next = { ...rowPreference(existing), value_text, version: existing.version + 1, source };
      assertContract('Preference', next);
      store.run(
        `UPDATE preferences SET value_text = ?, source = ?, version = ? WHERE preference_id = ?`,
        [value_text, source, next.version, existing.preference_id],
      );
      return next;
    }
    const pref = {
      contract_version: '0.1.0',
      preference_id: newId('prf_'),
      subject_id: session.subject_id,
      kind,
      value_text,
      source,
      provenance: 'approved_preference',
      version: 1,
      created_at: iso(clock),
      revoked_at: null,
    };
    assertContract('Preference', pref);
    store.run(
      `INSERT INTO preferences (
         preference_id, subject_id, kind, value_text, source, provenance, version, created_at, revoked_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [pref.preference_id, pref.subject_id, pref.kind, pref.value_text, pref.source,
        pref.provenance, pref.version, pref.created_at],
    );
    return pref;
  }

  function deletePreference(token, preferenceId) {
    const session = requireSession(token);
    const row = store.get('SELECT * FROM preferences WHERE preference_id = ?', [preferenceId]);
    if (!row || row.subject_id !== session.subject_id) fail('NOT_FOUND', 'preference.not_found', false, {}, 404);
    const now = iso(clock);
    store.run('UPDATE preferences SET revoked_at = ? WHERE preference_id = ?', [now, preferenceId]);
    return rowPreference({ ...row, revoked_at: now });
  }

  function createBrief(token, { text_ar, do_not = [], option_id = null, barber_preference = null }) {
    const session = requireSession(token);
    if (session.role !== 'customer' && session.role !== 'owner') {
      fail('UNAUTHORIZED', 'brief.role', false, {}, 401);
    }
    const brief = {
      contract_version: '0.1.0',
      brief_id: newId('brf_'),
      subject_id: session.subject_id,
      branch_id: config.WEEKEND_BRANCH_ID,
      barber_preference,
      requested_look: { option_id, text_ar },
      do_not,
      reference: { kind: 'none', image_ref: null, receipt_id: null },
      provenance: { approved_by_subject_at: iso(clock), version: 1 },
      status: 'approved',
    };
    assertContract('BarberBrief', brief);
    store.run(
      `INSERT INTO briefs (
         brief_id, subject_id, branch_id, barber_preference, option_id, text_ar, do_not_json,
         ref_kind, image_ref, receipt_id, approved_by_subject_at, version, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'none', NULL, NULL, ?, 1, 'approved', ?)`,
      [brief.brief_id, brief.subject_id, brief.branch_id, brief.barber_preference, option_id,
        text_ar, JSON.stringify(do_not), brief.provenance.approved_by_subject_at, iso(clock)],
    );
    return brief;
  }

  function staffBriefs(token) {
    const session = requireSession(token);
    if (session.role !== 'staff' && session.role !== 'owner') {
      fail('UNAUTHORIZED', 'staff.required', false, {}, 401);
    }
    const rows = store.all(
      `SELECT * FROM briefs WHERE branch_id = ? AND status IN ('approved', 'delivered', 'acknowledged')`,
      [config.WEEKEND_BRANCH_ID],
    );
    const now = iso(clock);
    return rows.map(row => {
      if (row.status === 'approved') {
        const viewId = newId('svw_');
        store.run('UPDATE briefs SET status = ? WHERE brief_id = ?', ['delivered', row.brief_id]);
        store.run(
          `INSERT OR IGNORE INTO delivery_receipts
             (brief_id, delivered_at, staff_view_id, acknowledged_at, acknowledged_by)
           VALUES (?, ?, ?, NULL, NULL)`,
          [row.brief_id, now, viewId],
        );
        row.status = 'delivered';
      }
      return rowBrief(row);
    });
  }

  function acknowledgeBrief(token, briefId) {
    const session = requireSession(token);
    if (session.role !== 'staff' && session.role !== 'owner') {
      fail('UNAUTHORIZED', 'staff.required', false, {}, 401);
    }
    const brief = store.get('SELECT * FROM briefs WHERE brief_id = ?', [briefId]);
    if (!brief || brief.branch_id !== config.WEEKEND_BRANCH_ID) {
      fail('NOT_FOUND', 'brief.not_found', false, {}, 404);
    }
    const now = iso(clock);
    store.run('UPDATE briefs SET status = ? WHERE brief_id = ?', ['acknowledged', briefId]);
    const existing = store.get('SELECT * FROM delivery_receipts WHERE brief_id = ?', [briefId]);
    if (!existing) {
      store.run(
        `INSERT INTO delivery_receipts
           (brief_id, delivered_at, staff_view_id, acknowledged_at, acknowledged_by)
         VALUES (?, ?, ?, ?, ?)`,
        [briefId, now, newId('svw_'), now, session.subject_id],
      );
    } else {
      store.run(
        `UPDATE delivery_receipts SET acknowledged_at = ?, acknowledged_by = ? WHERE brief_id = ?`,
        [now, session.subject_id, briefId],
      );
    }
    const receipt = store.get('SELECT * FROM delivery_receipts WHERE brief_id = ?', [briefId]);
    const out = {
      contract_version: '0.1.0',
      brief_id: receipt.brief_id,
      delivered_at: receipt.delivered_at,
      staff_view_id: receipt.staff_view_id,
      acknowledged_at: receipt.acknowledged_at,
      acknowledged_by: receipt.acknowledged_by,
    };
    assertContract('DeliveryReceipt', out);
    return out;
  }

  function registerUpload(token, { byteLength, contentType, bytes }) {
    const session = requireSession(token);
    if (!config.WEEKEND_PHOTO_ENABLED) {
      fail('CAPABILITY_UNAVAILABLE', 'photo.disabled', false, { capability: 'photo' }, 403);
    }
    if (!activeReceipt(session.subject_id, 'photo_analysis')) {
      fail('CONSENT_REQUIRED', 'photo.consent_required', false, { capability: 'photo' }, 403);
    }
    if (!IMAGE_TYPES.has(contentType) || byteLength > config.WEEKEND_UPLOAD_MAX_BYTES || byteLength < 1) {
      fail('UPLOAD_REJECTED', 'upload.rejected', false, { field: 'image_ref', limit: config.WEEKEND_UPLOAD_MAX_BYTES }, 400);
    }
    if (bytes instanceof Uint8Array) {
      if (bytes.length !== byteLength || !bytesMatchType(bytes, contentType)) {
        fail('UPLOAD_REJECTED', 'upload.rejected', false, { field: 'image_ref', limit: config.WEEKEND_UPLOAD_MAX_BYTES }, 400);
      }
    }
    const imageRef = newId('img_');
    store.run(
      `INSERT INTO images (image_ref, subject_id, session_id, byte_length, content_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [imageRef, session.subject_id, session.session_id, byteLength, contentType, iso(clock)],
    );
    if (bytes instanceof Uint8Array) {
      photoBytes.set(imageRef, Buffer.from(bytes));
    }
    return { image_ref: imageRef };
  }

  function consumePhotoBytes(imageRef) {
    const stored = photoBytes.get(imageRef) ?? null;
    photoBytes.delete(imageRef);
    return stored;
  }

  function actionResult(actionId, outcome, messageKey, receiptId = null) {
    const result = {
      contract_version: '0.1.0',
      action_id: actionId,
      outcome,
      receipt_id: receiptId,
      message_key: messageKey,
    };
    assertContract('ActionResult', result);
    return result;
  }

  function staleAction(actionId) {
    return actionResult(actionId, 'stale', 'action.stale');
  }

  function executeAction(token, actionId) {
    const session = requireSession(token);
    const row = store.get('SELECT * FROM allowed_actions WHERE action_id = ?', [actionId]);
    if (!row || row.subject_id !== session.subject_id) {
      fail('NOT_FOUND', 'action.not_found', false, {}, 404);
    }
    if (row.session_id !== session.session_id) {
      fail('STALE_ACTION', 'action.stale', false, { action_id: actionId }, 409);
    }
    if (row.consumed_at) {
      return staleAction(actionId);
    }
    if (Date.parse(row.expires_at) <= Date.parse(iso(clock))) {
      return actionResult(actionId, 'expired', 'action.expired');
    }
    if (row.requires_receipt_kind && !activeReceipt(session.subject_id, row.requires_receipt_kind)) {
      fail('CONSENT_REQUIRED', 'action.consent_required', false, { action_id: actionId }, 403);
    }

    let outcome = 'done';
    let messageKey = 'action.done';
    let receiptId = null;
    const payload = parsePayload(row);
    switch (row.kind) {
      case 'open_official_booking':
        outcome = 'external_handoff';
        messageKey = 'booking.external_handoff';
        break;
      case 'request_pending_booking':
        if (config.WEEKEND_BOOKING_HANDOFF_MODE !== 'pending_request') {
          outcome = 'rejected';
          messageKey = 'booking.pending_disabled';
          break;
        }
        store.run(
          `INSERT INTO pending_requests (request_id, subject_id, session_id, status, created_at)
           VALUES (?, ?, ?, 'pending', ?)`,
          [newId('req_'), session.subject_id, session.session_id, iso(clock)],
        );
        outcome = 'pending';
        messageKey = 'booking.pending_unconfirmed';
        break;
      case 'talk_to_staff':
        outcome = 'pending';
        messageKey = 'handoff.queued';
        break;
      case 'save_preference': {
        const pref = store.get('SELECT * FROM preferences WHERE preference_id = ?', [row.object_id]);
        if (!pref || pref.subject_id !== session.subject_id) {
          fail('NOT_FOUND', 'preference.not_found', false, {}, 404);
        }
        if (pref.revoked_at || pref.version !== row.object_version) {
          return staleAction(actionId);
        }
        const value = typeof payload.value_text === 'string' && payload.value_text.trim()
          ? payload.value_text.trim()
          : pref.value_text;
        const nextVersion = pref.version + 1;
        store.run(
          `UPDATE preferences
           SET value_text = ?, source = ?, provenance = ?, version = ?
           WHERE preference_id = ?`,
          [value, 'customer_selected', 'approved_preference', nextVersion, pref.preference_id],
        );
        outcome = 'done';
        messageKey = 'action.save_preference';
        break;
      }
      case 'delete_preference': {
        const pref = store.get('SELECT * FROM preferences WHERE preference_id = ?', [row.object_id]);
        if (!pref || pref.subject_id !== session.subject_id) {
          fail('NOT_FOUND', 'preference.not_found', false, {}, 404);
        }
        if (pref.revoked_at || pref.version !== row.object_version) {
          return staleAction(actionId);
        }
        store.run(
          'UPDATE preferences SET revoked_at = ? WHERE preference_id = ?',
          [iso(clock), pref.preference_id],
        );
        outcome = 'done';
        messageKey = 'action.delete_preference';
        break;
      }
      case 'decline':
      case 'continue_without_photo':
        outcome = 'done';
        messageKey = `action.${row.kind}`;
        break;
      case 'share_brief_text': {
        if (!activeReceipt(session.subject_id, 'staff_sharing_text')) {
          fail('CONSENT_REQUIRED', 'brief.share_consent', false, { capability: 'staff_inbox' }, 403);
        }
        const brief = store.get('SELECT * FROM briefs WHERE brief_id = ?', [row.object_id]);
        if (!brief || brief.subject_id !== session.subject_id) {
          fail('NOT_FOUND', 'brief.not_found', false, {}, 404);
        }
        if (brief.version !== row.object_version) return staleAction(actionId);
        outcome = 'done';
        messageKey = 'brief.shared_text';
        break;
      }
      case 'share_photo_ref': {
        if (!activeReceipt(session.subject_id, 'staff_sharing_photo')) {
          fail('CONSENT_REQUIRED', 'brief.photo_consent', false, { capability: 'photo' }, 403);
        }
        const image = store.get('SELECT * FROM images WHERE image_ref = ?', [row.object_id]);
        if (!image || image.subject_id !== session.subject_id) {
          fail('NOT_FOUND', 'upload.not_found', false, {}, 404);
        }
        outcome = 'done';
        messageKey = 'brief.shared_photo';
        break;
      }
      default: {
        const _never = row.kind;
        fail('VALIDATION_ERROR', 'action.kind', false, { field: 'kind' });
        void _never;
      }
    }

    store.run('UPDATE allowed_actions SET consumed_at = ? WHERE action_id = ?', [iso(clock), actionId]);
    const result = actionResult(actionId, outcome, messageKey, receiptId);
    store.run(
      `INSERT INTO action_results (action_id, outcome, receipt_id, message_key, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [result.action_id, result.outcome, result.receipt_id, result.message_key, iso(clock)],
    );
    return result;
  }

  function defaultActions(session) {
    const actions = [];
    if (config.WEEKEND_BOOKING_HANDOFF_MODE === 'official_link') {
      actions.push(persistAction(session, 'open_official_booking', 'handoff_official_booking', 1));
    } else {
      actions.push(persistAction(session, 'request_pending_booking', 'handoff_pending_booking', 1));
    }
    actions.push(persistAction(session, 'talk_to_staff', 'handoff_staff', 1));
    return actions;
  }

  async function submitTurn(token, input) {
    const session = requireSession(token);
    const checked = validateContract('ChatTurnInput', input);
    if (!checked.ok) fail('VALIDATION_ERROR', 'turn.invalid', false, { field: 'text' });
    if (input.session_id !== session.session_id) {
      fail('UNAUTHORIZED', 'turn.session', false, {}, 401);
    }
    const context = contextOf(session);
    let imageBytes = null;
    if (input.image_ref) {
      if (context.capabilities.photo !== 'enabled') {
        fail('CAPABILITY_UNAVAILABLE', 'photo.disabled', false, { capability: 'photo' }, 403);
      }
      if (!activeReceipt(session.subject_id, 'photo_analysis')) {
        fail('CONSENT_REQUIRED', 'photo.consent_required', false, { capability: 'photo' }, 403);
      }
      const image = store.get('SELECT * FROM images WHERE image_ref = ?', [input.image_ref]);
      if (!image || image.subject_id !== session.subject_id) {
        fail('NOT_FOUND', 'upload.not_found', false, {}, 404);
      }
      imageBytes = consumePhotoBytes(input.image_ref);
    }

    if (input.client_action_id) {
      const result = executeAction(token, input.client_action_id);
      return { context, output: null, action_result: result, allowed_actions: [] };
    }

    const now = iso(clock);
    // Both caps are claimed BEFORE the paid call: the session slot counts finished calls plus turns still in flight
    // (synchronous, so concurrent turns cannot both pass), and the day ledger reserves the cost ceiling atomically.
    const sessionCap = config.WEEKEND_MAX_CALLS_PER_SESSION;
    const inFlight = inflight.get(session.session_id) || 0;
    if (sessionCalls(session.session_id) + inFlight >= sessionCap) {
      fail('BUDGET_EXCEEDED', 'model.session_cap', false, { capability: 'model', limit: sessionCap }, 429);
    }
    if (!reserveSpend(now, costCeilingMinor)) {
      fail('BUDGET_EXCEEDED', 'model.budget_exceeded', false, {
        capability: 'model',
        limit: config.WEEKEND_SPEND_CAP_USD_PER_DAY,
      }, 429);
    }
    inflight.set(session.session_id, inFlight + 1);

    let output;
    let usage;
    let settled = false;
    const settle = (actualMinor) => {
      if (settled) return;
      settled = true;
      settleSpend(now, costCeilingMinor, actualMinor);
    };
    try {
      const result = await withTimeout(
        () => adapter({ context, input, now, image_bytes: imageBytes }),
        config.WEEKEND_REQUEST_TIMEOUT_MS,
      );
      output = result.output;
      usage = result.usage;
    } catch (err) {
      settle(0); // nothing billable is known; the reservation is released, the claimed call stays counted
      if (err instanceof AppError) throw err;
      if (err?.code !== 'TIMEOUT') throw err;
      usage = {
        contract_version: '0.1.0',
        usage_id: newId('use_'),
        session_id: session.session_id,
        turn_id: input.turn_id,
        provider: 'none',
        model_id: 'unavailable',
        prompt_version: 'none',
        input_tokens: 0,
        output_tokens: 0,
        latency_ms: config.WEEKEND_REQUEST_TIMEOUT_MS,
        cost_estimate_minor: null,
        outcome: 'timeout',
        created_at: now,
      };
      persistUsage(usage);
      fail('TIMEOUT', 'model.timeout', true, { capability: 'model' }, 504);
    } finally {
      const left = (inflight.get(session.session_id) || 1) - 1;
      if (left > 0) inflight.set(session.session_id, left);
      else inflight.delete(session.session_id);
    }
    assertContract('ChatTurnOutput', output);
    // The real cost always lands in the ledger, even when it exceeds what was reserved; only later turns are refused.
    settle(usage.cost_estimate_minor ?? 0);
    persistUsage(usage);
    if (input.image_ref && output.observations) {
      store.run(
        `INSERT OR REPLACE INTO photo_observations
           (image_ref, session_id, subject_id, observations_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [input.image_ref, session.session_id, session.subject_id, JSON.stringify(output.observations), now],
      );
    }
    const allowed = [];
    for (const proposed of output.proposed_actions) {
      const saved = persistProposedAction(session, proposed);
      if (saved) allowed.push(saved);
    }
    if (allowed.length === 0) allowed.push(...defaultActions(session));
    return { context, output, action_result: null, allowed_actions: allowed };
  }

  function issueSavePreferenceAction(token, payload = {}) {
    const session = requireSession(token);
    const action = persistSavePreferenceProposal(session, payload);
    if (!action) fail('NOT_FOUND', 'preference.not_found', false, {}, 404);
    return action;
  }

  function issueDeletePreferenceAction(token, payload = {}) {
    const session = requireSession(token);
    const action = persistDeletePreferenceProposal(session, payload);
    if (!action) fail('NOT_FOUND', 'preference.not_found', false, {}, 404);
    return action;
  }

  function issueShareBriefAction(token, payload = {}) {
    const session = requireSession(token);
    const action = persistShareBriefProposal(session, payload);
    if (!action) fail('NOT_FOUND', 'brief.not_found', false, {}, 404);
    return action;
  }

  function issueSharePhotoAction(token, payload = {}) {
    const session = requireSession(token);
    const action = persistSharePhotoProposal(session, payload);
    if (!action) fail('NOT_FOUND', 'upload.not_found', false, {}, 404);
    return action;
  }

  function issueBookingAction(token) {
    const session = requireSession(token);
    return persistAction(
      session,
      config.WEEKEND_BOOKING_HANDOFF_MODE === 'official_link'
        ? 'open_official_booking'
        : 'request_pending_booking',
      'handoff_booking',
      1,
    );
  }

  return {
    store,
    health() {
      let storeUp = false;
      try {
        storeUp = store.probe();
      } catch {
        storeUp = false;
      }
      const state = { ...healthOf(config, storeUp, realAdapter), checked_at: iso(clock) };
      assertContract('HealthState', state);
      return state;
    },
    createSession,
    context(token) {
      return contextOf(requireSession(token));
    },
    grantConsent,
    revokeConsent,
    listPreferences,
    savePreference,
    deletePreference,
    createBrief,
    staffBriefs,
    acknowledgeBrief,
    registerUpload,
    executeAction,
    submitTurn,
    issueBookingAction,
    issueSavePreferenceAction,
    issueDeletePreferenceAction,
    issueShareBriefAction,
    issueSharePhotoAction,
    peekPhotoBytes(imageRef) {
      return photoBytes.has(imageRef);
    },
    close() {
      store.close();
    },
  };
}
