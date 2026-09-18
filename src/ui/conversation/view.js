import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';
import { renderTranscript } from './transcript.js';
import { renderComposer } from './composer.js';
import { renderStyleOptionCards } from './style-option-card.js';
import { renderActionRow } from './action-row.js';
import { renderObservationLimits } from './observation-limits.js';
import { renderOptionalImage } from './optional-image.js';
import { renderBriefDraft } from '../brief/brief-draft.js';
import { renderError } from '../states/error.js';
import { renderActionResult } from '../states/action-result.js';

export function renderConversation({
  context = null,
  output = null,
  allowedActions = [],
  locale = 'ar',
  loading = false,
  draft = '',
  imageRef = null,
  actionResult = null,
  error = null,
  reconnectInvalidates = false,
  briefApproving = false,
  variant = 'weekend',
  thread = null,
  quickReplies = false,
} = {}) {
  const outputMessages = output?.messages || [];
  const messages = Array.isArray(thread) && thread.length
    ? thread
    : outputMessages.map((msg) => ({ ...msg, from: 'khalid' }));
  const transcript = renderTranscript({ messages, locale, loading });
  const composerDisabled = loading || output?.state === 'unavailable';
  const composer = renderComposer({
    locale,
    disabled: composerDisabled,
    draft,
    sessionId: context?.session_id,
    imageRef,
    variant,
    photoEnabled: context?.capabilities?.photo === 'enabled',
    validationError: error?.code === 'VALIDATION_ERROR' ? error : (output?.error?.code === 'VALIDATION_ERROR' ? output.error : null),
  });
  const styles = renderStyleOptionCards({ styleOptions: output?.style_options, locale, variant });
  const actions = renderActionRow({
    allowedActions,
    proposedActions: output?.proposed_actions,
    locale,
    disabled: loading || reconnectInvalidates,
    reconnectInvalidates,
    variant,
  });
  const limits = renderObservationLimits({ observations: output?.observations, locale });
  const photo = renderOptionalImage({
    context,
    imageRef: imageRef || output?.observations?.image_ref || null,
    locale,
    allowedActions,
    variant,
  });
  const briefDraft = renderBriefDraft({
    draft: output?.brief_draft,
    locale,
    approving: briefApproving,
  });
  const err = error || (output && output.state !== 'ok' ? output.error : null);
  const errorBlock = err ? renderError({ error: err, locale, keepDraft: Boolean(draft) }) : { html: '', meta: {} };
  const result = renderActionResult({ actionResult, locale });
  const flags = Array.isArray(output?.flags) ? output.flags : [];

  const whatsapp = variant === 'whatsapp';
  const styleCount = styles.meta.count;
  const hasBrief = output?.brief_draft?.status === 'draft' && Boolean(output?.brief_draft?.requested_look?.text_ar);
  const welcomeQuick = whatsapp && quickReplies
    ? el('div', { class: 'wa-quick', 'data-quick-replies': 'true' }, [
      el('button', { type: 'button', 'data-quick-text': t(locale, 'quick_fade') }, t(locale, 'quick_fade')),
      el('button', { type: 'button', 'data-quick-text': t(locale, 'quick_combo') }, t(locale, 'quick_combo')),
      el('button', { type: 'button', 'data-quick-book': 'true' }, t(locale, 'quick_book')),
    ])
    : '';
  const styleQuick = whatsapp && styleCount > 0 && !quickReplies
    ? el('div', { class: 'wa-quick', 'data-style-replies': 'true' }, [
      styleCount >= 1 ? el('button', { type: 'button', 'data-quick-text': t(locale, 'quick_first') }, t(locale, 'quick_first')) : '',
      styleCount >= 2 ? el('button', { type: 'button', 'data-quick-text': t(locale, 'quick_second') }, t(locale, 'quick_second')) : '',
      el('button', { type: 'button', 'data-quick-text': t(locale, 'quick_skip_styles') }, t(locale, 'quick_skip_styles')),
    ])
    : '';
  const briefQuick = whatsapp && hasBrief && !quickReplies
    ? el('div', { class: 'wa-quick', 'data-brief-replies': 'true' }, [
      el('button', { type: 'button', 'data-action': 'approve-brief' }, t(locale, 'quick_ok')),
      el('button', { type: 'button', 'data-quick-text': t(locale, 'quick_edit') }, t(locale, 'quick_edit')),
      el('button', { type: 'button', 'data-quick-book': 'true' }, t(locale, 'quick_book_no_brief')),
    ])
    : '';
  const quick = [welcomeQuick, styleQuick, briefQuick].filter(Boolean).join('');
  const html = el('section', {
    class: 'wk-phone',
    'data-surface': 'conversation',
    'data-variant': variant,
    'data-turn-state': output?.state || (loading ? 'loading' : 'idle'),
  }, [
    transcript.html,
    whatsapp ? '' : (flags.length ? el('p', { class: 'wk-note', 'data-flags': flags.join(',') }, `${t(locale, 'flags')}: ${escapeHtml(flags.join(', '))}`) : ''),
    styles.html,
    whatsapp ? '' : limits.html,
    photo.html,
    briefDraft.html,
    actions.html,
    result.html,
    errorBlock.html,
    quick,
    composer.html,
  ]);

  return {
    html,
    meta: {
      ...transcript.meta,
      styleCount: styles.meta.count,
      actionKinds: actions.meta.kinds,
      proposedNotExecutable: actions.meta.proposedNotExecutable,
      photoPreviewShown: photo.meta.previewShown,
      photoOptional: true,
      continueOffered: photo.meta.continueOffered,
      success: result.meta.showSuccess,
      bookingConfirmed: false,
      composerDisabled,
    },
  };
}
