import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';

export function renderShareControls({
  allowedActions = [],
  locale = 'ar',
  disabled = false,
} = {}) {
  const text = (allowedActions || []).find((a) => a && a.kind === 'share_brief_text' && a.action_id);
  const photo = (allowedActions || []).find((a) => a && a.kind === 'share_photo_ref' && a.action_id);
  const parts = [];
  if (text) {
    parts.push(el('button', {
      type: 'button',
      class: 'wk-pill',
      'data-action-kind': 'share_brief_text',
      'data-action-id': text.action_id,
      disabled,
    }, escapeHtml(text.label_ar || t(locale, 'share_text'))));
  }
  if (photo) {
    parts.push(el('button', {
      type: 'button',
      class: 'wk-pill is-ghost',
      'data-action-kind': 'share_photo_ref',
      'data-action-id': photo.action_id,
      disabled,
    }, escapeHtml(photo.label_ar || t(locale, 'share_photo'))));
  }
  const html = el('div', {
    class: 'wk-share',
    'data-component': 'share-controls',
    'data-share-bundled': 'false',
  }, [
    ...parts,
    el('p', { class: 'wk-note' }, t(locale, 'share_separate')),
  ]);
  return {
    html,
    meta: {
      hasText: Boolean(text),
      hasPhoto: Boolean(photo),
      bundled: false,
      sameControl: false,
    },
  };
}
