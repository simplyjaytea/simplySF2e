// Checks the Item Forge upgrade usage gate. A graded sf2e weapon or armor
// accepts only "installed-in-*" upgrades (foundryvtt/pf2e v14-dev
// src/scripts/config/usage.ts WEAPON_UPGRADES / ARMOR_UPGRADES); the forge
// installs only the unconstrained "installed-in-a-weapon" / "installed-in-armor"
// usages and fails closed on everything else, including PF2e etched runes.
// Run: node scripts/item-builder.runeCategory.test.mjs

import assert from "node:assert/strict";
import { getBaseItemCandidates, getPropertyRuneCandidates, propertyRuneFitsBase } from "./runes.mjs";
import { normalizeRunedItemConcept } from "./item-builder.mjs";

/* ---------------- usage gate ---------------- */

assert.ok(propertyRuneFitsBase("weapon", "installed-in-a-weapon"));
assert.ok(propertyRuneFitsBase("armor", "installed-in-armor"));
assert.ok(!propertyRuneFitsBase("weapon", "installed-in-armor"), "an armor upgrade does not fit a weapon");
assert.ok(!propertyRuneFitsBase("armor", "installed-in-a-weapon"), "a weapon upgrade does not fit armor");
for (const usage of ["etched-onto-a-weapon", "etched-onto-armor", "etched-onto-light-armor"]) {
  assert.ok(!propertyRuneFitsBase(usage.includes("weapon") ? "weapon" : "armor", usage), `${usage} is never installed`);
}
for (const usage of ["installed-in-a-weapon-sight", "installed-in-two-handed-weapon", "installed-in-one-handed-weapon-grip"]) {
  assert.ok(!propertyRuneFitsBase("weapon", usage), `${usage} depends on base traits and fails closed`);
}
assert.ok(!propertyRuneFitsBase("armor", "installed-in-armor-with-the-exposed-trait"), "trait-constrained armor upgrades fail closed");

/* ---------------- normalizeRunedItemConcept gating ---------------- */

const warnings = [];
const realWarn = console.warn;
console.warn = (...args) => warnings.push(args.join(" "));
try {
  const armor = normalizeRunedItemConcept({
    baseItemName: "Kasatha Microcord", grade: "tactical",
    upgrades: ["Old Etched Rune", "Shock Grid", "Sight Module"]
  }, {
    kind: "armor", rarity: "common",
    baseCandidates: [{ name: "Kasatha Microcord", level: 0, category: "light", upgradeSlots: 2 }],
    runeCandidates: [
      { name: "Old Etched Rune", level: 3, usage: "etched-onto-armor" },
      { name: "Shock Grid", level: 3, usage: "installed-in-armor" },
      { name: "Sight Module", level: 3, usage: "installed-in-a-weapon-sight" }
    ],
    grades: ["commercial", "tactical"]
  });
  assert.equal(armor.grade, "tactical");
  assert.deepEqual(armor.upgrades, ["Shock Grid"], "only the installed-in-armor upgrade survives");
  assert.ok(warnings.some((w) => w.includes("Old Etched Rune")), "dropped upgrades are warned");
  assert.ok(!("potency" in armor) && !("secondaryTier" in armor), "no legacy potency fields on a graded concept");

  // A dropped upgrade does not use a slot.
  const weapon = normalizeRunedItemConcept({
    baseItemName: "Laser Pistol", grade: "invented-grade",
    upgrades: ["Old Etched Rune", "Hybrid Battery"]
  }, {
    kind: "weapon", rarity: "common",
    baseCandidates: [{ name: "Laser Pistol", level: 0, category: "simple", upgradeSlots: 1 }],
    runeCandidates: [
      { name: "Old Etched Rune", level: 3, usage: "etched-onto-a-weapon" },
      { name: "Hybrid Battery", level: 2, usage: "installed-in-a-weapon" }
    ],
    grades: ["commercial", "tactical"]
  });
  assert.deepEqual(weapon.upgrades, ["Hybrid Battery"]);
  assert.equal(weapon.grade, "commercial", "an unknown grade falls back to the lowest offered grade");
} finally {
  console.warn = realWarn;
}

/* ---------------- compendium index -> candidates ---------------- */

// Exercise the Foundry-facing boundary: category and usage must survive from
// the pack index into the candidate lists.
const previousGame = globalThis.game;
let requestedFields = [];
const indexEntries = [
  { name: "Full Plate", type: "armor", system: { level: { value: 2 }, category: "heavy" } },
  { name: "Leather Armor", type: "armor", system: { level: { value: 0 }, category: "light" } },
  { name: "Specific Full Plate", type: "armor", system: {
    level: { value: 5 }, category: "heavy", specific: {}
  } },
  { name: "Longsword", type: "weapon", system: { level: { value: 0 } } },
  { name: "Specific Longsword", type: "weapon", system: {
    level: { value: 5 }, specific: {}
  } },
  { name: "Shock Grid", type: "equipment", system: {
    level: { value: 3 }, usage: { value: "installed-in-armor" }
  } },
  { name: "Invisibility", type: "equipment", system: {
    level: { value: 8 }, usage: { value: "etched-onto-light-armor" }
  } },
  { name: "Exposed Plating", type: "equipment", system: {
    level: { value: 5 }, usage: { value: "installed-in-armor-with-the-exposed-trait" }
  } }
];

globalThis.game = {
  settings: { get: () => ({}) },
  packs: new Map([["sf2e.equipment", {
    getIndex: async ({ fields }) => {
      requestedFields = fields;
      return indexEntries;
    }
  }]])
};

try {
  const indexedBases = await getBaseItemCandidates("armor", 20);
  assert.ok(requestedFields.includes("system.category"),
    "the equipment index explicitly requests the base armor category");
  assert.ok(requestedFields.includes("system.specific"),
    "the equipment index explicitly requests PF2e's specific-item marker");
  assert.deepEqual(indexedBases, [
    { name: "Leather Armor", level: 0, category: "light", upgradeSlots: 0 },
    { name: "Full Plate", level: 2, category: "heavy", upgradeSlots: 0 }
  ], "base candidates preserve real system.category and upgradeSlots values from the pack index");

  const indexedWeapons = await getBaseItemCandidates("weapon", 20);
  assert.deepEqual(indexedWeapons, [
    { name: "Longsword", level: 0, category: null, upgradeSlots: 1 }
  ], "specific weapons are excluded while a base missing system.specific remains ordinary");

  const indexedUpgrades = await getPropertyRuneCandidates("armor", 20);
  assert.deepEqual(indexedUpgrades, [
    { name: "Shock Grid", level: 3, usage: "installed-in-armor" }
  ], "only installed-in-armor upgrades become armor candidates");
} finally {
  if (previousGame === undefined) delete globalThis.game;
  else globalThis.game = previousGame;
}

console.log("item forge upgrade usage gate check: all assertions passed");
