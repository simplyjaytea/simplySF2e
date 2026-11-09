// getPacksFor warns once per message, not on every call (render).
// Run: node scripts/compendium.packWarn.test.mjs
import assert from "node:assert/strict";

let storedSources = {};
const installed = new Map();
globalThis.game = {
  settings: { get: () => storedSources },
  packs: installed
};

const { getPacksFor, resetPackWarnings } = await import("./compendium.mjs");

const originalWarn = console.warn;
const warnings = [];
console.warn = (message) => warnings.push(message);
const countOf = (pattern) => warnings.filter((message) => pattern.test(message)).length;

try {
  // (a) configured-but-missing pack warns once across three calls for one category.
  resetPackWarnings();
  warnings.length = 0;
  installed.clear();
  installed.set("sf2e.equipment", {});
  storedSources = { equipment: ["module.gone", "sf2e.equipment"] };
  const firstA = getPacksFor("equipment");
  for (let i = 0; i < 2; i++) assert.deepEqual(getPacksFor("equipment"), firstA);
  assert.equal(countOf(/module\.gone/), 1, "missing configured pack must warn exactly once across three calls");

  // (b) a different missing pack id, or a different category, still gets its own first warning.
  storedSources = { equipment: ["module.other", "sf2e.equipment"], feats: ["module.gone", "sf2e.feats"] };
  installed.set("sf2e.feats", {});
  getPacksFor("equipment");
  assert.equal(countOf(/module\.other/), 1, "a different missing pack id must warn its own first time");
  getPacksFor("feats");
  assert.equal(countOf(/configured feats pack "module\.gone"/), 1,
    "the same missing pack id under a different category must warn its own first time");
  assert.equal(countOf(/module\.gone/), 2, "module.gone under equipment and feats are separate warnings");

  // (c) the fallback warning fires once across three calls.
  resetPackWarnings();
  warnings.length = 0;
  installed.clear();
  storedSources = {};
  const firstC = getPacksFor("spells");
  for (let i = 0; i < 2; i++) assert.deepEqual(getPacksFor("spells"), firstC);
  assert.equal(countOf(/falling back to system defaults/), 1, "fallback warning must fire once across three calls");

  // (d) after resetPackWarnings() both warnings fire again.
  resetPackWarnings();
  warnings.length = 0;
  getPacksFor("spells");
  assert.equal(countOf(/falling back to system defaults/), 1, "warning must fire again after resetPackWarnings()");
  resetPackWarnings();
  warnings.length = 0;
  storedSources = { equipment: ["module.gone", "sf2e.equipment"] };
  installed.set("sf2e.equipment", {});
  getPacksFor("equipment");
  resetPackWarnings();
  getPacksFor("equipment");
  assert.equal(countOf(/module\.gone/), 2, "configured-missing warning must fire again after resetPackWarnings()");

  // (e) return values are identical on every call, including the fallback path.
  resetPackWarnings();
  warnings.length = 0;
  installed.clear();
  installed.set("sf2e.equipment", {});
  storedSources = { equipment: ["module.gone", "sf2e.equipment"] };
  const results = [getPacksFor("equipment"), getPacksFor("equipment"), getPacksFor("equipment")];
  assert.deepEqual(results[1], results[0]);
  assert.deepEqual(results[2], results[0]);
  assert.deepEqual(results[0], ["sf2e.equipment"]);
} finally {
  console.warn = originalWarn;
}

console.log("compendium.packWarn.test.mjs: pack warning dedupe assertions passed");
