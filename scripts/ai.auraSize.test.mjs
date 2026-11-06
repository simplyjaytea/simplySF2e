// The creature prompt offers size for auras as well as area blasts (T-SIZE). Captures the real request, no provider spend.
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";
const settings = new Map([
  [SETTINGS.apiBaseUrl, "http://localhost:11434/v1"], [SETTINGS.apiKey, ""],
  [SETTINGS.apiKeyBaseUrl, ""], [SETTINGS.model, "test-model"],
  [SETTINGS.temperature, 0.8], [SETTINGS.maxTokens, 8000], [SETTINGS.requestTimeout, 90]
]);
globalThis.game = { settings: { get: (_module, key) => settings.get(key) },
  i18n: { localize: (key) => key, format: (key, data) => `${key}:${JSON.stringify(data)}` } };
const requests = [];
let reply;
globalThis.fetch = async (_url, options) => {
  requests.push(JSON.parse(options.body));
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) }, finish_reason: "stop" }] }),
    { headers: { "content-type": "application/json" } });
};
const { generateConcept } = await import("./ai.mjs");
const gmPrompt = "A hostile swamp mystic with a foul aura.";
reply = { name: "Mystic", description: "A mystic", abilityScales: {}, saveScales: {},
  blurb: "", readAloud: "", recallKnowledge: "", size: "med", acScale: "moderate", hpScale: "moderate", perceptionScale: "moderate",
  spellcasting: null, ...Object.fromEntries(["traits", "languages", "speeds", "senses", "skills", "strikes", "specialAbilities",
    "focusSpells", "feats", "equipment", "loot", "resistances", "weaknesses", "immunities"].map((key) => [key, []])) };
await generateConcept({ prompt: gmPrompt, level: 4, rarity: "common", allowSpellcasting: true, preset: "Wizard" });
assert.equal(requests.length, 1, "one request");
const system = requests[0].messages[0].content;
assert.match(system, /"size": "small"\|"medium"\|"large"\|null, \/\/ area-blast and aura; null = medium/,
  "the prompt offers size for auras as well as area blasts");
console.log("ai.auraSize: ok");
