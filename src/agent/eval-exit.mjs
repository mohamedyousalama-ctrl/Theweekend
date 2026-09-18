/**
 * Exit rule for the real-model eval runner (issue #5 / package A3).
 *
 * Text cases must all pass. Vision is success only when `--images` was given and at least
 * one image case ran and every image case passed. Otherwise the run is `vision: NOT RUN`
 * and the process exits 1 — unless `--text-only` was passed, which prints
 * `vision: SKIPPED (--text-only)` and exits 0 on text success.
 *
 * Pure: unit-tested with a fake report; never talks to a model.
 */
export function evalExit({
  textPassed = 0,
  textTotal = 0,
  imagesRequested = false,
  imagePassed = 0,
  imageTotal = 0,
  textOnly = false,
} = {}) {
  const textOk = textPassed === textTotal;
  if (textOnly) {
    return { code: textOk ? 0 : 1, note: 'vision: SKIPPED (--text-only)' };
  }
  const visionRan = Boolean(imagesRequested) && imageTotal > 0;
  if (!visionRan) {
    return { code: 1, note: 'vision: NOT RUN' };
  }
  const visionOk = imagePassed === imageTotal;
  return { code: textOk && visionOk ? 0 : 1, note: null };
}
