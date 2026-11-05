// Area Damage table (GM Core pg. 128): cited rows checked against an inline
// copy of the printed table, so a typo in either place fails.
// Run: node scripts/area-damage.test.mjs
import assert from "node:assert/strict";
import { AREA_DAMAGE, AREA_DAMAGE_AVERAGE, lookup } from "./tables.mjs";

// Printed table: Level | Unlimited Use | Limited Use (dice and GM Core's average).
const PRINTED = `
-1 | 1d4 (2) | 1d6 (4)
0 | 1d6 (4) | 1d10 (6)
1 | 2d4 (5) | 2d6 (7)
2 | 2d6 (7) | 3d6 (11)
3 | 2d8 (9) | 4d6 (14)
4 | 3d6 (11) | 5d6 (18)
5 | 2d10 (12) | 6d6 (21)
6 | 4d6 (14) | 7d6 (25)
7 | 4d6 (15) | 8d6 (28)
8 | 5d6 (17) | 9d6 (32)
9 | 5d6 (18) | 10d6 (35)
10 | 6d6 (20) | 11d6 (39)
11 | 6d6 (21) | 12d6 (42)
12 | 5d8 (23) | 13d6 (46)
13 | 7d6 (24) | 14d6 (49)
14 | 4d12 (26) | 15d6 (53)
15 | 6d8 (27) | 16d6 (56)
16 | 8d6 (28) | 17d6 (60)
17 | 8d6 (29) | 18d6 (63)
18 | 9d6 (30) | 19d6 (67)
19 | 7d8 (32) | 20d6 (70)
20 | 6d10 (33) | 21d6 (74)
21 | 10d6 (35) | 22d6 (77)
22 | 8d8 (36) | 23d6 (81)
23 | 11d6 (38) | 24d6 (84)
24 | 11d6 (39) | 25d6 (88)
`.trim().split("\n").map((line) => {
  const m = /^(-?\d+) \| (\S+) \((\d+)\) \| (\S+) \((\d+)\)$/.exec(line.trim());
  assert.ok(m, `inline row parses: ${line}`);
  return { level: Number(m[1]), unlimited: m[2], unlimitedAvg: Number(m[3]), limited: m[4], limitedAvg: Number(m[5]) };
});

assert.equal(PRINTED.length, 26, "inline table has 26 levels");
assert.equal(AREA_DAMAGE.unlimited.length, 26, "unlimited dice: 26 entries");
assert.equal(AREA_DAMAGE.limited.length, 26, "limited dice: 26 entries");
assert.equal(AREA_DAMAGE_AVERAGE.unlimited.length, 26, "unlimited averages: 26 entries");
assert.equal(AREA_DAMAGE_AVERAGE.limited.length, 26, "limited averages: 26 entries");

// Every row, both columns, dice and printed average.
PRINTED.forEach((row, i) => {
  const at = `level ${row.level}`;
  assert.equal(AREA_DAMAGE.unlimited[i], row.unlimited, `${at} unlimited dice`);
  assert.equal(AREA_DAMAGE_AVERAGE.unlimited[i], row.unlimitedAvg, `${at} unlimited average`);
  assert.equal(AREA_DAMAGE.limited[i], row.limited, `${at} limited dice`);
  assert.equal(AREA_DAMAGE_AVERAGE.limited[i], row.limitedAvg, `${at} limited average`);
});

// Lookup by level (index 0 = level -1), limited column, no fallback to other columns.
assert.equal(lookup(AREA_DAMAGE, -1, "limited", []), "1d6");
assert.equal(lookup(AREA_DAMAGE, 0, "limited", []), "1d10");
assert.equal(lookup(AREA_DAMAGE, 12, "limited", []), "13d6");
assert.equal(lookup(AREA_DAMAGE, 24, "limited", []), "25d6");
assert.equal(lookup(AREA_DAMAGE_AVERAGE, 12, "limited", []), 46);
assert.equal(lookup(AREA_DAMAGE_AVERAGE, 7, "unlimited", []), 15, "printed average kept, not the plain 4d6 average");

// A limited-use area ability hits harder than an unlimited one at every level.
for (let i = 0; i < 26; i += 1) {
  assert.ok(AREA_DAMAGE_AVERAGE.limited[i] >= AREA_DAMAGE_AVERAGE.unlimited[i], `level ${i - 1}: limited >= unlimited average`);
}

console.log("area-damage.test.mjs: ok");
