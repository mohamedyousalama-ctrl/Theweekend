import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';
import { actionPresentation } from '../policy.js';
import { renderApprovedBrief } from '../brief/approved-brief.js';
import { renderActionResult } from '../states/action-result.js';

export function renderBriefPanel({
  brief = null,
  receipt = null,
  locale = 'ar',
  actionResult = null,
  loading = false,
} = {}) {
  const briefView = renderApprovedBrief({ brief, allowedActions: [], locale, loading });
  const hasAck = Boolean(receipt?.acknowledged_at);
  const delivered = Boolean(receipt?.delivered_at);
  const presentation = actionPresentation(actionResult);
  const saved = hasAck && (presentation.showSuccess || Boolean(receipt?.acknowledged_at));
  const success = hasAck;
  const ackDisabled = !brief || loading || hasAck;

  const receiptBlock = receipt
    ? el('div', {
      class: 'wk-brief',
      'data-receipt': 'true',
      'data-acknowledged': String(hasAck),
      'data-booking': 'unconfirmed',
    }, [
      el('div', { class: 'wk-brief-label' }, 'DeliveryReceipt'),
      el('p', {}, `${t(locale, 'ack_not_booking')} ${escapeHtml(receipt.staff_view_id)}`),
      el('p', { class: 'wk-note' }, delivered ? escapeHtml(receipt.delivered_at) : t(locale, 'no_success_before_receipt')),
    ])
    : el('p', {
      class: 'wk-note',
      'data-receipt': 'false',
      'data-success': 'false',
    }, t(locale, 'no_success_before_receipt'));

  const ack = el('button', {
    type: 'button',
    class: 'wk-pill',
    'data-action': 'acknowledge',
    'data-booking': 'unconfirmed',
    disabled: ackDisabled,
  }, t(locale, 'ack'));

  const result = renderActionResult({ actionResult, locale });

  const html = el('section', {
    class: 'wk-panel',
    'data-surface': 'staff_brief_panel',
    'data-success': String(success),
    'data-ack-is-booking': 'false',
  }, [
    briefView.html,
    receiptBlock,
    ack,
    el('p', { class: 'wk-note' }, t(locale, 'ack_not_booking')),
    result.html,
  ]);

  return {
    html,
    meta: {
      hasReceipt: Boolean(receipt),
      acknowledged: hasAck,
      success,
      saved: success,
      booking: false,
      pending: delivered && !hasAck,
    },
  };
}
