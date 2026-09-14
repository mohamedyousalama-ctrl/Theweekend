import { el } from '../html.js';
import { capabilityLabel, t } from '../copy.js';

const HEALTH_KEYS = ['model', 'photo', 'booking_handoff', 'staff_inbox', 'preferences', 'store'];

export function renderHealthBanner({ health = null, locale = 'ar' } = {}) {
  if (!health || !health.checked_at) {
    return {
      html: el('div', {
        class: 'wk-banner',
        'data-health': 'checking',
        'aria-live': 'polite',
      }, t(locale, 'checking')),
      meta: { checking: true },
    };
  }
  const anyDown = HEALTH_KEYS.some((k) => health[k] === 'unavailable');
  const html = el('div', {
    class: 'wk-banner',
    'data-health': anyDown ? 'unavailable' : health.store,
    'data-checked-at': health.checked_at,
  }, HEALTH_KEYS.map((key) => el('div', {
    'data-cap': key,
    'data-value': health[key],
  }, capabilityLabel(key, health[key], locale))));
  return {
    html,
    meta: { checking: false, checkedAt: health.checked_at, unavailable: anyDown },
  };
}
