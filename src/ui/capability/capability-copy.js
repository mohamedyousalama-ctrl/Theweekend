import { el } from '../html.js';
import { capabilityLabel, t } from '../copy.js';
import { renderHealthBanner } from './health-banner.js';
import { M2_SURFACES } from '../policy.js';

export function renderCapabilityCopy({
  context = null,
  health = null,
  locale = 'ar',
} = {}) {
  const caps = context?.capabilities || null;
  const banner = renderHealthBanner({ health, locale });
  const entries = caps
    ? [
      ['model', caps.model],
      ['photo', caps.photo],
      ['booking', caps.booking_handoff],
      ['staff_inbox', caps.staff_inbox],
      ['prefs_cap', caps.preferences],
    ]
    : [];

  const cards = entries.map(([name, value]) => {
    const off = value === 'unavailable' || value === 'disabled';
    return el('article', {
      class: off ? 'wk-cap-card is-off' : 'wk-cap-card',
      'data-capability': name,
      'data-value': value,
      'data-omitted-control': String(off),
    }, [
      el('h3', {}, capabilityLabel(name === 'prefs_cap' ? 'preferences' : name === 'booking' ? 'booking_handoff' : name, value, locale)),
      name === 'booking'
        ? el('p', { class: 'wk-note', 'data-booking': 'unconfirmed' }, t(locale, 'booking_unconfirmed'))
        : '',
      name === 'photo'
        ? el('p', { class: 'wk-note' }, t(locale, 'photo_optional'))
        : '',
    ]);
  });

  const m2 = el('aside', {
    class: 'wk-m2-note',
    'data-m2-mounted': 'false',
  }, [
    el('p', {}, t(locale, 'm2_unavailable')),
    el('ul', {}, M2_SURFACES.map((id) => el('li', { 'data-m2': id, 'data-available': 'false' }, id))),
  ]);

  const html = el('section', { 'data-surface': 'capability' }, [
    el('div', { class: 'wk-eyebrow' }, t(locale, 'landing_eyebrow')),
    el('h1', { class: 'wk-title' }, t(locale, 'landing_title')),
    el('p', { class: 'wk-lead' }, t(locale, 'intro')),
    el('p', { class: 'wk-lead' }, t(locale, 'landing_body')),
    banner.html,
    el('div', { class: 'wk-cap-grid' }, cards),
    m2,
  ]);

  return {
    html,
    meta: {
      checking: banner.meta.checking,
      bookingConfirmed: false,
      m2Mounted: false,
      photoOptional: true,
    },
  };
}
