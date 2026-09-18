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
  variant = 'weekend',
  photoEnabled = false,
} = {}) {
  const whatsapp = variant === 'whatsapp';
  const fieldCopy = validationError?.message_key
    ? (messageFromKey(validationError.message_key, locale) || t(locale, 'validation'))
    : t(locale, 'validation');
  const fieldError = validationError?.details?.field === 'text'
    ? el('p', { class: 'wk-error', id: 'composer-error', 'data-code': validationError.code }, escapeHtml(fieldCopy))
    : '';
  const attach = whatsapp && photoEnabled
    ? el('div', { class: 'wk-photo-upload', 'data-photo-upload': 'enabled' }, [
      el('label', {
        for: 'wk-photo-upload',
        class: 'wa-attach',
        title: t(locale, 'photo_upload'),
      }, t(locale, 'photo_upload')),
      el('input', {
        id: 'wk-photo-upload',
        name: 'photo',
        type: 'file',
        accept: 'image/jpeg,image/png,image/webp',
        disabled,
        'data-photo-input': 'true',
        'aria-label': t(locale, 'photo_upload'),
      }, ''),
    ])
    : '';
  const textarea = el('textarea', {
    id: 'wk-composer-text',
    name: 'text',
    maxlength: '2000',
    rows: whatsapp ? '1' : '3',
    placeholder: t(locale, whatsapp ? 'wa_composer_placeholder' : 'composer_placeholder'),
    disabled,
    'aria-invalid': validationError ? 'true' : 'false',
    'aria-describedby': validationError ? 'composer-error' : false,
  }, escapeHtml(draft));
  const send = el('button', {
    type: 'submit',
    class: 'wk-pill',
    disabled,
    'data-send': 'true',
  }, whatsapp ? '➤' : t(locale, 'send'));
  const html = el('form', {
    class: 'wk-composer',
    'data-component': 'composer',
    'aria-disabled': String(disabled),
  }, whatsapp
    ? [
      el('label', { for: 'wk-composer-text' }, t(locale, 'composer_label')),
      attach,
      textarea,
      fieldError,
      send,
    ]
    : [
      el('label', { for: 'wk-composer-text' }, t(locale, 'composer_label')),
      textarea,
      fieldError,
      send,
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
