import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';
import { styleOptionsLimited } from '../policy.js';

export function renderStyleOptionCards({ styleOptions = [], locale = 'ar', variant = 'weekend' } = {}) {
  const options = styleOptionsLimited(styleOptions);
  const whatsapp = variant === 'whatsapp';
  const cards = options.map((opt, index) => {
    const feasible = opt.feasible_in_person === true
      ? t(locale, 'feasible_true')
      : t(locale, 'feasible_unknown');
    const label = index === 0 ? t(locale, 'quick_first') : t(locale, 'quick_second');
    const body = whatsapp
      ? [
        el('p', {}, `${escapeHtml(label)}: ${escapeHtml(opt.why_ar || opt.name_ar)}`),
      ]
      : [
        el('div', { class: 'wk-chip' }, locale === 'en' ? escapeHtml(opt.name_en) : escapeHtml(opt.name_ar)),
        el('h3', {}, escapeHtml(opt.name_ar)),
        el('p', {}, escapeHtml(opt.why_ar)),
        el('p', { class: 'wk-note' }, escapeHtml(opt.upkeep_ar)),
        el('p', { class: 'wk-note', 'data-guarantee': 'false' }, feasible),
      ];
    return el('article', {
      class: 'wk-style-card',
      'data-option-id': opt.option_id,
      'data-feasible': String(opt.feasible_in_person),
    }, body);
  });
  return {
    html: options.length
      ? el('div', { class: 'wk-style-grid', 'data-count': String(options.length) }, cards)
      : '',
    meta: { count: options.length },
  };
}
