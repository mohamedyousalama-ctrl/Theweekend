import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';

export function renderHandoffList({
  handoffs = [],
  locale = 'ar',
  selfSubjectId = '',
} = {}) {
  const rows = Array.isArray(handoffs) ? handoffs : [];
  const cards = rows.map((item) => {
    const status = item.status;
    const mine = Boolean(selfSubjectId && item.accepted_by === selfSubjectId);
    const canAccept = status === 'received';
    const canRelease = status === 'received' || status === 'accepted';
    const statusKey = status === 'accepted'
      ? (mine ? 'handoff_accepted' : 'handoff_accepted_by_other')
      : 'handoff_received';
    const actions = [];
    if (canAccept) {
      actions.push(el('button', {
        type: 'button',
        class: 'wk-pill',
        'data-handoff-id': item.handoff_id,
        'data-handoff-accept': 'true',
      }, t(locale, 'handoff_accept')));
    }
    if (canRelease) {
      actions.push(el('button', {
        type: 'button',
        class: 'wk-pill is-ghost',
        'data-handoff-id': item.handoff_id,
        'data-handoff-release': 'true',
      }, t(locale, 'handoff_release')));
    }
    return el('div', {
      class: 'wk-inbox-card',
      'data-handoff-id': item.handoff_id,
      'data-handoff-status': status,
      'data-accepted': String(status === 'accepted'),
    }, [
      el('div', { class: 'wk-brief-label' }, t(locale, statusKey)),
      el('div', { class: 'wk-note' }, escapeHtml(item.handoff_id)),
      status === 'received'
        ? el('p', { class: 'wk-note', 'data-handoff-warning': 'not_accepted_until_click' }, t(locale, 'handoff_not_accepted_until_click'))
        : '',
      ...actions,
    ]);
  });

  const html = el('section', {
    class: 'wk-device',
    'data-surface': 'staff_handoffs',
    'data-handoff-count': String(rows.length),
  }, [
    el('div', { class: 'wk-inbox-head' }, [
      el('h2', {}, t(locale, 'handoff_queue')),
    ]),
    rows.length
      ? el('div', { class: 'wk-inbox-list' }, cards)
      : el('p', { class: 'wk-note' }, t(locale, 'handoff_queue_empty')),
  ]);

  return {
    html,
    meta: {
      count: rows.length,
      claimedAcceptance: false,
    },
  };
}
