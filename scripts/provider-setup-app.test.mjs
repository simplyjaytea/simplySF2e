// Provider Setup window behaviour with stubbed Foundry globals and a tiny DOM:
// Load models keeps unsaved Jev edits, a switch is refused while a run is busy,
// Enter binds once per window frame, and provider errors reach ui.notifications as escaped values.
// Run: node scripts/provider-setup-app.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import * as connect from "./provider-connect.mjs";
import { esc } from "./text.mjs";
import { parsePrice } from "./cost.mjs";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

const source = await readFile(new URL("./provider-setup-app.mjs", import.meta.url), "utf8");

// --- stubbed state -----------------------------------------------------------
let providerState;
let jevStored;
let activePrices;
let listModels;
let saveCalls;
let selectCalls;
let createCalls;
let confirmAnswer;
let confirmCalls;
const errors = [];
const warnings = [];
const runningApps = new Map();

const resetState = () => {
  providerState = {
    connectionId: "conn-1", connectionName: "DeepSeek",
    connections: [{ id: "conn-1", name: "DeepSeek", active: true }, { id: "conn-2", name: "OpenRouter", active: false }],
    baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash",
    provider: { id: "deepseek", name: "DeepSeek" }, hasConfiguredApiKey: true
  };
  jevStored = { apiKey: "", source: "openrouter", endpoint: "" };
  activePrices = { inputPerM: null, outputPerM: null };
  listModels = async () => ["model-a", "model-b"];
  saveCalls = 0;
  selectCalls = [];
  createCalls = 0;
  confirmAnswer = true;
  confirmCalls = 0;
  errors.length = 0;
  warnings.length = 0;
  runningApps.clear();
};
resetState();

// A window frame: querySelector answers from registered controls; listeners are recorded.
function makeForm() {
  const controls = new Map();
  const listeners = [];
  return {
    listeners,
    addEventListener: (type, fn) => listeners.push({ type, fn }),
    querySelector: (selector) => controls.get(selector) ?? null,
    querySelectorAll: () => [],
    setAttribute() {}, removeAttribute() {},
    control(selector, props = {}) {
      const el = {
        ...props,
        clicks: 0,
        listeners: [],
        addEventListener(type, fn) { this.listeners.push({ type, fn }); },
        click() { this.clicks += 1; }
      };
      controls.set(selector, el);
      return el;
    }
  };
}

function standardForm() {
  const form = makeForm();
  form.control("[name='activeConnection']", { value: "conn-1" });
  form.control("[name='jevSource']", { value: "openrouter" });
  form.control("[name='jevEndpoint']", { value: "" });
  form.control("[name='jevApiKey']", { value: "" });
  form.control("[name='clearJevApiKey']", { checked: false });
  form.control("[name='apiBaseUrl']", { value: providerState.baseUrl });
  form.control("[name='model']", { value: providerState.model });
  form.control("[name='connectionName']", { value: providerState.connectionName });
  form.control("[name='apiKey']", { value: "" });
  form.control("[name='inputPerM']", { value: "" });
  form.control("[name='outputPerM']", { value: "" });
  form.control("#spf-provider-model-list", { innerHTML: "" });
  form.control("[data-action='saveAndTest']");
  return form;
}

// --- module under test ---------------------------------------------------------
class ApplicationV2 {
  constructor(options = {}) { this.options = options; this.element = null; this.renders = 0; this.closed = 0; }
  async render() { this.renders += 1; }
  async close() { this.closed += 1; }
}

const context = vm.createContext({
  console: { log() {}, debug() {}, warn() {}, error() {} },
  game: { i18n: { localize: (key) => key, format: (key) => key } },
  ui: {
    notifications: {
      info() {},
      warn: (key, options) => warnings.push([key, options]),
      error: (key, options) => errors.push([key, options])
    }
  },
  foundry: {
    applications: {
      api: {
        ApplicationV2,
        HandlebarsApplicationMixin: (Base) => Base,
        DialogV2: { confirm: async (options) => { confirmCalls += 1; return confirmAnswer; } }
      },
      instances: { values: () => runningApps.values() }
    }
  },
  Promise, AbortController
});

// Stored settings as the snapshot reads them (SETTINGS keys), taken from the stubbed provider state.
const storedSetting = (key) => ({
  apiBaseUrl: providerState.baseUrl, model: providerState.model, apiKey: "",
  apiKeyBaseUrl: providerState.baseUrl, providerBank: []
})[key];

// Real pure helpers; stubs for everything that touches Foundry settings, the network or the Jev route.
const mocks = {
  MODULE_ID: "simplysf2e",
  SETTINGS: { apiBaseUrl: "apiBaseUrl", model: "model", apiKey: "apiKey", apiKeyBaseUrl: "apiKeyBaseUrl", providerBank: "providerBank" },
  createProviderConnection: async (data) => { createCalls += 1; return data; },
  deleteProviderConnection: async () => {},
  ensureProviderBank: async () => {},
  getActiveProviderPrices: () => activePrices,
  getJevRequestConfig: () => jevStored,
  getProviderAuthWarningKey: () => null,
  getProviderRequestConfig: () => providerState,
  normalizeApiBaseUrl: (value) => String(value ?? "").trim().replace(/\/+$/, ""),
  selectProviderConnection: async (id) => { selectCalls.push(id); },
  setActiveProviderPrices: async () => {},
  connectionFormDirty: connect.connectionFormDirty,
  connectionFormValues: connect.connectionFormValues,
  savedConnectionForDirty: connect.savedConnectionForDirty,
  snapshotProviderConnection: () => connect.snapshotProviderConnection((key) => storedSetting(key)),
  saveProviderConnection: async () => { saveCalls += 1; return { state: providerState, provider: providerState.provider, model: providerState.model }; },
  listProviderModels: async () => listModels(),
  testProviderConnection: async () => ({ total: 1 }),
  JEV_SOURCES: { openrouter: { id: "openrouter", label: "OpenRouter" }, typesafe: { id: "typesafe", label: "TypeSafe AI" } },
  TYPESAFE_JEV_ENDPOINT: "https://api.typesafe.ai/v1/systemone",
  normalizeJevSource: (value) => (value === "typesafe" ? "typesafe" : "openrouter"),
  normalizeTypeSafeEndpoint: (value) => String(value ?? "").trim(),
  testJevConnection: async () => ({ ok: true }),
  esc,
  parsePrice
};

const module = new vm.SourceTextModule(source, { context });
await module.link((specifier) => {
  const names = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .filter((match) => match[2] === specifier)
    .flatMap((match) => match[1].split(",").map((name) => name.trim()));
  return new vm.SyntheticModule(names, function () {
    for (const name of names) {
      if (!(name in mocks)) throw new Error(`Unexpected dependency: ${specifier} ${name}`);
      this.setExport(name, mocks[name]);
    }
  }, { context });
});
await module.evaluate();
const App = module.namespace.ProviderSetupApp;
const actions = App.DEFAULT_OPTIONS.actions;

const newApp = (form) => {
  const app = new App();
  app.element = form;
  app._onRender({}, {});
  return app;
};

// (a) Load models keeps an unsaved Jev source: the list is updated in place, no render.
{
  resetState();
  const form = standardForm();
  form.querySelector("[name='jevSource']").value = "typesafe";
  const app = newApp(form);
  const rendersBefore = app.renders;
  await actions.loadModels.call(app, null, { querySelector: () => null });
  assert.equal(form.querySelector("[name='jevSource']").value, "typesafe", "the unsaved Jev source is still in the form");
  assert.equal(app.renders, rendersBefore, "Load models does not re-render the window");
  assert.equal(form.querySelector("#spf-provider-model-list").innerHTML,
    '<option value="model-a"></option><option value="model-b"></option>', "the model list is filled in place");
  assert.equal(saveCalls, 1, "the chat settings were saved once");
}

// (b) A switch is refused while a run is busy, in this window or another, and the select goes back.
{
  resetState();
  const form = standardForm();
  const app = newApp(form);
  const select = form.querySelector("[name='activeConnection']");
  const changed = (value) => {
    select.value = value;
    for (const { type, fn } of select.listeners) if (type === "change") fn({ currentTarget: select });
  };
  // Own run: Load models is in flight.
  let release;
  listModels = () => new Promise((resolve) => { release = () => resolve(["model-a"]); });
  const loading = actions.loadModels.call(app, null, { querySelector: () => null });
  changed("conn-2");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(selectCalls, [], "own busy: no switch");
  assert.equal(select.value, "conn-1", "own busy: the select is put back");
  assert.equal(warnings.at(-1)?.[0], "SIMPLYSF2E.ProviderSetup.BusySwitch", "own busy: the notice names the run");
  release();
  await loading;
  // Another window runs a generation, and this form has an unsaved edit: refused before any dialog.
  runningApps.set("generator", { _progress: { steps: [] } });
  form.querySelector("[name='model']").value = "unsaved-model";
  const dialogsBefore = confirmCalls;
  changed("conn-2");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(confirmCalls, dialogsBefore, "another window busy: refused without asking about unsaved edits");
  form.querySelector("[name='model']").value = providerState.model;
  assert.deepEqual(selectCalls, [], "another window busy: no switch");
  assert.equal(select.value, "conn-1", "another window busy: the select is put back");
  assert.equal(warnings.at(-1)?.[0], "SIMPLYSF2E.ProviderSetup.BusySwitch", "another window busy: the notice names the run");
  runningApps.clear();
  // Idle: the switch goes through.
  changed("conn-2");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(selectCalls, ["conn-2"], "idle: the switch goes through");
}

// (c) Enter runs Save & Test once per window frame, including after a re-render of a new frame.
{
  resetState();
  const first = standardForm();
  const second = standardForm();
  const app = new App();
  const enter = (form) => {
    const event = {
      key: "Enter", isComposing: false, defaultPrevented: false,
      target: { tagName: "INPUT", type: "text" },
      preventDefault() {}
    };
    for (const { type, fn } of form.listeners) if (type === "keydown") fn(event);
  };
  app.element = first;
  app._onRender({}, {});
  enter(first);
  assert.equal(first.querySelector("[data-action='saveAndTest']").clicks, 1, "first frame: Enter clicks Save & Test");
  app.element = second;
  app._onRender({}, {});
  enter(second);
  assert.equal(second.querySelector("[data-action='saveAndTest']").clicks, 1, "a new frame is bound: Enter clicks Save & Test");
  assert.equal(first.querySelector("[data-action='saveAndTest']").clicks, 1, "the old frame is not clicked again");
  app._onRender({}, {});
  enter(second);
  assert.equal(second.querySelector("[data-action='saveAndTest']").clicks, 2, "re-rendering the same frame does not bind twice");
  assert.equal(second.listeners.filter((entry) => entry.type === "keydown").length, 1, "one keydown listener per frame");
}

// (d) A provider error reaches the notification as an escaped format value.
{
  resetState();
  listModels = async () => { throw new Error("<b>x</b>"); };
  const app = newApp(standardForm());
  await actions.loadModels.call(app, null, { querySelector: () => null });
  const [key, options] = errors.at(-1);
  assert.equal(key, "SIMPLYSF2E.ProviderSetup.ModelsFailed", "the failure uses the localized key");
  // Objects from the vm context have their own prototypes, so compare fields rather than deepEqual.
  assert.equal(options.localize, true, "localized key");
  assert.equal(options.escape, true, "values are escaped");
  assert.equal(options.format.message, "<b>x</b>", "the provider text is a format value");
}

// (e) Create asks before a render would drop unsaved Jev edits; Stay keeps the connection list as it was.
{
  resetState();
  const form = standardForm();
  form.querySelector("[name='jevApiKey']").value = "typed-key";
  const app = newApp(form);
  confirmAnswer = false;
  await actions.createConnection.call(app, null, {});
  assert.equal(confirmCalls, 1, "the unsaved-edits dialog is shown");
  assert.equal(createCalls, 0, "Stay: no connection is created");
  confirmAnswer = true;
  await actions.createConnection.call(app, null, {});
  assert.equal(createCalls, 1, "Switch anyway: the connection is created");
}

console.log("provider-setup-app.test.mjs: ok");
