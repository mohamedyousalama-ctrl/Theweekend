import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';
import { inboxStatusFrom, staffInboxVisible } from '../policy.js';
import { renderEmpty } from '../states/empty.js';
import { renderLoading } from '../states/loading.js';
import { renderError } from '../states/error.js';

export function renderInboxList({
  context = null,
  health = null,
  briefs = [],
  receipts = [],
  locale = 'ar',
  loading = false,
  error = null,
  actionResult = null,
} = {}) {
  if (!staffInboxVisible(context, health) && !loading) {
    return {
      html: el('section', {
        'data-surface': 'staff_inbox',
        'data-inbox': 'omitted',
      }, el('p', { class: 'wk-note' }, t(locale, 'unavailable'))),
      meta: { omitted: true, status: 'unavailable' },
    };
  }

  const status = inboxStatusFrom({ briefs, receipts, error, loading, actionResult });
  if (loading) {
    const load = renderLoading({ locale });
    return {
      html: el('section', { class: 'wk-device', 'data-surface': 'staff_inbox', 'data-inbox-status': 'loading' }, load.html),
      meta: { status: 'loading', success: false },
    };
  }
  if (error) {
    const err = renderError({ error, locale });
    return {
      html: el('section', { class: 'wk-device', 'data-surface': 'staff_inbox', 'data-inbox-status': 'error' }, err.html),
      meta: { status: 'error', success: false },
    };
  }
  if (!briefs.length) {
    const empty = renderEmpty({ locale, kind: 'inbox' });
    return {
      html: el('section', { class: 'wk-device', 'data-surface': 'staff_inbox', 'data-inbox-status': 'empty' }, [
        el('div', { class: 'wk-inbox-head' }, [
          el('div', { class: 'wk-note' }, context?.branch_id || ''),
          el('h2', {}, t(locale, 'inbox')),
        ]),
        empty.html,
      ]),
      meta: { status: 'empty', success: false },
    };
  }

  const cards = briefs.map((brief) => el('button', {
    type: 'button',
    class: 'wk-inbox-card',
    'data-brief-id': brief.brief_id,
    'data-brief-status': brief.status,
  }, [
    el('span', { class: 'wk-status-dot', 'aria-hidden': 'true' }, ''),
    el('div', {}, escapeHtml(brief.requested_look?.text_ar || brief.brief_id)),
    el('div', { class: 'wk-note' }, escapeHtml(brief.status)),
  ]));

  const html = el('section', {
    class: 'wk-device',
    'data-surface': 'staff_inbox',
    'data-inbox-status': status,
    'data-booking': 'unconfirmed',
  }, [
    el('div', { class: 'wk-inbox-head' }, [
      el('div', { class: 'wk-note' }, escapeHtml(context?.branch_id || '')),
      el('h2', {}, t(locale, 'inbox')),
    ]),
    el('div', { class: 'wk-inbox-list' }, cards),
  ]);

  return {
    html,
    meta: {
      status,
      count: briefs.length,
      success: status === 'saved',
      allBranch: false,
    },
  };
}
