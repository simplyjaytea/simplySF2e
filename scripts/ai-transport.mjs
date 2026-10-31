// Retry a rejected request once for transient provider overload. The caller's
// AbortSignal also owns the wait, so cancelling never starts a later request.
export async function fetchWithBackoff(url, options, { fetchImpl = globalThis.fetch, delayMs = 1000 } = {}) {
  const response = await fetchImpl(url, options);
  if (response.status !== 429 && (response.status < 500 || response.status > 599)) return response;
  const retryAfter = response.headers?.get?.("retry-after");
  let waitMs = delayMs;
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const date = Date.parse(retryAfter);
    const requested = Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(date) ? date - Date.now() : 0;
    // Do not retry earlier than the provider requested, or hang the run for a
    // long cooldown. Return the original error in that case.
    if (requested > 5000) return response;
    waitMs = Math.max(waitMs, requested);
  }
  // Release the discarded response without allowing an uncooperative stream to
  // hold up cancellation or the next request.
  try { response.body?.cancel?.()?.catch?.(() => {}); } catch { /* already locked or closed */ }
  await new Promise((resolve, reject) => {
    const signal = options?.signal;
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, waitMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
  return fetchImpl(url, options);
}
