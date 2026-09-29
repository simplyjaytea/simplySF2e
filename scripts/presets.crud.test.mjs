// Test preset CRUD operations, validation, export, and import
// Run: node scripts/presets.crud.test.mjs

import assert from "node:assert/strict";
import {
  PRESET_RARITIES,
  getCustomPresets,
  findPreset,
  addCustomPreset,
  updateCustomPreset,
  deleteCustomPreset,
  exportPresets,
  importPresets
} from "./presets.mjs";
import { MODULE_ID, SETTINGS } from "./settings.mjs";

// Setup mock game environment
let settingsStore = {};

globalThis.game = {
  settings: {
    get(module, key) {
      if (module === MODULE_ID && key === SETTINGS.customPresets) {
        return settingsStore[key];
      }
      return undefined;
    },
    async set(module, key, value) {
      if (module === MODULE_ID && key === SETTINGS.customPresets) {
        settingsStore[key] = value;
      }
    }
  }
};

globalThis.foundry = {
  utils: {
    randomID(length = 8) {
      return "rand" + Math.random().toString(36).slice(2, 2 + length);
    }
  }
};

// 1. getCustomPresets & findPreset
settingsStore[SETTINGS.customPresets] = null;
assert.deepEqual(getCustomPresets(), [], "getCustomPresets returns empty array when setting is null");

settingsStore[SETTINGS.customPresets] = "not-an-array";
assert.deepEqual(getCustomPresets(), [], "getCustomPresets returns empty array when setting is not an array");

settingsStore[SETTINGS.customPresets] = [
  { id: "p1", name: "Valid Preset", prompt: "Prompt 1" },
  { id: "p2" }, // missing name
  { name: "Missing ID" },
  null
];
assert.deepEqual(
  getCustomPresets(),
  [{ id: "p1", name: "Valid Preset", prompt: "Prompt 1" }],
  "getCustomPresets filters out corrupted entries"
);

// findPreset
assert.equal(findPreset(null), null, "findPreset returns null for null ID");
assert.equal(findPreset(""), null, "findPreset returns null for empty string");
assert.equal(findPreset("unknown-id"), null, "findPreset returns null for unknown ID");

const builtIn = findPreset("envoy");
assert.ok(builtIn, "findPreset finds built-in envoy");
assert.equal(builtIn.id, "envoy");
assert.equal(builtIn.custom, undefined);

const customFound = findPreset("p1");
assert.ok(customFound, "findPreset finds custom preset p1");
assert.equal(customFound.name, "Valid Preset");

// 2. addCustomPreset
settingsStore[SETTINGS.customPresets] = [];
const created = await addCustomPreset(
  "  A Very Long Preset Name That Exceeds Sixty Characters In Total Length Which Should Be Clamped  ",
  "  Guidance prompt  ",
  { rarity: "rare", allowSpellcasting: false, treasureAmount: "generous" }
);

assert.ok(created.id.startsWith("custom-"), "Generated preset ID starts with custom-");
assert.equal(created.name.length, 60, "Preset name is clamped to 60 chars");
assert.equal(created.prompt, "  Guidance prompt  ", "Prompt is stored as string");
assert.equal(created.rarity, "rare");
assert.equal(created.allowSpellcasting, false);
assert.equal(created.treasureAmount, "generous");
assert.equal(created.custom, true);
assert.equal(getCustomPresets().length, 1, "Preset saved to store");

// add with invalid defaults falls back safely
const createdDefaults = await addCustomPreset("Default Preset", "Prompt", {
  rarity: "invalid-rarity",
  allowSpellcasting: "not-a-boolean",
  treasureAmount: "invalid-amount"
});
assert.equal(createdDefaults.rarity, undefined, "Invalid rarity is dropped");
assert.equal(createdDefaults.allowSpellcasting, undefined, "Invalid allowSpellcasting is dropped");
assert.equal(createdDefaults.treasureAmount, undefined, "Invalid treasureAmount is dropped");

// 3. updateCustomPreset
const updated = await updateCustomPreset(created.id, {
  name: "Updated Name",
  prompt: "Updated prompt",
  rarity: "uncommon"
});
assert.ok(updated, "updateCustomPreset returns updated preset");
assert.equal(updated.name, "Updated Name");
assert.equal(updated.prompt, "Updated prompt");
assert.equal(updated.rarity, "uncommon");
assert.equal(updated.allowSpellcasting, false, "Unchanged fields are preserved");

// update failure cases
assert.equal(await updateCustomPreset("non-existent-id", { name: "Test" }), null, "Unknown ID returns null");
assert.equal(await updateCustomPreset("envoy", { name: "Cannot edit built-in" }), null, "Built-in returns null");

// 4. deleteCustomPreset
await deleteCustomPreset(created.id);
const remaining = getCustomPresets();
assert.equal(remaining.length, 1, "Remaining presets count is 1");
assert.equal(remaining[0].id, createdDefaults.id);
assert.equal(findPreset(created.id), null, "Deleted preset is gone");

// 5. exportPresets
const exportedAllJson = exportPresets();
const exportedAll = JSON.parse(exportedAllJson);
assert.equal(exportedAll.length, 1);
assert.equal(exportedAll[0].id, createdDefaults.id);

const exportedSubset = exportPresets([createdDefaults.id]);
assert.equal(JSON.parse(exportedSubset).length, 1);

const exportedNone = exportPresets(["non-existent"]);
assert.equal(JSON.parse(exportedNone).length, 0);

// 6. importPresets
// Invalid JSON
const badJsonResult = await importPresets("invalid-json{{{");
assert.deepEqual(badJsonResult, { added: 0, skipped: 1 }, "Invalid JSON reports skipped");

// Array import with valid and invalid entries
const importPayload = [
  { name: "Imported 1", prompt: "Prompt 1", rarity: "rare" },
  { name: "", prompt: "Prompt without name" },
  { name: "No prompt", prompt: "   " },
  { name: "Imported 2", prompt: "Prompt 2", id: "malicious-pre-set-id" }
];

const importResult = await importPresets(JSON.stringify(importPayload));
assert.deepEqual(importResult, { added: 2, skipped: 2 }, "Imported 2, skipped 2");

const allAfterImport = getCustomPresets();
const imported2 = allAfterImport.find((p) => p.name === "Imported 2");
assert.ok(imported2);
assert.notEqual(imported2.id, "malicious-pre-set-id", "Imported IDs are regenerated");
assert.ok(imported2.id.startsWith("custom-"));

// Single object import
const singleResult = await importPresets(JSON.stringify({ name: "Single Import", prompt: "Prompt" }));
assert.deepEqual(singleResult, { added: 1, skipped: 0 });

console.log("presets.crud.test.mjs: all preset CRUD, validation, import, and export assertions passed");
