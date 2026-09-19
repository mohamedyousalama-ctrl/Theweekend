/**
 * Pure helpers for the eval runner's per-case skipping and report summary (package A4 follow-up,
 * Codex P2-1/P2-2). Unit-tested; never talk to a model.
 */
export function skipReason(c, staffInbox) {
  if (c.requires_staff_inbox && c.requires_staff_inbox !== staffInbox) {
    return `requires --staff-inbox=${c.requires_staff_inbox} (mode is ${staffInbox})`;
  }
  return null;
}

export function buildSummary({ caseRows, imageRows = [], staffInbox, finishedAt }) {
  const run = caseRows.filter((c) => !c.skip);
  const textSkipped = caseRows.length - run.length;
  const textPassed = run.filter((c) => c.pass).length;
  const imagePassed = imageRows.filter((c) => c.pass).length;
  const cost = run.reduce((s, c) => s + (c.cost_minor || 0), 0) + imageRows.reduce((s, c) => s + (c.cost_minor || 0), 0);
  return {
    text_cases: run.length,
    text_passed: textPassed,
    text_skipped: textSkipped,
    image_cases: imageRows.length,
    image_passed: imagePassed,
    total_cost_minor_usd_cents: cost,
    staff_inbox: staffInbox,
    finished_at: finishedAt,
  };
}
