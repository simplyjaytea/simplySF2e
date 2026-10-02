// selectEquipment/selectLoot: Jev path vs. chat-model fallback through a stubbed fetch.
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";

const settings = new Map([
  [SETTINGS.apiBaseUrl, "http://localhost:11434/v1"], [SETTINGS.apiKey, ""],
  [SETTINGS.apiKeyBaseUrl, ""], [SETTINGS.model, "test-model"],
  [SETTINGS.temperature, 0.8], [SETTINGS.maxTokens, 8000], [SETTINGS.requestTimeout, 90]
]);
globalThis.game = {
  settings: { get: (_m, key) => settings.get(key) },
  i18n: { localize: (k) => k, format: (k, d) => `${k}:${JSON.stringify(d)}` }
};

const jevReplies = [];
const llmReplies = [];
const seen = { jev: 0, llm: 0 };
globalThis.fetch = async (url, options) => {
  if (String(url).includes("/systemone")) {
    seen.jev++;
    const next = jevReplies.shift();
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next), { headers: { "content-type": "application/json" } });
  }
  seen.llm++;
  assert.ok(llmReplies.length, "unexpected chat-model request");
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(llmReplies.shift()) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
  }), { headers: { "content-type": "application/json" } });
};

const { selectEquipment, selectLoot } = await import("./ai.mjs");
const jevConfig = { endpoint: "https://openrouter.ai/api/v1/systemone", apiKey: "k" };
const ref = { packId: "sf2e.equipment", _id: "medkit" };
const candidates = [{ id: "E0", name: "Medkit", type: "equipment", level: 1, ref }];
const concept = {
  name: "Guard", level: 2, rarity: "common", blurb: "", description: "", traits: [], strikes: [],
  equipment: [{ name: "med kit", quantity: 1 }], loot: [{ name: "med kit", quantity: 2 }]
};
const jevAnswer = (key, confidence) => ({
  model: "typesafe/jev-1.13",
  answers: { [key]: { type: "choice", choice: "E0", confidence, probabilities: { E0: confidence } } },
  usage: { input_tokens: 50, output_tokens: 2 }
});

// Confident Jev answer: no chat-model request, exact shape kept.
jevReplies.push(jevAnswer("draft0", 0.9));
let out = await selectEquipment({ concept, candidates, jevConfig });
assert.deepEqual(seen, { jev: 1, llm: 0 });
assert.deepEqual(out.equipment, [{ name: "Medkit", candidate: ref, quantity: 1, value: 0 }]);
assert.equal(out.omitted, false);
assert.equal(out.timing.source, "jev");
assert.equal(out.usage.total, 52);

// Low confidence: falls back to the chat model, which keeps its own behavior.
jevReplies.push(jevAnswer("draft0", 0.3));
llmReplies.push({ equipment: [{ id: "E0", quantity: 1 }] });
out = await selectEquipment({ concept, candidates, jevConfig });
assert.deepEqual(seen, { jev: 2, llm: 1 });
assert.equal(out.equipment[0].name, "Medkit");
assert.equal(out.timing.source, "llm");
assert.ok(out.usage.total >= 30, "fallback usage includes the chat call");

// Network error: same fallback.
jevReplies.push(new Error("offline"));
llmReplies.push({ equipment: [] });
out = await selectEquipment({ concept, candidates, jevConfig });
assert.equal(out.omitted, true);
assert.equal(out.timing.source, "llm");

// No Jev config (local provider): chat model only.
llmReplies.push({ equipment: [{ id: "E0", quantity: 1 }] });
const before = seen.jev;
await selectEquipment({ concept, candidates });
assert.equal(seen.jev, before);

// Loot: Jev keeps the draft quantity; omitted stays false.
jevReplies.push(jevAnswer("loot0", 0.9));
out = await selectLoot({ concept, candidates, jevConfig });
assert.deepEqual(out.loot, [{ name: "Medkit", candidate: ref, quantity: 2, value: 0 }]);
assert.equal(out.omitted, false);

// Loot with a spell gem goes to the chat model without asking Jev.
const jevBefore = seen.jev;
llmReplies.push({ loot: [{ id: "E0", quantity: 1 }] });
out = await selectLoot({
  concept: { ...concept, loot: [{ name: "Spell Gem of Fireball (Rank 3)", quantity: 1 }] }, candidates, jevConfig
});
assert.equal(seen.jev, jevBefore);
assert.equal(out.timing.source, "llm");
console.log("ai.jevPicks tests passed");
