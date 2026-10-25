import assert from "node:assert/strict";
import { REMASTER_SPELLCASTERS, pcSpellcastingProfile, pcSpellSlots, pcSpellPlan, spontaneousSpellSlots } from "./pc-tables.mjs";

const klass = (name, slug, title, remaster = true) => ({ name, system: { slug, publication: { title, remaster } } });
// PF2e Remaster casters never qualify: sf2e class documents are Compendium.sf2e.* and never carry these titles.
assert.equal(pcSpellcastingProfile(klass("Bard", "bard", "Pathfinder Player Core")), null);
assert.equal(pcSpellcastingProfile(klass("Sorcerer", "sorcerer", "Pathfinder Player Core 2")), null);
assert.equal(pcSpellcastingProfile(klass("Wizard", "wizard", "Pathfinder Player Core")), null);
assert.equal(pcSpellcastingProfile(klass("Oracle", "oracle", "Advanced Player's Guide")), null);
assert.equal(pcSpellcastingProfile(klass("Oracle", "oracle", "Pathfinder Player Core 2", false)), null);
assert.equal(pcSpellcastingProfile(klass("Magus", "magus", "Pathfinder Player Core 2")), null);
assert.deepEqual(pcSpellSlots(5, null), spontaneousSpellSlots(5), "unsupported classes retain legacy fallback");
assert.deepEqual(REMASTER_SPELLCASTERS.map((caster) => caster.slug), ["mystic", "witchwarper", "technomancer"],
  "the caster table holds exactly the sf2e casters");
assert.ok(REMASTER_SPELLCASTERS.every((caster) => ["Starfinder Player Core", "Starfinder Tech Core"].includes(caster.title)),
  "every caster row is cited to an sf2e publication");

// SF2e v14-dev packs/sf2e/classes/{mystic,witchwarper}.json: slug null,
// publication { title: "Starfinder Player Core", remaster: true }.
const mystic = pcSpellcastingProfile(klass("Mystic", null, "Starfinder Player Core"));
const witchwarper = pcSpellcastingProfile(klass("Witchwarper", null, "Starfinder Player Core"));
assert.deepEqual(mystic, { mode: "spontaneous", ability: "wis", tradition: null, baseSlots: 3 });
assert.deepEqual(witchwarper, { mode: "spontaneous", ability: null, tradition: null, baseSlots: 3 },
  "witchwarper casts with its chosen key attribute (cha or int)");
assert.deepEqual(pcSpellcastingProfile(klass("Mystic", "mystic", "Starfinder Player Core")), mystic);
assert.equal(pcSpellcastingProfile(klass("Mystic", null, "Pathfinder Player Core")), null);
assert.equal(pcSpellcastingProfile(klass("Witchwarper", null, "Starfinder Player Core", false)), null);
assert.equal(pcSpellcastingProfile(klass("Soldier", null, "Starfinder Player Core")), null);

// Mystic and Witchwarper Spells per Day, v14-dev packs/sf2e/journals/classes.json.
const sf2eSpellsPerDay = (lv) => {
  const top = Math.ceil(lv / 2);
  const row = { 0: 5 };
  for (let rank = 1; rank <= 10; rank++) row[rank] = rank === 10 ? (lv >= 19 ? 1 : 0) : rank > top ? 0 : rank === top && lv % 2 ? 3 : 4;
  return row;
};
for (let lv = 1; lv <= 20; lv++) {
  assert.deepEqual(pcSpellSlots(lv, mystic), sf2eSpellsPerDay(lv), `mystic level ${lv}`);
  assert.deepEqual(pcSpellSlots(lv, witchwarper), sf2eSpellsPerDay(lv), `witchwarper level ${lv}`);
}
assert.deepEqual(pcSpellSlots(1, mystic), { 0: 5, 1: 3, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 });
assert.deepEqual(pcSpellSlots(18, witchwarper), { 0: 5, 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 0 });
assert.deepEqual(pcSpellPlan(2, mystic).signatureRanks, []);
assert.deepEqual(pcSpellPlan(3, witchwarper).signatureRanks, [1, 2]);
for (const profile of [mystic, witchwarper]) {
  const plan = pcSpellPlan(19, profile);
  assert.equal(plan.slots[10], 1, "Transcendence / Quantum Thesis grant one 10th-rank slot");
  assert.equal(plan.picks[10], 2, "Transcendence / Quantum Thesis add two 10th-rank spells");
  assert.ok(plan.signatureRanks.includes(10));
}
// sf2e-1.6.1 packs/sf2e/classes/technomancer.json: Starfinder Tech Core, key Int.
const technomancer = pcSpellcastingProfile(klass("Technomancer", null, "Starfinder Tech Core"));
assert.deepEqual(technomancer, { mode: "prepared", ability: "int", tradition: "arcane", baseSlots: 2 });
assert.deepEqual(pcSpellcastingProfile(klass("Technomancer", "technomancer", "Starfinder Tech Core")), technomancer);
assert.equal(pcSpellcastingProfile(klass("Technomancer", null, "Starfinder Player Core")), null, "wrong publication does not qualify");
assert.equal(pcSpellcastingProfile(klass("Technomancer", null, "Starfinder Tech Core", false)), null);
assert.equal(pcSpellcastingProfile(klass("Mechanic", null, "Starfinder Tech Core")), null, "Mechanic does not cast");
// "prepare up to two 1st-rank spells and five cantrips"
assert.deepEqual(pcSpellSlots(1, technomancer), { 0: 5, 1: 2, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 });
assert.deepEqual(pcSpellSlots(5, technomancer), { 0: 5, 1: 3, 2: 3, 3: 2, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 });
assert.deepEqual(pcSpellSlots(19, technomancer), { 0: 5, 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 1 });
for (const lv of [1, 5, 19]) {
  const plan = pcSpellPlan(lv, technomancer);
  assert.deepEqual(plan.picks, plan.slots, `technomancer prepares exactly its slots at level ${lv}`);
  assert.deepEqual(plan.signatureRanks, [], "prepared casters have no signature spells");
}
// Spell Cache exists for ranks 1-9 only (each programming language), so levels 19-20 add no 10th-rank cache spell.
for (const lv of [19, 20]) {
  const { database } = pcSpellPlan(lv, technomancer);
  assert.deepEqual(database.cacheRanks, [1, 2, 3, 4, 5, 6, 7, 8, 9], `technomancer level ${lv} caches ranks 1-9`);
  assert.equal(database.size, 10 + 5 + 2 * (lv - 1) + 9, `technomancer level ${lv} database holds 9 cache spells`);
}

console.log("pc spellcasting profiles and slots: all assertions passed");
