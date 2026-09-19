/**
 * Pure CLI-flag parsing for the eval runner (package A4). Unit-tested; never talks to a model.
 */
export function staffInboxFlag(args, def = 'enabled') {
  const i = args.indexOf('--staff-inbox');
  const value = i === -1 ? def : args[i + 1];
  if (!['enabled', 'unavailable'].includes(value)) {
    throw new Error(`--staff-inbox must be "enabled" or "unavailable" (got "${value}")`);
  }
  return value;
}
