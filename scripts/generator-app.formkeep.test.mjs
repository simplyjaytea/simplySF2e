// R4-GEN: a re-render never throws away typed-but-not-generated form edits.
// Runs the unmodified GeneratorApp on top of the REAL SpfApp (app-base.mjs),
// with a fake ApplicationV2 whose render rebuilds the form from the stored
// input, the way Foundry replaces the part's HTML. Then source scans pin
// every handler named in the R4-GEN report and the skip-once sites.
// Run: node scripts/generator-app.formkeep.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import * as windowParts from "./window-parts.mjs";
import * as sounds from "./sounds.mjs";
import { progressView } from "./progress.mjs";
import * as recentGenerations from "./recent-generations.mjs";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

const FIELDS = ["prompt", "level", "rarity", "adjustment", "preset", "partySize", "threat", "treasureAmount", "rarityCap", "multiclass"];

/** A fake rendered form: shows `input`, lets the test type into it, and records listeners. */
function makeForm(input) {
  const fields = Object.fromEntries(FIELDS.map((name) => [name, { value: String(input[name] ?? "") }]));
  const spell = { checked: input.allowSpellcasting };
  const listeners = [];
  const on = (target) => Object.assign(target, {
    addEventListener: (type, fn) => listeners.push({ target, type, fn }),
    focus() {}
  });
  const radios = ["monster", "npc", "encounter", "character", "reskin"].map((value) => on({ value, checked: value === input.mode }));
  for (const field of Object.values(fields)) on(field);
  return {
    fields, radios, listeners,
    classList: { toggle() {} },
    addEventListener() {},
    querySelector(selector) {
      const name = /\[name=["']?(\w+)["']?\]/.exec(selector)?.[1];
      if (name === "mode") return radios.find((radio) => radio.checked) ?? null;
      if (name === "allowSpellcasting") return spell;
      return fields[name] ?? null;
    },
    querySelectorAll(selector) {
      return selector.includes('name="mode"') ? radios : [];
    },
    /** Type into a field. */
    type(name, value) { fields[name].value = String(value); },
    /** Click a mode radio and fire its change listener. */
    async pickMode(mode) {
      for (const radio of radios) radio.checked = radio.value === mode;
      const radio = radios.find((r) => r.value === mode);
      await listeners.find((l) => l.target === radio && l.type === "change").fn();
    },
    async change(name) {
      await listeners.find((l) => l.target === fields[name] && l.type === "change").fn();
    }
  };
}

let authWarning = null;
let presetDefaults = null;
const settingWrites = [];
const context = vm.createContext({
  AbortController,
  console: { log() {}, debug() {}, warn() {}, error() {} },
  game: {
    i18n: { localize: (key) => key, format: (key) => key },
    settings: { get: () => undefined, set: async (_module, key, value) => { settingWrites.push({ key, value }); } },
    users: []
  },
  ui: { notifications: { info() {}, warn() {}, error() {} } },
  foundry: {
    applications: {
      instances: { values: () => [][Symbol.iterator]() },
      api: {
        // Foundry replaces the form with the stored input on every render.
        ApplicationV2: class FakeApplicationV2 {
          constructor(options = {}) { this.options = options; this.renders = 0; }
          async render() {
            this.renders += 1;
            this.context = await this._prepareContext();
            this.element = makeForm(this.context.input);
            // A full render replaces every part, so each one is bound again.
            for (const part of ["status", "brief", "result"]) this._onPartRendered(part, this.element);
            this._onRender(this.context, {});
            return this;
          }
          async close() { return this; }
        },
        DialogV2: { async confirm() { return true; } },
        HandlebarsApplicationMixin: (Base) => class extends Base {}
      }
    }
  }
});
globalThis.game = context.game;
const generatorContext = Object.assign({}, ...await Promise.all(readdirSync(new URL("./generator-context/", import.meta.url))
  .filter((file) => file.endsWith(".mjs")).map((file) => import(`./generator-context/${file}`))));

const mocks = {
  ...windowParts,
  ...sounds,
  interfaceSoundLevel: () => "off",
  interfaceSoundVolume: () => 1,
  ...generatorContext,
  ...recentGenerations,
  progressView,
  MODULE_ID: "simplysf2e",
  SETTINGS: { generatorInput: "generatorInput", runTokenBudget: "runTokenBudget", runDeadline: "runDeadline" },
  getSetting: () => undefined,
  restoreGeneratorInput: (_saved, defaults) => defaults,
  rememberedInput: (input) => {
    const { prompt: _prompt, ...rest } = input;
    return rest;
  },
  getProviderRequestConfig: () => ({ connections: [] }),
  getProviderAuthWarningKey: () => authWarning,
  getActiveProviderPrices: () => ({}),
  getCustomPresets: () => [],
  findPreset: () => presetDefaults,
  examplePrompt: () => "",
  presetPickerGroups: (selectedId) => ({ selectedId: selectedId ?? "", standard: [], custom: [] }),
  THREATS: { moderate: {}, severe: {} },
  TREASURE_AMOUNT_MULTIPLIER: { standard: 1 },
  jevKeySource: () => null,
  describeMissingSources: () => "",
  activeParty: () => null,
  beginRunBudget: () => null,
  endRunBudget: () => {},
  ProviderSetupApp: class { render() { return this; } }
};
const linkWith = (text, extra = {}) => (specifier) => {
  if (extra[specifier]) return extra[specifier];
  const imports = [...text.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .filter((match) => match[2] === specifier).flatMap((match) => match[1].split(",").map((name) => name.trim()));
  return new vm.SyntheticModule(imports, function () {
    for (const name of imports) this.setExport(name, mocks[name] ?? (() => { throw new Error(`Unexpected dependency: ${name}`); }));
  }, { context });
};
const baseSource = await readFile(new URL("./app-base.mjs", import.meta.url), "utf8");
const baseModule = new vm.SourceTextModule(baseSource, { context });
await baseModule.link(linkWith(baseSource));
await baseModule.evaluate();
const source = await readFile(new URL("./generator-app.mjs", import.meta.url), "utf8");
const appModule = new vm.SourceTextModule(source, { context });
await appModule.link(linkWith(source, { "./app-base.mjs": baseModule }));
await appModule.evaluate();
const { GeneratorApp } = appModule.namespace;
const actions = GeneratorApp.DEFAULT_OPTIONS.actions;

async function openApp() {
  const app = new GeneratorApp();
  await app.render(true);
  return app;
}

// 1. A handler that renders without reading the form (Forget recent) keeps typed edits.
{
  const app = await openApp();
  app.element.type("prompt", "a rust-eaten salvage drone");
  app.element.type("level", 7);
  app.element.type("threat", "severe");
  await actions.forgetRecent.call(app, null, { dataset: { recentId: "none" } });
  assert.equal(app.context.input.prompt, "a rust-eaten salvage drone", "Forget recent keeps the typed prompt");
  assert.equal(app.context.input.level, 7, "Forget recent keeps the typed level");
  assert.equal(app.context.input.threat, "severe", "Forget recent keeps the typed threat");
  assert.equal(app.element.fields.prompt.value, "a rust-eaten salvage drone", "the re-rendered form still shows the typed prompt");
}

// 2. Dismiss and an outside plain render (Provider Setup's callback, Manage Presets) keep typed edits.
{
  const app = await openApp();
  app.element.type("prompt", "void cult ambush");
  await actions.dismissCharacterReview.call(app);
  assert.equal(app.context.input.prompt, "void cult ambush", "Dismiss keeps the typed prompt");
  app.element.type("level", 12);
  await app.render();   // the Provider Setup / Manage Presets callback is a plain render
  assert.equal(app.context.input.level, 12, "an outside render (Provider Setup, Manage Presets) keeps the typed level");
}

// 3. setInput (chat "/sf2e npc 5"): the new values win over the old form.
{
  const app = await openApp();
  app.element.type("prompt", "typed first");
  app.setInput({ mode: "npc", level: 5 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(app.context.input.mode, "npc", "setInput's mode is shown");
  assert.equal(app.context.input.level, 5, "setInput's level is shown, not read back from the old form");
  assert.equal(app._skipFormReadOnce, false, "the skip-once flag is consumed by its render");
}

// 4. Mode switch: the previous mode's draft is not read back as the new mode's prompt.
{
  const app = await openApp();
  app.element.type("prompt", "a monster draft");
  await app.element.pickMode("character");
  assert.equal(app.context.input.mode, "character", "the picked mode is shown");
  assert.equal(app.context.input.prompt, "", "the character prompt is its own (empty) draft, not the monster text");
  await app.element.pickMode("monster");
  assert.equal(app.context.input.prompt, "a monster draft", "switching back restores the monster draft");
}

// 5. Preset change: the preset's saved defaults are shown, not read back from the old form.
{
  const app = await openApp();
  presetDefaults = { rarity: "rare" };
  app.element.type("preset", "custom-1");
  await app.element.change("preset");
  await new Promise((resolve) => setTimeout(resolve, 0));   // the handler does not await its render
  presetDefaults = null;
  assert.equal(app.context.input.rarity, "rare", "the preset's rarity is applied");
  assert.equal(app.context.input.preset, "custom-1");
}

// 6. Welcome sample (remember: false): the GM's input comes back, nothing of the sample is persisted.
{
  const app = await openApp();
  app.element.type("level", 9);
  app.element.type("preset", "gm-preset");
  app.element.type("rarity", "uncommon");
  app.element.type("prompt", "my own idea");
  await app.render();   // the GM's settings are remembered as usual
  settingWrites.length = 0;
  authWarning = "SIMPLYSF2E.Generator.NoKey";   // stop the sample run at its readiness check
  await app.runFromChat({ mode: "monster", prompt: "sample prompt", level: 1, rarity: "common", preset: "" }, { remember: false });
  authWarning = null;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(settingWrites, [], "the sample run persists nothing");
  assert.equal(app.context.input.level, 9, "the GM's level is back after the sample");
  assert.equal(app.context.input.preset, "gm-preset", "the GM's preset is back after the sample");
  assert.equal(app.context.input.rarity, "uncommon", "the GM's rarity is back after the sample");
  assert.equal(app.context.input.mode, "monster", "the sample's mode stays, so its preview stays on screen");
  assert.equal(app.context.input.prompt, "my own idea", "the GM's draft for that mode is back");
  // The GM's next interaction must not persist the sample's values.
  await actions.forgetRecent.call(app, null, { dataset: { recentId: "none" } });
  assert.ok(settingWrites.every((write) => write.value.level !== 1 && write.value.preset !== ""),
    "the next interaction never remembers the sample's level or preset");
}

// 7. A normal chat command still remembers its input.
{
  const app = await openApp();
  settingWrites.length = 0;
  authWarning = "SIMPLYSF2E.Generator.NoKey";
  await app.runFromChat({ mode: "npc", prompt: "dock foreman", level: 5 });
  authWarning = null;
  assert.equal(app.context.input.level, 5, "a chat command's level stays");
  assert.ok(settingWrites.some((write) => write.value.mode === "npc" && write.value.level === 5), "a chat command is remembered");
}

// --- Source scans: every handler named in the report renders through SpfApp.render. ---
const base = baseSource;
const body = (text, signature) => {
  const start = text.indexOf(signature);
  assert.notEqual(start, -1, `${signature} not found`);
  const open = text.indexOf("{", start + signature.length - 1);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error(`${signature} has no end`);
};
const render = body(base, "async render(options = {}, _options = {}) {");
assert.match(render, /_keepFormBeforeRender\(\)/, "SpfApp.render reads the form before rendering");
assert.ok(render.indexOf("_skipFormReadOnce = false") < render.indexOf("if (this._closed && !forced) return this"),
  "a dropped render still consumes the skip-once flag");
assert.match(body(base, "_keepFormBeforeRender() {"), /if \(!this\.element\) return;/, "no read before the first render");
assert.match(body(base, "_openProviderSetup() {"), /ProviderSetupApp\.open\(\(\) => this\._renderStatus\(\)\)/,
  "the Provider Setup callback re-renders the status strip");
assert.match(body(base, "async _renderStatus() {"), /return this\.render\(this\.constructor\.WINDOW_ID \? \{ parts: \["status"\] \} : \{\}\);/,
  "the status render goes through SpfApp.render (the base reads the form)");

for (const signature of [
  "async #refitMemberLoot(member) {",
  "static async #onCreateActor() {",
  "static async #onRerollLoot() {",
  "static async #onRerollPick(_event, target) {",
  "static async #onDiscard() {",
  "static async #onDismissCharacterReview() {",
  "static async #onForgetRecent(event, target) {",
  "static async #onGenerateAnother() {"
]) {
  const handler = body(source, signature);
  assert.match(handler, /this\.render\(/, `${signature} re-renders through SpfApp.render`);
  assert.doesNotMatch(handler, /_skipFormReadOnce/, `${signature} sets no input, so it must not skip the form read`);
}

// Every path that sets input and then renders skips exactly one read, right before its render.
const skipSites = {
  "setInput(updates = {}) {": "show the merged input",
  "async runFromChat(updates = {}, { remember = true } = {}) {": "show the merged input",
  "#restoreAfterSample({ input, modePrompts }) {": "show the restored input",
  "#stepReskinLevel(delta) {": "the re-level box still shows the old level",
  "static async #onUseParty() {": "show the party's level and size",
  "async reskinFromUuid(uuid) {": "show Reskin",
  "static async #onOpenRecent(event, target) {": "show the restored mode"
};
for (const [signature, note] of Object.entries(skipSites)) {
  const handler = body(source, signature);
  assert.match(handler, /this\._skipFormReadOnce = true;[^\n]*\n\s*(?:await )?this\.render\(/, `${signature} skips the read right before its render`);
  assert.ok(handler.includes(note), `${signature} says why it skips`);
}
const onRender = body(source, "_onPartRendered(partId, element) {");
assert.match(onRender, /this\.#exampleTick\+\+;\s*this\._skipFormReadOnce = true;[^\n]*\n\s*this\.render\(\{ parts: \["brief"\] \}\);/, "the preset change skips the read");
assert.match(onRender, /const selectedMode = this\.#input\.mode;[\s\S]*?this\._skipFormReadOnce = true;\s*await this\.render\(\);/, "the mode switch skips the read");
assert.equal((source.match(/this\._skipFormReadOnce = true/g) ?? []).length, Object.keys(skipSites).length + 2,
  "no other Generator path skips the form read");

// A reskin drop that is still loading must not take the previous source's re-level box.
assert.match(body(source, "#readForm() {"), /this\.#relevelShownFor === this\.#reskinSource/, "the re-level box is read only for the source it shows");
assert.match(onRender, /this\.#relevelShownFor = this\.#reskinSource;/);

// The sample restore keeps the preview and runs before persisting resumes.
const chat = body(source, "async runFromChat(updates = {}, { remember = true } = {}) {");
assert.ok(chat.indexOf("this.#restoreAfterSample(gmInput)") < chat.lastIndexOf("this.#rememberInputSuspended = previousRememberSuspension"),
  "the GM's input is restored before persisting resumes");
assert.doesNotMatch(body(source, "#restoreAfterSample({ input, modePrompts }) {"),
  /#concept|#encounter|#pcConcept|#reskinFlavor|#resolved|#manifest|#stashPreview/, "the sample's preview is kept");

// The other tool windows: only paths that set input skip the read.
const other = {
  "itemforge-app.mjs": ["static async #onSelectKind(_event, target) {"],
  "treasure-app.mjs": ["static async #onUseParty() {"],
  "shop-app.mjs": []
};
for (const [file, sites] of Object.entries(other)) {
  const text = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
  assert.match(text, /extends SpfApp/, `${file} extends SpfApp`);
  assert.match(text, /_preserveForm\(\) \{\s*this\.#readForm\(\);/, `${file} reads its form in _preserveForm`);
  for (const signature of sites) {
    assert.match(body(text, signature), /this\._skipFormReadOnce = true;[^\n]*\n\s*await this\.render\(/, `${file} ${signature} skips the read`);
  }
  assert.equal((text.match(/this\._skipFormReadOnce = true/g) ?? []).length, sites.length, `${file} has no other skip`);
}
// Provider Setup keeps its own in-place logic and is not an SpfApp.
const providerSetup = await readFile(new URL("./provider-setup-app.mjs", import.meta.url), "utf8");
assert.doesNotMatch(providerSetup, /extends SpfApp/, "Provider Setup is not routed through the form read");

console.log("generator-app.formkeep.test.mjs: re-renders keep typed edits; skip-once paths show their new input");
