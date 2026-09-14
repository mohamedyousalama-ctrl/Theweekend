import { el, escapeHtml } from '../html.js';
import { messageFromKey, t } from '../copy.js';
import { isErrorShape } from '../policy.js';

export function renderError({ error = null, locale = 'ar', keepDraft = false } = {}) {
  if (!isErrorShape(error)) {
    return { html: '', meta: { shown: false, retryable: false } };
  }
  const retry = error.retryable
    ? el('button', {
      type: 'button',
      class: 'wk-pill is-ghost',
      'data-retry': 'true',
    }, t(locale, 'retry'))
    : '';
  const timeoutNote = error.code === 'TIMEOUT' && keepDraft
    ? el('p', { 'data-draft-kept': 'true' }, t(locale, 'timeout_keep'))
    : '';
  const html = el('div', {
    class: 'wk-error',
    role: 'alert',
    'data-error-code': error.code,
    'data-retryable': String(error.retryable),
  }, [
    el('p', {}, escapeHtml(messageFromKey(error.message_key, locale) || error.message_key)),
    timeoutNote,
    retry,
  ]);
  return {
    html,
    meta: {
      shown: true,
      code: error.code,
      retryable: error.retryable,
      keepDraft: error.code === 'TIMEOUT' && keepDraft,
    },
  };
}
