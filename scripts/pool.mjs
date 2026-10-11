/**
 * Run async tasks a few at a time. Encounter mode builds its creatures with
 * this so a large encounter does not wait for each creature in turn.
 * Pure module (no Foundry globals), node-testable.
 */

/**
 * How many encounter creatures are built at the same time. A module default,
 * not a game number: small enough to stay under typical provider rate limits.
 */
export const ENCOUNTER_CONCURRENCY = 3;

/**
 * Call `task(i)` for i = 0..count-1 with at most `limit` running at once.
 * Tasks start in index order and results come back in index order. After the
 * first failure no new task starts, `onError(err)` runs once (to abort the
 * others), the running ones are allowed to settle, and the first error is
 * thrown.
 * @template T
 * @param {number} count
 * @param {number} limit
 * @param {(index: number) => Promise<T>} task
 * @param {{onError?: (err: unknown) => void}} [options]
 * @returns {Promise<T[]>}
 */
export async function runPool(count, limit, task, { onError } = {}) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const width = Math.max(1, Math.min(total, Math.floor(Number(limit) || 1)));
  const results = new Array(total);
  let next = 0;
  let failure = null;
  const worker = async () => {
    while (!failure && next < total) {
      const index = next++;
      try {
        results[index] = await task(index);
      } catch (err) {
        if (!failure) {
          failure = { err };
          onError?.(err);
        }
      }
    }
  };
  await Promise.all(Array.from({ length: total ? width : 0 }, worker));
  if (failure) throw failure.err;
  return results;
}
