import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';

const DATA_IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/i;
const THREAD_MAX = 40;

export function isSafeChatPhotoUrl(url) {
  return typeof url === 'string' && DATA_IMAGE.test(url.replace(/\s/g, ''));
}

function renderMessage(msg, locale) {
  const from = msg.from === 'guest' ? 'guest' : 'khalid';
  const rawUrl = typeof msg.imageUrl === 'string' ? msg.imageUrl.replace(/\s/g, '') : '';
  const photo = isSafeChatPhotoUrl(rawUrl)
    ? el('img', {
      class: 'wk-bubble-photo',
      src: rawUrl,
      alt: t(locale, 'attached_photo'),
      'data-chat-photo': 'true',
    })
    : '';
  const text = msg.text ? escapeHtml(msg.text) : '';
  return el('article', {
    class: 'wk-message',
    'data-from': from,
    lang: msg.lang || locale,
    'data-has-photo': photo ? 'true' : 'false',
  }, [text, photo].filter(Boolean).join(''));
}

export function renderTranscript({
  messages = [],
  locale = 'ar',
  loading = false,
  extras = '',
} = {}) {
  if (loading) {
    return {
      html: el('div', {
        class: 'wk-transcript',
        'data-surface': 'conversation',
        'aria-busy': 'true',
      }, el('div', { class: 'wk-skeleton', 'data-state': 'loading' }, t(locale, 'loading'))),
      meta: { count: 0, loading: true },
    };
  }
  const list = Array.isArray(messages) ? messages.slice(-THREAD_MAX) : [];
  const inner = list.length
    ? [...list.map((msg) => renderMessage(msg, locale)), extras]
    : [el('div', { class: 'wk-empty', 'data-state': 'empty' }, t(locale, 'empty_messages'))];

  return {
    html: el('div', {
      class: 'wk-transcript',
      'data-surface': 'conversation',
      'aria-live': 'polite',
    }, inner),
    meta: { count: list.length, loading: false, photoBubbles: list.filter((m) => isSafeChatPhotoUrl(m.imageUrl)).length },
  };
}
