import assert from "node:assert/strict";
import { beginRunBudget, endRunBudget, getRunBudget, inheritRunBudget, spendRunTokens, remainingRunTokens, remainingDeadlineMs, runBudgetProblem } from "./run-budget.mjs";

let sig = {};
beginRunBudget(sig, { tokenBudget: 10, deadlineMs: 0, now: () => Date.now() });
assert.equal(getRunBudget(sig).tokensSpent, 0);
spendRunTokens(sig, { total: 3 });
assert.equal(runBudgetProblem(sig), null);
spendRunTokens(sig, { total: 10 });
assert.equal(runBudgetProblem(sig), "budget");

// no entry
assert.equal(runBudgetProblem({}), null);
// deadline
let s2 = {};
beginRunBudget(s2, { tokenBudget: 100, deadlineMs: 1, now: () => 0 });
// wait
const realNow = Date.now;
// simulate by startedAt? Use injected now already 0, Date.now now large
assert.equal(runBudgetProblem(s2), "deadline");

// inherit
let parent = {};
beginRunBudget(parent, { tokenBudget: 10, deadlineMs: 0, now: () => 0 });
let child = {};
inheritRunBudget(parent, child);
spendRunTokens(child, { total: 4 });
assert.equal(getRunBudget(parent).tokensSpent, 4);
// no-op without parent
inheritRunBudget({}, {});
// end
endRunBudget(parent);
assert.equal(getRunBudget(parent), null);
// disable limits
let s3 = {};
beginRunBudget(s3, { tokenBudget: 0, deadlineMs: NaN, now: () => 0 });
assert.equal(remainingRunTokens(s3), null);
assert.equal(remainingDeadlineMs(s3), null);
// spend ignores bad
spendRunTokens(s3, { total: NaN });
spendRunTokens(s3, { total: -1 });
spendRunTokens(s3, null);
// missing signal
assert.equal(beginRunBudget(null, {}), null);
console.log("ok");
