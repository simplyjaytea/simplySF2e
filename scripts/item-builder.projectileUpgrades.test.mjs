// Projectile-only upgrades on the real forge path. A projectile upgrade on a
// non-projectile base is skipped with its own reason, is not installed, and does
// not take the upgrade slot from a normal upgrade. buildRunedItem keeps the same
// group check for a concept that did not pass normalize (a fuzzy match), and
// reports that drop on the preview.
// Run: node scripts/item-builder.projectileUpgrades.test.mjs
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";
import { getBaseItemCandidates, getPropertyRuneCandidates } from "./runes.mjs";

const PROJECTILE_USAGE = "installed-in-a-weapon-that-uses-projectiles";
const IMPACT = "Impact Enhancer (Commercial)";

/* ---------------- fake pack: index + documents ---------------- */

const entry = (id, name, type, system) => ({ _id: id, name, type, system: structuredClone(system) });
const docs = new Map();
const addDoc = (id, name, type, system) => {
  docs.set(id, {
    name,
    uuid: `Compendium.sf2e.equipment.Item.${id}`,
    system: structuredClone(system),
    toObject: () => ({ _id: id, name, type, system: structuredClone(system) })
  });
  return entry(id, name, type, system);
};
const index = [
  addDoc("blaster", "Blaster (Commercial)", "weapon", {
    price: { value: { gp: 2 } }, level: { value: 0 }, grade: "commercial",
    group: "laser", traits: { rarity: "common", value: [] }, description: { value: "" }
  }),
  addDoc("sling", "Sling (Commercial)", "weapon", {
    price: { value: { gp: 1 } }, level: { value: 0 }, grade: "commercial",
    group: "projectile", traits: { rarity: "common", value: [] }, description: { value: "" }
  }),
  addDoc("hybrid", "Hybrid Battery", "equipment", {
    price: { value: { gp: 20 } }, level: { value: 2 }, usage: { value: "installed-in-a-weapon" },
    traits: { rarity: "common", value: [] }
  }),
  addDoc("impact", IMPACT, "equipment", {
    price: { value: { gp: 10 } }, level: { value: 3 }, usage: { value: PROJECTILE_USAGE },
    traits: { rarity: "common", value: [] }
  })
];

globalThis.game = {
  settings: { get: (_moduleId, key) => key === SETTINGS.sourcePacks ? {} : null },
  i18n: { localize: (key) => key, format: (key) => key },
  packs: new Map([["sf2e.equipment", {
    getIndex: async () => index,
    getDocument: async (id) => docs.get(id)
  }]])
};
globalThis.foundry = {
  utils: {
    escapeHTML: (value) => String(value),
    randomID: (n = 16) => "rand" + Math.random().toString(36).slice(2, 2 + n)
  }
};

const warnings = [];
const realWarn = console.warn;
console.warn = (...args) => warnings.push(args.join(" "));
try {
  const { buildRunedItem, normalizeRunedItemConcept } = await import("./item-builder.mjs");
  const bases = await getBaseItemCandidates("weapon", 20);
  const runes = await getPropertyRuneCandidates("weapon", 20);
  const normalize = (baseItemName, upgrades) => normalizeRunedItemConcept({
    baseItemName, grade: "commercial", upgrades
  }, { kind: "weapon", rarity: "common", baseCandidates: bases, runeCandidates: runes, grades: ["commercial"] });
  const build = (concept) => buildRunedItem({ ...concept, rarity: "common", description: "" });

  /* ---------------- laser base: wrong group is skipped, the normal upgrade installs ---------------- */

  warnings.length = 0;
  const laser = normalize("Blaster (Commercial)", [IMPACT, "Hybrid Battery"]);
  assert.deepEqual(laser.upgrades, ["Hybrid Battery"], "the normal upgrade takes the single slot on a laser base");
  assert.deepEqual(laser.skippedUpgrades, [IMPACT], "the projectile upgrade is listed as skipped");
  const builtLaser = await build(laser);
  const installedLaser = builtLaser.itemData.system.subitems.map((sub) => sub.name);
  assert.deepEqual(installedLaser, ["Hybrid Battery"], "the built laser weapon carries the normal upgrade");
  assert.deepEqual(builtLaser.preview.skippedUpgrades, [IMPACT], "the preview lists the projectile upgrade as skipped");
  assert.deepEqual(builtLaser.preview.unfitUpgrades, [IMPACT], "the preview marks it as a group mismatch");
  assert.equal(builtLaser.itemData.name, "Blaster (Commercial: Hybrid Battery)", "the name lists only installed upgrades");
  assert.ok(!warnings.some((w) => w.includes("no free upgrade slot")), "the laser skip is not reported as a slot problem");

  /* ---------------- projectile base: the projectile upgrade is kept ---------------- */

  warnings.length = 0;
  const projectile = normalize("Sling (Commercial)", [IMPACT]);
  assert.deepEqual(projectile.upgrades, [IMPACT], "a projectile base keeps its projectile upgrade");
  const builtProjectile = await build(projectile);
  assert.deepEqual(builtProjectile.itemData.system.subitems.map((sub) => sub.name), [IMPACT],
    "the projectile upgrade is installed on the projectile base");
  assert.deepEqual(builtProjectile.preview.skippedUpgrades, [], "nothing is skipped on a fitting projectile base");
  assert.ok(!warnings.some((w) => w.includes("cannot be installed")), "no group warning on a fitting base");

  /* ---------------- build-time safety net: a concept that skipped normalize ---------------- */

  // A fuzzy match can hand the builder an upgrade that normalize never saw. It is
  // dropped with a preview skip and a warning, and it does not reach the item.
  warnings.length = 0;
  const unchecked = await build({
    kind: "weapon", baseItemName: "Blaster (Commercial)", grade: "commercial",
    upgrades: [IMPACT], skippedUpgrades: [], level: null
  });
  assert.deepEqual(unchecked.itemData.system.subitems, [], "a wrong-group upgrade is not installed at build time");
  assert.deepEqual(unchecked.preview.skippedUpgrades, [IMPACT], "the build-time drop is listed on the preview");
  assert.deepEqual(unchecked.preview.unfitUpgrades, [IMPACT], "the build-time drop is marked as a group mismatch");
  assert.ok(warnings.some((w) => w.includes("cannot be installed") && w.includes(IMPACT)),
    "the build-time drop is warned by name, not only dropped");
  assert.equal(unchecked.itemData.name, "Blaster (Commercial)", "the name does not list the dropped upgrade");
} finally {
  console.warn = realWarn;
}

console.log("item forge projectile upgrade placement assertions passed");
