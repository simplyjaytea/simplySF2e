import assert from "node:assert/strict";
import { assertComplete, completionManifest, completionSummary } from "./completion.mjs";

const entry = { packId: "pf2e.test", _id: "a" };
const creature = completionManifest({ mode: "monster", concept: {}, resolved: {
  abilities: [{ ability: { name: "Howl", narrative: true }, entry: null }], spells: [{ spell: { name: "Fear" }, entry }],
  focusSpells: [], feats: [], equipment: [{ name: "Spear", entry }],
  loot: [{ name: "10 gold coins" }, { name: "Credits" }, { name: "Scroll of Fear", scroll: { rank: 1 }, entry }]
} });
assert.equal(creature.complete, true, "custom narrative abilities and module-built coins/scrolls are valid completion states");
assert.equal(creature.records.find((r) => r.category === "ability").status, "custom-narrative");

const unresolvedAbility = completionManifest({ mode: "monster", concept: {}, resolved: {
  abilities: [{ ability: { name: "Unresolved Glossary Ability" }, entry: null }], spells: [], focusSpells: [], feats: [], equipment: [], loot: []
} });
assert.equal(unresolvedAbility.complete, false, "only explicitly narrative abilities may bypass a missing compendium action");

const incomplete = completionManifest({ mode: "npc", concept: {}, resolved: {
  equipment: [{ name: "Imaginary Sword", entry: null }], loot: [], spells: [], focusSpells: [], feats: []
} });
assert.equal(incomplete.complete, false);
assert.throws(() => assertComplete(incomplete), /Imaginary Sword/);

const skippedGear = completionManifest({ mode: "npc", concept: {}, resolved: {
  equipment: [], loot: [], spells: [], focusSpells: [], feats: [],
  skippedGear: [{ category: "equipment", name: "rusted dagger", quantity: 1 }]
} });
assert.equal(skippedGear.complete, true, "gear the exact resolver skipped never blocks creation");
assert.deepEqual(skippedGear.records, [{ category: "equipment", name: "rusted dagger", status: "skipped", required: false }]);

const pc = completionManifest({ mode: "character", concept: { heritage: "Versatile Heritage" }, resolved: {
  ancestryDoc: { name: "Human" }, backgroundDoc: { name: "Warrior" }, classDoc: { name: "Fighter" }, heritageDoc: null,
  spells: [], focusSpells: [], feats: [], equipment: [], loot: []
} });
assert.equal(pc.unresolved[0].category, "heritage");

const emptySpellPlan = completionManifest({ mode: "character", concept: {
  spellcasting: { plannedPicks: { 0: 5, 1: 2 } }
}, resolved: {
  ancestryDoc: { name: "Human" }, backgroundDoc: { name: "Scholar" }, classDoc: { name: "Wizard" },
  spells: [], focusSpells: [], feats: [], equipment: [], loot: []
} });
assert.equal(emptySpellPlan.unresolved.filter((record) => record.category === "spell").length, 7,
  "every missing module-owned spell-plan pick must block complete-only creation");

const caster = completionManifest({ mode: "npc", concept: { spellcasting: { tradition: "arcane" } }, resolved: {
  spells: [{ spell: { name: "Fear" }, entry }], focusSpells: [{ spell: { name: "Force Bolt" }, entry }],
  feats: [], equipment: [], loot: []
} });
assert.equal(caster.records.filter((record) => record.category === "spellcasting-entry").length, 2,
  "normal and focus casting entries are visible module-built completion requirements");

const focusOnly = completionManifest({ mode: "character", concept: {}, resolved: {
  ancestryDoc: { name: "Human" }, backgroundDoc: { name: "Acolyte" }, classDoc: { name: "Champion" },
  spells: [], focusSpells: [{ spell: { name: "Lay on Hands" }, entry }], feats: [], equipment: [], loot: []
} });
assert.equal(focusOnly.records.filter((record) => record.category === "spellcasting-entry").length, 1,
  "a focus-only character still records its module-built casting entry");

// A character feat slot with no legal feat left is empty, warned and
// non-blocking. The same null entry in NPC mode still blocks Create.
const emptyFeat = completionManifest({ mode: "character", concept: {}, resolved: {
  ancestryDoc: { name: "Human" }, backgroundDoc: { name: "Soldier" }, classDoc: { name: "Soldier" },
  spells: [], focusSpells: [], equipment: [], loot: [],
  feats: [
    { type: "general", level: 3, archetype: false, name: "Toughness", entry },
    { type: "skill", level: 18, archetype: false, name: "skill 18", entry: null },
    { type: "general", level: 19, archetype: true, name: "general 19", entry: null }
  ]
} });
assert.equal(emptyFeat.complete, true, "an empty character feat slot never blocks Create");
assert.doesNotThrow(() => assertComplete(emptyFeat));
assert.deepEqual(emptyFeat.records.filter((record) => record.category === "feat"), [
  { category: "feat", name: "Toughness", status: "compendium", required: true },
  { category: "feat", name: "skill feat (level 18): no legal feat available", status: "empty", required: false },
  { category: "feat", name: "general feat (level 19): no legal feat available", status: "empty", required: false }
]);

const npcEmptyFeat = completionManifest({ mode: "npc", concept: {}, resolved: {
  spells: [], focusSpells: [], equipment: [], loot: [],
  feats: [{ type: "general", level: 3, archetype: false, name: "Unplaced Feat", entry: null }]
} });
assert.equal(npcEmptyFeat.complete, false, "NPC feat slots still block Create when unresolved");
assert.throws(() => assertComplete(npcEmptyFeat), /feat: Unplaced Feat/);

// A character archetype fill rejected by Free Archetype placement had other
// legal candidates, so it blocks Create. A plain null slot still does not.
const rejectedFill = completionManifest({ mode: "character", concept: {}, resolved: {
  ancestryDoc: { name: "Human" }, backgroundDoc: { name: "Soldier" }, classDoc: { name: "Soldier" },
  spells: [], focusSpells: [], equipment: [], loot: [],
  feats: [
    { type: "general", level: 19, archetype: true, name: "Rejected Feat", entry: null, placement: "rejected" }
  ]
} });
assert.equal(rejectedFill.complete, false, "a rejected character feat fill blocks Create");
assert.throws(() => assertComplete(rejectedFill), /feat: Rejected Feat/);
assert.deepEqual(rejectedFill.records.filter((record) => record.category === "feat"), [
  { category: "feat", name: "Rejected Feat", status: "unresolved", required: true }
]);

const plainNullFeat = completionManifest({ mode: "character", concept: {}, resolved: {
  ancestryDoc: { name: "Human" }, backgroundDoc: { name: "Soldier" }, classDoc: { name: "Soldier" },
  spells: [], focusSpells: [], equipment: [], loot: [],
  feats: [{ type: "general", level: 19, archetype: true, name: "general 19", entry: null }]
} });
assert.equal(plainNullFeat.complete, true, "a plain null character feat slot does not block Create");
assert.doesNotThrow(() => assertComplete(plainNullFeat));

const summary = completionSummary([creature, pc, skippedGear, emptyFeat]);
assert.deepEqual(summary, {
  total: creature.records.length + pc.records.length + skippedGear.records.length + emptyFeat.records.length,
  compendium: 3,
  native: 6,
  moduleBuilt: 3,
  customNarrative: 1,
  skipped: 1,
  empty: 2,
  unresolved: 1
}, "completion presentation must report every manifest status without exposing mutable documents");
console.log("completion.test.mjs: manifest statuses and complete-only boundary passed");
