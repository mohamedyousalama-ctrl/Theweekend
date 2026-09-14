import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';
import { preferenceVisibleInM1 } from '../policy.js';
import { renderEmpty } from '../states/empty.js';

export function renderPreferenceList({ preferences = [], locale = 'ar' } = {}) {
  const hiddenExecuted = (preferences || []).filter((p) => p && p.provenance === 'executed_result');
  const rows = (preferences || []).filter(preferenceVisibleInM1);
  if (!rows.length) {
    const empty = renderEmpty({ locale, kind: 'prefs' });
    const executedNote = hiddenExecuted.length
      ? el('p', {
        class: 'wk-note',
        'data-executed-result': 'hidden',
      }, t(locale, 'preference_executed_hidden'))
      : '';
    return {
      html: el('div', { class: 'wk-pref-list', 'data-surface': 'preferences' }, [empty.html, executedNote]),
      meta: { count: 0, executedHidden: hiddenExecuted.length, displayedExecuted: false },
    };
  }
  const html = el('div', { class: 'wk-pref-list', 'data-surface': 'preferences' }, [
    ...rows.map((pref) => el('article', {
      class: 'wk-pref-row',
      'data-preference-id': pref.preference_id,
      'data-provenance': pref.provenance,
      'data-version': String(pref.version),
    }, [
      el('div', { class: 'wk-pref-kind' }, escapeHtml(pref.kind)),
      el('div', {}, escapeHtml(pref.value_text)),
      el('div', { class: 'wk-chip' }, pref.provenance === 'proposal' ? t(locale, 'preference_proposal') : t(locale, 'preference_approved')),
      el('div', { class: 'wk-note' }, `${t(locale, 'version')} ${pref.version}`),
    ])),
    hiddenExecuted.length
      ? el('p', { class: 'wk-note', 'data-executed-result': 'hidden' }, t(locale, 'preference_executed_hidden'))
      : '',
  ]);
  return {
    html,
    meta: {
      count: rows.length,
      ids: rows.map((p) => p.preference_id),
      executedHidden: hiddenExecuted.length,
      displayedExecuted: false,
    },
  };
}
