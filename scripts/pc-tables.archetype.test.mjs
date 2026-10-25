// Archetype caster slots, witchwarper key attribute and technomancer database sizes.
// Cited: sf2e-1.6.1 packs/sf2e/journals/archetypes.json ("Spellcasting Archetypes"),
// classes/vVobwIMADBAIsBUV (Technomancer Spellcasting), Mystic/Witchwarper/Technomancer dedications.
import assert from "node:assert/strict";
import {
  archetypeSpellSlots, pcSpellPlan, technomancerDatabasePlan, witchwarperArchetypeAbility, ARCHETYPE_CASTER_DEDICATIONS
} from "./pc-tables.mjs";

const slotsOf = (ranks) => Object.fromEntries(ranks.map((rank) => [rank, 1]));
const BASIC = { basic: true }, EXPERT = { expert: true }, MASTER = { master: true };
const ALL = { basic: true, expert: true, master: true };

// The dedication itself grants two cantrips and no ranked slot.
for (const lv of [2, 4, 6, 8, 12, 18, 20]) {
  assert.deepEqual(archetypeSpellSlots(lv, {}), { cantrips: 2, slots: {} }, `dedication alone at level ${lv}`);
}
// Basic: rank 1 at 4, rank 2 at 6, rank 3 at 8.
assert.deepEqual(archetypeSpellSlots(2, BASIC).slots, {}, "basic is not yet reached at level 2");
assert.deepEqual(archetypeSpellSlots(4, BASIC).slots, slotsOf([1]));
assert.deepEqual(archetypeSpellSlots(6, BASIC).slots, slotsOf([1, 2]));
assert.deepEqual(archetypeSpellSlots(8, BASIC).slots, slotsOf([1, 2, 3]));
assert.deepEqual(archetypeSpellSlots(20, BASIC).slots, slotsOf([1, 2, 3]), "basic stops at rank 3");
// Expert: rank 4 at 12, rank 5 at 14, rank 6 at 16. Nothing without the feat.
assert.deepEqual(archetypeSpellSlots(12, EXPERT).slots, slotsOf([4]));
assert.deepEqual(archetypeSpellSlots(18, EXPERT).slots, slotsOf([4, 5, 6]));
assert.deepEqual(archetypeSpellSlots(8, EXPERT).slots, {}, "expert grants nothing before level 12");
// Master: rank 7 at 18, rank 8 at 20.
assert.deepEqual(archetypeSpellSlots(18, MASTER).slots, slotsOf([7]));
assert.deepEqual(archetypeSpellSlots(20, MASTER).slots, slotsOf([7, 8]));
assert.deepEqual(archetypeSpellSlots(12, MASTER).slots, {}, "master grants nothing before level 18");
// Feats stack; each rank is one slot.
assert.deepEqual(archetypeSpellSlots(12, { basic: true, expert: true }).slots, slotsOf([1, 2, 3, 4]));
assert.deepEqual(archetypeSpellSlots(20, ALL).slots, slotsOf([1, 2, 3, 4, 5, 6, 7, 8]));
assert.deepEqual(archetypeSpellSlots(2, ALL).slots, {}, "all three feats grant nothing at level 2");
assert.deepEqual(archetypeSpellSlots(20, { basic: "yes", expert: 1, master: null }).slots, {}, "only literal true places a feat");

assert.equal(witchwarperArchetypeAbility({ int: 3, cha: 2 }), "int");
assert.equal(witchwarperArchetypeAbility({ int: 1, cha: 2 }), "cha");
assert.equal(witchwarperArchetypeAbility({ int: 2, cha: 2 }), "int", "a tie uses Intelligence");
assert.equal(witchwarperArchetypeAbility(null), null, "no projection, no guess");
assert.equal(witchwarperArchetypeAbility({ int: 2 }), null);

assert.deepEqual(ARCHETYPE_CASTER_DEDICATIONS["technomancer-dedication"], {
  mode: "prepared", ability: "int", abilities: null, tradition: "arcane", traditionFrom: null
});
assert.equal(ARCHETYPE_CASTER_DEDICATIONS["mystic-dedication"].ability, "wis");
assert.equal(ARCHETYPE_CASTER_DEDICATIONS["mystic-dedication"].tradition, null, "mystic tradition comes from the connection");
assert.deepEqual(ARCHETYPE_CASTER_DEDICATIONS["witchwarper-dedication"].abilities, ["int", "cha"]);

// Technomancer database: 10 cantrips + 5 rank-1 + 2 per level after 1st (any rank
// the PC has slots for) + one cache spell per rank gained (ranks 1..max rank).
const db1 = technomancerDatabasePlan(1);
assert.equal(db1.size, 16, "level 1: 10 cantrips + five rank-1 + one cache spell");
assert.deepEqual(db1.cacheRanks, [1]);
assert.deepEqual(db1.caps, { 0: 10, 1: 5 });
const db5 = technomancerDatabasePlan(5);
assert.equal(db5.levelUps, 8, "four level-ups after 1st, two spells each");
assert.equal(db5.maxRank, 3);
assert.deepEqual(db5.cacheRanks, [1, 2, 3]);
assert.equal(db5.size, 26, "10 + 5 + 8 + 3 cache spells");
assert.deepEqual(db5.caps, { 0: 10, 1: 13, 2: 6, 3: 2 }, "rank r picks are only possible from the level that reaches rank r");
const db10 = technomancerDatabasePlan(10);
assert.equal(db10.maxRank, 5);
assert.equal(db10.size, 38, "10 + 5 + 18 + 5 cache spells");
assert.deepEqual(db10.caps, { 0: 10, 1: 23, 2: 16, 3: 12, 4: 8, 5: 4 });
assert.equal(technomancerDatabasePlan(20).size, 63, "10 + 5 + 38 + 10 cache spells");
assert.equal(technomancerDatabasePlan(20).caps[10], 4, "rank-10 picks are possible at levels 19 and 20 only");
for (let lv = 1; lv <= 20; lv++) {
  const plan = technomancerDatabasePlan(lv);
  assert.equal(plan.caps[1], 5 + 2 * (lv - 1), `rank-1 cap at level ${lv}`);
  assert.equal(plan.cacheRanks.length, Math.ceil(lv / 2), `cache ranks at level ${lv}`);
}

// The prepared profile attaches the database; the prepared slots themselves are unchanged.
const technomancerProfile = { mode: "prepared", ability: "int", tradition: "arcane", baseSlots: 2 };
for (const lv of [1, 5, 10]) {
  const plan = pcSpellPlan(lv, technomancerProfile);
  assert.deepEqual(plan.database, technomancerDatabasePlan(lv));
  assert.deepEqual(plan.picks, plan.slots);
}
assert.equal(pcSpellPlan(5, { mode: "spontaneous", baseSlots: 3 }).database, undefined, "spontaneous casters have no database");

console.log("archetype slots, witchwarper ability and technomancer database sizes: all assertions passed");
