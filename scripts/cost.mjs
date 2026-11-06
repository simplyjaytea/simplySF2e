// Pure run-cost rules: sum what the provider reported, price the rest from the
// optional manual per-1M-token prices, and format the amount. No Foundry
// globals, so it is node-testable; app-base.mjs supplies the live inputs.
//
// A manual price is used ONLY for a request the provider gave no cost for, and
// prompt and completion are priced separately from their own counts (an
// averaged price times the total is silently wrong).

/**
 * Normalize one manual price field. Empty/unset -> `{ value: null }`; a
 * non-negative finite number -> `{ value }`; anything else -> `{ value: null, error: true }`.
 */
export function parsePrice(raw) {
  if (raw == null) return { value: null };
  if (typeof raw === "string" && raw.trim() === "") return { value: null };
  if (typeof raw !== "number" && typeof raw !== "string") return { value: null, error: true };
  const n = typeof raw === "number" ? raw : Number(raw.trim());
  if (!Number.isFinite(n) || n < 0) return { value: null, error: true };
  return { value: n };
}

/** Stored prices `{ inputPerM, outputPerM }` -> each a finite number >= 0 or null. */
export function normalizePrices(prices) {
  return {
    inputPerM: parsePrice(prices?.inputPerM).value,
    outputPerM: parsePrice(prices?.outputPerM).value
  };
}

/** True when at least one usable manual price is set. */
export function hasPrices(prices) {
  const p = normalizePrices(prices);
  return p.inputPerM != null || p.outputPerM != null;
}

const count = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : 0);

/**
 * Sum the cost of a run.
 * @param {Array<{prompt?:number, completion?:number, total?:number, cost?:number|null,
 *   costMissing?:boolean, noManual?:boolean}>} usages one per request/step. `cost` is
 *   the provider-reported amount; `costMissing` marks a summed usage in which some
 *   request reported none; `noManual` keeps manual prices off (another model, e.g. Jev).
 * @param {{inputPerM?:number|null, outputPerM?:number|null}} prices optional manual prices
 * @returns {{amount:number|null, partial:boolean, source:"provider"|"manual"|"mixed"|null}}
 *   `amount` is null when nothing could be priced (no fake $0).
 */
export function runCost(usages, prices = {}) {
  const { inputPerM, outputPerM } = normalizePrices(prices);
  const priced = inputPerM != null || outputPerM != null;
  let amount = 0;
  let provider = false;
  let manual = false;
  let partial = false;
  for (const usage of Array.isArray(usages) ? usages : []) {
    if (!usage || typeof usage !== "object") continue;
    const prompt = count(usage.prompt);
    const completion = count(usage.completion);
    const reported = usage.cost == null ? NaN : Number(usage.cost);
    if (Number.isFinite(reported) && reported >= 0) {
      amount += reported;
      provider = true;
      if (usage.costMissing) partial = true;
      continue;
    }
    // A request that spent nothing (e.g. a Jev step that never ran) has no cost to miss.
    if (!prompt && !completion && !count(usage.total)) continue;
    if (priced && !usage.noManual) {
      amount += (prompt / 1e6) * (inputPerM ?? 0) + (completion / 1e6) * (outputPerM ?? 0);
      manual = true;
      // A single price covers only its own side of the request.
      if ((inputPerM == null && prompt) || (outputPerM == null && completion)) partial = true;
    } else {
      partial = true;
    }
  }
  if (!provider && !manual) return { amount: null, partial: false, source: null };
  return {
    amount,
    partial,
    source: provider && manual ? "mixed" : provider ? "provider" : "manual"
  };
}

/** "$0.0042" below $0.01 (4 decimals), "$1.23" otherwise. Null for a non-amount. */
export function formatCost(amount) {
  const n = Number(amount);
  if (amount == null || !Number.isFinite(n) || n < 0) return null;
  if (n === 0) return "$0.00";
  if (n < 0.00005) return "<$0.0001";
  const fine = n.toFixed(4);
  // 0.00996 rounds to 0.0100 at 4 places; show that as $0.01, not $0.0100.
  return Number(fine) >= 0.01 ? `$${n.toFixed(2)}` : `$${fine}`;
}
