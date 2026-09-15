import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';

export function renderBriefDraft({
  draft = null,
  locale = 'ar',
  approving = false,
} = {}) {
  if (!draft || draft.status !== 'draft' || !draft.requested_look?.text_ar) {
    return { html: '', meta: { shown: false } };
  }
  const html = el('section', {
    class: 'wk-brief',
    'data-component': 'brief-draft',
    'data-brief-status': 'draft',
  }, [
    el('p', { class: 'wk-eyebrow' }, t(locale, 'draft_brief')),
    el('div', { class: 'wk-brief-row' }, [
      el('div', { class: 'wk-brief-label' }, t(locale, 'requested_look')),
      el('div', { class: 'wk-brief-value' }, escapeHtml(draft.requested_look.text_ar)),
    ]),
    Array.isArray(draft.do_not) && draft.do_not.length
      ? el('div', { class: 'wk-brief-row' }, [
        el('div', { class: 'wk-brief-label' }, t(locale, 'do_not')),
        el('div', { class: 'wk-brief-value' }, escapeHtml(draft.do_not.join(' · '))),
      ])
      : '',
    draft.barber_preference
      ? el('div', { class: 'wk-brief-row' }, [
        el('div', { class: 'wk-brief-label' }, t(locale, 'barber_pref')),
        el('div', { class: 'wk-brief-value' }, escapeHtml(draft.barber_preference)),
      ])
      : '',
    el('button', {
      type: 'button',
      class: 'wk-pill',
      'data-action': 'approve-brief',
      disabled: approving,
    }, t(locale, 'approve_brief')),
  ]);
  return {
    html,
    meta: {
      shown: true,
      status: 'draft',
    },
  };
}
