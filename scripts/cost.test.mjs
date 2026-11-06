// Run-cost helpers: provider/manual/mixed/partial pricing and formatting.
// Run: node scripts/cost.test.mjs
import assert from "node:assert/strict";
import { formatCost, hasPrices, normalizePrices, parsePrice, runCost } from "./cost.mjs";
import { normalizeUsage } from "./tokens.mjs";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);
const none = { amount: null, partial: false, source: null };

// No usages / no cost / no prices: nothing, never a fake $0.
assert.deepEqual(runCost([], {}), none);
assert.deepEqual(runCost(undefined), none);

// Provider only: sums every request, including a zero-cost free model.
let r = runCost([{ prompt: 100, completion: 50, cost: 0.001 }, { prompt: 10, completion: 5, cost: 0.0002 }]);
close(r.amount, 0.0012); assert.equal(r.source, "provider"); assert.equal(r.partial, false);
r = runCost([{ prompt: 5, completion: 5, cost: 0 }]);
assert.deepEqual(r, { amount: 0, partial: false, source: "provider" });

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
close(r.amount, 0.01); assert.equal(r.partial, true); assert.equal(r.source, "provider");
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

console.log("cost.test.mjs: run-cost assertions passed");
