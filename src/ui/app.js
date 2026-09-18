import { el } from './html.js';
import { t } from './copy.js';
import {
  isConsentRequired,
  lookupReceiptKindForAction,
  previousActionsInvalidAfterReconnect,
  receiptKindFromConsentError,
  isReceiptKind,
} from './policy.js';
import { captureFocusKey, restoreFocus } from './focus.js';
import { renderAppHeader } from './chrome/app-header.js';
import { renderConversation } from './conversation/view.js';
import { composeTurn } from './conversation/composer.js';
import { renderApprovedBrief } from './brief/approved-brief.js';
import { renderInboxList } from './staff/inbox-list.js';
import { renderBriefPanel } from './staff/brief-panel.js';
import { renderHandoffList } from './staff/handoff-list.js';
import { renderPreferenceList } from './preferences/preference-list.js';
import { renderPreferenceEditor } from './preferences/preference-editor.js';
import { renderCapabilityCopy } from './capability/capability-copy.js';
import { renderConsentStep } from './consent/consent-step.js';
import { renderError } from './states/error.js';
import { galleryIndex } from './gallery-states.js';

async function api(path, { method = 'GET', token, body, fetchImpl, raw = false, contentType } = {}) {
  const doFetch = fetchImpl || fetch;
  const headers = {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  let payload;
  if (raw) {
    if (contentType) headers['content-type'] = contentType;
    payload = body;
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await doFetch(path, {
    method,
    headers,
    body: payload,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = json;
    err._http = res.status;
    throw err;
  }
  return json;
}

function uploadBytes(source) {
  if (!source) return { bytes: null, contentType: 'application/octet-stream' };
  if (source.bytes instanceof Uint8Array) {
    return { bytes: source.bytes, contentType: source.contentType || source.type || 'application/octet-stream' };
  }
  return null;
}

export function createRakanUi(root, { fetchImpl, initialSurface } = {}) {
  const state = {
    locale: 'ar',
    surface: initialSurface || 'capability',
    token: '',
    context: null,
    health: null,
    previousHealth: null,
    reconnectInvalidates: false,
    output: null,
    allowedActions: [],
    shareActions: [],
    actionResult: null,
    error: null,
    draft: '',
    imageRef: null,
    loadingTurn: false,
    brief: null,
    briefs: [],
    receipts: [],
    selectedBrief: null,
    preferences: [],
    prefError: null,
    inboxLoading: false,
    inboxError: null,
    handoffs: [],
    gallery: false,
    consent: null,
    pendingRetry: null,
    briefApproving: false,
  };

  function locale() {
    return state.context?.locale || state.locale;
  }

  function paint() {
    const loc = locale();
    const focusKey = captureFocusKey(root);
    const header = renderAppHeader({
      context: state.context,
      health: state.health,
      active: state.surface,
      locale: loc,
      gallery: state.gallery,
    });
    const main = renderSurface(loc);
    const session = renderSession(loc);
    const consent = state.consent?.kind
      ? renderConsentStep({
        kind: state.consent.kind,
        locale: loc,
        receipts: state.context?.consents,
      }).html
      : '';
    root.innerHTML = [
      el('a', { class: 'skip-link', href: '#wk-main' }, t(loc, 'skip')),
      header.html,
      el('div', { class: 'wk-page', id: 'wk-main', tabindex: '-1' }, [
        consent,
        session,
        main,
      ]),
    ].join('');
    bind();
    restoreFocus(root, focusKey);
  }

  function renderSession(loc) {
    if (state.context) {
      return el('p', { class: 'wk-note' }, `${t(loc, 'session')} ${state.context.session_id} · ${state.context.role}`);
    }
    return el('form', { id: 'wk-session', class: 'wk-editor' }, [
      el('label', { for: 'wk-role' }, t(loc, 'role')),
      el('select', { id: 'wk-role', name: 'role' }, [
        el('option', { value: 'customer' }, t(loc, 'customer_shell')),
        el('option', { value: 'staff' }, t(loc, 'staff_shell')),
        el('option', { value: 'owner' }, 'owner'),
      ]),
      el('label', { for: 'wk-pass' }, t(loc, 'passcode')),
      el('input', { id: 'wk-pass', name: 'passcode', type: 'password', autocomplete: 'current-password' }, ''),
      el('button', { type: 'submit', class: 'wk-pill' }, t(loc, 'enter')),
    ]);
  }

  function briefShareActions() {
    if (Array.isArray(state.shareActions) && state.shareActions.length) return state.shareActions;
    return state.allowedActions;
  }

  function renderSurface(loc) {
    switch (state.surface) {
      case 'conversation':
        return renderConversation({
          context: state.context,
          output: state.output,
          allowedActions: state.allowedActions,
          locale: loc,
          loading: state.loadingTurn,
          draft: state.draft,
          imageRef: state.imageRef,
          actionResult: state.actionResult,
          error: state.consent ? null : state.error,
          reconnectInvalidates: state.reconnectInvalidates,
          briefApproving: state.briefApproving,
        }).html;
      case 'approved_brief':
        return renderApprovedBrief({
          brief: state.brief,
          allowedActions: briefShareActions(),
          locale: loc,
          actionResult: state.actionResult,
        }).html;
      case 'staff_inbox':
        return [
          renderHandoffList({
            handoffs: state.handoffs,
            locale: loc,
            selfSubjectId: state.context?.subject_id || '',
          }).html,
          renderInboxList({
            context: state.context,
            health: state.health,
            briefs: state.briefs,
            receipts: state.receipts,
            locale: loc,
            loading: state.inboxLoading,
            error: state.inboxError,
            actionResult: state.actionResult,
          }).html,
          renderBriefPanel({
            brief: state.selectedBrief,
            receipt: state.receipts.find((r) => r.brief_id === state.selectedBrief?.brief_id) || null,
            locale: loc,
            actionResult: state.actionResult,
            loading: state.inboxLoading,
          }).html,
        ].join('');
      case 'preferences':
        return [
          renderPreferenceList({ preferences: state.preferences, locale: loc }).html,
          renderPreferenceEditor({
            locale: loc,
            allowedActions: state.allowedActions,
            error: state.prefError,
            actionResult: state.actionResult,
            capabilitiesEnabled: state.context?.capabilities?.preferences === 'enabled'
              && state.health?.preferences !== 'unavailable',
          }).html,
        ].join('');
      case 'capability':
        return [
          renderCapabilityCopy({
            context: state.context,
            health: state.health,
            locale: loc,
            gallery: state.gallery,
          }).html,
          state.gallery ? el('p', { class: 'wk-note' }, `${t(loc, 'gallery')}: ${galleryIndex().join(', ')}`) : '',
        ].join('');
      default: {
        const _never = state.surface;
        void _never;
        return renderCapabilityCopy({
          context: state.context,
          health: state.health,
          locale: loc,
          gallery: state.gallery,
        }).html;
      }
    }
  }

  function bind() {
    if (state.error && !root.querySelector('[data-error-code]')) {
      const extra = renderError({ error: state.error, locale: locale(), keepDraft: Boolean(state.draft) });
      root.querySelector('#wk-main')?.insertAdjacentHTML('afterbegin', extra.html);
    }
    root.querySelectorAll('[data-surface].wk-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.surface = btn.getAttribute('data-surface');
        if (state.surface === 'staff_inbox') void loadInbox();
        if (state.surface === 'preferences') void loadPreferences();
        if (state.surface === 'approved_brief') void loadShareActions();
        paint();
      });
    });
    const sessionForm = root.querySelector('#wk-session');
    if (sessionForm) {
      sessionForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const role = sessionForm.querySelector('[name="role"]').value;
        const passcode = sessionForm.querySelector('[name="passcode"]').value;
        try {
          const out = await api('/session', { method: 'POST', body: { role, passcode }, fetchImpl });
          state.token = out.token;
          state.context = out.context;
          state.error = null;
          state.reconnectInvalidates = false;
          paint();
        } catch (err) {
          state.error = err;
          paint();
        }
      });
    }
    const composer = root.querySelector('[data-component="composer"]');
    if (composer) {
      composer.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const text = composer.querySelector('textarea').value;
        if (!String(text || '').trim()) {
          state.error = {
            contract_version: '0.1.0',
            code: 'VALIDATION_ERROR',
            message_key: 'turn.invalid',
            retryable: false,
            details: { field: 'text' },
          };
          paint();
          return;
        }
        await submitTurn(text);
      });
    }
    root.querySelectorAll('[data-action-id][data-executable="true"]').forEach((btn) => {
      const opensItself = btn.getAttribute('data-opens-itself') === 'true';
      btn.addEventListener('click', () => void clickAction(btn.getAttribute('data-action-id'), { opensItself }));
    });
    root.querySelectorAll('[data-action-kind="continue_without_photo"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.imageRef = null;
        const id = btn.getAttribute('data-action-id');
        if (id) void clickAction(id);
        else paint();
      });
    });
    root.querySelectorAll('[data-retry="true"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.error = null;
        const pending = state.pendingRetry;
        if (pending) {
          void runPending(pending);
          return;
        }
        paint();
      });
    });
    root.querySelectorAll('[data-brief-id].wk-inbox-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-brief-id');
        state.selectedBrief = state.briefs.find((b) => b.brief_id === id) || null;
        paint();
      });
    });
    const ack = root.querySelector('[data-action="acknowledge"]');
    if (ack) {
      ack.addEventListener('click', async () => {
        if (!state.selectedBrief) return;
        try {
          const receipt = await api(`/staff/briefs/${state.selectedBrief.brief_id}/ack`, {
            method: 'POST',
            token: state.token,
            body: {},
            fetchImpl,
          });
          state.receipts = [...state.receipts.filter((r) => r.brief_id !== receipt.brief_id), receipt];
          state.selectedBrief = { ...state.selectedBrief, status: 'acknowledged' };
          state.actionResult = null;
        } catch (err) {
          state.inboxError = err;
        }
        paint();
      });
    }
    root.querySelectorAll('[data-handoff-accept="true"]').forEach((btn) => {
      btn.addEventListener('click', () => void postHandoff(btn.getAttribute('data-handoff-id'), 'accept'));
    });
    root.querySelectorAll('[data-handoff-release="true"]').forEach((btn) => {
      btn.addEventListener('click', () => void postHandoff(btn.getAttribute('data-handoff-id'), 'release'));
    });
    const prefForm = root.querySelector('[data-component="preference-editor"]');
    if (prefForm) {
      prefForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const saveBtn = prefForm.querySelector('[data-action-kind="save_preference"]');
        if (saveBtn?.getAttribute('data-action-id')) {
          await clickAction(saveBtn.getAttribute('data-action-id'));
          return;
        }
        const kind = prefForm.querySelector('[name="kind"]').value;
        const value_text = prefForm.querySelector('[name="value_text"]').value;
        const versionField = prefForm.querySelector('[name="version"]');
        const body = {
          kind,
          value_text,
          source: 'customer_typed',
          ...(versionField ? { version: Number(versionField.value) } : {}),
        };
        await savePreferenceDirect(body);
      });
    }
    const approve = root.querySelector('[data-action="approve-brief"]');
    if (approve) {
      approve.addEventListener('click', () => void approveBriefDraft());
    }
    const photoInput = root.querySelector('[data-photo-input="true"]');
    if (photoInput) {
      photoInput.addEventListener('change', async () => {
        const file = photoInput.files && photoInput.files[0];
        if (!file) return;
        await sendUpload(file);
      });
    }
    const grant = root.querySelector('[data-consent-grant="true"]');
    if (grant) {
      grant.addEventListener('click', () => void grantConsent(grant.getAttribute('data-consent-kind')));
    }
    const revoke = root.querySelector('[data-consent-revoke="true"]');
    if (revoke) {
      revoke.addEventListener('click', () => void revokeConsent(revoke.getAttribute('data-receipt-id')));
    }
    const dismiss = root.querySelector('[data-consent-dismiss="true"]');
    if (dismiss) {
      dismiss.addEventListener('click', () => {
        state.consent = null;
        state.pendingRetry = null;
        paint();
      });
    }
  }

  function attachReceipt(receipt) {
    if (!receipt || !state.context) return;
    const rest = (state.context.consents || []).filter((row) => row.kind !== receipt.kind || row.revoked_at);
    state.context = {
      ...state.context,
      consents: receipt.revoked_at ? rest : [...rest, receipt],
    };
  }

  function beginConsent(err, pending, fallbackKind) {
    const kind = receiptKindFromConsentError(err, fallbackKind || pending?.receiptKind);
    state.pendingRetry = pending;
    if (isReceiptKind(kind)) {
      state.consent = { kind, error: err };
      state.error = null;
    } else {
      state.consent = null;
      state.error = err;
    }
    paint();
  }

  async function runPending(pending) {
    if (!pending) {
      paint();
      return;
    }
    switch (pending.type) {
      case 'action':
        await clickAction(pending.actionId, { opensItself: pending.opensItself });
        break;
      case 'preference':
        await savePreferenceDirect(pending.body);
        break;
      case 'upload':
        await sendUpload({ bytes: pending.bytes, contentType: pending.contentType });
        break;
      case 'approve_brief':
        await approveBriefDraft();
        break;
      case 'share_actions':
        await loadShareActions();
        break;
      case 'turn':
        await submitTurn(pending.text || state.draft);
        break;
      default: {
        const _never = pending.type;
        void _never;
        paint();
      }
    }
  }

  async function grantConsent(kind) {
    if (!isReceiptKind(kind)) return;
    try {
      const receipt = await api('/consents', {
        method: 'POST',
        token: state.token,
        body: { kind, granted_via: 'customer_ui' },
        fetchImpl,
      });
      attachReceipt(receipt);
      state.consent = null;
      state.error = null;
      const pending = state.pendingRetry;
      state.pendingRetry = null;
      await runPending(pending);
    } catch (err) {
      state.error = err;
      paint();
    }
  }

  async function revokeConsent(receiptId) {
    if (!receiptId) return;
    try {
      const receipt = await api(`/consents/${receiptId}/revoke`, {
        method: 'POST',
        token: state.token,
        body: {},
        fetchImpl,
      });
      attachReceipt(receipt);
      state.consent = null;
      state.pendingRetry = null;
    } catch (err) {
      state.error = err;
    }
    paint();
  }

  async function submitTurn(text) {
    if (!String(text || '').trim()) {
      state.error = {
        contract_version: '0.1.0',
        code: 'VALIDATION_ERROR',
        message_key: 'turn.invalid',
        retryable: false,
        details: { field: 'text' },
      };
      paint();
      return;
    }
    state.draft = text;
    if (!state.context) return;
    state.loadingTurn = true;
    state.error = null;
    paint();
    try {
      const input = composeTurn({
        sessionId: state.context.session_id,
        text,
        imageRef: state.imageRef,
        localeHint: locale() === 'en' ? 'en' : 'ar',
      });
      const out = await api('/turns', { method: 'POST', token: state.token, body: input, fetchImpl });
      state.output = out.output;
      state.allowedActions = out.allowed_actions || [];
      state.actionResult = out.action_result;
      state.context = out.context || state.context;
      if (out.output?.state === 'ok') {
        state.draft = '';
        state.pendingRetry = null;
      } else if (out.output?.error?.retryable) {
        state.pendingRetry = { type: 'turn', text };
      }
    } catch (err) {
      if (isConsentRequired(err)) {
        state.loadingTurn = false;
        beginConsent(err, { type: 'turn', text }, 'photo_analysis');
        return;
      }
      state.error = err;
      if (err?.retryable) state.pendingRetry = { type: 'turn', text };
    } finally {
      state.loadingTurn = false;
      if (!state.consent) paint();
    }
  }

  async function clickAction(actionId, { opensItself = false } = {}) {
    if (!actionId || state.reconnectInvalidates) return;
    try {
      const result = await api(`/actions/${actionId}`, { method: 'POST', token: state.token, body: {}, fetchImpl });
      state.actionResult = result;
      state.error = null;
      if (result.outcome === 'external_handoff' && !opensItself) {
        const action = [...state.allowedActions, ...state.shareActions].find((a) => a.action_id === actionId);
        if (action?.url) window.open(action.url, '_blank', 'noopener,noreferrer');
      }
      if (result.outcome === 'stale' || result.outcome === 'rejected' || result.outcome === 'expired') {
        /* keep previous domain objects; do not flip success */
      }
      if (state.surface === 'preferences') await loadPreferences();
    } catch (err) {
      if (isConsentRequired(err)) {
        const receiptKind = lookupReceiptKindForAction(actionId, [state.allowedActions, state.shareActions]);
        beginConsent(err, { type: 'action', actionId, opensItself, receiptKind }, receiptKind);
        state.actionResult = null;
        return;
      }
      state.error = err;
      state.actionResult = null;
    }
    paint();
  }

  async function savePreferenceDirect(body) {
    try {
      await api('/preferences', {
        method: 'POST',
        token: state.token,
        body,
        fetchImpl,
      });
      state.prefError = null;
      await loadPreferences();
    } catch (err) {
      if (isConsentRequired(err)) {
        beginConsent(err, { type: 'preference', body }, 'text_preferences');
        return;
      }
      state.prefError = err;
      paint();
    }
  }

  async function sendUpload(source) {
    if (state.context?.capabilities?.photo !== 'enabled') return;
    let packed = uploadBytes(source);
    if (!packed && source && typeof source.arrayBuffer === 'function') {
      packed = {
        bytes: new Uint8Array(await source.arrayBuffer()),
        contentType: source.type || 'application/octet-stream',
      };
    }
    if (!packed?.bytes) return;
    try {
      const out = await api('/uploads', {
        method: 'POST',
        token: state.token,
        body: packed.bytes,
        raw: true,
        contentType: packed.contentType,
        fetchImpl,
      });
      if (out && typeof out.image_ref === 'string') state.imageRef = out.image_ref;
      state.error = null;
      state.pendingRetry = null;
    } catch (err) {
      if (isConsentRequired(err)) {
        beginConsent(err, {
          type: 'upload',
          bytes: packed.bytes,
          contentType: packed.contentType,
        }, 'photo_analysis');
        return;
      }
      state.error = err;
      if (err.code === 'UPLOAD_REJECTED') state.imageRef = null;
      state.pendingRetry = {
        type: 'upload',
        bytes: packed.bytes,
        contentType: packed.contentType,
      };
    }
    paint();
  }

  async function approveBriefDraft() {
    const draft = state.output?.brief_draft;
    if (!draft?.requested_look?.text_ar) return;
    state.briefApproving = true;
    paint();
    try {
      const brief = await api('/briefs', {
        method: 'POST',
        token: state.token,
        body: {
          text_ar: draft.requested_look.text_ar,
          do_not: Array.isArray(draft.do_not) ? draft.do_not : [],
          option_id: draft.requested_look.option_id ?? null,
          barber_preference: draft.barber_preference ?? null,
        },
        fetchImpl,
      });
      state.brief = brief;
      state.error = null;
      state.shareActions = [];
      try {
        const share = await api(`/briefs/${brief.brief_id}/share-actions`, {
          method: 'POST',
          token: state.token,
          body: {},
          fetchImpl,
        });
        state.shareActions = Array.isArray(share.allowed_actions) ? share.allowed_actions : [];
      } catch (shareErr) {
        if (isConsentRequired(shareErr)) {
          state.surface = 'approved_brief';
          state.briefApproving = false;
          beginConsent(shareErr, { type: 'share_actions' });
          return;
        }
        state.shareActions = [];
        state.error = shareErr;
        state.pendingRetry = { type: 'share_actions' };
      }
      state.surface = 'approved_brief';
    } catch (err) {
      if (isConsentRequired(err)) {
        state.briefApproving = false;
        beginConsent(err, { type: 'approve_brief' });
        return;
      }
      state.error = err;
    } finally {
      state.briefApproving = false;
    }
    paint();
  }

  async function loadInbox() {
    state.inboxLoading = true;
    paint();
    try {
      const [out, handoffOut] = await Promise.all([
        api('/staff/briefs', { token: state.token, fetchImpl }),
        api('/staff/handoffs', { token: state.token, fetchImpl }),
      ]);
      state.briefs = out.briefs || [];
      state.handoffs = handoffOut.handoffs || [];
      state.inboxError = null;
    } catch (err) {
      state.inboxError = err;
    } finally {
      state.inboxLoading = false;
      paint();
    }
  }

  async function postHandoff(handoffId, verb) {
    if (!handoffId || (verb !== 'accept' && verb !== 'release')) return;
    try {
      const row = await api(`/staff/handoffs/${handoffId}/${verb}`, {
        method: 'POST',
        token: state.token,
        body: {},
        fetchImpl,
      });
      state.handoffs = (state.handoffs || []).map((item) => (
        item.handoff_id === row.handoff_id ? row : item
      )).filter((item) => item.status === 'received' || item.status === 'accepted');
      if (verb === 'release') {
        state.handoffs = state.handoffs.filter((item) => item.handoff_id !== handoffId);
      }
      state.inboxError = null;
    } catch (err) {
      state.inboxError = err;
    }
    paint();
  }

  async function loadPreferences() {
    try {
      const out = await api('/preferences', { token: state.token, fetchImpl });
      state.preferences = out.preferences || [];
      state.prefError = null;
    } catch (err) {
      if (isConsentRequired(err)) {
        beginConsent(err, null, 'text_preferences');
        return;
      }
      state.prefError = err;
    }
    paint();
  }

  async function loadShareActions() {
    if (!state.brief?.brief_id || !state.token) return;
    try {
      const out = await api(`/briefs/${state.brief.brief_id}/share-actions`, {
        method: 'POST',
        token: state.token,
        body: {},
        fetchImpl,
      });
      state.shareActions = Array.isArray(out.allowed_actions) ? out.allowed_actions : [];
      state.error = null;
      state.pendingRetry = null;
    } catch (err) {
      if (isConsentRequired(err)) {
        beginConsent(err, { type: 'share_actions' });
        return;
      }
      state.shareActions = [];
      state.error = err;
      state.pendingRetry = { type: 'share_actions' };
    }
    paint();
  }

  async function refreshHealth() {
    try {
      const health = await api('/health', { fetchImpl });
      state.reconnectInvalidates = previousActionsInvalidAfterReconnect(state.previousHealth, health);
      if (state.reconnectInvalidates) state.allowedActions = [];
      state.previousHealth = state.health;
      state.health = health;
    } catch {
      state.health = null;
    }
    paint();
  }

  return {
    state,
    paint,
    refreshHealth,
    setGallery(on) {
      state.gallery = on;
      paint();
    },
  };
}

export function boot(root) {
  const ui = createRakanUi(root);
  const params = new URLSearchParams(window.location.search);
  if (params.get('gallery') === '1') ui.setGallery(true);
  ui.paint();
  void ui.refreshHealth();
  return ui;
}

if (typeof document !== 'undefined' && document.getElementById('rakan-root')) {
  boot(document.getElementById('rakan-root'));
}
