// Unsaved-edit detection for Provider Setup's connection switch. The saved side
// is built from the production snapshot (SETTINGS keys, snapshotProviderConnection)
// through savedConnectionForDirty; the form side through connectionFormValues.
// Run: node scripts/provider-connect.dirty.test.mjs
import assert from "node:assert/strict";
import {
  connectionFormDirty, connectionFormValues, savedConnectionForDirty, snapshotProviderConnection
} from "./provider-connect.mjs";
import { SETTINGS } from "./settings.mjs";

// Stored settings as Foundry returns them: keys are SETTINGS.* values.
const stored = (overrides = {}) => ({
  [SETTINGS.apiBaseUrl]: "https://api.deepseek.com/v1",
  [SETTINGS.model]: "deepseek-v4-flash",
  [SETTINGS.apiKey]: "sk-old-secret",
  [SETTINGS.apiKeyBaseUrl]: "https://api.deepseek.com/v1",
  [SETTINGS.providerBank]: [],
  ...overrides
});
const savedOf = (store, prices = {}) => savedConnectionForDirty(
  snapshotProviderConnection((key) => store[key]),
  { connectionName: "DeepSeek", prices }
);
// The form as the app reads it: text fields by name, clearApiKey as checkbox state.
const formOf = (values) => connectionFormValues((name) => values[name]);
const sameForm = {
  connectionName: "DeepSeek", apiBaseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash",
  apiKey: "", clearApiKey: false, inputPerM: "", outputPerM: ""
};
const saved = savedOf(stored());

assert.deepEqual(connectionFormDirty(saved, formOf(sameForm)), [], "identical form, blank key field: nothing dirty");
assert.deepEqual(
  connectionFormDirty(saved, formOf({ ...sameForm, apiBaseUrl: "https://api.openai.com/v1" })),
  ["apiBaseUrl"],
  "one changed endpoint"
);
assert.deepEqual(connectionFormDirty(saved, formOf({ ...sameForm, model: "  deepseek-v4-flash  " })), [], "whitespace-only change is not dirty");
assert.deepEqual(connectionFormDirty(saved, formOf({ ...sameForm, apiKey: "sk-new-secret" })), ["apiKey"], "typed key that differs is dirty");
assert.deepEqual(connectionFormDirty(saved, formOf({ ...sameForm, apiKey: "  sk-old-secret " })), [], "typed key equal to saved (after trim) is not dirty");
assert.deepEqual(connectionFormDirty(saved, formOf({ ...sameForm, apiKey: undefined })), [], "undefined key field is treated as blank");
assert.deepEqual(connectionFormDirty(saved, formOf({ ...sameForm, unknownField: "x" })), [], "unknown extra form field is ignored");
assert.deepEqual(
  connectionFormDirty(saved, formOf({ ...sameForm, connectionName: "DeepSeek 2", model: "" })),
  ["connectionName", "model"],
  "several fields reported in field order"
);

// clear-key checkbox: dirty only when checked.
assert.deepEqual(connectionFormDirty(saved, formOf({ ...sameForm, clearApiKey: true })), ["clearApiKey"], "a checked clear-key box is dirty");
assert.deepEqual(connectionFormDirty(saved, formOf({ ...sameForm, clearApiKey: false })), [], "an unchecked clear-key box is not dirty");

// Manual prices: compared as numbers; empty means unset.
const priced = savedOf(stored(), { inputPerM: 0.27, outputPerM: 1.1 });
assert.deepEqual(connectionFormDirty(priced, formOf({ ...sameForm, inputPerM: "0.5", outputPerM: "1.1" })), ["inputPerM"], "an input price change is dirty");
assert.deepEqual(connectionFormDirty(priced, formOf({ ...sameForm, inputPerM: "0.27", outputPerM: "1.10" })), [], "the same prices as text are not dirty");
assert.deepEqual(connectionFormDirty(priced, formOf({ ...sameForm, inputPerM: "0.27", outputPerM: "" })), ["outputPerM"], "clearing a saved price is dirty");
assert.deepEqual(connectionFormDirty(savedOf(stored()), formOf({ ...sameForm, inputPerM: "", outputPerM: "" })), [], "no saved price and an empty field: not dirty");
assert.deepEqual(connectionFormDirty(savedOf(stored()), formOf({ ...sameForm, inputPerM: "0.4" })), ["inputPerM"], "a new price on an unpriced connection is dirty");

// Stored URL with a trailing slash, shown normalised in the form: not an edit.
const slashed = savedOf(stored({ [SETTINGS.apiBaseUrl]: "https://api.deepseek.com/v1/" }));
assert.deepEqual(connectionFormDirty(slashed, formOf(sameForm)), [], "a stored trailing slash is not a change");
assert.deepEqual(
  connectionFormDirty(slashed, formOf({ ...sameForm, apiBaseUrl: "https://api.openai.com/v1" })),
  ["apiBaseUrl"],
  "a real endpoint change is still dirty with a stored trailing slash"
);

assert.deepEqual(connectionFormDirty({ model: "m" }, { model: "m", apiKey: "" }), [], "missing saved fields read as empty");
assert.deepEqual(connectionFormDirty({ model: undefined }, { model: "" }), [], "undefined saved equals empty form");
assert.deepEqual(connectionFormDirty({}, { model: "x" }), ["model"], "no saved record: a typed value is dirty");
console.log("provider-connect.dirty.test.mjs: ok");
