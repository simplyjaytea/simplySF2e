// SF2e pack defaults follow system.sf2e.json 1.5.0 collection ids
// (`sf2e.<packs[].name>`). Missing configured packs warn and fall back.
// Run: node scripts/compendium.packDefaults.test.mjs
import assert from "node:assert/strict";

let storedSources = {};
const installed = new Map();
globalThis.game = {
  settings: { get: () => storedSources },
  packs: installed
};

const { DEFAULT_PACKS, getPacksFor } = await import("./compendium.mjs");

assert.deepEqual(DEFAULT_PACKS, {
  abilities: ["sf2e.bestiary-ability-glossary-srd"],
  spells: ["sf2e.spells"],
  equipment: ["sf2e.equipment"],
  feats: ["sf2e.feats"],
  ancestries: ["sf2e.ancestries"],
  backgrounds: ["sf2e.backgrounds"],
  classes: ["sf2e.classes"],
  classFeatures: ["sf2e.class-features"],
  heritages: ["sf2e.heritages"],
  bestiaryActors: ["sf2e.alien-core-bestiary"]
});
for (const [category, ids] of Object.entries(DEFAULT_PACKS)) {
  for (const id of ids) {
    assert.match(id, /^sf2e\./, `${category} default ${id} must be an sf2e collection id`);
    assert.doesNotMatch(id, /^pf2e\./, `${category} must not keep a pf2e default`);
  }
}

const originalWarn = console.warn;
const warnings = [];
console.warn = (message) => warnings.push(message);

try {
  for (const id of DEFAULT_PACKS.abilities) installed.set(id, {});
  for (const id of DEFAULT_PACKS.equipment) installed.set(id, {});
  assert.deepEqual(getPacksFor("abilities"), ["sf2e.bestiary-ability-glossary-srd"]);
  assert.deepEqual(getPacksFor("equipment"), ["sf2e.equipment"]);
  assert.deepEqual(warnings, [], "installed SF2e defaults must not emit missing-pack warnings");

  storedSources = { abilities: ["module.missing-abilities"] };
  assert.deepEqual(getPacksFor("abilities"), ["sf2e.bestiary-ability-glossary-srd"],
    "an unavailable custom selection must fall back to installed system defaults");
  assert.equal(warnings.length, 2, "a missing configured pack and its fallback must remain visible to the GM");
  assert.match(warnings[0], /module\.missing-abilities/);
  assert.match(warnings[1], /falling back to system defaults/);
} finally {
  console.warn = originalWarn;
}

console.log("compendium.packDefaults.test.mjs: SF2e pack-default assertions passed");
