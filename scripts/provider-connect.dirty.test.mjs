// Unsaved-edit detection for Provider Setup's connection switch.
// Run: node scripts/provider-connect.dirty.test.mjs
import assert from "node:assert/strict";
import { connectionFormDirty } from "./provider-connect.mjs";

const saved = {
  connectionName: "DeepSeek",
  apiBaseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-v4-flash",
  apiKey: "sk-old-secret"
};
const same = { connectionName: "DeepSeek", apiBaseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash", apiKey: "" };

assert.deepEqual(connectionFormDirty(saved, same), [], "identical form, blank key field: nothing dirty");
assert.deepEqual(
  connectionFormDirty(saved, { ...same, apiBaseUrl: "https://api.openai.com/v1" }),
  ["apiBaseUrl"],
  "one changed endpoint"
);
assert.deepEqual(connectionFormDirty(saved, { ...same, model: "  deepseek-v4-flash  " }), [], "whitespace-only change is not dirty");
assert.deepEqual(connectionFormDirty(saved, { ...same, apiKey: "sk-new-secret" }), ["apiKey"], "typed key that differs is dirty");
assert.deepEqual(connectionFormDirty(saved, { ...same, apiKey: "  sk-old-secret " }), [], "typed key equal to saved (after trim) is not dirty");
assert.deepEqual(connectionFormDirty(saved, { ...same, apiKey: undefined }), [], "undefined key field is treated as blank");
assert.deepEqual(connectionFormDirty(saved, { ...same, unknownField: "x" }), [], "unknown extra form field is ignored");
assert.deepEqual(
  connectionFormDirty(saved, { ...same, connectionName: "DeepSeek 2", model: "" }),
  ["connectionName", "model"],
  "several fields reported in field order"
);
assert.deepEqual(connectionFormDirty({ model: "m" }, { model: "m", apiKey: "" }), [], "missing saved fields read as empty");
assert.deepEqual(connectionFormDirty({ model: undefined }, { model: "" }), [], "undefined saved equals empty form");
assert.deepEqual(connectionFormDirty({}, { model: "x" }), ["model"], "no saved record: a typed value is dirty");
console.log("provider-connect.dirty.test.mjs: ok");
