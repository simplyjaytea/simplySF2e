// Encounter treasure split: the whole encounter budget is divided across the
// groups that carry loot; a lootless group gets 0 and frees its share.
// Run: node scripts/creature-pipeline.encounter.test.mjs
import assert from "node:assert/strict";
import { generateEncounter } from "./creature-pipeline.mjs";
import { treasureBudget } from "./tables.mjs";

const unexpected = (name) => async () => { throw new Error(`unexpected AI call: ${name}`); };
const COIN_LOOT = [{ name: "100 credits", quantity: 1 }];

async function run(lootByGroup, counts = lootByGroup.map(() => 1)) {
  const drafts = lootByGroup.map((has, i) => ({
    name: `Group ${i}`, level: 3, specialAbilities: [], feats: [], equipment: [], strikes: [],
    loot: has ? COIN_LOOT : []
  }));
  let n = 0;
  const ai = {
    designEncounter: async () => ({ name: "Test", briefs: lootByGroup.map((_, i) => `brief ${i}`), usage: null }),
    generateConcept: async ({ prompt }) => {
      const i = Number(/brief (\d+)/.exec(prompt)[1]);
      n++;
      return { concept: drafts[i], usage: null };
    },
    chooseSpellFocus: unexpected("chooseSpellFocus"), selectSpells: unexpected("selectSpells"),
    selectCreatureAbilities: unexpected("selectCreatureAbilities"), selectCreatureFeats: unexpected("selectCreatureFeats"),
    selectEquipment: unexpected("selectEquipment"), selectLoot: unexpected("selectLoot")
  };
  const composition = {
    budget: 100, spent: 100,
    members: lootByGroup.map((_, i) => ({ role: i === 0 ? "boss" : "minion", level: 3, count: counts[i], xpEach: 20 }))
  };
  const enc = await generateEncounter({
    composition, theme: "t", partyLevel: 3, rarity: "common", allowSpellcasting: false,
    treasureAmount: "standard", ai
  });
  assert.equal(n, lootByGroup.length, "every group was drafted");
  return enc;
}

const FULL = treasureBudget(3, "common", "standard");
assert.ok(FULL > 0);

// boss with loot + two lootless groups: the boss carries the whole budget
let enc = await run([true, false, false]);
assert.equal(enc.members[0].treasureGroupBudget, FULL, "the only loot group gets the full encounter budget");
assert.equal(enc.members[1].treasureGroupBudget, 0);
assert.equal(enc.members[2].treasureGroupBudget, 0);
assert.equal(enc.treasureBudget, FULL, "the reported encounter budget matches the GM Core total");

// two loot groups + one lootless: half each
enc = await run([true, true, false]);
assert.equal(enc.members[0].treasureGroupBudget, FULL / 2);
assert.equal(enc.members[1].treasureGroupBudget, FULL / 2);
assert.equal(enc.members[2].treasureGroupBudget, 0);
assert.equal(enc.treasureBudget, FULL);

// copies change only the per-copy split, not the group's share
enc = await run([true, false], [3, 1]);
assert.equal(enc.members[0].treasureGroupBudget, FULL);
assert.equal(enc.members[0].treasureBudgetEach, FULL / 3);
assert.equal(enc.treasureBudget, FULL);

// no group with loot: everything 0, no NaN
enc = await run([false, false]);
assert.deepEqual(enc.members.map((m) => m.treasureGroupBudget), [0, 0]);
assert.equal(enc.treasureBudget, 0);

// every group with loot: unchanged from the old even split (pin)
enc = await run([true, true, true]);
for (const m of enc.members) assert.equal(m.treasureGroupBudget, FULL / 3);
assert.ok(Math.abs(enc.treasureBudget - FULL) < 1e-9);

console.log("creature-pipeline.encounter.test.mjs: treasure splits across loot groups only");
