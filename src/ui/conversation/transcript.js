import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';
import { messagesLimited } from '../policy.js';

export function renderTranscript({ messages = [], locale = 'ar', loading = false } = {}) {
  if (loading) {
    return {
      html: el('div', {
        class: 'wk-transcript',
        'data-surface': 'conversation',
        'aria-busy': 'true',
      }, el('div', { class: 'wk-skeleton', 'data-state': 'loading' }, t(locale, 'loading'))),
      meta: { count: 0, loading: true },
    };
  }
  const list = messagesLimited(messages);
  const inner = list.length
    ? list.map((msg, i) => el('article', {
      class: 'wk-message',
      'data-from': 'rakan',
      lang: msg.lang || locale,
    }, escapeHtml(msg.text)))
    : [el('div', { class: 'wk-empty', 'data-state': 'empty' }, t(locale, 'empty_messages'))];

  return {
    html: el('div', {
      class: 'wk-transcript',
      'data-surface': 'conversation',
      'aria-live': 'polite',
    }, inner),
    meta: { count: list.length, loading: false },
  };
}
