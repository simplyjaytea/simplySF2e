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

// Expected shapes come from foundryvtt/pf2e v14-dev packs/sf2e/equipment:
// augmentations/* use usage "implanted" and one category trait (tech,
// biotech, magitech + magical, necrograft); solarian-crystals/* use usage
// "other" and traits ["magical"]. No "augmentation", "cybernetic",
// "solarian" or "crystal" equipment trait exists (config/traits.ts).

// 1. Usage is fixed per kind
assert.deepEqual(await getUsageOptions("augmentation"), ["implanted"]);
assert.deepEqual(await getUsageOptions("crystal"), ["other"]);

const normalize = (raw, kind, level = 4) => normalizeMagicItemConcept(raw, {
  level, rarity: "common", availableKinds: [], effectCatalog: [], usageOptions: ["worn"], kind
});

// 2. Augmentation: default category is tech; invented traits are dropped
const normAug = normalize({
  name: "Dermal Plating",
  description: "Subdermal carbon mesh reinforcing the skin.",
  usage: "installed-in-body",
  traits: ["cybernetic", "augmentation", "magical", "invested"],
  bulk: "negligible",
  invested: true,
  effects: []
}, "augmentation");
assert.equal(normAug.kind, "augmentation");
assert.equal(normAug.usage, "implanted", "the AI's usage never overrides the real augmentation usage");
assert.deepEqual(normAug.traits, ["tech"], "only the real category trait remains");
assert.equal(normAug.invested, false, "implanted items are never invested");

// The AI's category wins; magitech carries magical like the published items
assert.deepEqual(normalize({ name: "Rune Eye", category: "magitech", traits: ["biotech", "detection"] }, "augmentation").traits.sort(),
  ["detection", "magical", "magitech"]);
assert.deepEqual(normalize({ name: "Grown Gill", traits: ["biotech"] }, "augmentation").traits, ["biotech"],
  "a category given as a trait is used when no category key is set");
assert.deepEqual(normalize({ name: "Bone Lattice", category: "apex" }, "augmentation").traits, ["tech"],
  "apex and unknown categories fall back to tech");

const augData = await buildMagicItemData(normAug);
assert.equal(augData.img, "icons/commodities/tech/sensor-red.webp");
assert.equal(augData.type, "equipment");
assert.equal(augData.system.usage.value, "implanted");
assert.deepEqual(augData.system.traits.value, ["tech"]);

// 3. Solarian crystal: usage other, magical only
const normCrystal = normalize({
  name: "Photon Attuned Shard",
  description: "A crystal pulsing with raw solar plasma.",
  usage: "worn",
  traits: ["solarian", "crystal"],
  bulk: "negligible",
  effects: []
}, "crystal", 5);
assert.equal(normCrystal.kind, "crystal");
assert.equal(normCrystal.usage, "other");
assert.deepEqual(normCrystal.traits, ["magical"]);

const crystalData = await buildMagicItemData(normCrystal);
assert.equal(crystalData.img, "icons/commodities/gems/gem-faceted-round-purple.webp");
assert.deepEqual(crystalData.system.traits.value, ["magical"]);

// 4. Unknown kinds normalize as wondrous
assert.equal(normalize({ name: "Thing" }, "invented").kind, "wondrous");

console.log("item-builder.augmentations.test.mjs: augmentations and solarian crystals match real sf2e shapes");
