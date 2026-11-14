// Mixed usage must never read as a complete total: split + total-only in one
// request, or reasoning tokens counted in the total only. Every usage is built
// from a raw provider block through normalizeUsage (never a hand-written
// post-normalize object), then combineUsage where two requests are summed.
// Run: node scripts/cost.mixedUsage.test.mjs
import assert from "node:assert/strict";
import { combineUsage, reportedCost, runCost } from "./cost.mjs";
import { normalizeUsage } from "./tokens.mjs";

// Same request text production passes to the fallback estimator. Keeping it here
// means a wrong total-only shape would leak an estimated prompt into the cost.
const REQ = { content: '{"keywords":["fire"]}', system: "system prompt", user: "user prompt" };
const PRICES = { inputPerM: 1, outputPerM: 2 };
const FULL = { prompt_tokens: 1_000_000, completion_tokens: 500_000, total_tokens: 1_500_000 };
const norm = (block) => normalizeUsage(block, REQ);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

const cases = [];
const test = (name, fn) => cases.push([name, fn]);

test("known-good: full split prices exactly", () => {
  const u = norm(FULL);
  assert.equal(u.estimated, false);
  const r = runCost([u], PRICES);
  close(r.amount, 2); assert.equal(r.partial, false); assert.equal(r.source, "manual");
});

test("a: prompt + total, no completion -> estimated, provider total kept", () => {
  const u = norm({ prompt_tokens: FULL.prompt_tokens, total_tokens: FULL.total_tokens });
  assert.equal(u.estimated, true, "a one-sided split is estimated");
  assert.equal(u.total, 1_500_000, "the provider total is kept");
  assert.equal(u.prompt, 1_000_000, "the provider prompt is kept");
});

test("b: total only -> nothing priced, none shape (partial false by design)", () => {
  const u = norm({ total_tokens: 1_500_000 });
  assert.equal(u.prompt, 0); assert.equal(u.completion, 0); assert.equal(u.total, 1_500_000);
  assert.equal(u.estimated, false, "total-only is exact, not estimated");
  // Nothing priced at all: runCost returns the "none" shape (partial false by design,
  // pinned by cost.test.mjs). The app shows no cost line for a null amount.
  const r = runCost([u], PRICES);
  assert.deepEqual(r, { amount: null, partial: false, source: null }, "no fake $0, no source");
});

test("c: total only + OpenRouter cost > 0 -> provider covers it, not partial", () => {
  const u = norm({ total_tokens: 1_500_000, cost: 0.02 });
  assert.equal(reportedCost(u), 0.02);
  const r = runCost([u], PRICES);
  close(r.amount, 0.02); assert.equal(r.source, "provider"); assert.equal(r.partial, false);
});

test("d1: full split + total-only, no provider cost -> partial, split side priced", () => {
  const agg = combineUsage(norm(FULL), norm({ total_tokens: 500_000 }));
  assert.equal(agg.estimated, false);
  assert.equal(agg.total, 2_000_000);
  const r = runCost([agg], PRICES);
  close(r.amount, 2); assert.equal(r.partial, true, "the total-only remainder is unpriced");
});

test("d2: provider cost on the split side only -> partial", () => {
  const agg = combineUsage(norm({ ...FULL, cost: 0.01 }), norm({ total_tokens: 500_000 }));
  assert.equal(agg.costMissing, true, "the total-only side is flagged as cost-missing");
  const r = runCost([agg], PRICES);
  close(r.amount, 0.01); assert.equal(r.source, "provider"); assert.equal(r.partial, true);
});

test("e: prompt + completion < total (reasoning in total only) -> exact, partial", () => {
  const u = norm({ prompt_tokens: 1_000_000, completion_tokens: 500_000, total_tokens: 2_000_000 });
  assert.equal(u.estimated, false, "both sides are provider-reported");
  assert.equal(u.total, 2_000_000);
  const r = runCost([u], PRICES);
  close(r.amount, 2); assert.equal(r.partial, true, "the 500k unsplit reasoning tokens are unpriced");
});

test("f: combineUsage with one estimated side -> estimated", () => {
  const est = norm({ prompt_tokens: 1_000_000, total_tokens: 1_500_000 });
  assert.equal(est.estimated, true);
  assert.equal(combineUsage(est, norm(FULL)).estimated, true);
  assert.equal(combineUsage(norm(FULL), est).estimated, true);
});

test("g: cost 0 with tokens spent (BYOK) -> no reported cost, manual pricing applies", () => {
  const u = norm({ ...FULL, cost: 0 });
  assert.equal(reportedCost(u), null, "a zero cost with tokens is unknown, not free");
  const r = runCost([u], PRICES);
  close(r.amount, 2); assert.equal(r.source, "manual"); assert.equal(r.partial, false);
});

let failed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL - ${name}\n${err.message}`);
  }
}
if (failed) {
  console.error(`cost.mixedUsage.test.mjs: ${failed} case(s) failed`);
  process.exit(1);
}
console.log("cost.mixedUsage.test.mjs: mixed-usage assertions passed");
