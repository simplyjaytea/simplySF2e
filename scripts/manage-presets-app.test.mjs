// Test ManagePresetsApp dialogs and action handlers
// Run: node scripts/manage-presets-app.test.mjs

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

import { MODULE_ID, SETTINGS } from "./settings.mjs";
import { TREASURE_AMOUNT_MULTIPLIER } from "./tables.mjs";
import { esc } from "./text.mjs";
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

let settingsStore = {};
const notifications = [];
let savedFiles = [];
let dialogPromptMock = null;
let dialogConfirmMock = null;

globalThis.game = {
  i18n: {
    localize: (key) => key,
    format: (key, data) => `${key}:${JSON.stringify(data)}`
  },
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
    randomID: (n = 8) => "mock" + Math.random().toString(36).slice(2, 2 + n),
    saveDataToFile: (data, type, filename) => {
      savedFiles.push({ data, type, filename });
    }
  }
};

const context = vm.createContext({
  console: { log() {}, warn() {}, error() {} },
  game: globalThis.game,
  ui: {
    notifications: {
      info(msg) { notifications.push({ type: "info", msg }); },
      warn(msg) { notifications.push({ type: "warn", msg }); },
      error(msg) { notifications.push({ type: "error", msg }); }
    }
  },
  foundry: {
    applications: {
      api: {
        ApplicationV2: class FakeApplicationV2 {
          constructor(options = {}) { this.options = options; }
          async render() { this.rendered = true; }
        },
        HandlebarsApplicationMixin: (Base) => class extends Base {},
        DialogV2: {
          prompt: async (opts) => {
            if (dialogPromptMock) return dialogPromptMock(opts);
            return null;
          },
          confirm: async (opts) => {
            if (dialogConfirmMock) return dialogConfirmMock(opts);
            return false;
          }
        }
      }
    },
    utils: globalThis.foundry.utils
  }
});

const mocks = {
  MODULE_ID,
  TREASURE_AMOUNT_MULTIPLIER,
  esc,
  PRESET_RARITIES,
  getCustomPresets,
  findPreset,
  addCustomPreset,
  updateCustomPreset,
  deleteCustomPreset,
  exportPresets,
  importPresets
};

const source = await readFile(new URL("./manage-presets-app.mjs", import.meta.url), "utf8");
const appModule = new vm.SourceTextModule(source, { context });
await appModule.link((specifier) => {
  const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .filter((match) => match[2] === specifier)
    .flatMap((match) => match[1].split(",").map((name) => name.trim()));
  return new vm.SyntheticModule(imports, function () {
    for (const name of imports) {
      this.setExport(name, mocks[name] ?? (() => { throw new Error(`Unexpected dependency: ${name}`); }));
    }
  }, { context });
});
await appModule.evaluate();

const { promptPresetDialog, confirmDeletePreset, ManagePresetsApp } = appModule.namespace;

// 1. promptPresetDialog
dialogPromptMock = (opts) => {
  // Simulate clicking Save with valid data
  return {
    name: "New Preset",
    prompt: "A cool guide",
    rarity: "rare",
    treasureAmount: "generous",
    allowSpellcasting: false
  };
};

const result = await promptPresetDialog({ name: "Initial" });
assert.ok(result);
assert.equal(result.name, "New Preset");
assert.equal(result.rarity, "rare");

// promptPresetDialog cancel or missing name/prompt returns null
dialogPromptMock = () => null;
assert.equal(await promptPresetDialog(), null);

dialogPromptMock = () => ({ name: "", prompt: "Has prompt but no name" });
assert.equal(await promptPresetDialog(), null);

// 2. confirmDeletePreset
settingsStore[SETTINGS.customPresets] = [
  { id: "custom-del", name: "Preset To Delete", prompt: "Delete me", custom: true }
];

dialogConfirmMock = () => false;
let deletedResult = await confirmDeletePreset({ id: "custom-del", name: "Preset To Delete" });
assert.equal(deletedResult, false, "confirmDeletePreset returns false when not confirmed");
assert.equal(getCustomPresets().length, 1, "Preset was not deleted");

dialogConfirmMock = () => true;
deletedResult = await confirmDeletePreset({ id: "custom-del", name: "Preset To Delete" });
assert.equal(deletedResult, true, "confirmDeletePreset returns true when confirmed");
assert.equal(getCustomPresets().length, 0, "Preset was deleted");
assert.ok(notifications.some((n) => n.msg.includes("SIMPLYSF2E.Presets.Deleted")));

// 3. ManagePresetsApp actions
let generatorRendered = false;
const fakeGenerator = {
  render() { generatorRendered = true; }
};

const manageApp = new ManagePresetsApp({ generator: fakeGenerator });

// _prepareContext
settingsStore[SETTINGS.customPresets] = [
  { id: "custom-1", name: "Preset 1", prompt: "Prompt 1", custom: true }
];
const ctx = await manageApp._prepareContext();
assert.equal(ctx.presets.length, 1);
assert.equal(ctx.presets[0].id, "custom-1");

// newPreset action
const actions = ManagePresetsApp.DEFAULT_OPTIONS.actions;
dialogPromptMock = () => ({
  name: "Action Created",
  prompt: "Action Prompt",
  rarity: "common",
  treasureAmount: "standard",
  allowSpellcasting: true
});

generatorRendered = false;
await actions.newPreset.call(manageApp);
assert.equal(getCustomPresets().length, 2);
assert.equal(generatorRendered, true, "Generator re-rendered after new preset");
assert.ok(notifications.some((n) => n.msg.includes("SIMPLYSF2E.Presets.Saved")));

// exportPreset action
savedFiles = [];
await actions.exportPreset.call(manageApp, {}, { dataset: { id: "custom-1" } });
assert.equal(savedFiles.length, 1);
assert.equal(savedFiles[0].filename, "simplysf2e-preset-custom-1.json");

// exportAll action
savedFiles = [];
await actions.exportAll.call(manageApp);
assert.equal(savedFiles.length, 1);
assert.equal(savedFiles[0].filename, "simplysf2e-presets.json");

// importPresets action
dialogPromptMock = () => JSON.stringify([
  { name: "Imported from Dialog", prompt: "Imported Prompt" }
]);
generatorRendered = false;
await actions.importPresets.call(manageApp);
assert.equal(getCustomPresets().length, 3);
assert.equal(generatorRendered, true, "Generator re-rendered after import");
assert.ok(notifications.some((n) => n.msg.includes("SIMPLYSF2E.Presets.ImportDone")));

console.log("manage-presets-app.test.mjs: dialogs and action handlers passed");
