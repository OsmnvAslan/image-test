// Exponential backoff + jitter helper (PLAN §4.3).
// Tries `fn` up to (1 + retries) times. Each call gets an attempt index (1-based).
// `onAttempt` is invoked before every attempt so the caller can count total attempts
// across all providers. Delay before retry N = base * 2^(N-1) plus random jitter.

export interface RetryOptions {
  retries: number; // number of *re*tries after the first try (so total tries = retries + 1)
  baseMs: number; // base backoff in ms
  onAttempt?: () => void; // called once per attempt (used to tally total attempts)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const totalTries = opts.retries + 1;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= totalTries; attempt++) {
    opts.onAttempt?.();
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt < totalTries) {
        const backoff = opts.baseMs * Math.pow(2, attempt - 1);
        const jitter = Math.random() * opts.baseMs; // full-ish jitter, bounded by base
        await sleep(backoff + jitter);
      }
    }
  }

  throw lastErr;
}
