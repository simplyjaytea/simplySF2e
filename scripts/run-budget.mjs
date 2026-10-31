/**
 * Per-run token budget + deadline registry, keyed by the run's AbortSignal.
 *
 * Dependency-free. No Foundry globals, no network, no timers.
 */

const REGISTRY = new WeakMap();

/**
 * Begin a run budget on `signal`. Returns the stored entry, or null when the
 * signal is missing/undefined.
 */
export function beginRunBudget(signal, { tokenBudget, deadlineMs, now = Date.now } = {}) {
  if (!signal) return null;
  const entry = {
    tokenBudget,
    tokensSpent: 0,
    startedAt: now(),
    deadlineMs
  };
  REGISTRY.set(signal, entry);
  return entry;
}

/**
 * Delete the run budget entry for `signal`. Safe when absent.
 */
export function endRunBudget(signal) {
  if (!signal) return;
  REGISTRY.delete(signal);
}

/**
 * Return the run budget entry for `signal`, or null.
 */
export function getRunBudget(signal) {
  if (!signal) return null;
  return REGISTRY.get(signal) ?? null;
}

/**
 * Copy the parent's run budget entry to the derived signal so an
 * AbortSignal.any member shares the run budget. No-op when the parent has none.
 */
export function inheritRunBudget(parentSignal, derivedSignal) {
  const entry = getRunBudget(parentSignal);
  if (!entry || !derivedSignal) return;
  // Share the same object so spend accumulates across parent + derived.
  REGISTRY.set(derivedSignal, entry);
}

/**
 * Add `usage.total` to the entry when it is a finite number >= 0.
 */
export function spendRunTokens(signal, usage) {
  const entry = getRunBudget(signal);
  if (!entry) return;
  const total = usage?.total;
  if (typeof total !== "number" || !Number.isFinite(total) || total < 0) return;
  entry.tokensSpent += total;
}

/**
 * Remaining tokens, or null when no entry / no positive finite tokenBudget.
 */
export function remainingRunTokens(signal) {
  const entry = getRunBudget(signal);
  if (!entry) return null;
  const { tokenBudget, tokensSpent } = entry;
  if (typeof tokenBudget !== "number" || !Number.isFinite(tokenBudget) || tokenBudget <= 0) return null;
  return Math.max(0, tokenBudget - tokensSpent);
}

/**
 * Remaining deadline ms, or null when no entry / no positive finite deadlineMs.
 */
export function remainingDeadlineMs(signal) {
  const entry = getRunBudget(signal);
  if (!entry) return null;
  const { deadlineMs, startedAt } = entry;
  if (typeof deadlineMs !== "number" || !Number.isFinite(deadlineMs) || deadlineMs <= 0) return null;
  return Math.max(0, deadlineMs - (Date.now() - startedAt));
}

/**
 * Return null, "budget", or "deadline". "deadline" takes precedence when both.
 * tokenBudget/deadlineMs of 0/negative/NaN/Infinity disable that limit.
 */
export function runBudgetProblem(signal) {
  const entry = getRunBudget(signal);
  if (!entry) return null;
  const { tokenBudget, tokensSpent, deadlineMs, startedAt } = entry;
  // deadline first
  const deadlineActive = typeof deadlineMs === "number" && Number.isFinite(deadlineMs) && deadlineMs > 0;
  if (deadlineActive) {
    const remaining = deadlineMs - (Date.now() - startedAt);
    if (remaining <= 0) return "deadline";
  }
  const budgetActive = typeof tokenBudget === "number" && Number.isFinite(tokenBudget) && tokenBudget > 0;
  if (budgetActive) {
    if (tokensSpent >= tokenBudget) return "budget";
  }
  return null;
}
