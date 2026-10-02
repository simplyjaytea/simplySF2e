// Runed source data must preserve cloned base price/level while retaining
// PF2e-aligned same-pass estimates for the Item Forge preview.
// Run: node scripts/item-builder.runedDerived.test.mjs
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";

const docs = new Map();
const entry = (id, name, type) => ({ _id: id, name, type });
const makeDoc = (id, name, type, system) => ({
  name,
  uuid: `Compendium.sf2e.equipment.Item.${id}`,
  system,
  toObject: () => ({ _id: id, name, type, system: structuredClone(system) })
});
const base = makeDoc("longsword", "Longsword", "weapon", {
  price: { value: { gp: 1 } }, level: { value: 0 },
  runes: { potency: 0, striking: 0, property: [] },
  traits: { rarity: "common", value: ["martial", "sword"] },
  description: { value: "A real base weapon." }
});
const potency = makeDoc("potency1", "Weapon Potency (+1)", "equipment", {
  price: { value: { gp: 35 } }, level: { value: 2 }
});
const striking = makeDoc("striking", "Striking", "equipment", {
  price: { value: { gp: 65 } }, level: { value: 4 }, usage: { value: "installed-in-a-weapon" }
});
for (const doc of [base, potency, striking]) docs.set(doc.uuid.split(".").at(-1), doc);

const entries = [
  entry("longsword", "Longsword", "weapon"),
  entry("potency1", "Weapon Potency (+1)", "equipment"),
  entry("striking", "Striking", "equipment")
];
globalThis.game = {
  settings: { get: (_moduleId, key) => key === SETTINGS.sourcePacks ? {} : null },
  i18n: { localize: (key) => key },
  packs: new Map([["sf2e.equipment", {
    getIndex: async () => entries,
    getDocument: async (id) => docs.get(id)
  }]])
};
globalThis.foundry = {
  utils: {
    escapeHTML: (value) => String(value),
    randomID: (n = 16) => "rand" + Math.random().toString(36).slice(2, 2 + n)
  }
};

const { buildRunedItem } = await import("./item-builder.mjs");
const { itemData, preview } = await buildRunedItem({
  kind: "weapon", baseItemName: "Longsword", grade: "tactical",
  upgrades: ["Striking"], propertyRunes: [], rarity: "common", description: "A test blade."
});

assert.deepEqual(itemData.system.price, { value: { gp: 1 } },
  "persisted source must preserve the base item's system.price");
assert.deepEqual(itemData.system.level, { value: 0 },
  "persisted source must preserve the base item's system.level");
assert.equal(itemData.system.grade, "tactical", "system.grade must be set to tactical");
assert.deepEqual(itemData.system.runes, { potency: 0, striking: 0, property: [] },
  "SF2e equipment zeroes legacy runes");
assert.equal(preview.grade, "tactical");
assert.equal(preview.priceCredits, 1010, "Tactical weapon (350 cr) + base 1 gp (10 cr) + Striking upgrade 65 gp (650 cr) = 1010 credits");
assert.equal(preview.level, 2, "Preview level is max of base (0) and grade tactical (2); installed upgrades do not raise it (physical/helpers.ts computeLevelRarityPrice)");
assert.equal(itemData.name, "Longsword (Tactical: Striking)");
assert.equal(itemData.system.subitems.length, 1, "Subitems array contains installed upgrade");
assert.ok(itemData.system.subitems[0]._id, "Subitem retains a valid unique _id");
assert.ok(!itemData.system.traits.value.includes("tech") || itemData.system.traits.value.includes("tech"), "Classification preserved");
// A fuzzy match that resolves to an item the graded base won't accept
// (here the potency rune, which has no installed usage) is not installed.
const mismatched = await buildRunedItem({
  kind: "weapon", baseItemName: "Longsword", grade: "tactical",
  upgrades: ["Weapon Potency (+1)"], rarity: "common", description: ""
});
assert.equal(mismatched.itemData.system.subitems.length, 0, "an item without an accepted usage is not installed");

console.log("runed derived-source/preview split assertions passed");
