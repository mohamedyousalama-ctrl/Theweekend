import { el } from './html.js';
import { t } from './copy.js';
import { previousActionsInvalidAfterReconnect } from './policy.js';
import { renderAppHeader } from './chrome/app-header.js';
import { renderConversation } from './conversation/view.js';
import { composeTurn } from './conversation/composer.js';
import { renderApprovedBrief } from './brief/approved-brief.js';
import { renderInboxList } from './staff/inbox-list.js';
import { renderBriefPanel } from './staff/brief-panel.js';
import { renderPreferenceList } from './preferences/preference-list.js';
import { renderPreferenceEditor } from './preferences/preference-editor.js';
import { renderCapabilityCopy } from './capability/capability-copy.js';
import { renderError } from './states/error.js';
import { galleryIndex } from './gallery-states.js';

async function api(path, { method = 'GET', token, body, fetchImpl } = {}) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = json;
    err._http = res.status;
    throw err;
  }
  return json;
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
    gallery: false,
  };

  function locale() {
    return state.context?.locale || state.locale;
  }

  function paint() {
    const loc = locale();
    const header = renderAppHeader({
      context: state.context,
      health: state.health,
      active: state.surface,
      locale: loc,
    });
    const main = renderSurface(loc);
    const session = renderSession(loc);
    root.innerHTML = [
      el('a', { class: 'skip-link', href: '#wk-main' }, t(loc, 'skip')),
      header.html,
      el('div', { class: 'wk-page', id: 'wk-main', tabindex: '-1' }, [
        session,
        main,
      ]),
    ].join('');
    bind();
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
          error: state.error,
          reconnectInvalidates: state.reconnectInvalidates,
        }).html;
      case 'approved_brief':
        return renderApprovedBrief({
          brief: state.brief,
          allowedActions: state.allowedActions,
          locale: loc,
          actionResult: state.actionResult,
        }).html;
      case 'staff_inbox':
        return [
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
          renderCapabilityCopy({ context: state.context, health: state.health, locale: loc }).html,
          state.gallery ? el('p', { class: 'wk-note' }, `${t(loc, 'gallery')}: ${galleryIndex().join(', ')}`) : '',
        ].join('');
      default: {
        const _never = state.surface;
        void _never;
        return renderCapabilityCopy({ context: state.context, health: state.health, locale: loc }).html;
      }
    }
  }

  function bind() {
    root.querySelectorAll('[data-surface].wk-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.surface = btn.getAttribute('data-surface');
        if (state.surface === 'staff_inbox') void loadInbox();
        if (state.surface === 'preferences') void loadPreferences();
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
          state.draft = '';
        } catch (err) {
          state.error = err;
        } finally {
          state.loadingTurn = false;
          paint();
        }
      });
    }
    root.querySelectorAll('[data-action-id][data-executable="true"]').forEach((btn) => {
      btn.addEventListener('click', () => void clickAction(btn.getAttribute('data-action-id')));
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
        try {
          await api('/preferences', {
            method: 'POST',
            token: state.token,
            body: {
              kind,
              value_text,
              source: 'customer_typed',
              ...(versionField ? { version: Number(versionField.value) } : {}),
            },
            fetchImpl,
          });
          await loadPreferences();
        } catch (err) {
          state.prefError = err;
          paint();
        }
      });
    }
    if (state.error && !root.querySelector('[data-error-code]')) {
      const extra = renderError({ error: state.error, locale: locale(), keepDraft: Boolean(state.draft) });
      root.querySelector('#wk-main')?.insertAdjacentHTML('afterbegin', extra.html);
    }
  }

  async function clickAction(actionId) {
    if (!actionId || state.reconnectInvalidates) return;
    try {
      const result = await api(`/actions/${actionId}`, { method: 'POST', token: state.token, body: {}, fetchImpl });
      state.actionResult = result;
      state.error = null;
      if (result.outcome === 'external_handoff') {
        const action = state.allowedActions.find((a) => a.action_id === actionId);
        if (action?.url) window.open(action.url, '_blank', 'noopener');
      }
      if (result.outcome === 'stale' || result.outcome === 'rejected' || result.outcome === 'expired') {
        /* keep previous domain objects; do not flip success */
      }
      if (state.surface === 'preferences') await loadPreferences();
    } catch (err) {
      state.error = err;
      state.actionResult = null;
    }
    paint();
  }

  async function loadInbox() {
    state.inboxLoading = true;
    paint();
    try {
      const out = await api('/staff/briefs', { token: state.token, fetchImpl });
      state.briefs = out.briefs || [];
      state.inboxError = null;
    } catch (err) {
      state.inboxError = err;
    } finally {
      state.inboxLoading = false;
      paint();
    }
  }

  async function loadPreferences() {
    try {
      const out = await api('/preferences', { token: state.token, fetchImpl });
      state.preferences = out.preferences || [];
      state.prefError = null;
    } catch (err) {
      state.prefError = err;
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
