// Provider choice and model-selection rules for the one-screen Welcome.
// Run: node scripts/provider-connect.test.mjs
import assert from "node:assert/strict";
import {
  defaultModelPresent, filterProviderModels, findProviderPreset, resolveModelChoice,
  restoreProviderConnection, snapshotProviderConnection
} from "./provider-connect.mjs";

const presets = [
  { id: "openrouter", model: "deepseek/deepseek-v4.1-flash" },
  { id: "ollama", model: "" }
];
assert.equal(findProviderPreset("openrouter", presets), presets[0]);
assert.equal(findProviderPreset("missing", presets), null);
assert.equal(findProviderPreset("ollama", presets), presets[1]);

const models = ["openai/gpt-6-luna", "anthropic/claude-sonnet", "anthropic/claude-haiku"];
assert.deepEqual(filterProviderModels(models), models);
assert.deepEqual(filterProviderModels(models, { anthropicOnly: true }), ["anthropic/claude-sonnet", "anthropic/claude-haiku"]);
assert.equal(defaultModelPresent(models, "openai/gpt-6-luna"), true);
assert.equal(defaultModelPresent(models, "missing"), false);
assert.equal(defaultModelPresent(models, ""), false);

assert.deepEqual(
  resolveModelChoice(["deepseek/deepseek-v4.1-flash", "openai/gpt-6-luna"], { defaultModel: "deepseek/deepseek-v4.1-flash" }),
  { availableModels: ["deepseek/deepseek-v4.1-flash", "openai/gpt-6-luna"], model: "deepseek/deepseek-v4.1-flash", needsModelChoice: false },
  "a listed preset default is selected explicitly"
);
assert.deepEqual(
  resolveModelChoice(["openai/gpt-6-luna"], { defaultModel: "deepseek/deepseek-v4.1-flash" }),
  { availableModels: ["openai/gpt-6-luna"], model: "", needsModelChoice: true },
  "a missing default is never replaced silently"
);
assert.deepEqual(
  resolveModelChoice(models, { defaultModel: "openai/gpt-6-luna", anthropicOnly: true }),
  { availableModels: ["anthropic/claude-sonnet", "anthropic/claude-haiku"], model: "", needsModelChoice: true },
  "Anthropic always requires a choice from the filtered list"
);
assert.deepEqual(resolveModelChoice([], {}), { availableModels: [], model: "", needsModelChoice: true });

const live = {
  apiBaseUrl: "https://old.example/v1",
  model: "old-model",
  apiKey: "old-key",
  apiKeyBaseUrl: "https://old.example/v1",
  providerBank: { activeId: "old", connections: [{ id: "old", model: "old-model" }] }
};
const snapshot = snapshotProviderConnection((key) => live[key]);
live.providerBank.activeId = "new";
live.providerBank.connections[0].model = "new-model";
assert.equal(snapshot.providerBank.activeId, "old", "the snapshot survives in-place bank mutation");
assert.equal(snapshot.providerBank.connections[0].model, "old-model");
const restored = {};
await restoreProviderConnection(snapshot, async (key, value) => { restored[key] = value; });
assert.deepEqual(restored, {
  apiBaseUrl: "https://old.example/v1",
  model: "old-model",
  apiKey: "old-key",
  apiKeyBaseUrl: "https://old.example/v1",
  providerBank: { activeId: "old", connections: [{ id: "old", model: "old-model" }] }
});
assert.notEqual(restored.providerBank, snapshot.providerBank, "restore does not share mutable bank objects");

console.log("provider-connect.test.mjs: provider, model-choice and snapshot/restore rules verified");
