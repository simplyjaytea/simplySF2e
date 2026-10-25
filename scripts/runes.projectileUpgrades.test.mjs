// Checks the projectile-only weapon upgrade gate. sf2e 1.6.1 lists
// "installed-in-a-weapon-that-uses-projectiles" in src/scripts/config/usage.ts:10
// (WEAPON_UPGRADES); the Impact Enhancer and Arcane Adapter upgrades carry it.
// The forge installs them only on a base whose system.group is "projectile",
// and fails closed for every other group or a missing group.
// Run: node scripts/runes.projectileUpgrades.test.mjs

import assert from "node:assert/strict";
import {
  PROJECTILE_UPGRADE_USAGE, WEAPON_UPGRADE_USAGES, propertyRuneFitsBase, propertyRuneMayFitBase,
  getPropertyRuneCandidates
} from "./runes.mjs";
import { normalizeRunedItemConcept } from "./item-builder.mjs";

/* ---------------- usage gate ---------------- */

assert.equal(PROJECTILE_UPGRADE_USAGE, "installed-in-a-weapon-that-uses-projectiles");
assert.ok(!WEAPON_UPGRADE_USAGES.has(PROJECTILE_UPGRADE_USAGE), "the projectile usage is a separate gate");

assert.ok(propertyRuneFitsBase("weapon", PROJECTILE_UPGRADE_USAGE, "projectile"),
  "a projectile upgrade fits a projectile-group base");
assert.ok(!propertyRuneFitsBase("weapon", PROJECTILE_UPGRADE_USAGE, "laser"),
  "a projectile upgrade does not fit a laser-group base");
assert.ok(!propertyRuneFitsBase("weapon", PROJECTILE_UPGRADE_USAGE, "shock"),
  "a projectile upgrade does not fit a shock-group base");
assert.ok(!propertyRuneFitsBase("weapon", PROJECTILE_UPGRADE_USAGE, null),
  "a projectile upgrade fails closed when the base group is missing");
assert.ok(!propertyRuneFitsBase("weapon", PROJECTILE_UPGRADE_USAGE),
  "a projectile upgrade fails closed when no base group is passed");
assert.ok(!propertyRuneFitsBase("armor", PROJECTILE_UPGRADE_USAGE, "projectile"),
  "a projectile upgrade never fits armor");

// Existing installed-in-a-weapon behaviour is unchanged for every base group.
for (const group of ["projectile", "laser", "shock", null, undefined]) {
  assert.ok(propertyRuneFitsBase("weapon", "installed-in-a-weapon", group),
    `installed-in-a-weapon still fits a weapon with group ${group}`);
}
assert.ok(propertyRuneFitsBase("weapon", "installed-in-a-weapon"), "installed-in-a-weapon needs no base group");
assert.ok(propertyRuneFitsBase("armor", "installed-in-armor"), "installed-in-armor still fits armor");
assert.ok(!propertyRuneFitsBase("weapon", "installed-in-a-weapon-sight"), "trait-constrained weapon usages still fail closed");
assert.ok(!propertyRuneFitsBase("weapon", "installed-in-two-handed-weapon"), "two-handed usages still fail closed");

// The candidate-stage check keeps projectile upgrades for weapons only.
assert.ok(propertyRuneMayFitBase("weapon", PROJECTILE_UPGRADE_USAGE), "a projectile upgrade may fit a weapon before the base is known");
assert.ok(propertyRuneMayFitBase("weapon", "installed-in-a-weapon"), "installed-in-a-weapon may fit a weapon");
assert.ok(!propertyRuneMayFitBase("weapon", "installed-in-armor"), "an armor upgrade may not fit a weapon");
assert.ok(!propertyRuneMayFitBase("armor", PROJECTILE_UPGRADE_USAGE), "a projectile upgrade may not fit armor");
assert.ok(!propertyRuneMayFitBase("weapon", "etched-onto-a-weapon"), "etched runes never fit");

/* ---------------- candidate list from the pack index ---------------- */

// Names and levels below are test fixtures, not verified pack data. The
// usage strings are the sf2e 1.6.1 values cited above.
const previousGame = globalThis.game;
const indexEntries = [
  { name: "Longbow", type: "weapon", system: { level: { value: 1 }, group: "bow" } },
  { name: "Sling", type: "weapon", system: { level: { value: 0 }, group: "projectile" } },
  { name: "Impact Enhancer (Commercial)", type: "equipment", system: {
    level: { value: 3 }, usage: { value: PROJECTILE_UPGRADE_USAGE }
  } },
  { name: "Arcane Adapter (Commercial)", type: "equipment", system: {
    level: { value: 3 }, usage: { value: PROJECTILE_UPGRADE_USAGE }
  } },
  { name: "Hybrid Battery", type: "equipment", system: {
    level: { value: 2 }, usage: { value: "installed-in-a-weapon" }
  } },
  { name: "Sight Module", type: "equipment", system: {
    level: { value: 3 }, usage: { value: "installed-in-a-weapon-sight" }
  } },
  { name: "Shock Grid", type: "equipment", system: {
    level: { value: 3 }, usage: { value: "installed-in-armor" }
  } }
];

globalThis.game = {
  settings: { get: () => ({}) },
  packs: new Map([["sf2e.equipment", {
    getIndex: async () => indexEntries
  }]])
};

try {
  const weaponUpgrades = await getPropertyRuneCandidates("weapon", 20);
  const names = weaponUpgrades.map((c) => c.name).sort();
  assert.deepEqual(names, ["Arcane Adapter (Commercial)", "Hybrid Battery", "Impact Enhancer (Commercial)"],
    "weapon candidates list the projectile upgrades alongside installed-in-a-weapon, and nothing else");
  assert.ok(weaponUpgrades.some((c) => c.usage === PROJECTILE_UPGRADE_USAGE),
    "the projectile usage survives into the candidate list for downstream gating");

  const armorUpgrades = await getPropertyRuneCandidates("armor", 20);
  assert.deepEqual(armorUpgrades.map((c) => c.name), ["Shock Grid"], "armor candidates are unchanged");

  // Normalize keeps a projectile upgrade for a weapon base because the base
  // group is not on the candidate; buildRunedItem makes the real check.
  const concept = normalizeRunedItemConcept({
    baseItemName: "Longbow", grade: "commercial",
    upgrades: ["Impact Enhancer (Commercial)", "Sight Module"]
  }, {
    kind: "weapon", rarity: "common",
    baseCandidates: [{ name: "Longbow", level: 1, category: null, upgradeSlots: 1 }],
    runeCandidates: weaponUpgrades,
    grades: ["commercial"]
  });
  assert.deepEqual(concept.upgrades, ["Impact Enhancer (Commercial)"],
    "normalize keeps a projectile upgrade for a weapon base and still drops a trait-constrained one");
} finally {
  if (previousGame === undefined) delete globalThis.game;
  else globalThis.game = previousGame;
}

console.log("projectile upgrade gate check: all assertions passed");
