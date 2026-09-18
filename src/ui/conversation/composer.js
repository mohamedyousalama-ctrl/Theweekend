import { el, escapeHtml, newTurnId } from '../html.js';
import { messageFromKey, t } from '../copy.js';
import { buildChatTurnInput } from '../policy.js';

export function renderComposer({
  locale = 'ar',
  disabled = false,
  draft = '',
  sessionId = '',
  imageRef = null,
  validationError = null,
} = {}) {
  const empty = !String(draft || '').trim();
  const fieldCopy = validationError?.message_key
    ? (messageFromKey(validationError.message_key, locale) || t(locale, 'validation'))
    : t(locale, 'validation');
  const fieldError = validationError?.details?.field === 'text'
    ? el('p', { class: 'wk-error', id: 'composer-error', 'data-code': validationError.code }, fieldCopy)
    : '';
  const html = el('form', {
    class: 'wk-composer',
    'data-component': 'composer',
    'aria-disabled': String(disabled),
  }, [
    el('label', { for: 'wk-composer-text' }, t(locale, 'composer_label')),
    el('textarea', {
      id: 'wk-composer-text',
      name: 'text',
      maxlength: '2000',
      placeholder: t(locale, 'composer_placeholder'),
      disabled,
      'aria-invalid': validationError ? 'true' : 'false',
      'aria-describedby': validationError ? 'composer-error' : false,
    }, escapeHtml(draft)),
    fieldError,
    el('button', {
      type: 'submit',
      class: 'wk-pill',
      disabled: disabled || empty,
      'data-send': 'true',
    }, t(locale, 'send')),
  ]);
  return {
    html,
    meta: {
      disabled,
      keepsDraft: Boolean(draft),
      sessionId,
      imageRef,
    },
  };
}

export function composeTurn({
  sessionId,
  text,
  imageRef = null,
  clientActionId = null,
  localeHint = 'ar',
  turnId,
} = {}) {
  return buildChatTurnInput({
    sessionId,
    turnId: turnId || newTurnId(),
    text,
    imageRef,
    clientActionId,
    localeHint,
  });
}

export { newTurnId };
