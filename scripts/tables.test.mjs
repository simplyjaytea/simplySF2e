// Fallback chains and edge rows in tables.mjs that live QA cannot reach from
// this machine: lookup() scale fallbacks, averageDamage() parsing,
// treasureBudget() extrapolated edge rows, and identificationDC() rarity
// mapping. Also pins the spontaneousSpellSlots() generic fallback
// (pc-tables.mjs) to pcSpellSlots(level, null) so the legacy approximation
// cannot drift silently. Run: node scripts/tables.test.mjs

import assert from "node:assert/strict";
import {
  ABILITY_MODIFIER, AC, SKILL, LEVEL_DC, lookup, averageDamage,
  treasureBudget, identificationDC
} from "./tables.mjs";
import { spontaneousSpellSlots, pcSpellSlots } from "./pc-tables.mjs";

/* ---------------------------------------------------------------------- *
 * lookup(): requested scale, then fallbacks, then the first column
 * ---------------------------------------------------------------------- */

assert.equal(
  lookup(ABILITY_MODIFIER, -1, "extreme"), 3,
  "extreme ability is null below level 1, so level -1 falls back to high"
);
assert.equal(
  lookup(ABILITY_MODIFIER, 0, "extreme"), 3,
  "extreme ability is null at level 0, so it falls back to high"
);
assert.equal(
  lookup(ABILITY_MODIFIER, 5, "extreme"), 6,
  "a present scale never consults the fallback chain"
);
assert.equal(
  lookup(SKILL, 5, "terrible"), 13,
  "SKILL has no terrible column, so the default chain lands on high"
);
assert.equal(
  lookup(ABILITY_MODIFIER, 5, "terrible", ["low"]), 2,
  "an explicit fallback chain is honored before the first-column default"
);
assert.equal(
  lookup(ABILITY_MODIFIER, 5, "nope", []), 6,
  "an empty chain with an unknown scale returns the first column, not undefined"
);
assert.equal(
  lookup(AC, 99, "moderate"), 50,
  "levels above 24 clamp to the level-24 row"
);
assert.equal(
  lookup(AC, -99, "moderate"), 14,
  "levels below -1 clamp to the level -1 row"
);

/* ---------------------------------------------------------------------- *
 * averageDamage(): dice formulas for preview display
 * ---------------------------------------------------------------------- */

assert.equal(averageDamage("2d8+9"), 18);
assert.equal(averageDamage("1d6+1"), 4);
assert.equal(averageDamage("2d8 + 9"), 18, "surrounding spaces are ignored");
assert.equal(averageDamage("1d6-1"), 2, "negative modifiers subtract");
assert.equal(averageDamage("hello"), null, "non-formulas return null, never NaN");
assert.equal(averageDamage("d6"), null, "a missing die count is not a formula");
assert.equal(averageDamage(""), null, "an empty string is not a formula");

/* ---------------------------------------------------------------------- *
 * treasureBudget(): extrapolated -1/0 and 21-24 rows plus fail-closed
 * multipliers. L1-20 totals are cited SF2e data; these edges pin the
 * extrapolation shape (level 0 ~= half of level 1, ~1.45x past level 20).
 * ---------------------------------------------------------------------- */

assert.equal(treasureBudget(-1), 4, "level -1 ~= half of the level-0 share");
assert.equal(treasureBudget(0), 7, "level 0 ~= half of the level-1 share");
assert.equal(treasureBudget(1), 14, "level-1 anchor for the edge ratios above");
assert.equal(treasureBudget(21), 56800, "post-20 curve continues at ~1.45x");
assert.equal(treasureBudget(24), 176000, "top extrapolated row");
assert.equal(
  treasureBudget(5, "fancy", "lavish"), treasureBudget(5),
  "unknown rarity/amount multipliers fail closed to x1"
);
assert.equal(
  treasureBudget(5, "rare", "generous"), 405,
  "rarity and amount multipliers compose on the edge-shaped base"
);

/* ---------------------------------------------------------------------- *
 * identificationDC(): level DC plus the cited rarity adjustment
 * ---------------------------------------------------------------------- */

assert.equal(identificationDC(1), 15, "level-1 common baseline");
assert.equal(identificationDC(1, "uncommon"), 17, "uncommon is +2");
assert.equal(identificationDC(5, "rare"), 25, "rare is +5");
assert.equal(identificationDC(5, "unique"), 30, "unique is +10");
assert.equal(
  identificationDC(5, "fancy"), identificationDC(5),
  "an unknown rarity adds +0 instead of NaN"
);

/* ---------------------------------------------------------------------- *
 * pc-tables.mjs generic fallback: unsupported classes keep the old 2-slot
 * approximation via pcSpellSlots(level, null)
 * ---------------------------------------------------------------------- */

assert.deepEqual(
  spontaneousSpellSlots(5), pcSpellSlots(5, null),
  "the legacy spontaneous fallback stays glued to pcSpellSlots(level, null)"
);

console.log("tables.test.mjs: lookup chains, averageDamage, treasure edges, identificationDC, and spell fallback passed");
