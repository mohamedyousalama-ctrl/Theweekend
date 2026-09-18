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
import { isDirectServiceAsk, isGreetingOnly } from '../policy.js';

function lastGuestText(messages) {
  const lastGuest = [...messages].reverse().find((msg) => msg.from === 'guest');
  return lastGuest || null;
}

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
  const lastGuest = lastGuestText(messages);
  const lastFromGuest = messages.length ? messages[messages.length - 1].from === 'guest' : false;
  const guestSaid = String(lastGuest?.text || '').trim();
  const guestSentPhoto = Boolean(lastGuest?.imageUrl);
  const greetingTurn = !guestSaid && !guestSentPhoto
    ? true
    : (!guestSentPhoto && isGreetingOnly(guestSaid));
  const directService = !guestSentPhoto && isDirectServiceAsk(guestSaid, output?.flags);
  const pickedStyle = Boolean(guestSaid && /^(الأول|الثاني|بدون هالخيارات|The first|The second|Skip these options)$/u.test(guestSaid));
  const hasAttachedPhoto = messages.some((msg) => Boolean(msg.imageUrl));
  const khalidLines = messages.filter((msg) => msg.from !== 'guest' && String(msg.text || '').trim());
  const lastKhalid = khalidLines.at(-1);
  const welcomeText = t(locale, 'wa_welcome');
  const lastIsWelcome = Boolean(lastKhalid && lastKhalid.text === welcomeText);
  const photoOffered = Boolean(
    lastKhalid
    && !lastIsWelcome
    && /أرفق|ارفق|تبي ترسل|بدون صورة|attach a photo|without a photo/i.test(lastKhalid.text || ''),
  );

  const styles = renderStyleOptionCards({ styleOptions: output?.style_options, locale, variant });
  const styleCount = styles.meta.count;
  const hasBrief = output?.brief_draft?.status === 'draft' && Boolean(output?.brief_draft?.requested_look?.text_ar);
  const whatsapp = variant === 'whatsapp';
  const showStyles = whatsapp
    ? styleCount > 0 && !greetingTurn && !directService && !lastFromGuest && !loading && !hasBrief && !pickedStyle
    : styleCount > 0;
  const showBrief = whatsapp
    ? hasBrief && !showStyles && !greetingTurn && !directService && !lastFromGuest && !loading
    : true;
  const whatsappContinue = whatsapp
    && !quickReplies
    && !greetingTurn
    && !directService
    && !hasAttachedPhoto
    && !showStyles
    && photoOffered;

  const transcript = renderTranscript({
    messages,
    locale,
    loading,
    extras: whatsapp && showStyles ? styles.html : '',
    keepOnLoad: whatsapp,
  });
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
  const actions = renderActionRow({
    allowedActions,
    proposedActions: output?.proposed_actions,
    locale,
    disabled: loading || reconnectInvalidates,
    reconnectInvalidates,
    variant,
    greetingTurn: whatsapp ? greetingTurn || loading : false,
    showStyles: whatsapp ? showStyles : false,
    directService: whatsapp ? directService : false,
    hasBrief: whatsapp ? showBrief : hasBrief,
    lastGuestText: guestSaid,
    flags: output?.flags,
  });
  const limits = renderObservationLimits({ observations: output?.observations, locale });
  const photo = renderOptionalImage({
    context,
    imageRef: imageRef || output?.observations?.image_ref || null,
    locale,
    allowedActions,
    variant,
    offerContinueOverride: whatsapp ? whatsappContinue : null,
  });
  const briefDraft = showBrief
    ? renderBriefDraft({
      draft: output?.brief_draft,
      locale,
      approving: briefApproving,
      variant,
    })
    : { html: '', meta: { shown: false } };
  const err = error || (output && output.state !== 'ok' ? output.error : null);
  const errorBlock = err ? renderError({ error: err, locale, keepDraft: Boolean(draft) }) : { html: '', meta: {} };
  const result = renderActionResult({ actionResult, locale });
  const flags = Array.isArray(output?.flags) ? output.flags : [];

  const welcomeQuick = whatsapp && quickReplies && !loading
    ? el('div', { class: 'wa-quick', 'data-quick-replies': 'true' }, [
      el('button', { type: 'button', 'data-quick-text': t(locale, 'quick_fade') }, t(locale, 'quick_fade')),
      el('button', { type: 'button', 'data-quick-text': t(locale, 'quick_combo') }, t(locale, 'quick_combo')),
      el('button', { type: 'button', 'data-quick-book': 'true' }, t(locale, 'quick_book')),
    ])
    : '';
  const styleQuick = whatsapp && showStyles
    ? el('div', { class: 'wa-quick', 'data-style-replies': 'true' }, [
      styleCount >= 1 ? el('button', { type: 'button', 'data-quick-text': t(locale, 'quick_first') }, t(locale, 'quick_first')) : '',
      styleCount >= 2 ? el('button', { type: 'button', 'data-quick-text': t(locale, 'quick_second') }, t(locale, 'quick_second')) : '',
      el('button', { type: 'button', 'data-quick-text': t(locale, 'quick_skip_styles') }, t(locale, 'quick_skip_styles')),
    ])
    : '';
  const briefQuick = whatsapp && showBrief && hasBrief && !quickReplies
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
    whatsapp ? '' : styles.html,
    whatsapp ? '' : limits.html,
    loading && whatsapp ? '' : photo.html,
    loading && whatsapp ? '' : briefDraft.html,
    loading && whatsapp ? '' : actions.html,
    result.html,
    errorBlock.html,
    quick,
    composer.html,
  ]);

  return {
    html,
    meta: {
      ...transcript.meta,
      styleCount: showStyles ? styles.meta.count : (whatsapp ? 0 : styles.meta.count),
      actionKinds: actions.meta.kinds,
      proposedNotExecutable: actions.meta.proposedNotExecutable,
      photoPreviewShown: photo.meta.previewShown || Boolean(transcript.meta.photoBubbles),
      photoOptional: true,
      continueOffered: photo.meta.continueOffered,
      success: result.meta.showSuccess,
      bookingConfirmed: false,
      composerDisabled,
      greetingTurn: whatsapp ? greetingTurn : false,
    },
  };
}
