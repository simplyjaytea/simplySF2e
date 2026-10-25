import assert from "node:assert/strict";
import { pcSpellcastingProfile, pcSpellPlan } from "./pc-tables.mjs";

// Class publication metadata from sf2e v14-dev class documents (packs/sf2e/classes/).
// Feature texts: sf2e class-features/shared/signature-spells.json,
// mystic/transcendence.json and witchwarper/quantum-thesis.json.
const profile = (name, title) => pcSpellcastingProfile({ name, system: {
  slug: null, publication: { title, remaster: true }
} });
for (const [name, title] of [
  ["Mystic", "Starfinder Player Core"], ["Witchwarper", "Starfinder Player Core"]
]) {
  const caster = profile(name, title);
  for (const level of [1, 2]) assert.deepEqual(pcSpellPlan(level, caster).signatureRanks, [], `${name} before Signature Spells`);
  assert.deepEqual(pcSpellPlan(3, caster).signatureRanks, [1, 2]);
  assert.equal(pcSpellPlan(18, caster).picks[10], 0);
  for (const level of [19, 20]) {
    const plan = pcSpellPlan(level, caster);
    assert.equal(plan.slots[10], 1);
    assert.equal(plan.picks[10], 2, `${name} learns two rank-ten spells, not one`);
    assert.deepEqual(plan.signatureRanks, Array.from({ length: 10 }, (_, i) => i + 1));
    assert.equal(plan.picks[0], 5);
    plan.picks[1] = 99;
    assert.notEqual(plan.slots[1], 99, "repertoire capacity cannot mutate native slot capacity");
  }
}
const technomancer = profile("Technomancer", "Starfinder Tech Core");
const preparedPlan = pcSpellPlan(20, technomancer);
assert.deepEqual(preparedPlan.signatureRanks, []);
assert.deepEqual(preparedPlan.picks, preparedPlan.slots, "ordinary prepared picks are daily slots, not a repertoire");
const unknown = pcSpellPlan(20, null);
assert.equal(unknown.picks[10], 1, "legacy approximation is not silently granted a qualified class feature");
assert.deepEqual(unknown.signatureRanks, []);
console.log("PC spell plan: repertoire/slot separation and ordinary signature eligibility passed");
