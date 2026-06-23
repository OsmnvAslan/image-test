// Tiny in-process concurrency pool (PLAN.md §3).
//
// Runs `worker` over `items` with at most `limit` workers in flight. Used to
// fan out one generation job per product while keeping the free image
// providers happy. No external queue/broker — deliberately minimal.

/**
 * Default concurrency limit from env, falling back to 3 (PLAN §3).
 */
export function defaultConcurrency(): number {
  return Number(process.env.MAX_CONCURRENCY) || 3;
}

/**
 * Run `worker(item, index)` over all items with at most `limit` concurrent
 * invocations. Resolves when every item has been processed. The worker is
 * expected to handle its own errors (per-job try/catch); if a worker rejects,
 * the pool still drains the remaining items but the returned promise rejects.
 */
export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const max = Math.max(1, Math.floor(limit) || 1);
  let next = 0;

  async function runner(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  }

  const runners: Promise<void>[] = [];
  const count = Math.min(max, items.length);
  for (let i = 0; i < count; i++) {
    runners.push(runner());
  }
  await Promise.all(runners);
}
