// Test SourcesConfigApp context preparation, form submission, and reset
// Run: node scripts/sources-app.test.mjs

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

import { MODULE_ID, SETTINGS } from "./settings.mjs";
import { CATEGORIES, DEFAULT_PACKS } from "./compendium.mjs";

let settingsStore = {};
const notifications = [];
let confirmAnswer = true;
let confirmCalls = 0;

const fakeElement = {
  querySelectorAll(selector) {
    if (selector.includes('data-category="equipment"')) {
      return [{ dataset: { pack: "world.custom-equipment" } }];
    }
    if (selector.includes('data-category="spells"')) {
      return [{ dataset: { pack: "sf2e.spells" } }];
    }
    return [];
  }
};

const context = vm.createContext({
  console: { log() {}, warn() {}, error() {} },
  game: {
    i18n: {
      localize: (key) => key,
      format: (key, data) => `${key}:${JSON.stringify(data)}`
    },
    settings: {
      get(module, key) {
        if (module === MODULE_ID && key === SETTINGS.sourcePacks) {
          return settingsStore[key];
        }
        return undefined;
      },
      async set(module, key, value) {
        if (module === MODULE_ID && key === SETTINGS.sourcePacks) {
          settingsStore[key] = value;
        }
      }
    }
  },
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
        DialogV2: { async confirm() { confirmCalls += 1; return confirmAnswer; } },
        HandlebarsApplicationMixin: (Base) => class extends Base {}
      }
    }
  }
});

let detectNothing = false;
const mockDetectAvailablePacks = async () => {
  const detected = {};
  if (detectNothing) {
    for (const cat of CATEGORIES) detected[cat] = [];
    return detected;
  }
  for (const cat of CATEGORIES) {
    detected[cat] = (DEFAULT_PACKS[cat] || []).map((id) => ({
      id,
      label: `Pack ${id}`,
      type: cat === "bestiaryActors" ? "Actor" : "Item"
    }));
  }
  detected.equipment.push({
    id: "world.custom-equipment",
    label: "Custom Equipment",
    type: "Item"
  });
  return detected;
};

const mocks = {
  MODULE_ID,
  SETTINGS,
  CATEGORIES,
  DEFAULT_PACKS,
  getSetting: (key) => settingsStore[key],
  detectAvailablePacks: mockDetectAvailablePacks
};

const source = await readFile(new URL("./sources-app.mjs", import.meta.url), "utf8");
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

const { SourcesConfigApp } = appModule.namespace;

// 1. _prepareContext with default settings
settingsStore[SETTINGS.sourcePacks] = {};
const app = new SourcesConfigApp();
const ctx = await app._prepareContext();

assert.equal(ctx.categories.length, CATEGORIES.length, "All categories present in context");

const equipCat = ctx.categories.find((c) => c.key === "equipment");
assert.ok(equipCat, "Equipment category exists");
assert.ok(equipCat.packs.length >= 2, "Equipment has default plus custom pack");

const defaultEquipPack = equipCat.packs.find((p) => p.id === DEFAULT_PACKS.equipment[0]);
assert.ok(defaultEquipPack);
assert.equal(defaultEquipPack.checked, true, "Default equipment pack is checked by default");
assert.equal(defaultEquipPack.isDefault, true, "Default equipment pack isDefault is true");

const customEquipPack = equipCat.packs.find((p) => p.id === "world.custom-equipment");
assert.ok(customEquipPack);
assert.equal(customEquipPack.checked, false, "Custom equipment pack is unchecked by default");
assert.equal(customEquipPack.isDefault, false, "Custom equipment pack isDefault is false");

// 2. _prepareContext with stored custom selection
settingsStore[SETTINGS.sourcePacks] = {
  equipment: ["world.custom-equipment"]
};
const ctxCustom = await app._prepareContext();
const equipCustomCat = ctxCustom.categories.find((c) => c.key === "equipment");
const customPackChecked = equipCustomCat.packs.find((p) => p.id === "world.custom-equipment");
const defaultPackUnchecked = equipCustomCat.packs.find((p) => p.id === DEFAULT_PACKS.equipment[0]);

assert.equal(customPackChecked.checked, true, "Custom pack is checked when in stored settings");
assert.equal(defaultPackUnchecked.checked, false, "Default pack is unchecked when omitted from stored settings");

assert.equal(ctxCustom.noPacks, false, "noPacks false when packs exist");

detectNothing = true;
const ctxEmpty = await app._prepareContext();
assert.equal(ctxEmpty.noPacks, true, "noPacks true when no category has packs");
detectNothing = false;

// 3. Form submission (#onSubmit)
const submitHandler = SourcesConfigApp.DEFAULT_OPTIONS.form.handler;
await submitHandler.call({ element: fakeElement });

assert.deepEqual(
  Array.from(settingsStore[SETTINGS.sourcePacks].equipment),
  ["world.custom-equipment"],
  "Submitted equipment selection saved to settings"
);
assert.deepEqual(
  Array.from(settingsStore[SETTINGS.sourcePacks].spells),
  ["sf2e.spells"],
  "Submitted spells selection saved to settings"
);
assert.deepEqual(
  Array.from(settingsStore[SETTINGS.sourcePacks].feats),
  [],
  "Empty categories saved as empty arrays"
);

assert.ok(
  notifications.some((n) => n.msg === "SIMPLYSF2E.Sources.Saved"),
  "Notification shown on save"
);

// 4. Reset (#onReset)
const resetHandler = SourcesConfigApp.DEFAULT_OPTIONS.actions.reset;
let renderCalled = false;
const beforeReset = { ...settingsStore[SETTINGS.sourcePacks] };
confirmAnswer = false;
await resetHandler.call({ async render() { renderCalled = true; } });
assert.equal(confirmCalls, 1, "Reset asks for confirmation");
assert.equal(renderCalled, false, "Declined reset does not re-render");
assert.deepEqual({ ...settingsStore[SETTINGS.sourcePacks] }, beforeReset, "Declined reset leaves settings untouched");
confirmAnswer = true;
await resetHandler.call({
  async render() { renderCalled = true; }
});

assert.deepEqual({ ...settingsStore[SETTINGS.sourcePacks] }, {}, "Reset clears sourcePacks setting to empty object");
assert.equal(renderCalled, true, "Reset triggers app re-render");
assert.ok(
  notifications.some((n) => n.msg === "SIMPLYSF2E.Sources.ResetDone"),
  "Notification shown on reset"
);

console.log("sources-app.test.mjs: context preparation, form submission, and reset assertions passed");
