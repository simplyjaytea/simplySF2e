// Pure "Use my party" summary checks. Run: node scripts/party.test.mjs
import assert from "node:assert/strict";
import { partySummary } from "./party.mjs";

const pc = (level) => ({ type: "character", level });

assert.equal(partySummary(null), null, "no party");
assert.equal(partySummary(undefined), null, "no party (undefined)");
assert.equal(partySummary({ name: "Empty", members: [] }), null, "empty party");
assert.equal(
  partySummary({ name: "Pets", members: [{ type: "familiar", level: 3 }, { type: "npc", level: 4 }] }),
  null,
  "no characters among familiar/npc members"
);

assert.deepEqual(
  partySummary({ name: "Drift", members: [pc(4), { type: "npc", level: 9 }, pc(6)] }),
  { name: "Drift", count: 2, size: 2, level: 5 },
  "mixed members count only characters"
);

assert.equal(partySummary({ name: "Odd", members: [pc(4), pc(5)] }).level, 5, "4.5 rounds up");
assert.equal(partySummary({ name: "Odd", members: [pc(3), pc(4)] }).level, 4, "3.5 rounds up");
assert.equal(partySummary({ name: "Low", members: [pc(3), pc(4), pc(4)] }).level, 4, "3.67 rounds to 4");

const big = partySummary({ name: "Big", members: Array.from({ length: 10 }, () => pc(2)) });
assert.equal(big.count, 10, "count is the true character count");
assert.equal(big.size, 8, "size clamped to 8");

assert.equal(partySummary({ name: "High", members: [pc(25), pc(22)] }).level, 20, "level clamped to 20");
assert.equal(partySummary({ name: "Zero", members: [pc(0), pc(-3)] }).level, 1, "level clamped to 1");

const ignored = partySummary({ name: "Mixed", members: [pc(NaN), pc("x"), pc(7), pc(undefined)] });
assert.deepEqual(ignored, { name: "Mixed", count: 4, size: 4, level: 7 }, "non-finite levels ignored");

assert.equal(partySummary({ name: "NoLevels", members: [pc(NaN), pc(null)] }), null, "all levels non-finite");

assert.equal(partySummary({ name: 42, members: [pc(2)] }).name, "42", "name coerced to string");

console.log("OK party");
