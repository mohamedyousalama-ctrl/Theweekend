import test from 'node:test';
import assert from 'node:assert/strict';
import { evalExit } from '../../src/agent/eval-exit.mjs';

test('eval exit: vision NOT RUN without --images; SKIPPED with --text-only; 0 only when images ran and passed', () => {
  const textPass = { textPassed: 30, textTotal: 30 };

  const noImages = evalExit({ ...textPass, imagesRequested: false, imagePassed: 0, imageTotal: 0, textOnly: false });
  assert.equal(noImages.code, 1);
  assert.equal(noImages.note, 'vision: NOT RUN');

  const emptyDir = evalExit({ ...textPass, imagesRequested: true, imagePassed: 0, imageTotal: 0, textOnly: false });
  assert.equal(emptyDir.code, 1);
  assert.equal(emptyDir.note, 'vision: NOT RUN');

  const textOnlyOk = evalExit({ ...textPass, imagesRequested: false, imagePassed: 0, imageTotal: 0, textOnly: true });
  assert.equal(textOnlyOk.code, 0);
  assert.equal(textOnlyOk.note, 'vision: SKIPPED (--text-only)');

  const textOnlyFail = evalExit({ textPassed: 28, textTotal: 30, imagesRequested: false, imagePassed: 0, imageTotal: 0, textOnly: true });
  assert.equal(textOnlyFail.code, 1);
  assert.equal(textOnlyFail.note, 'vision: SKIPPED (--text-only)');

  const visionPass = evalExit({ ...textPass, imagesRequested: true, imagePassed: 4, imageTotal: 4, textOnly: false });
  assert.equal(visionPass.code, 0);
  assert.equal(visionPass.note, null);

  const visionFail = evalExit({ ...textPass, imagesRequested: true, imagePassed: 3, imageTotal: 4, textOnly: false });
  assert.equal(visionFail.code, 1);
  assert.equal(visionFail.note, null);

  const textFailWithVision = evalExit({ textPassed: 29, textTotal: 30, imagesRequested: true, imagePassed: 4, imageTotal: 4, textOnly: false });
  assert.equal(textFailWithVision.code, 1);
  assert.equal(textFailWithVision.note, null);
});
