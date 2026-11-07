// Run-cost helpers: provider/manual/mixed/partial pricing and formatting.
// Run: node scripts/cost.test.mjs
import assert from "node:assert/strict";
import { combineUsage, formatCost, hasPrices, normalizePrices, parseCost, parsePrice, runCost } from "./cost.mjs";
import { normalizeJevUsage, normalizeUsage } from "./tokens.mjs";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);
const none = { amount: null, partial: false, source: null };

// No usages / no cost / no prices: nothing, never a fake $0.
assert.deepEqual(runCost([], {}), none);
assert.deepEqual(runCost(undefined), none);

// Provider only: sums every request, including a zero-cost free model.
let r = runCost([{ prompt: 100, completion: 50, cost: 0.001 }, { prompt: 10, completion: 5, cost: 0.0002 }]);
close(r.amount, 0.0012); assert.equal(r.source, "provider"); assert.equal(r.partial, false);
// A reported 0 with no tokens is a real $0.00; with tokens it is unknown (OpenRouter BYOK), never "free".
assert.deepEqual(runCost([{ prompt: 0, completion: 0, total: 0, cost: 0 }]), { amount: 0, partial: false, source: "provider" });
assert.deepEqual(runCost([{ prompt: 5, completion: 5, cost: 0 }]), none, "BYOK cost 0 with tokens is unknown");
r = runCost([{ prompt: 5, completion: 5, cost: 0 }, { prompt: 10, completion: 10, cost: 0.01 }]);
close(r.amount, 0.01); assert.equal(r.partial, true, "a BYOK-zero request inside a priced run is an unpriced request: partial");
r = runCost([{ prompt: 1_000_000, completion: 0, cost: 0 }], { inputPerM: 2 });
close(r.amount, 2); assert.equal(r.source, "manual", "BYOK zero falls back to manual prices");

// Manual only: prompt and completion priced separately from their own counts.
r = runCost([{ prompt: 1_000_000, completion: 500_000 }], { inputPerM: 0.27, outputPerM: 1.1 });
close(r.amount, 0.27 + 0.55); assert.equal(r.source, "manual"); assert.equal(r.partial, false);
// Mutation guard: the same price for both sides must give a different answer.
const samePrice = runCost([{ prompt: 1_000_000, completion: 500_000 }], { inputPerM: 0.27, outputPerM: 0.27 });
assert.notEqual(samePrice.amount, r.amount);
close(samePrice.amount, 0.27 * 1.5);
// Asymmetric counts: a swapped prompt/completion price would change the sum.
close(runCost([{ prompt: 200, completion: 0 }], { inputPerM: 10, outputPerM: 99 }).amount, 0.002);
close(runCost([{ prompt: 0, completion: 200 }], { inputPerM: 99, outputPerM: 10 }).amount, 0.002);

// Manual price never overrides a provider-reported cost.
r = runCost([{ prompt: 1_000_000, completion: 1_000_000, cost: 0.05 }], { inputPerM: 9, outputPerM: 9 });
close(r.amount, 0.05); assert.equal(r.source, "provider");

// Mixed: one provider-reported request plus one priced manually.
r = runCost([{ prompt: 10, completion: 10, cost: 0.01 }, { prompt: 1_000_000, completion: 0 }], { inputPerM: 2, outputPerM: 4 });
close(r.amount, 2.01); assert.equal(r.source, "mixed"); assert.equal(r.partial, false);

// Partial: one request lacks cost and there are no prices.
r = runCost([{ prompt: 10, completion: 10, cost: 0.01 }, { prompt: 10, completion: 10 }]);
close(r.amount, 0.01); assert.equal(r.partial, true, "a separate unpriced request is partial without prices");
r = runCost([{ prompt: 10, completion: 10, cost: 0.01, costMissing: true }]);
assert.equal(r.partial, true); assert.equal(r.source, "provider");
assert.deepEqual(runCost([{ prompt: 10, completion: 10 }]), none, "nothing priced: no amount, no source");
// A summed usage that flagged a missing retry cost is partial too.
assert.equal(runCost([{ prompt: 1, completion: 1, cost: 0.01, costMissing: true }]).partial, true);
// A one-sided price leaves the unpriced side missing.
r = runCost([{ prompt: 1_000_000, completion: 1_000_000 }], { inputPerM: 1 });
close(r.amount, 1); assert.equal(r.partial, true);
// Manual prices stay off a usage that opts out (Jev runs another model).
r = runCost([{ prompt: 1_000_000, completion: 0, noManual: true }], { inputPerM: 5 });
assert.deepEqual(r, none);

// Zero tokens: a request that spent nothing is neither partial nor priced.
assert.deepEqual(runCost([{ prompt: 0, completion: 0, total: 0 }], { inputPerM: 1, outputPerM: 1 }), none);
r = runCost([{ prompt: 0, completion: 0, total: 0 }, { prompt: 10, completion: 10, cost: 0.1 }]);
assert.equal(r.partial, false);

// Negative / NaN / junk prices are ignored.
for (const bad of [-1, NaN, Infinity, "abc", {}, true]) {
  assert.deepEqual(runCost([{ prompt: 1_000_000, completion: 1_000_000 }], { inputPerM: bad, outputPerM: bad }), none, String(bad));
}
close(runCost([{ prompt: 1_000_000, completion: 1_000_000 }], { inputPerM: -5, outputPerM: 2 }).amount, 2);
// Negative / NaN provider costs are not trusted.
assert.deepEqual(runCost([{ prompt: 5, completion: 5, cost: -1 }]), none);
assert.deepEqual(runCost([{ prompt: 5, completion: 5, cost: NaN }]), none);

// Price parsing: empty = unset; negative / non-numeric = error.
assert.deepEqual(parsePrice(""), { value: null });
assert.deepEqual(parsePrice("  "), { value: null });
assert.deepEqual(parsePrice(null), { value: null });
assert.deepEqual(parsePrice("0.27"), { value: 0.27 });
assert.deepEqual(parsePrice(0), { value: 0 });
for (const bad of ["-1", -0.01, "abc", "1e999", NaN, {}, true]) assert.equal(parsePrice(bad).error, true, String(bad));
assert.deepEqual(normalizePrices({ inputPerM: "1.5", outputPerM: "x" }), { inputPerM: 1.5, outputPerM: null });
assert.equal(hasPrices({}), false);
assert.equal(hasPrices({ outputPerM: 0 }), true);

// Formatting and rounding edges.
assert.equal(formatCost(0.0042), "$0.0042");
assert.equal(formatCost(0.00004), "<$0.0001");
assert.equal(formatCost(0.0001), "$0.0001");
assert.equal(formatCost(0.00996), "$0.01", "rounds across the $0.01 boundary without a 4-decimal $0.0100");
assert.equal(formatCost(0.01), "$0.01");
assert.equal(formatCost(1.234), "$1.23");
assert.equal(formatCost(12), "$12.00");
assert.equal(formatCost(0), "$0.00");
for (const bad of [null, undefined, NaN, -1, "x"]) assert.equal(formatCost(bad), null, String(bad));

// Provider usage.cost survives normalizeUsage; absent or bad cost stays absent.
assert.equal(normalizeUsage({ prompt_tokens: 1, completion_tokens: 2, cost: 0.0003 }).cost, 0.0003);
assert.equal("cost" in normalizeUsage({ prompt_tokens: 1, completion_tokens: 2 }), false);
assert.equal("cost" in normalizeUsage({ prompt_tokens: 1, completion_tokens: 2, cost: -1 }), false);

// T1 #1: total-only usage (no prompt/completion split) is unpriceable, never a manual $0.
assert.deepEqual(runCost([{ prompt: 0, completion: 0, total: 500 }], { inputPerM: 1, outputPerM: 1 }), none);
r = runCost([{ prompt: 0, completion: 0, total: 500 }, { prompt: 1_000_000, completion: 0, cost: 0.5 }], { inputPerM: 1, outputPerM: 1 });
close(r.amount, 0.5); assert.equal(r.partial, true);

// T1 #2: manual pricing that prices no tokens yields no amount, not "$0.00".
assert.deepEqual(runCost([{ prompt: 0, completion: 1_000_000 }], { inputPerM: 1 }), none);

// T1 #4: blank/whitespace cost is absent, not $0.
for (const blank of ["", "  ", "\t"]) {
  assert.deepEqual(runCost([{ prompt: 1, completion: 1, cost: blank }]), none, JSON.stringify(blank));
  assert.equal(parseCost(blank), null);
}
assert.equal("cost" in normalizeUsage({ prompt_tokens: 1, completion_tokens: 1, cost: "" }), false);
assert.equal(normalizeJevUsage({ input_tokens: 5, cost: " " }).cost, null);

// Estimated branches keep the provider's cost (partial counts, and no counts at all).
assert.equal(normalizeUsage({ prompt_tokens: 7, cost: 0.002 }, { content: "abcd" }).cost, 0.002);
assert.equal(normalizeUsage({ cost: 0.003 }, { content: "abcd", system: "x", user: "y" }).cost, 0.003);
assert.equal(normalizeUsage({ total_tokens: 9, cost: 0.004 }, { content: "abcd" }).cost, 0.004);

// T1 #3 / combineUsage: priced attempt + unpriced attempt; manual prices cover the unpriced tokens.
const priced = { prompt: 10, completion: 20, total: 30, cost: 0.004, estimated: false };
const unpriced = { prompt: 1_000_000, completion: 500_000, total: 1_500_000, estimated: false };
const agg = combineUsage(priced, unpriced);
assert.equal(agg.unpricedPrompt, 1_000_000); assert.equal(agg.unpricedCompletion, 500_000);
assert.equal(agg.costMissing, undefined);
r = runCost([agg], { inputPerM: 2, outputPerM: 4 });
close(r.amount, 0.004 + 2 + 2); assert.equal(r.source, "mixed"); assert.equal(r.partial, false);
r = runCost([agg]);
close(r.amount, 0.004); assert.equal(r.partial, true, "no prices: the unpriced remainder makes it partial");
// Order does not matter, and plain usages stay plain when no cost is ever reported.
assert.deepEqual(combineUsage(unpriced, priced).unpricedPrompt, 1_000_000);
assert.deepEqual(combineUsage(unpriced, unpriced), { prompt: 2_000_000, completion: 1_000_000, total: 3_000_000, estimated: false });
// An unsplit unpriced attempt inside a priced aggregate is opaque: partial even with prices.
r = runCost([combineUsage(priced, { prompt: 0, completion: 0, total: 40 })], { inputPerM: 2, outputPerM: 4 });
assert.equal(r.partial, true);

// Jev tokens are never priced with chat prices, including in a merged (fallback) step.
const chat = { prompt: 1_000_000, completion: 0, total: 1_000_000, estimated: false };
const jev = { prompt: 3_000_000, completion: 1_000_000, total: 4_000_000, estimated: false };
const merged = combineUsage(chat, jev, { b: true });
r = runCost([merged], { inputPerM: 2, outputPerM: 4 });
close(r.amount, 2, "only the chat remainder is priced"); assert.equal(r.partial, true);
// Jev reported its cost, chat did not: Jev cost kept, chat remainder priced manually.
r = runCost([combineUsage(chat, { ...jev, cost: 0.01 }, { b: true })], { inputPerM: 2, outputPerM: 4 });
close(r.amount, 2.01); assert.equal(r.source, "mixed"); assert.equal(r.partial, false);
// Chat priced, Jev not: partial.
r = runCost([combineUsage({ ...chat, cost: 0.5 }, jev, { b: true })], { inputPerM: 2, outputPerM: 4 });
close(r.amount, 0.5); assert.equal(r.partial, true);

// Per-entry prices beat the default prices (a request is priced by the connection that made it).
r = runCost([
  { prompt: 1_000_000, completion: 0, prices: { inputPerM: 1 } },
  { prompt: 1_000_000, completion: 0, prices: { inputPerM: 10 } },
  { prompt: 1_000_000, completion: 0, prices: {} }
], { inputPerM: 999 });
close(r.amount, 11); assert.equal(r.partial, true, "an entry recorded without prices stays unpriced");

// T-COSTGAP
r = runCost([combineUsage({prompt:1e6,completion:0,total:1e6},{prompt:0,completion:0,total:5e6})], {inputPerM:1,outputPerM:1});
assert.equal(r.partial, true); close(r.amount, 1);
r = runCost([{prompt:100,completion:50,total:150}], {inputPerM:1,outputPerM:1});
// no remainder -> unchanged (partial false if priced)
assert.equal(r.partial, false);
assert.deepEqual(runCost([{prompt:0,completion:0,total:5}], {}), none);
console.log("cost.test.mjs: run-cost assertions passed");
