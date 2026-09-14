import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';
import { renderShareControls } from './share-controls.js';
import { renderEmpty } from '../states/empty.js';
import { renderLoading } from '../states/loading.js';
import { renderActionResult } from '../states/action-result.js';

export function renderApprovedBrief({
  brief = null,
  allowedActions = [],
  locale = 'ar',
  loading = false,
  actionResult = null,
} = {}) {
  if (loading) return { ...renderLoading({ locale }), html: el('section', { 'data-surface': 'approved_brief' }, renderLoading({ locale }).html) };
  if (!brief) {
    const empty = renderEmpty({ locale, kind: 'brief' });
    return { html: el('section', { 'data-surface': 'approved_brief' }, empty.html), meta: { ...empty.meta } };
  }

  const share = renderShareControls({ allowedActions, locale });
  const result = renderActionResult({ actionResult, locale });
  const photoRef = brief.reference?.kind === 'photo_ref';
  const rows = [
    ['requested_look', brief.requested_look?.text_ar],
    ['do_not', Array.isArray(brief.do_not) ? brief.do_not.join(' · ') : ''],
    ['barber_pref', brief.barber_preference || t(locale, 'barber_pref')],
    ['branch_pref', brief.branch_id],
    ['provenance', `${t(locale, 'version')} ${brief.provenance?.version ?? ''}`],
    ['approved_at', brief.provenance?.approved_by_subject_at || t(locale, 'draft_brief')],
    [photoRef ? 'reference_photo' : 'reference_none', photoRef ? brief.reference.image_ref : ''],
  ];

  const html = el('section', {
    class: 'wk-brief',
    'data-surface': 'approved_brief',
    'data-brief-id': brief.brief_id,
    'data-brief-status': brief.status,
    'data-allocation': 'preference',
  }, [
    ...rows.map(([key, value]) => el('div', { class: 'wk-brief-row' }, [
      el('div', { class: 'wk-brief-label' }, t(locale, key)),
      el('div', { class: 'wk-brief-value' }, escapeHtml(value || '')),
    ])),
    el('p', { class: 'wk-note', 'data-barber-allocation': 'false' }, t(locale, 'barber_pref')),
    share.html,
    result.html,
  ]);

  return {
    html,
    meta: {
      briefId: brief.brief_id,
      status: brief.status,
      shareText: share.meta.hasText,
      sharePhoto: share.meta.hasPhoto,
      bundledShare: false,
      barberIsPreference: true,
      success: result.meta.showSuccess === true,
    },
  };
}
