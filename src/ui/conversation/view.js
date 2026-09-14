import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';
import { renderTranscript } from './transcript.js';
import { renderComposer } from './composer.js';
import { renderStyleOptionCards } from './style-option-card.js';
import { renderActionRow } from './action-row.js';
import { renderObservationLimits } from './observation-limits.js';
import { renderOptionalImage } from './optional-image.js';
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
} = {}) {
  const messages = output?.messages || [];
  const transcript = renderTranscript({ messages, locale, loading });
  const composerDisabled = loading || output?.state === 'unavailable';
  const composer = renderComposer({
    locale,
    disabled: composerDisabled,
    draft,
    sessionId: context?.session_id,
    imageRef,
    validationError: error?.code === 'VALIDATION_ERROR' ? error : (output?.error?.code === 'VALIDATION_ERROR' ? output.error : null),
  });
  const styles = renderStyleOptionCards({ styleOptions: output?.style_options, locale });
  const actions = renderActionRow({
    allowedActions,
    proposedActions: output?.proposed_actions,
    locale,
    disabled: loading || reconnectInvalidates,
    reconnectInvalidates,
  });
  const limits = renderObservationLimits({ observations: output?.observations, locale });
  const photo = renderOptionalImage({
    context,
    imageRef: imageRef || output?.observations?.image_ref || null,
    locale,
    allowedActions,
  });
  const err = error || (output && output.state !== 'ok' ? output.error : null);
  const errorBlock = err ? renderError({ error: err, locale, keepDraft: Boolean(draft) }) : { html: '', meta: {} };
  const result = renderActionResult({ actionResult, locale });
  const flags = Array.isArray(output?.flags) ? output.flags : [];

  const html = el('section', {
    class: 'wk-phone',
    'data-surface': 'conversation',
    'data-turn-state': output?.state || (loading ? 'loading' : 'idle'),
  }, [
    transcript.html,
    flags.length ? el('p', { class: 'wk-note', 'data-flags': flags.join(',') }, `${t(locale, 'flags')}: ${escapeHtml(flags.join(', '))}`) : '',
    styles.html,
    limits.html,
    photo.html,
    actions.html,
    result.html,
    errorBlock.html,
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
