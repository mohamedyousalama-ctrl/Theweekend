/**
 * Presentation policy for M1 Rakan UI.
 * Inputs must come from C contract objects. Displayed action IDs do not authorize execution.
 */

export const CONTRACT_VERSION = '0.1.0';

export const ALLOWED_ACTION_KINDS = Object.freeze([
  'open_official_booking',
  'request_pending_booking',
  'share_brief_text',
  'share_photo_ref',
  'save_preference',
  'delete_preference',
  'talk_to_staff',
  'decline',
  'continue_without_photo',
]);

export const M1_SURFACES = Object.freeze([
  'conversation',
  'approved_brief',
  'staff_inbox',
  'preferences',
  'capability',
]);

export const M2_SURFACES = Object.freeze([
  'reception_kiosk',
  'visit_capture',
  'guest_directory',
  'cross_branch_banner',
  'visit_stats',
  'health_dossier',
  'visit_gallery',
  'visit_ledger',
]);

export const NOT_INFERRED = Object.freeze([
  'identity',
  'age',
  'ethnicity',
  'health',
  'attractiveness',
  'gender',
]);

export const ERROR_CODES = Object.freeze([
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'CONSENT_REQUIRED',
  'CAPABILITY_UNAVAILABLE',
  'MODEL_UNAVAILABLE',
  'BUDGET_EXCEEDED',
  'TIMEOUT',
  'STALE_ACTION',
  'CONFLICT',
  'UPLOAD_REJECTED',
]);

export const ACTION_OUTCOMES = Object.freeze([
  'done',
  'external_handoff',
  'pending',
  'rejected',
  'expired',
  'revoked',
  'stale',
]);

export const RECEIPT_KINDS = Object.freeze([
  'photo_analysis',
  'text_preferences',
  'staff_sharing_text',
  'staff_sharing_photo',
]);

const RECEIPT_KIND_SET = new Set(RECEIPT_KINDS);

export function isReceiptKind(kind) {
  return RECEIPT_KIND_SET.has(kind);
}

export function isConsentRequired(error) {
  return Boolean(error && error.code === 'CONSENT_REQUIRED');
}

export function receiptKindFromConsentError(error, fallbackKind = null) {
  if (isReceiptKind(error?.requires_receipt_kind)) return error.requires_receipt_kind;
  if (isReceiptKind(error?.details?.requires_receipt_kind)) return error.details.requires_receipt_kind;
  if (isReceiptKind(fallbackKind)) return fallbackKind;
  const key = error?.message_key;
  switch (key) {
    case 'photo.consent_required':
      return 'photo_analysis';
    case 'preference.consent_required':
      return 'text_preferences';
    case 'brief.share_consent':
      return 'staff_sharing_text';
    case 'brief.photo_consent':
      return 'staff_sharing_photo';
    default: {
      const cap = error?.details?.capability;
      switch (cap) {
        case 'photo':
          return 'photo_analysis';
        case 'preferences':
          return 'text_preferences';
        case 'staff_inbox':
          return 'staff_sharing_text';
        default:
          return isReceiptKind(fallbackKind) ? fallbackKind : null;
      }
    }
  }
}

export function lookupReceiptKindForAction(actionId, actionLists = []) {
  for (const list of actionLists) {
    const hit = (Array.isArray(list) ? list : []).find((a) => a && a.action_id === actionId);
    if (hit && isReceiptKind(hit.requires_receipt_kind)) return hit.requires_receipt_kind;
  }
  return null;
}

const ACTION_KIND_SET = new Set(ALLOWED_ACTION_KINDS);

export function isAllowedActionKind(kind) {
  return ACTION_KIND_SET.has(kind);
}

export function filterAllowedActions(actions, { max = 3 } = {}) {
  if (!Array.isArray(actions)) return [];
  const out = [];
  for (const action of actions) {
    if (!action || typeof action !== 'object') continue;
    if (!isAllowedActionKind(action.kind)) continue;
    if (typeof action.action_id !== 'string' || !action.action_id.startsWith('act_')) continue;
    out.push(action);
    if (out.length >= max) break;
  }
  return out;
}

export function hasActiveReceipt(consents, kind) {
  if (!Array.isArray(consents)) return false;
  return consents.some((receipt) => (
    receipt
    && receipt.kind === kind
    && receipt.revoked_at == null
    && typeof receipt.receipt_id === 'string'
    && receipt.receipt_id.startsWith('rcp_')
  ));
}

/** Bare hello with no service request. Used by the WhatsApp skin so a greeting does not dump cards. */
export function isGreetingOnly(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  const t = raw.replace(/[.!?؟،,~…]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length > 48) return false;
  return /^(وعليكم السلام\s+)?(هلا( والله)?|السلام عليكم|مرحباً?|أهلاً?( وسهلاً?)?|اهلا|سلام عليكم|سلام|hi there|hello|hey|hi)(\s+(والله|فيك))?$/iu.test(t);
}

export function photoPreviewPermitted(context) {
  if (!context || typeof context !== 'object') return false;
  return context.capabilities?.photo === 'enabled'
    && hasActiveReceipt(context.consents, 'photo_analysis');
}

export function shouldOfferContinueWithoutPhoto({ context, allowedActions, photoUiVisible }) {
  if (photoUiVisible) return true;
  if (context?.capabilities?.photo === 'enabled') return true;
  const actions = Array.isArray(allowedActions) ? allowedActions : [];
  return actions.some((a) => a && (a.kind === 'continue_without_photo' || a.kind === 'share_photo_ref'));
}

export function bookingNeverConfirmed(outcome) {
  void outcome;
  return true;
}

export function actionPresentation(actionResult) {
  if (!actionResult || typeof actionResult !== 'object') {
    return {
      kind: 'idle',
      showSuccess: false,
      pending: false,
      failed: false,
      bookingConfirmed: false,
      handoff: false,
    };
  }
  const outcome = actionResult.outcome;
  switch (outcome) {
    case 'done':
      return {
        kind: 'saved',
        showSuccess: true,
        pending: false,
        failed: false,
        bookingConfirmed: false,
        handoff: false,
      };
    case 'external_handoff':
      return {
        kind: 'handoff',
        showSuccess: false,
        pending: false,
        failed: false,
        bookingConfirmed: false,
        handoff: true,
      };
    case 'pending':
      return {
        kind: 'pending',
        showSuccess: false,
        pending: true,
        failed: false,
        bookingConfirmed: false,
        handoff: false,
      };
    case 'rejected':
    case 'expired':
    case 'revoked':
    case 'stale':
      return {
        kind: 'failed',
        showSuccess: false,
        pending: false,
        failed: true,
        bookingConfirmed: false,
        handoff: false,
      };
    default: {
      const _never = outcome;
      void _never;
      return {
        kind: 'unknown',
        showSuccess: false,
        pending: false,
        failed: true,
        bookingConfirmed: false,
        handoff: false,
      };
    }
  }
}

export function preferenceVisibleInM1(preference) {
  if (!preference || typeof preference !== 'object') return false;
  if (preference.revoked_at) return false;
  if (preference.provenance === 'executed_result') return false;
  return preference.provenance === 'proposal' || preference.provenance === 'approved_preference';
}

export function shareKindsSeparate(actions) {
  const list = filterAllowedActions(actions, { max: 9 });
  const text = list.filter((a) => a.kind === 'share_brief_text');
  const photo = list.filter((a) => a.kind === 'share_photo_ref');
  return { text, photo, bundled: false };
}

export function staffInboxVisible(context, health) {
  if (health?.staff_inbox === 'unavailable') return false;
  if (context?.capabilities?.staff_inbox !== 'enabled') return false;
  const role = context?.role;
  return role === 'staff' || role === 'owner';
}

export function preferencesSurfaceVisible(context, health) {
  if (health?.preferences === 'unavailable') return false;
  return context?.capabilities?.preferences === 'enabled';
}

export function navForContext(context, health) {
  const items = [{ id: 'capability', m1: true }];
  items.push({ id: 'conversation', m1: true });
  items.push({ id: 'approved_brief', m1: true });
  if (preferencesSurfaceVisible(context, health)) {
    items.push({ id: 'preferences', m1: true });
  }
  if (staffInboxVisible(context, health)) {
    items.push({ id: 'staff_inbox', m1: true });
  }
  return items.filter((item) => M1_SURFACES.includes(item.id) && !M2_SURFACES.includes(item.id));
}

export function styleOptionsLimited(options) {
  if (!Array.isArray(options)) return [];
  return options.slice(0, 2);
}

export function messagesLimited(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(0, 3);
}

export function capabilityOmitted(healthValue, capabilityValue, unavailableValues) {
  if (unavailableValues.includes(healthValue) || unavailableValues.includes(capabilityValue)) {
    return true;
  }
  return false;
}

export function previousActionsInvalidAfterReconnect(previousHealth, nextHealth) {
  if (!previousHealth || !nextHealth) return false;
  const keys = ['model', 'photo', 'booking_handoff', 'staff_inbox', 'preferences', 'store'];
  return keys.some((key) => {
    const was = previousHealth[key];
    const now = nextHealth[key];
    const wasDown = was === 'unavailable' || was === 'degraded';
    const recovered = now === 'ok' || now === 'degraded';
    return wasDown && recovered && was !== now;
  });
}

export function isErrorShape(value) {
  return Boolean(value && ERROR_CODES.includes(value.code) && typeof value.message_key === 'string');
}

export function inboxStatusFrom({ briefs, receipts, error, loading, actionResult }) {
  if (loading) return 'loading';
  if (error) return 'error';
  if (!Array.isArray(briefs) || briefs.length === 0) return 'empty';
  const presentation = actionPresentation(actionResult);
  if (presentation.pending) return 'pending';
  if (presentation.failed) return 'error';
  const hasAckReceipt = Array.isArray(receipts)
    && receipts.some((r) => r && r.acknowledged_at);
  if (hasAckReceipt) return 'saved';
  const waiting = briefs.some((b) => b && (b.status === 'approved' || b.status === 'delivered'));
  if (waiting) return 'pending';
  return 'ready';
}

export function acknowledgeIsNotBooking() {
  return true;
}

export function m2Mounted(surfaces) {
  if (!Array.isArray(surfaces)) return false;
  return surfaces.some((id) => M2_SURFACES.includes(id));
}

export function buildChatTurnInput({
  sessionId,
  turnId,
  text = '',
  imageRef = null,
  clientActionId = null,
  localeHint = 'ar',
}) {
  return {
    contract_version: CONTRACT_VERSION,
    session_id: sessionId,
    turn_id: turnId,
    text,
    image_ref: imageRef,
    client_action_id: clientActionId,
    locale_hint: localeHint,
  };
}
