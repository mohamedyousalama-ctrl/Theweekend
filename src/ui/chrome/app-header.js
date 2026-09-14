import { el } from '../html.js';
import { t } from '../copy.js';
import { M2_SURFACES, navForContext } from '../policy.js';
import { renderWordmark } from './wordmark.js';

const LABELS = {
  capability: 'capability',
  conversation: 'conversation',
  approved_brief: 'brief',
  preferences: 'preferences',
  staff_inbox: 'inbox',
};

export function renderAppHeader({
  context = null,
  health = null,
  active = 'capability',
  locale = 'ar',
} = {}) {
  const items = navForContext(context, health);
  const m2 = M2_SURFACES;
  const nav = el('nav', {
    class: 'wk-nav',
    'aria-label': t(locale, 'product'),
    'data-m2-mounted': 'false',
  }, items.map((item) => el('button', {
    type: 'button',
    class: 'wk-pill',
    'data-surface': item.id,
    'data-m1': 'true',
    'aria-pressed': String(active === item.id),
  }, t(locale, LABELS[item.id] ?? item.id))));

  const html = el('header', { class: 'wk-header', 'data-m2-surfaces': m2.join(',') }, [
    renderWordmark(),
    el('div', { class: 'wk-header-rule', 'aria-hidden': 'true' }, ''),
    nav,
  ]);

  return {
    html,
    meta: {
      surfaces: items.map((i) => i.id),
      m2Mounted: false,
      m2ListedUnavailable: m2.slice(),
    },
  };
}
