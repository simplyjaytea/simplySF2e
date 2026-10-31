// Retry a rejected or overloaded provider response at most once per logical
// request. The caller owns the retry budget (a mutable `{ remaining }`); this
// module only spends it when the response is a genuinely transient status.
// Cancelling always wins: a pre-aborted or mid-wait abort rejects and never
// starts a later request.
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);

function retryAfterMs(response) {
  const raw = response?.headers?.get?.("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 300000);
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) {
    const ms = date - Date.now();
    return ms > 0 ? Math.min(ms, 300000) : 0;
  }
  return null;
}

function isRetryableStatus(status, response) {
  if (TRANSIENT_STATUSES.has(status)) return true;
  // A bare 5xx is ambiguous: the provider may already have billed the
  // completion. Only retry it when the provider explicitly asks us to wait.
  if (typeof status === "number" && status >= 500 && status <= 599) {
    return retryAfterMs(response) != null;
  }
  return false;
}

export async function fetchWithBackoff(url, options, {
  fetchImpl = globalThis.fetch,
  delayMs,
  maxDelayMs = 30000,
  retryBudget = null
} = {}) {
  const baseDelay = (typeof delayMs === "number") ? delayMs : 1000;
  const signal = options?.signal;

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  let response = await fetchImpl(url, options);
  const status = response?.status;

  if (!isRetryableStatus(status, response)) return response;
  if (retryBudget && retryBudget.remaining <= 0) return response;

  if (retryBudget) retryBudget.remaining = Math.max(0, retryBudget.remaining - 1);

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  try { await response?.body?.cancel?.(); } catch { /* ignore */ }

  const after = retryAfterMs(response);
  const rawDelay = (after != null) ? after : baseDelay;
  // Honor a provider-supplied Retry-After exactly; only add jitter to our own
  // default delay so a rate-limited provider is not kept waiting longer.
  const jitter = (after != null) ? 0 : Math.floor(Math.random() * Math.max(1, Math.ceil(rawDelay * 0.25)));
  const delay = Math.min(rawDelay + jitter, maxDelayMs);

  await new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delay);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  console.warn(`simplysf2e | retrying provider request after HTTP ${status} (delay ${delay}ms)`);
  return fetchImpl(url, options);
}
