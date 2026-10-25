// Graded item naming, published-grade refusal and the upgrade slot cap.
// Bases published with a grade label ("Blast Knife (Superior)") are finished
// items and are not offered; a commercial base keeps one grade label; a base
// already published above commercial keeps its published grade; a dropped
// upgrade is warned and reported as skipped.
// Run: node scripts/item-builder.gradeNaming.test.mjs
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";
import {
  trailingGradeLabel, stripTrailingGradeLabel, isPublishedAboveCommercial, getBaseItemCandidates
} from "./runes.mjs";

/* ---------------- label helpers ---------------- */

assert.equal(trailingGradeLabel("Blast Knife (Superior)"), "superior");
assert.equal(trailingGradeLabel("Lock (Commercial)"), "commercial");
assert.equal(trailingGradeLabel("Longsword"), null);
assert.equal(trailingGradeLabel("Longsword (Tactical: Striking)"), null, "an upgrade list is not a grade label");
assert.equal(stripTrailingGradeLabel("Lock (Commercial)"), "Lock");
assert.equal(stripTrailingGradeLabel("Longsword"), "Longsword");
assert.equal(isPublishedAboveCommercial("Lock (Commercial)"), false);
assert.equal(isPublishedAboveCommercial("Grenade Launcher (Ultimate)"), true);

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
  addDoc("longsword", "Longsword", "weapon", {
    price: { value: { gp: 1 } }, level: { value: 0 }, group: "sword",
    traits: { rarity: "common", value: ["martial"] }, description: { value: "" }
  }),
  addDoc("blastknife", "Blast Knife (Superior)", "weapon", {
    price: { value: { gp: 900 } }, level: { value: 10 }, grade: "commercial",
    group: "knife", traits: { rarity: "common", value: [] }, description: { value: "" }
  }),
  addDoc("caramel", "Caramel Cannon", "weapon", {
    price: { value: { gp: 80 } }, level: { value: 0 }, grade: "tactical",
    group: "projectile", traits: { rarity: "common", value: [] }, description: { value: "" }
  }),
  addDoc("striking", "Striking", "equipment", {
    price: { value: { gp: 65 } }, level: { value: 4 }, usage: { value: "installed-in-a-weapon" },
    traits: { rarity: "common", value: [] }
  }),
  addDoc("hybrid", "Hybrid Battery", "equipment", {
    price: { value: { gp: 20 } }, level: { value: 2 }, usage: { value: "installed-in-a-weapon" },
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

  /* ---------------- candidates ---------------- */

  const bases = await getBaseItemCandidates("weapon", 20);
  const names = bases.map((b) => b.name);
  assert.ok(!names.includes("Blast Knife (Superior)"), "a base named for a non-commercial grade is not offered");
  assert.ok(names.includes("Blaster (Commercial)"), "a commercial-labelled base is still offered");
  assert.ok(names.includes("Longsword"), "an unlabelled base is still offered");

  /* ---------------- naming ---------------- */

  const tactical = await buildRunedItem({
    kind: "weapon", baseItemName: "Blaster (Commercial)", grade: "tactical",
    upgrades: [], rarity: "common", description: ""
  });
  assert.equal(tactical.itemData.name, "Blaster (Tactical)", "a commercial label is replaced by the chosen grade, never doubled");
  assert.equal(tactical.itemData.system.grade, "tactical");

  const commercial = await buildRunedItem({
    kind: "weapon", baseItemName: "Blaster (Commercial)", grade: "commercial",
    upgrades: [], rarity: "common", description: ""
  });
  assert.equal(commercial.itemData.name, "Blaster (Commercial)", "a commercial base at commercial keeps its published name");

  const commercialWithUpgrade = await buildRunedItem({
    kind: "weapon", baseItemName: "Blaster (Commercial)", grade: "commercial",
    upgrades: ["Striking"], rarity: "common", description: ""
  });
  assert.equal(commercialWithUpgrade.itemData.name, "Blaster (Commercial: Striking)",
    "upgrades on a commercial base use one grade label");

  const plain = await buildRunedItem({
    kind: "weapon", baseItemName: "Longsword", grade: "advanced",
    upgrades: [], rarity: "common", description: ""
  });
  assert.equal(plain.itemData.name, "Longsword (Advanced)", "an unlabelled base is named as before");

  /* ---------------- published grade kept ---------------- */

  const published = await buildRunedItem({
    kind: "weapon", baseItemName: "Caramel Cannon", grade: "elite",
    upgrades: [], rarity: "common", description: ""
  });
  assert.equal(published.itemData.system.grade, "tactical", "a base published above commercial keeps its published grade");
  assert.equal(published.itemData.name, "Caramel Cannon (Tactical)", "the published name carries the published grade");
  assert.equal(published.preview.grade, "tactical", "the preview reports the grade actually built");
  assert.ok(warnings.some((w) => w.includes("Caramel Cannon") && w.includes("kept tactical instead of elite")),
    "the kept grade is warned");

  // The published grade can put a base above the GM's level, though its stored level is lower.
  await assert.rejects(
    buildRunedItem({ kind: "weapon", baseItemName: "Caramel Cannon", grade: "elite", upgrades: [], rarity: "common", description: "", level: 1 }),
    /comes out at level 2, above this item's level 1/,
    "a published base above the GM's level is refused"
  );
  const withinLevel = await buildRunedItem({
    kind: "weapon", baseItemName: "Caramel Cannon", grade: "elite",
    upgrades: [], rarity: "common", description: "", level: 2
  });
  assert.equal(withinLevel.preview.level, 2, "a published base at or below the GM's level is built");

  /* ---------------- upgrade slot cap ---------------- */

  warnings.length = 0;
  const concept = normalizeRunedItemConcept({
    baseItemName: "Longsword", grade: "tactical", upgrades: ["Striking", "Hybrid Battery"]
  }, {
    kind: "weapon", rarity: "common",
    baseCandidates: [{ name: "Longsword", level: 0, category: null, upgradeSlots: 1 }],
    runeCandidates: [
      { name: "Striking", level: 4, usage: "installed-in-a-weapon" },
      { name: "Hybrid Battery", level: 2, usage: "installed-in-a-weapon" }
    ],
    grades: ["commercial", "tactical"]
  });
  assert.deepEqual(concept.upgrades, ["Striking"], "the slot cap still keeps only the first upgrade");
  assert.deepEqual(concept.skippedUpgrades, ["Hybrid Battery"], "the capped upgrade is reported, not lost");
  assert.ok(warnings.some((w) => w.includes("no free upgrade slot") && w.includes("Hybrid Battery")),
    "the cap drop names the skipped upgrade in a warning");

  const built = await buildRunedItem({ ...concept, rarity: "common", description: "" });
  assert.deepEqual(built.preview.skippedUpgrades, ["Hybrid Battery"], "the preview carries the skipped upgrade for the app notice");
  assert.equal(built.itemData.system.subitems.length, 1, "the capped upgrade is not installed");
} finally {
  console.warn = realWarn;
}

console.log("item forge grade naming and slot cap assertions passed");
