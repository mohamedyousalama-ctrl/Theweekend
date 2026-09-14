export function withTimeout(work, ms, options = {}) {
  const controller = options.controller instanceof AbortController
    ? options.controller
    : new AbortController();
  const run = Promise.resolve().then(() => work(controller.signal));
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('timeout');
      err.code = 'TIMEOUT';
      controller.abort(err);
      reject(err);
    }, ms);
  });
  return Promise.race([run, timeout]).finally(() => clearTimeout(timer));
}

/** If the adapter already settled, return it; otherwise wait a short beat after abort. */
export function settledOrSoon(value, promise, waitMs = 50) {
  if (value) return Promise.resolve(value);
  return Promise.race([
    Promise.resolve(promise).then((result) => result, () => null),
    new Promise((resolve) => setTimeout(() => resolve(null), waitMs)),
  ]);
}
