import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';
import { filterAllowedActions, isAllowedActionKind } from '../policy.js';

function bookingLabel(kind, locale, labelAr, labelEn) {
  if (kind === 'open_official_booking' || kind === 'request_pending_booking') {
    return `${locale === 'en' ? labelEn : labelAr} — ${t(locale, 'booking_unconfirmed')}`;
  }
  return locale === 'en' ? labelEn : labelAr;
}

export function renderActionRow({
  allowedActions = [],
  proposedActions = [],
  locale = 'ar',
  disabled = false,
  reconnectInvalidates = false,
} = {}) {
  const allowed = filterAllowedActions(allowedActions);
  const invented = (allowedActions || []).filter((a) => a && !isAllowedActionKind(a.kind));
  const buttons = allowed.map((action) => {
    const isBooking = action.kind === 'open_official_booking' || action.kind === 'request_pending_booking';
    return el('button', {
      type: 'button',
      class: action.kind === 'decline' || action.kind === 'continue_without_photo' ? 'wk-pill is-ghost' : 'wk-pill',
      'data-action-id': action.action_id,
      'data-action-kind': action.kind,
      'data-executable': reconnectInvalidates ? 'false' : 'true',
      'data-booking-confirmed': 'false',
      disabled: disabled || reconnectInvalidates,
      'aria-disabled': String(disabled || reconnectInvalidates),
    }, escapeHtml(bookingLabel(action.kind, locale, action.label_ar, action.label_en)));
  });

  const proposed = Array.isArray(proposedActions) ? proposedActions : [];
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
      kinds: allowed.map((a) => a.kind),
      ids: allowed.map((a) => a.action_id),
      inventedDropped: invented.map((a) => a.kind),
      proposedNotExecutable: proposed.map((p) => p.kind),
      bookingConfirmed: false,
    },
  };
}
