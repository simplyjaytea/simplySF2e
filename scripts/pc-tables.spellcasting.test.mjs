import assert from "node:assert/strict";
import { pcSpellcastingProfile, pcSpellSlots, pcSpellPlan, spontaneousSpellSlots } from "./pc-tables.mjs";

const klass = (name, slug, title, remaster = true) => ({ name, system: { slug, publication: { title, remaster } } });
assert.deepEqual(pcSpellcastingProfile(klass("Bard", "bard", "Pathfinder Player Core")),
  { mode: "spontaneous", ability: "cha", tradition: "occult", baseSlots: 2 });
assert.deepEqual(pcSpellcastingProfile(klass("Sorcerer", "sorcerer", "Pathfinder Player Core 2")),
  { mode: "spontaneous", ability: "cha", tradition: null, baseSlots: 3 });
assert.deepEqual(pcSpellcastingProfile(klass("Wizard", "wizard", "Pathfinder Player Core")),
  { mode: "prepared", ability: "int", tradition: "arcane", baseSlots: 2 });
assert.equal(pcSpellcastingProfile(klass("Oracle", "oracle", "Advanced Player's Guide")), null);
assert.equal(pcSpellcastingProfile(klass("Oracle", "oracle", "Pathfinder Player Core 2", false)), null);
assert.equal(pcSpellcastingProfile(klass("Magus", "magus", "Pathfinder Player Core 2")), null);

const bard = pcSpellcastingProfile(klass("Bard", "bard", "Pathfinder Player Core"));
const sorcerer = pcSpellcastingProfile(klass("Sorcerer", "sorcerer", "Pathfinder Player Core 2"));
assert.deepEqual(pcSpellSlots(1, bard), { 0: 5, 1: 2, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 });
assert.equal(pcSpellSlots(2, bard)[1], 3);
assert.equal(pcSpellSlots(5, sorcerer)[3], 3);
assert.equal(pcSpellSlots(6, sorcerer)[3], 4);
assert.equal(pcSpellSlots(19, bard)[10], 1);
assert.equal(pcSpellSlots(20, sorcerer)[10], 1);
assert.deepEqual(pcSpellSlots(5, null), spontaneousSpellSlots(5), "unsupported classes retain legacy fallback");
assert.deepEqual(pcSpellPlan(2, bard).signatureRanks, []);
assert.ok(pcSpellPlan(3, bard).signatureRanks.includes(2));
assert.equal(pcSpellPlan(19, bard).slots[10], 1);
assert.equal(pcSpellPlan(19, bard).picks[10], 2);
assert.deepEqual(pcSpellPlan(20, pcSpellcastingProfile(klass("Wizard", "wizard", "Pathfinder Player Core"))).signatureRanks, []);

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
console.log("pc spellcasting profiles and slots: all assertions passed");
