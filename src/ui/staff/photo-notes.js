import { el, escapeHtml } from '../html.js';
import { observationValueLabel, t } from '../copy.js';
import { renderObservationLimits } from '../conversation/observation-limits.js';

const OBSERVED_KEYS = ['hair_length', 'hair_texture', 'beard', 'top_density_visible', 'face_visible'];

export function renderPhotoNotes({ observations = null, locale = 'ar' } = {}) {
  if (!observations || typeof observations !== 'object') {
    return { html: '', meta: { shown: false, hasImage: false } };
  }
  const observed = observations.observed && typeof observations.observed === 'object'
    ? observations.observed
    : null;
  const rows = OBSERVED_KEYS
    .map((key) => [key, observed?.[key]])
    .filter(([, value]) => typeof value === 'string' && value);
  const limits = renderObservationLimits({ observations, locale });
  const html = el('div', {
    class: 'wk-brief',
    'data-photo-notes': 'true',
    'data-photo-bytes': 'false',
  }, [
    el('div', { class: 'wk-brief-label' }, t(locale, 'photo_notes')),
    el('p', { class: 'wk-note' }, t(locale, 'photo_notes_not_image')),
    ...rows.map(([key, value]) => el('div', { class: 'wk-brief-row', 'data-observed': key }, [
      el('div', { class: 'wk-brief-label' }, t(locale, `obs_${key}`)),
      el('div', { class: 'wk-brief-value' }, escapeHtml(observationValueLabel(value, locale))),
    ])),
    observations.confidence
      ? el('p', { class: 'wk-note' }, `${t(locale, 'obs_confidence')}: ${escapeHtml(observationValueLabel(observations.confidence, locale))}`)
      : '',
    limits.html,
  ]);
  return {
    html,
    meta: {
      shown: true,
      hasImage: false,
      identityInferred: false,
    },
  };
}
