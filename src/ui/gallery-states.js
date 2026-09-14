/**
 * §6 state gallery. Objects match fixtures/contracts (validated in tests).
 * Browser demo only; live success still requires C ActionResult / receipts.
 */

export const GALLERY_IDS = [
  'loading',
  'validation',
  'unavailable',
  'timeout',
  'failed_save',
  'reconnected',
];

export function galleryIndex() {
  return GALLERY_IDS.slice();
}
