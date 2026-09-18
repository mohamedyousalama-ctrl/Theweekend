import { el, escapeHtml } from '../html.js';
import { notInferredLabel, observationValueLabel, t } from '../copy.js';
import { NOT_INFERRED } from '../policy.js';

export function renderObservationLimits({ observations = null, locale = 'ar' } = {}) {
  if (!observations) {
    return { html: '', meta: { shown: false, notInferred: [] } };
  }
  const listed = Array.isArray(observations.not_inferred) && observations.not_inferred.length
    ? observations.not_inferred
    : NOT_INFERRED.slice();
  const limits = Array.isArray(observations.limitations) ? observations.limitations : [];
  const html = el('section', {
    class: 'wk-limits',
    'data-component': 'observation-limits',
    'data-retention': observations.retention || '',
  }, [
    el('div', { class: 'wk-brief-label' }, t(locale, 'not_inferred')),
    el('ul', {}, listed.map((token) => el('li', { 'data-not-inferred': token }, escapeHtml(notInferredLabel(token, locale))))),
    limits.length
      ? el('div', {}, [
        el('div', { class: 'wk-brief-label' }, t(locale, 'limitations')),
        el('p', {}, escapeHtml(limits.map((token) => observationValueLabel(token, locale)).join(' · '))),
      ])
      : '',
  ]);
  return {
    html,
    meta: {
      shown: true,
      notInferred: listed,
      identityInferred: false,
    },
  };
}
