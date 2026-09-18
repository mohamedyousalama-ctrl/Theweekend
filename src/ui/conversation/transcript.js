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
  const text = msg.text && String(msg.text).trim() ? escapeHtml(msg.text) : '';
  if (!text && !photo) return '';
  return el('article', {
    class: 'wk-message',
    'data-from': from,
    lang: msg.lang || locale,
    'data-has-photo': photo ? 'true' : 'false',
  }, [text, photo].filter(Boolean).join(''));
}

function typingIndicator(locale) {
  return el('div', {
    class: 'wa-typing',
    'data-state': 'loading',
    'aria-label': t(locale, 'loading'),
  }, [
    el('span', {}, ''),
    el('span', {}, ''),
    el('span', {}, ''),
  ]);
}

export function renderTranscript({
  messages = [],
  locale = 'ar',
  loading = false,
  extras = '',
  keepOnLoad = false,
} = {}) {
  if (loading && !keepOnLoad) {
    return {
      html: el('div', {
        class: 'wk-transcript',
        'data-surface': 'conversation',
        'aria-busy': 'true',
      }, el('div', { class: 'wk-skeleton', 'data-state': 'loading' }, t(locale, 'loading'))),
      meta: { count: 0, loading: true, photoBubbles: 0 },
    };
  }
  const list = Array.isArray(messages) ? messages.slice(-THREAD_MAX) : [];
  const bubbles = list.map((msg) => renderMessage(msg, locale)).filter(Boolean);
  const inner = bubbles.length
    ? [...bubbles, extras, loading ? typingIndicator(locale) : '']
    : [el('div', { class: 'wk-empty', 'data-state': 'empty' }, t(locale, 'empty_messages'))];

  return {
    html: el('div', {
      class: 'wk-transcript',
      'data-surface': 'conversation',
      'aria-live': 'polite',
      'aria-busy': loading ? 'true' : 'false',
    }, inner),
    meta: {
      count: bubbles.length,
      loading: Boolean(loading),
      photoBubbles: list.filter((m) => isSafeChatPhotoUrl(m.imageUrl)).length,
    },
  };
}
