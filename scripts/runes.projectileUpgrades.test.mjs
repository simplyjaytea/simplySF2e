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

  // Normalize knows the base group, so it refuses a projectile upgrade on a
  // non-projectile base before the slot cap, and the upgrade is reported as skipped.
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    const normalize = (baseCandidate, upgrades) => normalizeRunedItemConcept({
      baseItemName: baseCandidate.name, grade: "commercial", upgrades
    }, {
      kind: "weapon", rarity: "common",
      baseCandidates: [baseCandidate],
      runeCandidates: weaponUpgrades,
      grades: ["commercial"]
    });
    const projectileBase = { name: "Sling", level: 0, category: null, group: "projectile", upgradeSlots: 1 };
    const laserBase = { name: "Blaster", level: 0, category: null, group: "laser", upgradeSlots: 1 };
    const noGroupBase = { name: "Longbow", level: 1, category: null, group: null, upgradeSlots: 1 };

    const onProjectile = normalize(projectileBase, ["Impact Enhancer (Commercial)", "Sight Module"]);
    assert.deepEqual(onProjectile.upgrades, ["Impact Enhancer (Commercial)"],
      "a projectile base keeps its projectile upgrade and still drops a trait-constrained one");
    assert.deepEqual(onProjectile.skippedUpgrades, [], "nothing is skipped on a projectile base that fits");

    // The regression: the projectile upgrade is requested first and must not take the one slot.
    warnings.length = 0;
    const onLaser = normalize(laserBase, ["Impact Enhancer (Commercial)", "Hybrid Battery"]);
    assert.deepEqual(onLaser.upgrades, ["Hybrid Battery"], "a normal upgrade installs on a laser base even when a projectile upgrade was requested first");
    assert.deepEqual(onLaser.skippedUpgrades, ["Impact Enhancer (Commercial)"], "the wrong-group projectile upgrade is listed as skipped");
    assert.deepEqual(onLaser.unfitUpgrades, ["Impact Enhancer (Commercial)"], "the skip is marked as a group mismatch, not a slot skip");
    assert.ok(warnings.some((w) => w.includes("cannot be installed") && w.includes("Impact Enhancer")),
      "the group mismatch is warned by name");
    assert.ok(!warnings.some((w) => w.includes("no free upgrade slot")),
      "a group mismatch is not reported as a slot problem");

    const onNoGroup = normalize(noGroupBase, ["Impact Enhancer (Commercial)"]);
    assert.deepEqual(onNoGroup.upgrades, [], "a base with no group fails closed for a projectile upgrade");
    assert.deepEqual(onNoGroup.unfitUpgrades, ["Impact Enhancer (Commercial)"]);

    // A projectile upgrade that fits but finds no free slot is a slot skip, not a group skip.
    const slotCapped = normalize(projectileBase, ["Hybrid Battery", "Impact Enhancer (Commercial)"]);
    assert.deepEqual(slotCapped.upgrades, ["Hybrid Battery"]);
    assert.deepEqual(slotCapped.skippedUpgrades, ["Impact Enhancer (Commercial)"], "a fitting upgrade past the cap is a slot skip");
    assert.deepEqual(slotCapped.unfitUpgrades, [], "a slot skip is not marked as a group mismatch");
  } finally {
    console.warn = realWarn;
  }
} finally {
  if (previousGame === undefined) delete globalThis.game;
  else globalThis.game = previousGame;
}

console.log("projectile upgrade gate check: all assertions passed");
