import { el } from '../html.js';
import { receiptKindLabel, t } from '../copy.js';
import { isReceiptKind } from '../policy.js';

export function renderConsentStep({
  kind = null,
  locale = 'ar',
  receipts = [],
} = {}) {
  if (!isReceiptKind(kind)) {
    return { html: '', meta: { shown: false, kind: null, canRevoke: false } };
  }
  const existing = (receipts || []).find((receipt) => (
    receipt
    && receipt.kind === kind
    && receipt.revoked_at == null
    && typeof receipt.receipt_id === 'string'
  ));
  const html = el('section', {
    class: 'wk-consent',
    role: 'dialog',
    'aria-modal': 'false',
    'data-component': 'consent-step',
    'data-consent-kind': kind,
  }, [
    el('h2', { class: 'wk-consent-title' }, receiptKindLabel(kind, locale)),
    el('p', { class: 'wk-lead' }, t(locale, `notice_${kind}`)),
    el('div', { class: 'wk-action-row' }, [
      el('button', {
        type: 'button',
        class: 'wk-pill',
        'data-consent-grant': 'true',
        'data-consent-kind': kind,
      }, t(locale, 'consent_grant')),
      existing
        ? el('button', {
          type: 'button',
          class: 'wk-pill is-ghost',
          'data-consent-revoke': 'true',
          'data-receipt-id': existing.receipt_id,
        }, t(locale, 'consent_revoke'))
        : '',
      el('button', {
        type: 'button',
        class: 'wk-pill is-ghost',
        'data-consent-dismiss': 'true',
      }, t(locale, 'consent_later')),
    ]),
    kind === 'photo_analysis'
      ? el('p', { class: 'wk-note' }, t(locale, 'photo_optional'))
      : el('p', { class: 'wk-note' }, t(locale, 'consent_optional')),
  ]);
  return {
    html,
    meta: {
      shown: true,
      kind,
      canRevoke: Boolean(existing),
    },
  };
}
