export function withTimeout(work, ms) {
  const run = Promise.resolve().then(() => work());
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('timeout');
      err.code = 'TIMEOUT';
      reject(err);
    }, ms);
  });
  return Promise.race([run, timeout]).finally(() => clearTimeout(timer));
}
