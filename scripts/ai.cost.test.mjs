// Provider-reported cost survives requestJSON: summed across attempts, partial when one lacks it.
// Run: node scripts/ai.cost.test.mjs
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";

const settings = new Map([
  [SETTINGS.apiBaseUrl, "https://openrouter.ai/api/v1"],
  [SETTINGS.apiKey, ""], [SETTINGS.apiKeyBaseUrl, ""],
  [SETTINGS.model, "test-model"], [SETTINGS.temperature, 0.8],
  [SETTINGS.maxTokens, 8000], [SETTINGS.requestTimeout, 90]
]);
globalThis.game = {
  settings: { get: (_m, key) => settings.get(key) },
  i18n: { localize: (k) => k, format: (k, d) => `${k}:${JSON.stringify(d)}` }
};
const replies = [];
globalThis.fetch = async () => {
  const reply = replies.shift();
  assert.ok(reply, "unexpected extra provider call");
  return new Response(JSON.stringify(reply), { status: 200, headers: { "content-type": "application/json" } });
};
const { chooseSpellFocus } = await import("./ai.mjs");
const args = { concept: { name: "Ember Adept", level: 5, blurb: "b", description: "d", traits: ["fire"] }, tradition: "arcane" };
const truncated = (usage) => ({ choices: [{ message: { content: '{"keywords":["fire"' }, finish_reason: "length" }], usage });
const ok = (usage) => ({ choices: [{ message: { content: '{"keywords":["fire","control"]}' }, finish_reason: "stop" }], usage });

// Two OpenRouter-shaped calls (truncated attempt + retry), both with cost: summed.
replies.push(
  truncated({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30, cost: 0.0004 }),
  ok({ prompt_tokens: 11, completion_tokens: 5, total_tokens: 16, cost: 0.0002 })
);
let result = await chooseSpellFocus(args);
assert.ok(Math.abs(result.usage.cost - 0.0006) < 1e-12, `summed cost, got ${result.usage.cost}`);
assert.equal(result.usage.costMissing, undefined);
assert.equal(result.usage.prompt, 21);

// One call without cost: partial.
replies.push(
  truncated({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30, cost: 0.0004 }),
  ok({ prompt_tokens: 11, completion_tokens: 5, total_tokens: 16 })
);
result = await chooseSpellFocus(args);
assert.ok(Math.abs(result.usage.cost - 0.0004) < 1e-12);
assert.equal(result.usage.costMissing, true);

// Missing first, then a priced retry: still partial.
replies.push(
  truncated({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }),
  ok({ prompt_tokens: 11, completion_tokens: 5, total_tokens: 16, cost: 0.0002 })
);
result = await chooseSpellFocus(args);
assert.equal(result.usage.costMissing, true);

// No cost anywhere: no cost field at all.
replies.push(ok({ prompt_tokens: 11, completion_tokens: 5, total_tokens: 16 }));
result = await chooseSpellFocus(args);
assert.equal("cost" in result.usage, false);

console.log("ai.cost.test.mjs: cost accumulation assertions passed");
