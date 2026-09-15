import { el, escapeHtml } from '../html.js';
import { preferenceKindLabel, t } from '../copy.js';
import { filterAllowedActions } from '../policy.js';
import { renderError } from '../states/error.js';
import { renderActionResult } from '../states/action-result.js';

const KINDS = ['style', 'barber', 'branch', 'do_not', 'note'];

export function renderPreferenceEditor({
  locale = 'ar',
  allowedActions = [],
  selected = null,
  error = null,
  actionResult = null,
  capabilitiesEnabled = true,
} = {}) {
  const actions = filterAllowedActions(allowedActions, { max: 9 });
  const save = actions.find((a) => a.kind === 'save_preference');
  const del = actions.find((a) => a.kind === 'delete_preference');
  const unavailable = !capabilitiesEnabled;

  const conflict = error?.code === 'CONFLICT'
    ? renderError({ error, locale }).html
    : '';
  const result = renderActionResult({ actionResult, locale });

  const html = el('form', {
    class: 'wk-editor',
    'data-component': 'preference-editor',
    'data-unavailable': String(unavailable),
  }, [
    el('label', { for: 'pref-kind' }, t(locale, 'preferences')),
    el('select', { id: 'pref-kind', name: 'kind', disabled: unavailable },
      KINDS.map((k) => el('option', {
        value: k,
        selected: selected?.kind === k,
      }, preferenceKindLabel(k, locale)))),
    el('label', { for: 'pref-text' }, t(locale, 'value_text')),
    el('textarea', {
      id: 'pref-text',
      name: 'value_text',
      maxlength: '300',
      disabled: unavailable,
    }, escapeHtml(selected?.value_text || '')),
    selected ? el('input', { type: 'hidden', name: 'version', value: String(selected.version) }, '') : '',
    conflict,
    !unavailable
      ? el('button', {
        type: 'submit',
        class: 'wk-pill',
        'data-action-kind': 'save_preference',
        ...(save ? { 'data-action-id': save.action_id } : { 'data-direct-save': 'true' }),
      }, t(locale, 'save_pref'))
      : '',
    del && !unavailable
      ? el('button', {
        type: 'button',
        class: 'wk-pill is-ghost',
        'data-action-kind': 'delete_preference',
        'data-action-id': del.action_id,
        'data-executable': 'true',
      }, t(locale, 'delete_pref'))
      : '',
    unavailable ? el('p', { class: 'wk-note' }, t(locale, 'unavailable')) : '',
    result.html,
  ]);

  return {
    html,
    meta: {
      canSave: !unavailable,
      canDelete: Boolean(del) && !unavailable,
      success: result.meta.showSuccess === true,
      conflict: error?.code === 'CONFLICT',
      executedWritten: false,
    },
  };
}
