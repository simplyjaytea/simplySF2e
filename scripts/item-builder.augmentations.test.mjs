// Test Cybernetics, Biotech Augmentations, and Solarian Crystals in Item Forge
// Run: node scripts/item-builder.augmentations.test.mjs

import assert from "node:assert/strict";
import { normalizeMagicItemConcept, buildMagicItemData, getUsageOptions } from "./item-builder.mjs";

globalThis.game = {
  i18n: { localize: (k) => k, format: (k) => k },
  settings: { get: () => null },
  packs: new Map()
};
globalThis.foundry = {
  utils: {
    escapeHTML: (s) => String(s ?? ""),
    randomID: () => "mock-id"
  }
};

// 1. Augmentation usage options
const augUsages = await getUsageOptions("augmentation");
assert.deepEqual(augUsages, ["installed-in-body"], "Augmentation usage defaults to installed-in-body");

const crystalUsages = await getUsageOptions("crystal");
assert.deepEqual(crystalUsages, ["other"], "Crystal usage defaults to other");

// 2. Normalizing Augmentation
const rawAug = {
  name: "Dermal Plating",
  description: "Subdermal carbon mesh reinforcing the skin.",
  usage: "installed-in-body",
  traits: ["cybernetic"],
  bulk: "negligible",
  effects: []
};
const normAug = normalizeMagicItemConcept(rawAug, {
  level: 4, rarity: "common", availableKinds: [], effectCatalog: [], usageOptions: augUsages, kind: "augmentation"
});

assert.equal(normAug.kind, "augmentation");
assert.ok(normAug.traits.includes("augmentation"), "Augmentation trait added");
assert.ok(normAug.traits.includes("cybernetic"), "Cybernetic trait preserved");
assert.equal(normAug.usage, "installed-in-body");

// Build augmentation item data
const augData = await buildMagicItemData(normAug);
assert.equal(augData.img, "icons/commodities/tech/sensor-red.webp");
assert.ok(augData.system.traits.value.includes("augmentation"));

// 3. Normalizing Solarian Crystal
const rawCrystal = {
  name: "Photon Attuned Shard",
  description: "A crystal pulsing with raw solar plasma.",
  usage: "other",
  traits: [],
  bulk: "negligible",
  effects: []
};
const normCrystal = normalizeMagicItemConcept(rawCrystal, {
  level: 5, rarity: "uncommon", availableKinds: [], effectCatalog: [], usageOptions: crystalUsages, kind: "crystal"
});

assert.equal(normCrystal.kind, "crystal");
assert.ok(normCrystal.traits.includes("solarian"), "Solarian trait added");
assert.ok(normCrystal.traits.includes("crystal"), "Crystal trait added");

const crystalData = await buildMagicItemData(normCrystal);
assert.equal(crystalData.img, "icons/commodities/gems/gem-faceted-round-purple.webp");
assert.ok(crystalData.system.traits.value.includes("solarian"));

console.log("item-builder.augmentations.test.mjs: augmentations and solarian crystals verified in Item Forge");
