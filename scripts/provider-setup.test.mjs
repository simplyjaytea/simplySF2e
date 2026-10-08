// Focused provider-setup save checks. The app itself is production code; only
// Foundry's Application shell and settings storage are replaced here.
// Run: node scripts/provider-setup.test.mjs
import assert from "node:assert/strict";
import { MODULE_ID, SETTINGS, registerSettings, getProviderRequestConfig } from "./settings.mjs";

class FakeApplicationV2 {
  constructor() {}
  render() {}
  async close() {}
}

globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: FakeApplicationV2,
      HandlebarsApplicationMixin: (Base) => class extends Base {},
      DialogV2: {
        confirm: async () => true
      }
    }
  },
  utils: {
    escapeHTML: (value) => String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
  }
};

const values = new Map();
const registrations = new Map();
globalThis.game = {
  settings: {
    get: (_moduleId, key) => values.get(key),
    register: (_moduleId, key, config) => registrations.set(key, config),
    registerMenu: () => {},
    set: async (_moduleId, key, value) => {
      values.set(key, value);
      await registrations.get(key)?.onChange?.(value);
      return value;
    }
  },
  i18n: {
    localize: (key) => key,
    format: (key, data) => `${key}:${JSON.stringify(data)}`
  }
};
const notices = { info: [], warn: [], error: [] };
globalThis.ui = { notifications: {
  info: (message) => notices.info.push(message),
  warn: (message) => notices.warn.push(message),
  error: (message) => notices.error.push(message)
} };

registerSettings(class SourcesConfigApp {}, class ProviderSetupApp {});
const { ProviderSetupApp, PROVIDER_PRESETS, jevTestNotice } = await import("./provider-setup-app.mjs");

assert.deepEqual(
  PROVIDER_PRESETS.filter((provider) => !provider.preserve).map((provider) => provider.id),
  ["deepseek", "openai", "openrouter", "ollama", "lmstudio"],
  "consumer setup must cover the documented cloud and local providers"
);

const presetApp = new ProviderSetupApp();
const baseControl = { value: "https://api.openai.com/v1" };
const modelControl = { value: "gpt-5.6-luna" };
const makeButton = (provider) => ({
  dataset: { provider },
  classList: { toggle: () => {} },
  setAttribute(name, value) { this[name] = value; }
});
const ollamaButton = makeButton("ollama");
const openAIButton = makeButton("openai");
presetApp.element = {
  querySelector: (selector) => selector.includes("apiBaseUrl") ? baseControl : modelControl,
  querySelectorAll: () => [openAIButton, ollamaButton]
};
await ProviderSetupApp.DEFAULT_OPTIONS.actions.chooseProvider.call(presetApp, null, ollamaButton);
assert.equal(baseControl.value, "http://localhost:11434/v1");
assert.equal(modelControl.value, "", "local presets must require a model that is actually installed");
assert.equal(ollamaButton["aria-pressed"], "true");
assert.equal(openAIButton["aria-pressed"], "false");

{
  const hintEl = { hidden: false };
  const hintApp = new ProviderSetupApp();
  const hintOpenAI = makeButton("openai");
  hintApp.element = {
    querySelector: (selector) => selector.includes("local-hint") ? hintEl : (selector.includes("apiBaseUrl") ? { value: "" } : { value: "" }),
    querySelectorAll: () => [hintOpenAI]
  };
  await ProviderSetupApp.DEFAULT_OPTIONS.actions.chooseProvider.call(hintApp, null, hintOpenAI);
  assert.equal(hintEl.hidden, true, "hosted presets hide the local-server hint");
  await ProviderSetupApp.DEFAULT_OPTIONS.actions.chooseProvider.call(hintApp, null, makeButton("lmstudio"));
  assert.equal(hintEl.hidden, false, "local presets show the local-server hint");
  await ProviderSetupApp.DEFAULT_OPTIONS.actions.chooseProvider.call(hintApp, null, makeButton("custom"));
  assert.equal(hintEl.hidden, false, "custom endpoints keep the local-server hint");
}

const setCurrent = ({ baseUrl, model = "old-model", apiKey = "old-secret", bound = baseUrl }) => {
  values.set(SETTINGS.apiBaseUrl, baseUrl);
  values.set(SETTINGS.model, model);
  values.set(SETTINGS.apiKey, apiKey);
  values.set(SETTINGS.apiKeyBaseUrl, bound);
};

const submit = async ({ baseUrl, model, apiKey = "", clearApiKey = false, connectionName = "", jevApiKey = "", clearJevApiKey = false, expectFail = false }) => {
  let saved = 0;
  const app = new ProviderSetupApp(() => { saved += 1; });
  const submitButton = makeButton("submit");
  submitButton.disabled = false;
  submitButton.querySelector = () => null;
  const controls = new Map([
    ["[name='apiBaseUrl']", { value: baseUrl, disabled: false }],
    ["[name='model']", { value: model, disabled: false }],
    ["[name='apiKey']", { value: apiKey, disabled: false }],
    ["[name='clearApiKey']", { checked: clearApiKey, disabled: false }],
    ["[name='connectionName']", { value: connectionName, disabled: false }],
    ["[name='jevApiKey']", { value: jevApiKey, disabled: false }],
    ["[name='clearJevApiKey']", { checked: clearJevApiKey, disabled: false }],
    ["button[type='submit']", submitButton]
  ]);
  app.element = {
    querySelector: (selector) => controls.get(selector) ?? null,
    querySelectorAll: () => [...controls.values()],
    setAttribute: () => {},
    removeAttribute: () => {}
  };
  if (expectFail) {
    // Failed saves are reported with an error toast (and the form stays open).
    const before = notices.error.length;
    await ProviderSetupApp.DEFAULT_OPTIONS.form.handler.call(app);
    assert.equal(notices.error.length, before + 1, "a failed save must notify");
    assert.equal(saved, 0, "a failed save must not refresh the generator");
    return;
  }
  await ProviderSetupApp.DEFAULT_OPTIONS.form.handler.call(app);
  assert.equal(saved, 1, "successful setup must refresh the calling generator");
};

const jevAction = async ({ jevApiKey = "", clearJevApiKey = false, chatKey = "", jevSource, jevEndpoint, action = "saveJevKey" }) => {
  let rendered = 0;
  const app = new ProviderSetupApp();
  app.render = async () => { rendered += 1; };
  const button = makeButton("jev");
  button.querySelector = () => null;
  const controls = new Map([
    ["[name='jevApiKey']", { value: jevApiKey, disabled: false }],
    ["[name='clearJevApiKey']", { checked: clearJevApiKey, disabled: false }],
    ["[name='apiKey']", { value: chatKey, disabled: false }],
    ...(jevSource === undefined ? [] : [["[name='jevSource']", { value: jevSource, disabled: false }]]),
    ...(jevEndpoint === undefined ? [] : [["[name='jevEndpoint']", { value: jevEndpoint, disabled: false }]])
  ]);
  app.element = {
    querySelector: (selector) => controls.get(selector) ?? null,
    querySelectorAll: () => [button],
    setAttribute: () => {},
    removeAttribute: () => {}
  };
  await ProviderSetupApp.DEFAULT_OPTIONS.actions[action].call(app, null, button);
  assert.equal(rendered, 0, "Jev save must not re-render and discard unsaved chat fields");
  assert.equal(controls.get("[name='apiKey']").value, chatKey, "typed chat key survives a Jev save");
};

setCurrent({ baseUrl: "https://old-provider.example/v1" });
await submit({ baseUrl: "http://localhost:11434/v1", model: "qwen3:8b" });
assert.equal(values.get(SETTINGS.apiKey), "", "switching endpoints without a replacement must clear the old secret");
assert.equal(values.get(SETTINGS.apiKeyBaseUrl), "", "a cleared secret must not remain authorized");

setCurrent({ baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-luna" });
await submit({ baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-luna" });
assert.equal(values.get(SETTINGS.apiKey), "old-secret", "saving the same endpoint with a blank key field keeps its secret");
assert.equal(values.get(SETTINGS.apiKeyBaseUrl), "https://api.openai.com/v1");

setCurrent({ baseUrl: "https://old-provider.example/v1" });
await submit({
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-v4-flash",
  apiKey: "new-secret"
});
assert.equal(values.get(SETTINGS.apiKey), "new-secret");
assert.equal(
  values.get(SETTINGS.apiKeyBaseUrl),
  "https://api.deepseek.com/v1",
  "an explicitly entered replacement key must bind only to the displayed new endpoint"
);

// Save & Test uses the production Chat Completions path, closes only on
// success, and leaves the saved dialog open for correction after a failure.
const originalFetch = globalThis.fetch;
const originalError = console.error;
const makeTestButton = () => {
  const icon = { className: "fa-solid fa-signal" };
  return { disabled: false, querySelector: () => icon, icon };
};
const makeSaveTestApp = ({ baseUrl, model }) => {
  let saved = 0;
  let closed = 0;
  const app = new ProviderSetupApp(() => { saved += 1; });
  const target = makeTestButton();
  const otherButton = { disabled: false };
  const modelInput = { value: model, disabled: false };
  const apiKeyInput = { value: "", disabled: false };
  const clearKeyInput = { checked: false, disabled: false };
  const inputListeners = new Map();
  const baseControl = {
    value: baseUrl,
    disabled: false,
    addEventListener: (name, callback) => inputListeners.set(name, callback)
  };
  const controls = new Map([
    ["[name='apiBaseUrl']", baseControl],
    ["[name='model']", modelInput],
    ["[name='apiKey']", apiKeyInput],
    ["[name='clearApiKey']", clearKeyInput],
    ["button[type='submit']", otherButton]
  ]);
  const interactiveControls = [target, otherButton, baseControl, modelInput, apiKeyInput, clearKeyInput];
  const attributes = new Map();
  app.element = {
    querySelector: (selector) => controls.get(selector) ?? null,
    querySelectorAll: (selector) => selector === "button, input, select, textarea" ? interactiveControls : [],
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name)
  };
  app.close = async () => {
    closed += 1;
    // ApplicationV2 clears its element during close. Save & Test must still
    // complete its finally cleanup without dereferencing the destroyed dialog.
    app.element = null;
  };
  return {
    app, target,
    getSaved: () => saved,
    getClosed: () => closed,
    controls: interactiveControls,
    getAttribute: (name) => attributes.get(name),
    changeBaseUrl: (value) => {
      baseControl.value = value;
      inputListeners.get("input")?.({ currentTarget: baseControl });
    }
  };
};

try {
  setCurrent({ baseUrl: "http://localhost:11434/v1", model: "qwen3:8b", apiKey: "", bound: "" });
  const success = makeSaveTestApp({ baseUrl: "http://localhost:11434/v1", model: "qwen3:8b" });
  globalThis.fetch = async () => {
    assert.ok(success.controls.every((control) => control.disabled === true), "save-and-test freezes every setup control during the request");
    assert.equal(success.getAttribute("aria-busy"), "true", "save-and-test exposes its busy state");
    return new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
      usage: { prompt_tokens: 6, completion_tokens: 3, total_tokens: 9 }
    }), { headers: { "content-type": "application/json" } });
  };
  await ProviderSetupApp.DEFAULT_OPTIONS.actions.saveAndTest.call(success.app, null, success.target);
  assert.equal(success.getSaved(), 1, "save-and-test must refresh the calling generator after saving");
  assert.equal(success.getClosed(), 1, "a successful connection test closes setup");
  assert.equal(success.target.disabled, false, "the test action restores its button state");
  assert.ok(success.controls.every((control) => control.disabled === false), "save-and-test restores every setup control");
  assert.equal(success.getAttribute("aria-busy"), undefined, "save-and-test clears its busy state");
  assert.ok(notices.info.some((message) => message.includes("SIMPLYSF2E.ProviderSetup.TestSuccess")));

  setCurrent({ baseUrl: "http://localhost:11434/v1", model: "", apiKey: "", bound: "" });
  const discovery = makeSaveTestApp({ baseUrl: "http://localhost:11434/v1", model: "" });
  globalThis.fetch = async () => {
    assert.ok(discovery.controls.every((control) => control.disabled === true), "model discovery freezes every setup control during the request");
    assert.equal(discovery.getAttribute("aria-busy"), "true", "model discovery exposes its busy state");
    return new Response(JSON.stringify({ data: [
      { id: "qwen3:8b" }, { id: "gemma3:4b" }
    ] }), { headers: { "content-type": "application/json" } });
  };
  await ProviderSetupApp.DEFAULT_OPTIONS.actions.loadModels.call(discovery.app, null, discovery.target);
  assert.equal(discovery.getSaved(), 1, "model discovery saves the displayed endpoint before requesting it");
  assert.equal(discovery.getClosed(), 0, "model discovery keeps setup open for selection");
  assert.ok(discovery.controls.every((control) => control.disabled === false), "model discovery restores every setup control");
  assert.deepEqual(
    (await discovery.app._prepareContext()).availableModels,
    ["gemma3:4b", "qwen3:8b"],
    "discovered identifiers become editable datalist suggestions"
  );
  assert.ok(notices.info.some((message) => message.includes("SIMPLYSF2E.ProviderSetup.ModelsLoaded")));
  discovery.app._onRender();
  discovery.changeBaseUrl("http://localhost:1234/v1");
  assert.deepEqual(
    (await discovery.app._prepareContext()).availableModels,
    [],
    "manually changing the endpoint clears model suggestions from the previous provider"
  );

  console.error = () => {};
  globalThis.fetch = async () => { throw new TypeError("provider offline"); };
  const failure = makeSaveTestApp({ baseUrl: "http://localhost:11434/v1", model: "qwen3:8b" });
  await ProviderSetupApp.DEFAULT_OPTIONS.actions.saveAndTest.call(failure.app, null, failure.target);
  assert.equal(failure.getSaved(), 1, "a failed test must not roll back valid saved settings");
  assert.equal(failure.getClosed(), 0, "a failed test keeps setup open for correction");
  assert.ok(notices.error.some((message) => message.includes("provider offline")));
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalError;
}

const resetBank = () => values.set(SETTINGS.providerBank, { activeId: "", connections: [] });

resetBank();
setCurrent({ baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash", apiKey: "deepseek-secret" });
await submit({
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-v4-flash",
  connectionName: "Home DeepSeek"
});
assert.equal(values.get(SETTINGS.apiKey), "deepseek-secret", "saving the same endpoint keeps the stored key");
assert.equal(getProviderRequestConfig().connectionName, "Home DeepSeek");
assert.equal(getProviderRequestConfig().apiKey, "deepseek-secret");
assert.equal(getProviderRequestConfig().apiKeyIsBound, true);

const createApp = new ProviderSetupApp();
createApp.element = {
  querySelector: () => null,
  querySelectorAll: () => [],
  setAttribute: () => {},
  removeAttribute: () => {}
};
let rendered = 0;
createApp.render = async () => { rendered += 1; };
await ProviderSetupApp.DEFAULT_OPTIONS.actions.createConnection.call(createApp);
assert.equal(rendered, 1, "creating a connection must reload the setup form");
assert.equal(getProviderRequestConfig().apiKey, "", "New connection must not copy the previous profile's key");
assert.equal(getProviderRequestConfig().hasConfiguredApiKey, false);
assert.equal(values.get(SETTINGS.providerBank).connections.length, 2);
const original = values.get(SETTINGS.providerBank).connections.find((connection) => connection.name === "Home DeepSeek");
assert.ok(original, "the saved DeepSeek profile must remain in the bank");
assert.equal(original.apiKey, "deepseek-secret");
const createdId = getProviderRequestConfig().connectionId;
assert.notEqual(createdId, original.id);

const switchApp = new ProviderSetupApp();
const changeHandlers = [];
const liveSelect = {
  value: original.id,
  addEventListener: (name, callback) => { if (name === "change") changeHandlers.push(callback); }
};
switchApp.element = {
  querySelector: (selector) => {
    if (selector.includes("activeConnection")) return liveSelect;
    if (selector.includes("apiBaseUrl")) {
      return { addEventListener: () => {} };
    }
    return null;
  },
  querySelectorAll: () => []
};
switchApp._onRender();
assert.equal(changeHandlers.length, 1);
await changeHandlers[0]({ currentTarget: liveSelect });
assert.equal(getProviderRequestConfig().connectionId, original.id);
assert.equal(getProviderRequestConfig().apiKey, "deepseek-secret", "switching profiles must rebind the stored key to its own URL");
assert.equal(getProviderRequestConfig().baseUrl, "https://api.deepseek.com/v1");

liveSelect.value = createdId;
await changeHandlers[0]({ currentTarget: liveSelect });
assert.equal(getProviderRequestConfig().connectionId, createdId);
assert.equal(getProviderRequestConfig().apiKey, "", "the inactive profile's key must not leak onto a different endpoint");

await submit({
  baseUrl: "https://gateway.example/v1",
  model: "hosted-model",
  apiKey: "custom-secret",
  connectionName: "Custom provider"
});
assert.equal(getProviderRequestConfig().connectionName, "Custom provider");
assert.equal(getProviderRequestConfig().apiKey, "custom-secret");
assert.equal(getProviderRequestConfig().apiKeyIsBound, true);
assert.equal(
  values.get(SETTINGS.apiKeyBaseUrl),
  "https://gateway.example/v1",
  "a replacement key must bind only to the displayed endpoint of the active profile"
);
assert.equal(
  values.get(SETTINGS.providerBank).connections.find((connection) => connection.id === original.id).apiKey,
  "deepseek-secret",
  "saving the active profile must not rewrite another connection's secret"
);

const deleteApp = new ProviderSetupApp();
deleteApp.render = async () => {};
deleteApp.element = { querySelector: () => null, querySelectorAll: () => [] };
await ProviderSetupApp.DEFAULT_OPTIONS.actions.deleteConnection.call(deleteApp);
assert.equal(values.get(SETTINGS.providerBank).connections.length, 1, "delete keeps the remaining connection");
assert.equal(getProviderRequestConfig().connectionName, "Home DeepSeek");
assert.equal(getProviderRequestConfig().apiKey, "deepseek-secret");

// Jev key: saveJevKey action (empty keeps, typed saves, clear removes).
values.set(SETTINGS.jevApiKey, "");
await jevAction({ jevApiKey: "  or-jev-1  ", chatKey: "typed-chat-key" });
assert.equal(values.get(SETTINGS.jevApiKey), "or-jev-1", "typed Jev key is trimmed and saved");
await jevAction({});
assert.equal(values.get(SETTINGS.jevApiKey), "or-jev-1", "empty input keeps the stored Jev key");
await jevAction({ clearJevApiKey: true });
assert.equal(values.get(SETTINGS.jevApiKey), "", "clear box removes the Jev key");

// A chat save that fails (no model) still keeps a Jev key typed before Save.
setCurrent({ baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-luna" });
values.set(SETTINGS.jevApiKey, "");
await submit({ baseUrl: "https://api.openai.com/v1", model: "", jevApiKey: "or-jev-2", expectFail: true });
assert.equal(values.get(SETTINGS.jevApiKey), "or-jev-2", "Jev key is saved before the chat save can throw NoModel");

// A chat-only save leaves the Jev key unchanged.
await submit({ baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-luna" });
assert.equal(values.get(SETTINGS.jevApiKey), "or-jev-2", "chat-only save leaves the Jev key alone");

// Jev source: a key belongs to its source.
values.set(SETTINGS.jevApiKey, "or-jev-3");
values.set(SETTINGS.jevSource, "openrouter");
await jevAction({ jevSource: "openrouter" });
assert.equal(values.get(SETTINGS.jevApiKey), "or-jev-3", "same source with blank input keeps the key");
{
  const order = [];
  const realSet = game.settings.set;
  game.settings.set = async (m, key, value) => { order.push([key, value]); return realSet(m, key, value); };
  await jevAction({ jevSource: "typesafe" });
  game.settings.set = realSet;
  assert.deepEqual(order, [[SETTINGS.jevApiKey, ""], [SETTINGS.jevSource, "typesafe"]],
    "old key is cleared before the source moves");
}
assert.equal(values.get(SETTINGS.jevSource), "typesafe", "source change is saved");
assert.equal(values.get(SETTINGS.jevApiKey), "", "switching source without a new key clears the old key");
await jevAction({ jevSource: "openrouter", jevApiKey: " or-jev-4 " });
assert.deepEqual([values.get(SETTINGS.jevSource), values.get(SETTINGS.jevApiKey)], ["openrouter", "or-jev-4"],
  "source change with a new key saves both");
await jevAction({ jevSource: "__proto__" });
assert.equal(values.get(SETTINGS.jevSource), "openrouter", "unknown source normalizes to OpenRouter");
assert.equal(values.get(SETTINGS.jevApiKey), "or-jev-4");

// Test Jev: saves first, calls the chosen route, toasts the result, keeps chat fields.
{
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({ model: "jev-1.13.0", answers: { ping: { type: "choice", choice: "red", confidence: 0.98, probabilities: { red: 0.98, table: 0.02 } } } }) };
  };
  try {
    const before = notices.info.length;
    await jevAction({ action: "testJev", jevSource: "typesafe", jevApiKey: "ts-key", chatKey: "typed-chat" });
    assert.equal(values.get(SETTINGS.jevApiKey), "ts-key", "Test Jev saves the typed key first");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.typesafe.ai/v1/systemone", "TypeSafe key goes to TypeSafe");
    assert.equal(calls[0].init.headers.Authorization, "Bearer ts-key");
    assert.ok(notices.info.slice(before).some((m) => m.startsWith("SIMPLYSF2E.ProviderSetup.JevTestSuccess")), "success toast");

    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    const errBefore = notices.error.length;
    await jevAction({ action: "testJev" });
    assert.ok(notices.error.slice(errBefore).some((m) => m.startsWith("SIMPLYSF2E.ProviderSetup.JevTestTypeSafeCors")), "CORS toast");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// TypeSafe endpoint: a key belongs to the address it was saved for.
{
  const proxy = "https://jev-proxy.example.com/v1/systemone";
  values.set(SETTINGS.jevSource, "typesafe");
  values.set(SETTINGS.jevTypeSafeEndpoint, "");
  values.set(SETTINGS.jevApiKey, "ts-1");
  await jevAction({ jevSource: "typesafe", jevEndpoint: "" });
  assert.equal(values.get(SETTINGS.jevApiKey), "ts-1", "same (official) endpoint keeps the key");
  await jevAction({ jevSource: "typesafe", jevEndpoint: "https://api.typesafe.ai/v1/systemone" });
  assert.deepEqual([values.get(SETTINGS.jevTypeSafeEndpoint), values.get(SETTINGS.jevApiKey)], ["", "ts-1"],
    "typing the official URL stores blank and keeps the key");

  const order = [];
  const realSet = game.settings.set;
  game.settings.set = async (m, key, value) => { order.push([key, value]); return realSet(m, key, value); };
  await jevAction({ jevSource: "typesafe", jevEndpoint: ` ${proxy} ` });
  game.settings.set = realSet;
  assert.deepEqual(order, [[SETTINGS.jevApiKey, ""], [SETTINGS.jevTypeSafeEndpoint, proxy]],
    "old key is cleared before the endpoint moves");

  await jevAction({ jevSource: "typesafe", jevEndpoint: proxy, jevApiKey: "ts-2" });
  assert.deepEqual([values.get(SETTINGS.jevTypeSafeEndpoint), values.get(SETTINGS.jevApiKey)], [proxy, "ts-2"]);

  const errBefore = notices.error.length;
  await jevAction({ jevSource: "typesafe", jevEndpoint: "http://proxy.example.com/systemone", jevApiKey: "ts-3" });
  assert.ok(notices.error.slice(errBefore).some((m) => m.startsWith("SIMPLYSF2E.ProviderSetup.JevSaveFailed")), "unusable endpoint is refused");
  assert.deepEqual([values.get(SETTINGS.jevTypeSafeEndpoint), values.get(SETTINGS.jevApiKey)], [proxy, "ts-2"],
    "a refused endpoint writes nothing");

  await jevAction({ jevSource: "openrouter", jevEndpoint: "", jevApiKey: "or-5" });
  assert.deepEqual([values.get(SETTINGS.jevSource), values.get(SETTINGS.jevTypeSafeEndpoint), values.get(SETTINGS.jevApiKey)],
    ["openrouter", "", "or-5"]);
  await jevAction({ jevSource: "openrouter", jevEndpoint: proxy });
  assert.equal(values.get(SETTINGS.jevApiKey), "or-5", "editing the TypeSafe endpoint leaves an OpenRouter key alone");

  // Test Jev reaches the proxy, and names it when unreachable.
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(url); throw new TypeError("Failed to fetch"); };
  try {
    const before = notices.error.length;
    await jevAction({ action: "testJev", jevSource: "typesafe", jevEndpoint: proxy, jevApiKey: "ts-4" });
    assert.deepEqual(calls, [proxy], "Test Jev calls the saved proxy");
    assert.ok(notices.error.slice(before).some((m) => m.startsWith("SIMPLYSF2E.ProviderSetup.JevTestProxyNetwork") && m.includes(proxy)),
      "proxy failure names the proxy, not TypeSafe's CORS block");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// Test Jev toast mapping.
assert.equal(jevTestNotice({ ok: true, source: "openrouter", ms: 412 }).data.seconds, "0.4");
assert.equal(jevTestNotice({ ok: false, reason: "unconfigured", source: null }).key, "SIMPLYSF2E.ProviderSetup.JevTestOff");
assert.equal(jevTestNotice({ ok: false, reason: "http", status: 401, source: "openrouter" }).key, "SIMPLYSF2E.ProviderSetup.JevTestBadKey");
assert.equal(jevTestNotice({ ok: false, reason: "http", status: 429, source: "openrouter" }).key, "SIMPLYSF2E.ProviderSetup.JevTestHttp");
assert.equal(jevTestNotice({ ok: false, reason: "network", source: "typesafe" }).key, "SIMPLYSF2E.ProviderSetup.JevTestTypeSafeCors");
assert.equal(jevTestNotice({ ok: false, reason: "network", source: "typesafe", endpoint: "https://api.typesafe.ai/v1/systemone" }).key,
  "SIMPLYSF2E.ProviderSetup.JevTestTypeSafeCors");
assert.deepEqual(jevTestNotice({ ok: false, reason: "network", source: "typesafe", endpoint: "https://p.example.com/x" }).data,
  { source: "TypeSafe AI", endpoint: "https://p.example.com/x" });
assert.equal(jevTestNotice({ ok: false, reason: "network", source: "openrouter" }).key, "SIMPLYSF2E.ProviderSetup.JevTestNetwork");
assert.equal(jevTestNotice({ ok: false, reason: "timeout", source: "typesafe" }).data.source, "TypeSafe AI");
assert.equal(jevTestNotice({ ok: false, reason: "shape", source: "openrouter" }).level, "error");

console.log("provider-setup.test.mjs: setup save assertions passed");
