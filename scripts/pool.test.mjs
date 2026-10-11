// runPool: bounded concurrency, index-ordered results, stop on first failure.
// Run: node scripts/pool.test.mjs

import assert from "node:assert/strict";
import { runPool, ENCOUNTER_CONCURRENCY } from "./pool.mjs";

const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

assert.ok(ENCOUNTER_CONCURRENCY >= 1);

// Results keep index order even when later tasks finish first.
let running = 0;
let peak = 0;
const started = [];
const results = await runPool(6, 3, async (i) => {
  started.push(i);
  running++;
  peak = Math.max(peak, running);
  await tick(30 - i * 4);
  running--;
  return i * 10;
});
assert.deepEqual(results, [0, 10, 20, 30, 40, 50]);
assert.equal(peak, 3, "never more than the limit at once");
assert.deepEqual(started, [0, 1, 2, 3, 4, 5], "tasks start in index order");

// The first failure stops new starts, calls onError once, and is thrown.
const ran = [];
let aborts = 0;
await assert.rejects(
  runPool(6, 2, async (i) => {
    ran.push(i);
    await tick(5);
    if (i === 1) throw new Error("boom");
    if (i === 2) throw new Error("second");
    return i;
  }, { onError: () => aborts++ }),
  /boom/
);
assert.equal(aborts, 1);
assert.ok(!ran.includes(4) && !ran.includes(5), "no new task starts after a failure");

// Edge cases.
assert.deepEqual(await runPool(0, 3, async () => 1), []);
assert.deepEqual(await runPool(2, 0, async (i) => i), [0, 1], "a limit below 1 still runs one at a time");

console.log("pool.test.mjs: bounded, ordered, fail-fast");
