import { el, escapeHtml } from '../html.js';
import { t } from '../copy.js';
import { filterAllowedActions, photoPreviewPermitted, shouldOfferContinueWithoutPhoto } from '../policy.js';

export function renderOptionalImage({
  context = null,
  imageRef = null,
  locale = 'ar',
  allowedActions = [],
} = {}) {
  const permitted = photoPreviewPermitted(context);
  const offerContinue = shouldOfferContinueWithoutPhoto({
    context,
    allowedActions,
    photoUiVisible: permitted && Boolean(imageRef),
  });
  const continueAction = filterAllowedActions(allowedActions, { max: 9 })
    .find((a) => a.kind === 'continue_without_photo');

  let well = '';
  if (permitted && imageRef) {
    well = el('div', {
      class: 'wk-image-well',
      'data-photo-preview': 'shown',
      'data-image-ref': imageRef,
    }, [
      el('span', {}, t(locale, 'image_ref')),
      el('code', {}, escapeHtml(imageRef)),
    ]);
  } else {
    well = el('p', {
      class: 'wk-note',
      'data-photo-preview': 'hidden',
    }, permitted ? t(locale, 'photo_optional') : t(locale, 'photo_preview_blocked'));
  }

  const continueBtn = offerContinue
    ? el('button', {
      type: 'button',
      class: 'wk-pill is-ghost',
      'data-action-kind': 'continue_without_photo',
      'data-action-id': continueAction?.action_id || '',
      'data-text-path': 'true',
      disabled: !continueAction,
    }, t(locale, 'continue_without_photo'))
    : '';

  return {
    html: el('section', { 'data-component': 'optional-image' }, [
      well,
      el('p', { class: 'wk-note' }, t(locale, 'photo_optional')),
      continueBtn,
    ]),
    meta: {
      previewShown: Boolean(permitted && imageRef),
      photoOptional: true,
      continueOffered: offerContinue,
      continueExecutable: Boolean(continueAction),
    },
  };
}
