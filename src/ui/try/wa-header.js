import { el } from '../html.js';
import { t } from '../copy.js';

export function renderWaHeader({ locale = 'ar', health = null } = {}) {
  const status = health?.model === 'ok'
    ? el('em', { class: 'wa-status' }, t(locale, 'wa_replying'))
    : '';
  const html = el('header', { class: 'wa-header', 'data-component': 'wa-header' }, [
    el('a', { class: 'wa-back', href: '/', 'aria-label': t(locale, 'hub_home') }, '‹'),
    el('div', { class: 'wa-avatar', 'aria-hidden': 'true' }, 'و'),
    el('div', { class: 'wa-who' }, [
      el('strong', {}, t(locale, 'product')),
      el('span', {}, t(locale, 'wa_subtitle')),
      status,
    ]),
  ]);
  return { html };
}
