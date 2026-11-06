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
 * A raw provider `cost` as a finite amount >= 0, else null. Blank strings,
 * booleans, negatives and NaN are "absent", never $0.
 */
export function parseCost(raw) {
  if (raw == null || typeof raw === "boolean") return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const spentTokens = (u) => count(u?.prompt) + count(u?.completion) + count(u?.total) > 0;
// Tokens were spent but the split is unknown (total only): cannot be priced per side.
const opaqueTokens = (u) => !count(u?.prompt) && !count(u?.completion) && count(u?.total) > 0;

/**
 * Provider-reported cost of a usage, or null when it is unknown. A reported 0
 * with tokens spent is unknown too: OpenRouter BYOK reports 0 while the real
 * upstream charge is elsewhere, so it must not read as free.
 */
export function reportedCost(usage) {
  const cost = parseCost(usage?.cost);
  if (cost == null) return null;
  if (cost === 0 && spentTokens(usage)) return null;
  return cost;
}

// Tokens of `u` the provider gave no cost for: priceable counts, plus whether
// some part is unpriceable (opaque split, or Jev tokens that chat prices never cover).
function unpricedOf(u, opaqueAll = false) {
  const jev = count(u?.jevPrompt) + count(u?.jevCompletion);
  if (reportedCost(u) != null) {
    return { p: count(u.unpricedPrompt), c: count(u.unpricedCompletion), opaque: Boolean(u.costMissing) };
  }
  if (!spentTokens(u)) return { p: 0, c: 0, opaque: false };
  if (opaqueAll || opaqueTokens(u) || jev > 0) {
    return {
      p: opaqueAll ? 0 : Math.max(0, count(u.prompt) - count(u.jevPrompt)),
      c: opaqueAll ? 0 : Math.max(0, count(u.completion) - count(u.jevCompletion)),
      opaque: true
    };
  }
  return { p: count(u.prompt), c: count(u.completion), opaque: false };
}

/**
 * Sum two usages (either may be null) keeping cost bookkeeping: `cost` (provider-
 * reported total), `unpricedPrompt`/`unpricedCompletion` (tokens of requests with no
 * reported cost, for manual pricing) and `costMissing` (some unpriced part cannot be
 * priced). None of these appear until some request reported a cost, so providers that
 * never report cost keep the plain `{ prompt, completion, total, estimated }` shape.
 * `opaqueB` marks b's unpriced tokens unpriceable (Jev, which chat prices never cover);
 * a's/b's own Jev tokens are carried as jevPrompt/jevCompletion.
 */
export function combineUsage(a, b, { b: bIsJev = false } = {}) {
  if (!a) return b ?? null;
  if (!b) return a;
  const costA = reportedCost(a);
  const costB = reportedCost(b);
  const ua = unpricedOf(a);
  const ub = unpricedOf(b, bIsJev);
  const jevPrompt = count(a.jevPrompt) + count(b.jevPrompt) + (bIsJev ? count(b.prompt) : 0);
  const jevCompletion = count(a.jevCompletion) + count(b.jevCompletion) + (bIsJev ? count(b.completion) : 0);
  const out = {
    prompt: count(a.prompt) + count(b.prompt),
    completion: count(a.completion) + count(b.completion),
    total: count(a.total) + count(b.total),
    estimated: Boolean(a.estimated || b.estimated)
  };
  if (costA != null || costB != null) {
    out.cost = (costA ?? 0) + (costB ?? 0);
    const p = ua.p + ub.p;
    const c = ua.c + ub.c;
    if (p) out.unpricedPrompt = p;
    if (c) out.unpricedCompletion = c;
    if (ua.opaque || ub.opaque) out.costMissing = true;
  }
  if (jevPrompt) out.jevPrompt = jevPrompt;
  if (jevCompletion) out.jevCompletion = jevCompletion;
  return out;
}

/**
 * Sum the cost of a run.
 * @param {Array<object>} usages one per request/step: `prompt`, `completion`, `total`,
 *   `cost` (provider-reported amount), the aggregate fields of combineUsage, `prices`
 *   (the manual prices in force when the request was made; falls back to the
 *   `prices` argument) and `noManual` (keeps manual prices off, e.g. Jev).
 * @param {{inputPerM?:number|null, outputPerM?:number|null}} prices default manual prices
 * @returns {{amount:number|null, partial:boolean, source:"provider"|"manual"|"mixed"|null}}
 *   `amount` is null when nothing could be priced (no fake $0).
 */
export function runCost(usages, prices = {}) {
  let amount = 0;
  let provider = false;
  let manual = false;
  let partial = false;
  // Price `p`/`c` tokens with this entry's prices; false when nothing could be priced.
  const priceTokens = (p, c, usage) => {
    const { inputPerM, outputPerM } = normalizePrices(usage.prices ?? prices);
    if (usage.noManual || (inputPerM == null && outputPerM == null)) return false;
    let priced = false;
    if (p && inputPerM != null) { amount += (p / 1e6) * inputPerM; priced = true; }
    else if (p) partial = true;
    if (c && outputPerM != null) { amount += (c / 1e6) * outputPerM; priced = true; }
    else if (c) partial = true;
    if (priced) manual = true;
    return priced;
  };
  for (const usage of Array.isArray(usages) ? usages : []) {
    if (!usage || typeof usage !== "object") continue;
    const reported = reportedCost(usage);
    if (reported != null) {
      amount += reported;
      provider = true;
      const p = count(usage.unpricedPrompt);
      const c = count(usage.unpricedCompletion);
      if ((p || c) && !priceTokens(p, c, usage)) partial = true;
      if (usage.costMissing) partial = true;
      continue;
    }
    // A request that spent nothing (e.g. a Jev step that never ran) has no cost to miss.
    if (!spentTokens(usage)) continue;
    // Total-only usage has no prompt/completion split to price.
    if (opaqueTokens(usage)) { partial = true; continue; }
    const jev = count(usage.jevPrompt) + count(usage.jevCompletion);
    if (jev) partial = true;
    const p = Math.max(0, count(usage.prompt) - count(usage.jevPrompt));
    const c = Math.max(0, count(usage.completion) - count(usage.jevCompletion));
    if (!priceTokens(p, c, usage) && (p || c)) partial = true;
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
