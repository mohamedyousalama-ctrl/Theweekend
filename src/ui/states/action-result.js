import { el, escapeHtml } from '../html.js';
import { messageFromKey, t } from '../copy.js';
import { actionPresentation } from '../policy.js';

export function renderActionResult({ actionResult = null, locale = 'ar' } = {}) {
  const presentation = actionPresentation(actionResult);
  if (presentation.kind === 'idle') {
    return {
      html: el('div', {
        class: 'wk-result',
        'data-kind': 'idle',
        'data-success': 'false',
        'data-booking': 'unconfirmed',
      }, ''),
      meta: presentation,
    };
  }
  let text = messageFromKey(actionResult.message_key, locale);
  if (presentation.handoff) text = t(locale, 'handoff');
  if (presentation.pending) text = t(locale, 'pending');
  if (presentation.failed) text = text || t(locale, 'failed_save');
  if (presentation.showSuccess) text = text || t(locale, 'saved');

  const html = el('div', {
    class: 'wk-result',
    role: 'status',
    'data-kind': presentation.kind,
    'data-success': String(presentation.showSuccess),
    'data-outcome': actionResult.outcome,
    'data-booking': 'unconfirmed',
    'data-action-id': actionResult.action_id,
  }, escapeHtml(text));

  return { html, meta: { ...presentation, outcome: actionResult.outcome } };
}
