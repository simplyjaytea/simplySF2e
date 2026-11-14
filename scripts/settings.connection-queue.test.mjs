// Connection-bank queue and verify-before-snapshot: overlapping switches, a
// world endpoint/model changed by another GM client, a rejected bank write, and
// a deliberate Provider Setup save. Imports production settings/provider-connect.
// Run: node scripts/settings.connection-queue.test.mjs
import assert from "node:assert/strict";
import {
  MODULE_ID,
  SETTINGS,
  createProviderConnection,
  getProviderRequestConfig,
  selectProviderConnection,
  upsertActiveProviderConnection
} from "./settings.mjs";
import { saveProviderConnection } from "./provider-connect.mjs";

const values = new Map();
// Called after each stored write, before set() resolves: lets a test start a
// second call at an exact point, or fail one write.
let onSet = null;
const WORLD_KEYS = new Set([SETTINGS.apiBaseUrl, SETTINGS.model]);

globalThis.game = {
  i18n: { localize: (key) => key, format: (key) => key },
  settings: {
    get: (_moduleId, key) => values.get(key),
    set: async (_moduleId, key, value) => {
      const hook = onSet;
      if (hook) await hook(key, value, "before");
      values.set(key, structuredClone(value));
      // A world setting is a server round trip; client settings are local.
      if (WORLD_KEYS.has(key)) await new Promise((resolve) => setTimeout(resolve, 5));
      if (hook) await hook(key, value, "after");
      return value;
    }
  }
};

const warnings = [];
console.warn = (...args) => warnings.push(args.join(" "));

const watchdog = (promise, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}: timed out (queue stuck)`)), 2000))
]);

const conn = (id, apiBaseUrl, model, apiKey) => ({
  id, name: id, apiBaseUrl, model, apiKey, apiKeyBaseUrl: apiKey ? apiBaseUrl : "", inputPerM: null, outputPerM: null
});
const stored = (id) => values.get(SETTINGS.providerBank).connections.find((connection) => connection.id === id);

/** Bank with `connections`, `activeId` active, and live settings equal to that profile. */
function seed(connections, activeId) {
  onSet = null;
  warnings.length = 0;
  values.set(SETTINGS.providerBank, { activeId, connections: structuredClone(connections) });
  const active = connections.find((connection) => connection.id === activeId);
  values.set(SETTINGS.apiBaseUrl, active.apiBaseUrl);
  values.set(SETTINGS.model, active.model);
  values.set(SETTINGS.apiKey, active.apiKey);
  values.set(SETTINGS.apiKeyBaseUrl, active.apiKeyBaseUrl);
}

/** Start select(A->firstId); the moment the bank is persisted with firstId active, start select(secondId). */
async function overlappingSwitch(firstId, secondId) {
  let second = null;
  onSet = (key, value, phase) => {
    if (phase === "after" && key === SETTINGS.providerBank && value.activeId === firstId && !second) {
      second = selectProviderConnection(secondId);
    }
  };
  const first = selectProviderConnection(firstId);
  assert.equal(await watchdog(first, "first switch"), true);
  assert.ok(second, "the second switch started while the first was still applying");
  assert.equal(await watchdog(second, "second switch"), true);
  onSet = null;
}

// (a) A -> B, then -> C inside B's world-setting round trip. B keeps its own
// endpoint, model and key.
seed([
  conn("A", "https://a.example/v1", "model-a", "key-a"),
  conn("B", "https://b.example/v1", "model-b", "key-b"),
  conn("C", "https://c.example/v1", "model-c", "key-c")
], "A");
await overlappingSwitch("B", "C");
assert.deepEqual(
  { url: stored("B").apiBaseUrl, model: stored("B").model, key: stored("B").apiKey, bind: stored("B").apiKeyBaseUrl },
  { url: "https://b.example/v1", model: "model-b", key: "key-b", bind: "https://b.example/v1" },
  "(a) an overlapping switch must not write A's endpoint, model or key onto B"
);
assert.equal(stored("A").apiKey, "key-a");
assert.equal(getProviderRequestConfig().connectionId, "C");
assert.equal(getProviderRequestConfig().baseUrl, "https://c.example/v1");
assert.equal(getProviderRequestConfig().model, "model-c");
assert.equal(getProviderRequestConfig().apiKey, "key-c", "the last switch wins with its own bound key");
assert.equal(warnings.length, 0, "a clean queued switch warns nothing");

// (a, same endpoint) Two keys on one endpoint and model: only the queue can tell
// them apart, because the endpoint/model check passes.
seed([
  conn("A", "https://shared.example/v1", "model-s", "key-a"),
  conn("B", "https://shared.example/v1", "model-s", "key-b"),
  conn("C", "https://c.example/v1", "model-c", "key-c")
], "A");
await overlappingSwitch("B", "C");
assert.equal(stored("B").apiKey, "key-b", "(a) B's own key survives an overlapping switch on a shared endpoint");
assert.equal(stored("A").apiKey, "key-a");
assert.equal(getProviderRequestConfig().apiKey, "key-c");

// (b) Another GM client switched the world endpoint/model (and this client's
// onChange cleared the key binding). This client's bank still says X.
const otherBrowser = () => {
  values.set(SETTINGS.apiBaseUrl, "https://other.example/v1");
  values.set(SETTINGS.model, "other-model");
  values.set(SETTINGS.apiKeyBaseUrl, "");
};
const bankXY = [
  conn("X", "https://x.example/v1", "model-x", "key-x"),
  conn("Y", "https://y.example/v1", "model-y", "key-y")
];
const xKept = (label) => assert.deepEqual(
  { url: stored("X").apiBaseUrl, model: stored("X").model, key: stored("X").apiKey, bind: stored("X").apiKeyBaseUrl },
  { url: "https://x.example/v1", model: "model-x", key: "key-x", bind: "https://x.example/v1" },
  label
);
seed(bankXY, "X");
otherBrowser();
assert.equal(await selectProviderConnection("Y"), true);
xKept("(b) a switch after another client's world change keeps X's stored endpoint, model and binding");
assert.equal(warnings.length, 1, "the skipped copy warns once");
assert.ok(warnings[0].startsWith(`${MODULE_ID} |`), "the warning carries the module id prefix");
assert.equal(getProviderRequestConfig().apiKey, "key-y");

seed(bankXY, "X");
otherBrowser();
await createProviderConnection({ name: "New", apiBaseUrl: "https://new.example/v1", model: "m" });
xKept("(b) Create after another client's world change keeps X's stored values");

seed(bankXY, "X");
otherBrowser();
await upsertActiveProviderConnection({ name: "Renamed" });
xKept("(b) a plain upsert after another client's world change keeps X's stored values");
assert.equal(stored("X").name, "Renamed", "the name patch still applies");

// (c) A rejected bank write neither blocks nor poisons the queue.
seed([
  conn("A", "https://a.example/v1", "model-a", "key-a"),
  conn("B", "https://b.example/v1", "model-b", "key-b"),
  conn("C", "https://c.example/v1", "model-c", "key-c")
], "A");
let failNext = true;
onSet = (key, _value, phase) => {
  if (phase === "before" && key === SETTINGS.providerBank && failNext) {
    failNext = false;
    throw new Error("bank write rejected");
  }
};
const rejected = selectProviderConnection("B");
const queuedAfter = selectProviderConnection("C");
await assert.rejects(watchdog(rejected, "rejected switch"), /bank write rejected/);
assert.equal(await watchdog(queuedAfter, "switch queued behind a rejection"), true, "(c) the next call still runs");
assert.equal(getProviderRequestConfig().connectionId, "C");
assert.equal(getProviderRequestConfig().apiKey, "key-c");
assert.equal(stored("B").apiKey, "key-b");
onSet = null;
assert.equal(await watchdog(selectProviderConnection("B"), "later switch"), true);
assert.equal(getProviderRequestConfig().apiKey, "key-b");

// (d) A Provider Setup save of an edited URL and model lands on the active profile.
seed(bankXY, "X");
await watchdog(saveProviderConnection({
  baseUrl: "https://edited.example/v1/",
  model: "edited-model",
  enteredApiKey: "edited-key",
  connectionName: "Edited",
  notify: false
}), "save");
assert.deepEqual(
  { name: stored("X").name, url: stored("X").apiBaseUrl, model: stored("X").model, key: stored("X").apiKey, bind: stored("X").apiKeyBaseUrl },
  { name: "Edited", url: "https://edited.example/v1", model: "edited-model", key: "edited-key", bind: "https://edited.example/v1" },
  "(d) a deliberate save stores the edited endpoint, model and key on the active profile"
);
assert.equal(stored("Y").apiKey, "key-y", "the inactive profile is untouched");
assert.equal(warnings.length, 0, "a deliberate save warns nothing");
// Model-only edit on the same endpoint keeps the key.
await saveProviderConnection({ baseUrl: "https://edited.example/v1", model: "model-2", notify: false });
assert.equal(stored("X").model, "model-2");
assert.equal(stored("X").apiKey, "edited-key");
assert.equal(getProviderRequestConfig().apiKey, "edited-key");

// (d, raced) Another client changes the world endpoint during the save: the
// profile keeps its stored values and the key is not bound to the other URL.
seed(bankXY, "X");
onSet = (key, _value, phase) => {
  if (phase === "after" && key === SETTINGS.model) { onSet = null; otherBrowser(); }
};
await saveProviderConnection({ baseUrl: "https://edited.example/v1", model: "edited-model", enteredApiKey: "edited-key", notify: false });
xKept("(d) a save raced by another client's world change does not store that endpoint");
assert.equal(warnings.length, 1);

// A save queued behind a switch runs after it, against the switched-to profile.
seed(bankXY, "X");
const switching = selectProviderConnection("Y");
const saving = saveProviderConnection({ baseUrl: "https://y.example/v1", model: "model-y2", notify: false });
await watchdog(Promise.all([switching, saving]), "switch then save");
assert.equal(stored("Y").model, "model-y2", "the queued save lands on the profile switched to");
assert.equal(stored("X").model, "model-x", "the profile switched away from keeps its model");
assert.equal(stored("Y").apiKey, "key-y");

// R4-PROV: manual prices are written inside the save's own queued step.
// A save with prices, then a switch in the same tick: the prices stay on the saved profile.
seed(bankXY, "X");
const savingPrices = saveProviderConnection({
  baseUrl: "https://x.example/v1", model: "model-x", notify: false, prices: { inputPerM: "1.5", outputPerM: "3" }
});
const switchingAway = selectProviderConnection("Y");
await watchdog(Promise.all([savingPrices, switchingAway]), "save with prices then switch");
assert.deepEqual([stored("X").inputPerM, stored("X").outputPerM], [1.5, 3], "prices land on the connection that was saved");
assert.deepEqual([stored("Y").inputPerM, stored("Y").outputPerM], [null, null], "the connection switched to gets none");
assert.equal(getProviderRequestConfig().connectionId, "Y");

// An invalid price rejects with err.field before anything is written (no half-saved connection).
seed(bankXY, "X");
const before = structuredClone(values.get(SETTINGS.providerBank));
for (const [prices, field] of [
  [{ inputPerM: "-1", outputPerM: "2" }, "inputPerM"],
  [{ inputPerM: "1", outputPerM: "abc" }, "outputPerM"]
]) {
  await assert.rejects(
    watchdog(saveProviderConnection({ baseUrl: "https://z.example/v1", model: "m-z", enteredApiKey: "k", connectionName: "Z", notify: false, prices }), "bad price"),
    (err) => err.field === field
  );
}
assert.deepEqual(values.get(SETTINGS.providerBank), before, "a rejected price writes no bank change");
assert.equal(values.get(SETTINGS.apiBaseUrl), "https://x.example/v1", "a rejected price leaves the live endpoint");
assert.equal(values.get(SETTINGS.model), "model-x");
assert.equal(values.get(SETTINGS.apiKey), "key-x");

// Endpoint changed and prices not edited: the old provider's prices are cleared, not re-applied.
seed([{ ...conn("X", "https://x.example/v1", "model-x", "key-x"), inputPerM: 2, outputPerM: 4 }, conn("Y", "https://y.example/v1", "model-y", "key-y")], "X");
await watchdog(saveProviderConnection({
  baseUrl: "https://new.example/v1", model: "m", notify: false, prices: { inputPerM: "2", outputPerM: "4" }, pricesEdited: false
}), "base changed, prices unedited");
assert.deepEqual([stored("X").inputPerM, stored("X").outputPerM], [null, null], "unedited prices are cleared with the endpoint");
// Endpoint changed and prices edited: the new prices are stored.
await watchdog(saveProviderConnection({
  baseUrl: "https://newer.example/v1", model: "m", notify: false, prices: { inputPerM: "5", outputPerM: "6" }, pricesEdited: true
}), "base changed, prices edited");
assert.deepEqual([stored("X").inputPerM, stored("X").outputPerM], [5, 6]);
// Same endpoint, unedited prices: kept as they are.
await watchdog(saveProviderConnection({
  baseUrl: "https://newer.example/v1", model: "m2", notify: false, prices: { inputPerM: "5", outputPerM: "6" }, pricesEdited: false
}), "same endpoint");
assert.deepEqual([stored("X").inputPerM, stored("X").outputPerM], [5, 6]);

console.log("settings.connection-queue tests passed");
