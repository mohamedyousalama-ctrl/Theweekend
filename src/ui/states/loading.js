import { el } from '../html.js';
import { t } from '../copy.js';

export function renderLoading({ locale = 'ar', label } = {}) {
  const html = el('div', {
    class: 'wk-skeleton',
    'data-state': 'loading',
    'aria-busy': 'true',
  }, t(locale, label || 'loading'));
  return { html, meta: { loading: true, success: false } };
}
