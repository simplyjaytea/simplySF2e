/**
 * Token-count helpers shared by the provider client and the usage report.
 * Pure: no Foundry globals. Not a tokenizer — fallback counts are labeled
 * estimated and coarsened on display so they do not look counted.
 */
import { parseCost } from "./cost.mjs";

/** JSON punctuation that BPE-style tokenizers usually split off as their own token. */
const JSON_PUNCT = /[{}\[\]":]/g;

/**
 * Estimate tokens from a string or a character count.
 * Prose uses ~4 characters/token; JSON punctuation gets a small extra.
 * @param {string|number} input
 * @returns {number}
 */
export function estimateTokens(input) {
  const text = typeof input === "number" ? null : String(input ?? "");
  const chars = text !== null ? text.length : Math.max(0, Number(input) || 0);
  if (chars <= 0) return 0;
  const punct = text ? (text.match(JSON_PUNCT) || []).length : 0;
  // ponytail: 4 chars/token plus a JSON punct bump; replace if a real tokenizer ships
  return Math.max(1, Math.round(chars / 4 + punct * 0.25));
}

/**
 * Drop fake precision on estimated counts. Exact provider usage is never coarsened.
 * @param {number} n
 * @returns {number}
 */
export function coarsenTokenEstimate(n) {
  const x = Math.max(0, Number(n) || 0);
  if (x === 0) return 0;
  if (x < 50) return Math.max(1, Math.round(x));
  if (x < 200) return Math.round(x / 5) * 5;
  return Math.round(x / 10) * 10;
}

/**
 * Compact last-run total from recorded per-call usage. Estimated steps stay
 * coarsened and the whole total is marked estimated whenever any step is.
 * @param {Array<{usage?: {total?: number, estimated?: boolean}}>} entries
 * @returns {{total: number, estimated: boolean}|null}
 */
export function lastRunTokenTotal(entries) {
  if (!Array.isArray(entries) || !entries.length) return null;
  let total = 0;
  let estimated = false;
  let any = false;
  for (const entry of entries) {
    const usage = entry?.usage;
    if (!usage) continue;
    any = true;
    if (usage.estimated) {
      estimated = true;
      total += coarsenTokenEstimate(usage.total || 0);
    } else {
      total += usage.total || 0;
    }
  }
  return any ? { total, estimated } : null;
}

/**
 * A provider token count, or NaN when absent. null, undefined, "", booleans
 * and non-numeric text are absent (Number(null) and Number("") would be 0);
 * a numeric 0 or a numeric string stays a count.
 */
function usageCount(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return NaN;
}

/**
 * Shape a provider usage block into {prompt, completion, total, estimated}.
 * Prefers complete provider counts. Partial blocks fill the missing side from
 * the estimator and stay labeled estimated. No usage at all is fully estimated.
 */
export function normalizeUsage(usage, { content, system, user, reasoningChars = 0 } = {}) {
  // OpenRouter reports the charged amount as usage.cost; other providers omit it.
  const parsedCost = parseCost(usage?.cost);
  const costField = parsedCost == null ? {} : { cost: parsedCost };
  const prompt = usageCount(usage?.prompt_tokens);
  const completion = usageCount(usage?.completion_tokens);
  const total = usageCount(usage?.total_tokens);
  const hasPrompt = Number.isFinite(prompt);
  const hasCompletion = Number.isFinite(completion);
  const hasTotal = Number.isFinite(total);
  if (hasPrompt && hasCompletion) {
    return {
      prompt,
      completion,
      total: hasTotal ? total : prompt + completion,
      ...costField,
      estimated: false
    };
  }

  const promptEst = estimateTokens(`${system ?? ""}${user ?? ""}`);
  const completionEst = estimateTokens(content ?? "")
    + (reasoningChars > 0 ? estimateTokens(reasoningChars) : 0);

  if (hasTotal && !hasPrompt && !hasCompletion) {
    return { prompt: 0, completion: 0, total, ...costField, estimated: false };
  }
  if (hasPrompt || hasCompletion || hasTotal) {
    const p = hasPrompt ? prompt : promptEst;
    const c = hasCompletion ? completion : completionEst;
    return {
      prompt: p,
      completion: c,
      total: hasTotal ? total : p + c,
      ...costField,
      estimated: true
    };
  }
  return {
    prompt: promptEst,
    completion: completionEst,
    total: promptEst + completionEst,
    ...costField,
    estimated: true
  };
}

/**
 * Shape a Jev (System One) usage block, `{ input_tokens, output_tokens, cost? }`,
 * into `{ prompt, completion, total, cost, estimated }`. Jev's output is free, so
 * `completion` may be 0. `cost` is the provider-reported amount, or null when the
 * response carried none. Returns null without a usable `input_tokens` (never guessed).
 */
export function normalizeJevUsage(usage) {
  const input = Number(usage?.input_tokens);
  if (usage?.input_tokens == null || !Number.isFinite(input) || input < 0) return null;
  const output = Number(usage?.output_tokens);
  const completion = Number.isFinite(output) && output >= 0 ? output : 0;
  return {
    prompt: input,
    completion,
    total: input + completion,
    cost: parseCost(usage?.cost),
    estimated: false
  };
}
