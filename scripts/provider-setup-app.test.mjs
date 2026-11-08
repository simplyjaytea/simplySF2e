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
let deleteCalls;
let confirmAnswer;
let confirmCalls;
let lastConfirm;
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
  deleteCalls = 0;
  confirmAnswer = true;
  confirmCalls = 0;
  lastConfirm = null;
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

// A parent element with a slot for the "key is saved" hint: querySelector finds it, remove() clears it.
function hintSlot() {
  return {
    hint: null,
    querySelector(selector) { return selector === ".spf-key-saved" ? this.hint : null; }
  };
}

function standardForm() {
  const form = makeForm();
  form.control("[name='activeConnection']", { value: "conn-1" });
  form.control("[name='jevSource']", { value: "openrouter" });
  form.control("[name='jevEndpoint']", { value: "" });
  form.control("[name='jevApiKey']", { value: "", parentElement: hintSlot() });
  form.control("[name='clearJevApiKey']", { checked: false });
  form.control("[name='apiBaseUrl']", { value: providerState.baseUrl });
  form.control("[name='model']", { value: providerState.model });
  form.control("[name='connectionName']", { value: providerState.connectionName });
  form.control("[name='apiKey']", { value: "", parentElement: hintSlot(), insertAdjacentHTML(position, html) { if (position === "afterend" && html.includes("spf-key-saved")) this.parentElement.hint = { remove() { this.owner.hint = null; }, owner: this.parentElement }; } });
  form.control("[name='clearApiKey']", { checked: false });
  form.control("[name='inputPerM']", { value: "" });
  form.control("[name='outputPerM']", { value: "" });
  form.control("#spf-provider-model-list", { innerHTML: "" });
  form.control(".spf-provider-privacy", {
    inserted: [],
    insertAdjacentHTML(position, html) { this.inserted.push([position, html]); }
  });
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
        DialogV2: { confirm: async (options) => { confirmCalls += 1; lastConfirm = options; return confirmAnswer; } }
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
  deleteProviderConnection: async () => { deleteCalls += 1; },
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
  saveProviderConnection: async (data = {}) => {
    saveCalls += 1;
    // A typed key is stored; a clear request removes it. The returned state reflects that, as the real save does.
    if (data.enteredApiKey) providerState.hasConfiguredApiKey = true;
    if (data.clearApiKey) providerState.hasConfiguredApiKey = false;
    return { state: providerState, provider: providerState.provider, model: providerState.model };
  },
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

// (f) Load models that stores a typed key: the key field reads as saved, the clear-key box appears unchecked,
// and the unsaved Jev source is untouched.
{
  resetState();
  providerState.hasConfiguredApiKey = false;
  const form = standardForm();
  form.querySelector("[name='apiKey']").value = "sk-new-secret";
  form.querySelector("[name='jevSource']").value = "typesafe";
  const privacy = form.querySelector(".spf-provider-privacy");
  const app = newApp(form);
  await actions.loadModels.call(app, null, { querySelector: () => null });
  assert.equal(form.querySelector("[name='apiKey']").value, "", "the typed key was stored and the field is cleared");
  assert.equal(form.querySelector("[name='apiKey']").placeholder, "", "a saved key leaves the placeholder empty; the hint carries the message");
  assert.equal(privacy.inserted.length, 1, "the clear-key box is added once");
  assert.equal(privacy.inserted[0][0], "beforebegin", "the box goes before the privacy note, as in the template");
  assert.match(privacy.inserted[0][1], /name="clearApiKey"/, "the box is the clear-key checkbox");
  assert.doesNotMatch(privacy.inserted[0][1], /checked/, "the box is unchecked");
  assert.equal(form.querySelector("[name='jevSource']").value, "typesafe", "the unsaved Jev source is intact");
  const keyGroup = form.querySelector("[name='apiKey']").parentElement;
  assert.ok(keyGroup.querySelector(".spf-key-saved"), "after storing a key the saved hint is present");
  // Clear the stored key through the clear-key box and Load models again: hint gone, placeholder back.
  form.querySelector("[name='clearApiKey']").checked = true;
  await actions.loadModels.call(app, null, { querySelector: () => null });
  assert.equal(keyGroup.querySelector(".spf-key-saved"), null, "after clearing the key the saved hint is removed");
  assert.equal(form.querySelector("[name='apiKey']").placeholder, "SIMPLYSF2E.ProviderSetup.ApiKeyOptional", "and the placeholder is the no-key one");
}

// (g) Delete and switch with unsaved edits each ask with their own label.
{
  resetState();
  const deleteForm = standardForm();
  deleteForm.querySelector("[name='jevApiKey']").value = "typed";
  const deleteApp = newApp(deleteForm);
  confirmAnswer = true;
  await actions.deleteConnection.call(deleteApp, null, {});
  assert.equal(lastConfirm.yes.label, "SIMPLYSF2E.ProviderSetup.UnsavedContinue", "Delete with unsaved edits asks to Continue");
  assert.equal(deleteCalls, 1, "Continue deletes the connection");

  resetState();
  const switchForm = standardForm();
  switchForm.querySelector("[name='model']").value = "unsaved-model";
  newApp(switchForm);
  const select = switchForm.querySelector("[name='activeConnection']");
  select.value = "conn-2";
  for (const { type, fn } of select.listeners) if (type === "change") fn({ currentTarget: select });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lastConfirm.yes.label, "SIMPLYSF2E.ProviderSetup.UnsavedSwitch", "a switch with unsaved edits asks with Switch");
  assert.deepEqual(selectCalls, ["conn-2"], "Switch anyway switches");
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
  assert.equal(lastConfirm.yes.label, "SIMPLYSF2E.ProviderSetup.UnsavedContinue", "Create asks to Continue, not Switch");
  assert.equal(createCalls, 0, "Stay: no connection is created");
  confirmAnswer = true;
  await actions.createConnection.call(app, null, {});
  assert.equal(createCalls, 1, "Switch anyway: the connection is created");
}

// (h) A rejected manual price names its field, so the template can mark that input invalid and link the message.
{
  resetState();
  const form = standardForm();
  form.querySelector("[name='inputPerM']").value = "-1";
  const app = newApp(form);
  await actions.saveAndTest.call(app, null, { querySelector: () => null });
  const context = await app._prepareContext();
  assert.equal(context.priceErrorField, "input", "the input price is the invalid field");
  assert.equal(context.priceError, "SIMPLYSF2E.ProviderSetup.PriceInputInvalid", "its message is in the context");
  form.querySelector("[name='inputPerM']").value = "0.5";
  form.querySelector("[name='outputPerM']").value = "-2";
  await actions.saveAndTest.call(app, null, { querySelector: () => null });
  const outputContext = await app._prepareContext();
  assert.equal(outputContext.priceErrorField, "output", "a rejected output price names the output field");
}

console.log("provider-setup-app.test.mjs: ok");
