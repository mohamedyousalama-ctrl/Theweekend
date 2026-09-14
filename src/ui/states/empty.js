import { el } from '../html.js';
import { t } from '../copy.js';

export function renderEmpty({ locale = 'ar', kind = 'messages' } = {}) {
  const key = kind === 'inbox' ? 'empty_inbox'
    : kind === 'prefs' ? 'empty_prefs'
      : kind === 'brief' ? 'empty_brief'
        : 'empty_messages';
  const html = el('div', {
    class: 'wk-empty',
    'data-state': 'empty',
    'data-empty-kind': kind,
  }, t(locale, key));
  return { html, meta: { empty: true, kind } };
}
