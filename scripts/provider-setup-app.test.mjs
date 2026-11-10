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
let confirmHook = null;
let refreshCalls = [];
let priceWrites = [];
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
  confirmHook = null;
  errors.length = 0;
  warnings.length = 0;
  runningApps.clear();
  refreshCalls = [];
  priceWrites = [];
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
  game: { i18n: { localize: (key) => key, format: (key, data = {}) => key + "|" + Object.values(data).join("|") } },
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
        DialogV2: { confirm: async (options) => { confirmCalls += 1; lastConfirm = options; if (confirmHook) confirmHook(); return confirmAnswer; } }
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
  anotherRunInProgress: (self) => [...runningApps.values()].some((app) => app !== self && (app?._progress || app?._generationAbort)),
  refreshOtherConnectionViews: async (self) => { refreshCalls.push(self); },
  selectProviderConnection: async (id) => { selectCalls.push(id); },
  // Writes the active prices, as the real one does (cleared by `{}`).
  setActiveProviderPrices: async (prices = {}) => {
    priceWrites.push(prices);
    activePrices = { inputPerM: parsePrice(prices.inputPerM).value, outputPerM: parsePrice(prices.outputPerM).value };
  },
  connectionFormDirty: connect.connectionFormDirty,
  connectionFormValues: connect.connectionFormValues,
  savedConnectionForDirty: connect.savedConnectionForDirty,
  snapshotProviderConnection: () => connect.snapshotProviderConnection((key) => storedSetting(key)),
  saveProviderConnection: async (data = {}) => {
    saveCalls += 1;
    // As the real save: a changed base URL moves the endpoint and clears the manual prices.
    const baseChanged = data.baseUrl !== undefined && mocks.normalizeApiBaseUrl(data.baseUrl) !== providerState.baseUrl;
    if (baseChanged) {
      providerState.baseUrl = mocks.normalizeApiBaseUrl(data.baseUrl);
      activePrices = { inputPerM: null, outputPerM: null };
    }
    // Prices passed to the save are written in that same step (never a second call), unless the
    // endpoint changed and they were not edited.
    if (data.prices && !(baseChanged && !data.pricesEdited)) await mocks.setActiveProviderPrices(data.prices);
    // The model in the form is stored, as the real save does.
    if (data.model) providerState.model = data.model;
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
  assert.equal(confirmCalls, 1, "Delete with unsaved edits asks once");
  assert.equal(lastConfirm.window.title, "SIMPLYSF2E.ProviderSetup.DeleteTitle", "the one dialog is the delete dialog");
  assert.ok(lastConfirm.content.includes("SIMPLYSF2E.ProviderSetup.UnsavedBodyDelete"), "it carries the delete unsaved-edits sentence");
  assert.ok(!lastConfirm.content.includes("UnsavedBodyContinue"), "and not the Continue sentence");
  assert.equal(deleteCalls, 1, "confirming deletes with no further question");

  resetState();
  const cleanApp = newApp(standardForm());
  await actions.deleteConnection.call(cleanApp, null, {});
  assert.equal(confirmCalls, 1, "Delete without unsaved edits asks once");
  assert.ok(!lastConfirm.content.includes("UnsavedBody"), "and shows only the delete question");

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

// Source scan: #onDeleteConnection opens one dialog; #confirmDropEdits had 4 mentions on next, now 3.
{
  const start = source.indexOf("static async #onDeleteConnection()");
  const body = source.slice(start, source.indexOf("\n  }\n", start));
  assert.equal(body.split("DialogV2.confirm(").length - 1, 1, "exactly one DialogV2.confirm in #onDeleteConnection");
  assert.ok(!body.includes("#confirmDropEdits"), "#onDeleteConnection no longer calls #confirmDropEdits");
  const unsavedAt = body.indexOf("#unsavedEditsHtml({ continuing: true, deleting: true })");
  assert.ok(unsavedAt !== -1 && unsavedAt < body.indexOf("DialogV2.confirm("), "unsaved text is built before the dialog");
  assert.ok(body.slice(body.indexOf("DialogV2.confirm(")).includes("this.#busy"), "#busy is re-checked after the dialog");
  assert.ok(source.includes("async #confirmDropEdits("), "#confirmDropEdits still exists");
  assert.equal(source.split("#confirmDropEdits").length - 1, 3, "definition plus switch and create callers");
}

// (g2) Delete escapes the connection name in its dialog; a switch while the dialog is open deletes nothing.
{
  resetState();
  providerState.connectionName = "<img src=x onerror=1>";
  const escapeApp = newApp(standardForm());
  await actions.deleteConnection.call(escapeApp, null, {});
  assert.ok(lastConfirm.content.includes("&lt;img"), "the delete dialog escapes the connection name");
  assert.ok(!lastConfirm.content.includes("<img"), "no raw <img> tag reaches the delete dialog");

  resetState();
  const switchingApp = newApp(standardForm());
  // A real switch replaces the state object; the handler's `state` still holds the old one.
  confirmHook = () => { providerState = { ...providerState, connectionId: "conn-2" }; };
  await actions.deleteConnection.call(switchingApp, null, {});
  confirmHook = null;
  assert.equal(deleteCalls, 0, "a connection switch while the delete dialog is open deletes nothing");
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
  assert.ok(lastConfirm.content.includes("SIMPLYSF2E.ProviderSetup.UnsavedBodyContinue"), "Create carries the Continue sentence");
  assert.ok(!lastConfirm.content.includes("UnsavedBodyDelete"), "and not the delete sentence");
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

// (i) The active connection changes in another window while this form shows connection A.
// Save, Save & Test, Load models and the form submit write nothing, warn, and reload the form.
{
  const switchedAway = () => {
    // A real switch replaces the state object, as in (g2).
    providerState = {
      ...providerState, connectionId: "conn-2", connectionName: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1", model: "or-model"
    };
  };
  const submit = App.DEFAULT_OPTIONS.form.handler;
  const entries = {
    saveAndTest: (app) => actions.saveAndTest.call(app, null, { querySelector: () => null }),
    loadModels: (app) => actions.loadModels.call(app, null, { querySelector: () => null }),
    submit: (app) => submit.call(app, null, null, null)
  };
  for (const [name, run] of Object.entries(entries)) {
    resetState();
    const form = standardForm();
    form.control("button[type='submit']");
    const app = newApp(form);
    await app._prepareContext();
    switchedAway();
    form.querySelector("[name='model']").value = "typed-for-A";
    const rendersBefore = app.renders;
    await run(app);
    assert.equal(saveCalls, 0, `${name}: nothing is written to the new active connection`);
    assert.equal(providerState.model, "or-model", `${name}: the new connection keeps its model`);
    assert.equal(warnings.at(-1)?.[0], "SIMPLYSF2E.ProviderSetup.StaleConnection", `${name}: the stale-connection notice shows`);
    assert.equal(warnings.at(-1)?.[1]?.localize, true, `${name}: notice is localized by key`);
    assert.equal(app.renders, rendersBefore + 1, `${name}: the form is reloaded`);
    assert.equal(app.closed, 0, `${name}: the window stays open`);
    assert.equal(errors.length, 0, `${name}: no error toast`);
  }
  // The form rendered for the connection that is still active saves as before.
  resetState();
  const okApp = newApp(standardForm());
  await okApp._prepareContext();
  await actions.loadModels.call(okApp, null, { querySelector: () => null });
  assert.equal(saveCalls, 1, "an up-to-date form still saves");
  assert.equal(warnings.length, 0, "and warns nothing");
}

// (j) Another window's switch: a clean Provider Setup reloads; one with edits stays as it is.
{
  resetState();
  const clean = newApp(standardForm());
  await clean._prepareContext();
  await clean._refreshForConnectionChange();
  assert.equal(clean.renders, 0, "connection unchanged: nothing to reload");
  providerState = { ...providerState, connectionId: "conn-2", connectionName: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" };
  await clean._refreshForConnectionChange();
  assert.equal(clean.renders, 1, "a clean form reloads after another window switched");

  resetState();
  const dirtyForm = standardForm();
  const dirty = newApp(dirtyForm);
  await dirty._prepareContext();
  dirtyForm.querySelector("[name='model']").value = "typed";
  providerState = { ...providerState, connectionId: "conn-2", connectionName: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" };
  await dirty._refreshForConnectionChange();
  assert.equal(dirty.renders, 0, "a form with unsaved edits is not re-rendered");
  assert.equal(dirtyForm.querySelector("[name='model']").value, "typed", "and keeps the typed text");
}

// (k) Its own switch, create and delete refresh the other windows.
{
  resetState();
  const form = standardForm();
  const app = newApp(form);
  const select = form.querySelector("[name='activeConnection']");
  select.value = "conn-2";
  for (const { type, fn } of select.listeners) if (type === "change") fn({ currentTarget: select });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(refreshCalls, [app], "a switch refreshes the other windows");
  await actions.createConnection.call(app, null, {});
  assert.equal(refreshCalls.length, 2, "create refreshes the other windows");
  await actions.deleteConnection.call(app, null, {});
  assert.equal(refreshCalls.length, 3, "delete refreshes the other windows");
}

// (l) Manual prices after the base URL changed: untouched price fields are not re-applied; edited ones are.
{
  const priceForm = () => {
    resetState();
    activePrices = { inputPerM: 0.27, outputPerM: 1.1 };
    const form = standardForm();
    form.querySelector("[name='inputPerM']").value = "0.27";
    form.querySelector("[name='outputPerM']").value = "1.10";
    form.control("details[data-section='prices'] .spf-fold-state", { textContent: "old summary" });
    // The OpenAI tile fills only the endpoint (and model); the price boxes keep their values.
    form.querySelector("[name='apiBaseUrl']").value = "https://api.openai.com/v1";
    return form;
  };
  // Untouched prices, endpoint changed.
  let form = priceForm();
  let app = newApp(form);
  await app._prepareContext();
  await actions.loadModels.call(app, null, { querySelector: () => null });
  assert.deepEqual(activePrices, { inputPerM: null, outputPerM: null }, "base URL changed, prices untouched: active prices end cleared");
  assert.equal(priceWrites.some((p) => p.inputPerM !== undefined), false, "the old prices are not written back");
  assert.equal(form.querySelector("[name='inputPerM']").value, "", "the input price box shows the cleared state");
  assert.equal(form.querySelector("[name='outputPerM']").value, "", "the output price box shows the cleared state");
  assert.equal(form.querySelector("details[data-section='prices'] .spf-fold-state").textContent,
    "SIMPLYSF2E.ProviderSetup.CostNotSet", "the price summary shows the cleared state");
  // The GM typed new prices in the same save.
  form = priceForm();
  form.querySelector("[name='inputPerM']").value = "2.5";
  form.querySelector("[name='outputPerM']").value = "10";
  app = newApp(form);
  await app._prepareContext();
  await actions.loadModels.call(app, null, { querySelector: () => null });
  assert.deepEqual(activePrices, { inputPerM: 2.5, outputPerM: 10 }, "edited prices are applied with the new endpoint");
  assert.equal(form.querySelector("[name='inputPerM']").value, "2.5", "an applied price stays in its box");
  // Endpoint unchanged: the same prices are applied as before (no behaviour change).
  form = priceForm();
  form.querySelector("[name='apiBaseUrl']").value = providerState.baseUrl;
  app = newApp(form);
  await app._prepareContext();
  await actions.loadModels.call(app, null, { querySelector: () => null });
  assert.deepEqual(activePrices, { inputPerM: 0.27, outputPerM: 1.1 }, "endpoint unchanged: prices kept");
}

// (m) Create and Delete change the active connection, so they are refused while another window runs
// a generation: no dialog, nothing created or deleted, the BusySwitch notice. A run that starts while the
// dialog is open stops the write as well.
{
  resetState();
  runningApps.set("generator", { _generationAbort: new AbortController() });
  const deleteApp = newApp(standardForm());
  await actions.deleteConnection.call(deleteApp, null, {});
  assert.equal(confirmCalls, 0, "another run: Delete opens no dialog");
  assert.equal(deleteCalls, 0, "another run: nothing is deleted");
  assert.equal(warnings.at(-1)?.[0], "SIMPLYSF2E.ProviderSetup.BusySwitch", "another run: Delete warns BusySwitch");

  resetState();
  runningApps.set("generator", { _generationAbort: new AbortController() });
  const createApp = newApp(standardForm());
  await actions.createConnection.call(createApp, null, {});
  assert.equal(confirmCalls, 0, "another run: Create opens no dialog");
  assert.equal(createCalls, 0, "another run: nothing is created");
  assert.equal(warnings.at(-1)?.[0], "SIMPLYSF2E.ProviderSetup.BusySwitch", "another run: Create warns BusySwitch");

  resetState();
  const deleteDuringDialog = newApp(standardForm());
  confirmHook = () => runningApps.set("generator", { _progress: { steps: [] } });
  await actions.deleteConnection.call(deleteDuringDialog, null, {});
  confirmHook = null;
  assert.equal(confirmCalls, 1, "a run started during Delete: the dialog was shown once");
  assert.equal(deleteCalls, 0, "a run started during Delete: nothing is deleted");
  runningApps.clear();

  resetState();
  const createForm = standardForm();
  createForm.querySelector("[name='jevApiKey']").value = "typed";
  const createDuringDialog = newApp(createForm);
  confirmHook = () => runningApps.set("generator", { _progress: { steps: [] } });
  await actions.createConnection.call(createDuringDialog, null, {});
  confirmHook = null;
  assert.equal(confirmCalls, 1, "a run started during Create: the unsaved-edits dialog was shown once");
  assert.equal(createCalls, 0, "a run started during Create: nothing is created");
  runningApps.clear();
}

// (n) Load models saves a changed model and then refreshes the saved snapshot: the form now matches what is
// stored, so another window's switch reloads it. A real edit typed after the save still keeps the form.
{
  const otherWindowSwitch = () => {
    providerState = { ...providerState, connectionId: "conn-2", connectionName: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "or-model" };
  };
  resetState();
  const form = standardForm();
  const app = newApp(form);
  await app._prepareContext();
  form.querySelector("[name='model']").value = "model-saved-now";
  await actions.loadModels.call(app, null, { querySelector: () => null });
  assert.equal(providerState.model, "model-saved-now", "Load models stored the new model");
  const rendersAfterSave = app.renders;
  otherWindowSwitch();
  await app._refreshForConnectionChange();
  assert.equal(app.renders, rendersAfterSave + 1, "after a save, another window's switch reloads the clean form");

  resetState();
  const editedForm = standardForm();
  const editedApp = newApp(editedForm);
  await editedApp._prepareContext();
  editedForm.querySelector("[name='model']").value = "model-saved-now";
  await actions.loadModels.call(editedApp, null, { querySelector: () => null });
  editedForm.querySelector("[name='model']").value = "typed-after-save";
  const rendersBeforeSwitch = editedApp.renders;
  otherWindowSwitch();
  await editedApp._refreshForConnectionChange();
  assert.equal(editedApp.renders, rendersBeforeSwitch, "a real edit typed after the save: no reload");
  assert.equal(editedForm.querySelector("[name='model']").value, "typed-after-save", "and the typed text is kept");
}

// (o) One save action: Save & test is the only primary; the native submit is the quiet
// "Save without testing"; the footnote that explained two save buttons is gone.
{
  const template = await readFile(new URL("../templates/provider-setup.hbs", import.meta.url), "utf8");
  const lang = await readFile(new URL("../lang/en.json", import.meta.url), "utf8");
  assert.equal(template.match(/spf-primary/g)?.length, 1, "exactly one .spf-primary in Provider Setup");
  assert.match(template, /class="spf-primary" data-action="saveAndTest"/, "Save & test is the primary");
  assert.equal(template.match(/type="submit"/g)?.length, 1, "one native submit");
  assert.match(template, /<button type="submit" class="spf-secondary">\s*<i[^>]*><\/i> \{\{localize "SIMPLYSF2E\.ProviderSetup\.SaveWithoutTest"\}\}/,
    "the native submit is the secondary Save without testing");
  for (const gone of ["FooterHint", "SaveAuthorize"]) {
    assert.ok(!template.includes(gone), `${gone} is not in the template`);
    assert.ok(!lang.includes(`"${gone}"`), `${gone} is not in lang/en.json`);
  }
  const messages = JSON.parse(lang).SIMPLYSF2E.ProviderSetup;
  assert.equal(messages.SaveWithoutTest, "Save without testing");
  assert.match(messages.ModelHint, /Load models/, "ModelHint names the real button label");
  assert.match(template, /class="spf-hint spf-endpoint-key-hint"[^>]*hidden/, "the endpoint-change hint renders hidden");
}

// (p) A rejected price sets a custom validity; changing the value clears it at once, so the
// native submit (Save without testing) is not blocked by the stale message. The field error stays.
{
  resetState();
  const form = standardForm();
  const validity = (el) => {
    el.custom = "";
    el.setCustomValidity = function (message) { this.custom = message; };
    el.reportValidity = () => true;
    return el;
  };
  const priceInput = validity(form.querySelector("[name='inputPerM']"));
  const priceOutput = validity(form.querySelector("[name='outputPerM']"));
  const app = newApp(form);
  for (const el of [priceInput, priceOutput]) {
    assert.equal(el.listeners.filter((entry) => entry.type === "input").length, 1, "one input listener per price field");
  }
  priceInput.value = "-2";
  await actions.saveAndTest.call(app, null, { querySelector: () => null });
  assert.equal(priceInput.custom, "SIMPLYSF2E.ProviderSetup.PriceInputInvalid", "the rejected price carries a custom validity");
  assert.equal(saveCalls, 0, "a rejected price saves nothing");
  priceInput.value = "2";
  for (const { type, fn } of priceInput.listeners) if (type === "input") fn({ currentTarget: priceInput });
  assert.equal(priceInput.custom, "", "a changed value clears the stale custom validity");
  priceOutput.custom = "stale";
  for (const { type, fn } of priceOutput.listeners) if (type === "input") fn({ currentTarget: priceOutput });
  assert.equal(priceOutput.custom, "", "the output price clears too");
}

// (q) The endpoint-change hint shows only while a key is saved and the URL differs from the saved endpoint.
{
  resetState();
  const form = standardForm();
  const hint = form.control(".spf-endpoint-key-hint", { hidden: true });
  const url = form.querySelector("[name='apiBaseUrl']");
  newApp(form);
  const typeUrl = (value) => {
    url.value = value;
    for (const { type, fn } of url.listeners) if (type === "input") fn({ currentTarget: url });
  };
  assert.equal(hint.hidden, true, "saved endpoint shown: hint hidden");
  typeUrl("https://openrouter.ai/api/v1");
  assert.equal(hint.hidden, false, "another endpoint with a saved key: hint shown");
  typeUrl("https://api.deepseek.com/v1/");
  assert.equal(hint.hidden, true, "back to the saved endpoint: hint hidden");
  providerState.hasConfiguredApiKey = false;
  typeUrl("https://openrouter.ai/api/v1");
  assert.equal(hint.hidden, true, "no saved key: nothing to lose, hint hidden");
}

console.log("provider-setup-app.test.mjs: ok");
