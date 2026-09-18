import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';
import { filterAllowedActions, isAllowedActionKind } from '../policy.js';

function bookingLabel(kind, locale, labelAr, labelEn) {
  void kind;
  return locale === 'en' ? labelEn : labelAr;
}

function asked(text, pattern) {
  return pattern.test(String(text || ''));
}

/** WhatsApp skin: one next-step cluster, never a greeting dump of every allowed kind. */
export function filterWhatsappActions(allowedActions, {
  greetingTurn = false,
  showStyles = false,
  hasBrief = false,
  lastGuestText = '',
  flags = [],
} = {}) {
  const guest = lastGuestText || '';
  const flagSet = new Set(Array.isArray(flags) ? flags : []);
  return filterAllowedActions(allowedActions).filter((action) => {
    switch (action.kind) {
      case 'continue_without_photo':
      case 'delete_preference':
        return false;
      case 'save_preference':
        return !greetingTurn && !showStyles && asked(guest, /احفظ|ذكرني|save|remember/i);
      case 'open_official_booking':
      case 'request_pending_booking':
        return !greetingTurn && !showStyles;
      case 'share_brief_text':
      case 'share_photo_ref':
        return hasBrief && !showStyles && !greetingTurn;
      case 'talk_to_staff':
        return !greetingTurn && (
          asked(guest, /موظف|طاقم|ستاف|staff|human|شخص/i)
          || flagSet.has('handoff_requested')
          || flagSet.has('complaint')
        );
      case 'decline':
        return !greetingTurn && !showStyles;
      default: {
        const _never = action.kind;
        void _never;
        return false;
      }
    }
  });
}

export function renderActionRow({
  allowedActions = [],
  proposedActions = [],
  locale = 'ar',
  disabled = false,
  reconnectInvalidates = false,
  variant = 'weekend',
  greetingTurn = false,
  showStyles = false,
  hasBrief = false,
  lastGuestText = '',
  flags = [],
} = {}) {
  // continue_without_photo has its own control in optional-image.js; rendering it here too gave one click two listeners.
  const scoped = variant === 'whatsapp'
    ? filterWhatsappActions(allowedActions, { greetingTurn, showStyles, hasBrief, lastGuestText, flags })
    : filterAllowedActions(allowedActions).filter((a) => a.kind !== 'continue_without_photo');
  const invented = (allowedActions || []).filter((a) => a && !isAllowedActionKind(a.kind));
  const buttons = scoped.map((action) => {
    const enabled = !(disabled || reconnectInvalidates);
    const common = {
      class: action.kind === 'decline' || action.kind === 'continue_without_photo' ? 'wk-pill is-ghost' : 'wk-pill',
      'data-action-id': action.action_id,
      'data-action-kind': action.kind,
      'data-executable': enabled ? 'true' : 'false',
      'data-booking-confirmed': 'false',
      'aria-disabled': String(!enabled),
    };
    const label = escapeHtml(bookingLabel(action.kind, locale, action.label_ar, action.label_en));
    // The server's own URL (external handoff) is a real link so the click opens it directly; app.js still posts the action.
    if (enabled && typeof action.url === 'string' && /^https:\/\//.test(action.url)) {
      return el('a', { ...common, href: action.url, target: '_blank', rel: 'noopener noreferrer', role: 'button', 'data-opens-itself': 'true' }, label);
    }
    return el('button', { type: 'button', ...common, disabled: !enabled }, label);
  });

  const proposed = variant === 'whatsapp' ? [] : (Array.isArray(proposedActions) ? proposedActions : []);
  const proposedBlock = proposed.length
    ? el('aside', {
      class: 'wk-proposed',
      'data-proposed-actions': 'inert',
      'aria-disabled': 'true',
    }, [
      el('div', {}, t(locale, 'proposed_inert')),
      ...proposed.map((p) => el('div', {
        'data-proposed-kind': p.kind,
        'data-executable': 'false',
      }, escapeHtml(p.label_ar || p.label_en || ''))),
    ])
    : '';

  if (variant === 'whatsapp' && !buttons.length) {
    return {
      html: '',
      meta: {
        kinds: [],
        ids: [],
        inventedDropped: invented.map((a) => a.kind),
        proposedNotExecutable: [],
        bookingConfirmed: false,
      },
    };
  }

  const row = buttons.length
    ? el('div', {
      class: 'wk-action-row',
      role: 'group',
      'aria-label': t(locale, 'actions'),
      'data-action-count': String(buttons.length),
    }, buttons)
    : el('p', { class: 'wk-note', 'data-action-count': '0' }, t(locale, 'no_actions'));

  return {
    html: el('section', { 'data-component': 'action-row' }, [row, proposedBlock]),
    meta: {
      kinds: scoped.map((a) => a.kind),
      ids: scoped.map((a) => a.action_id),
      inventedDropped: invented.map((a) => a.kind),
      proposedNotExecutable: proposed.map((p) => p.kind),
      bookingConfirmed: false,
    },
  };
}
