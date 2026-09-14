import { el } from '../html.js';

export function renderWordmark() {
  return el('div', {
    class: 'wk-wordmark',
    dir: 'ltr',
    'aria-label': 'THE WEEKEND',
  }, [
    el('span', { class: 'wk-wordmark-week' }, 'THE WEEK'),
    el('span', { class: 'wk-wordmark-end' }, 'END'),
  ]);
}
