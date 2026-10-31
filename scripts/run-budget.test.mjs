// Pure run-budget registry behavior. No Foundry globals, no network, no real
// clock: every case drives `now` explicitly so deadlines are deterministic.
// Run: node scripts/run-budget.test.mjs
import assert from "node:assert/strict";
import {
  beginRunBudget, endRunBudget, getRunBudget, inheritRunBudget, spendRunTokens,
  remainingRunTokens, remainingDeadlineMs, runBudgetProblem
} from "./run-budget.mjs";

const signal = () => new AbortController().signal;

// No entry anywhere means nothing is enforced and nothing is tracked.
assert.equal(runBudgetProblem(signal()), null);
assert.equal(remainingRunTokens(signal()), null);
assert.equal(remainingDeadlineMs(signal()), null);

// A token budget accumulates and fails closed once it is spent.
{
  const sig = signal();
  beginRunBudget(sig, { tokenBudget: 10, deadlineMs: 0, now: () => 1000 });
  assert.equal(getRunBudget(sig).tokensSpent, 0);
  spendRunTokens(sig, { total: 3 });
  assert.equal(remainingRunTokens(sig), 7);
  assert.equal(runBudgetProblem(sig), null);
  spendRunTokens(sig, { total: 7 });
  assert.equal(remainingRunTokens(sig), 0);
  assert.equal(runBudgetProblem(sig), "budget");
  // Spending past the limit never makes the remaining count negative.
  spendRunTokens(sig, { total: 5 });
  assert.equal(remainingRunTokens(sig), 0);
  endRunBudget(sig);
  assert.equal(getRunBudget(sig), null);
}

// Bad usage is ignored rather than turning the total into NaN.
{
  const sig = signal();
  beginRunBudget(sig, { tokenBudget: 10, deadlineMs: 0, now: () => 0 });
  for (const usage of [null, undefined, {}, { total: NaN }, { total: -1 }, { total: "5" }]) {
    spendRunTokens(sig, usage);
  }
  assert.equal(getRunBudget(sig).tokensSpent, 0);
}

// The deadline is measured from startedAt with the injected clock.
{
  let now = 10000;
  const sig = signal();
  beginRunBudget(sig, { tokenBudget: 0, deadlineMs: 5000, now: () => now });
  assert.equal(remainingDeadlineMs(sig), 5000);
  assert.equal(runBudgetProblem(sig), null);
  now = 14999;
  assert.equal(remainingDeadlineMs(sig), 1);
  assert.equal(runBudgetProblem(sig), null);
  now = 15000;
  assert.equal(remainingDeadlineMs(sig), 0);
  assert.equal(runBudgetProblem(sig), "deadline");
  // Clamps at zero instead of going negative.
  now = 99000;
  assert.equal(remainingDeadlineMs(sig), 0);
}

// The deadline outranks the budget when both are exceeded.
{
  let now = 0;
  const sig = signal();
  beginRunBudget(sig, { tokenBudget: 1, deadlineMs: 1, now: () => now });
  spendRunTokens(sig, { total: 5 });
  now = 2;
  assert.equal(runBudgetProblem(sig), "deadline");
}

// A disabled limit never fires, even with tokens spent.
{
  const sig = signal();
  beginRunBudget(sig, { tokenBudget: 0, deadlineMs: NaN, now: () => 0 });
  spendRunTokens(sig, { total: 999999 });
  assert.equal(remainingRunTokens(sig), null);
  assert.equal(remainingDeadlineMs(sig), null);
  assert.equal(runBudgetProblem(sig), null);
}

// An encounter member inherits the run's entry, so spend and deadline are shared.
{
  const parent = signal();
  const member = signal();
  beginRunBudget(parent, { tokenBudget: 10, deadlineMs: 60000, now: () => 0 });
  inheritRunBudget(parent, member);
  spendRunTokens(member, { total: 4 });
  assert.equal(getRunBudget(parent).tokensSpent, 4);
  assert.equal(remainingDeadlineMs(member), 60000);
  spendRunTokens(parent, { total: 6 });
  assert.equal(runBudgetProblem(member), "budget");
  // Ending the parent run does not clear an inherited member entry.
  endRunBudget(parent);
  assert.equal(getRunBudget(member).tokensSpent, 10);
  endRunBudget(member);
}

// Inheritance is a no-op without a parent entry or without a derived signal.
{
  const derived = signal();
  inheritRunBudget(signal(), derived);
  assert.equal(getRunBudget(derived), null);
  inheritRunBudget(null, derived);
  assert.equal(getRunBudget(derived), null);
}

// A missing signal is a no-op everywhere.
assert.equal(beginRunBudget(null, { tokenBudget: 1 }), null);
endRunBudget(null);
assert.equal(getRunBudget(undefined), null);
spendRunTokens(undefined, { total: 1 });
assert.equal(runBudgetProblem(undefined), null);

console.log("run-budget.test.mjs passed");
