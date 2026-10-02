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

const { selectEquipment, selectLoot, selectCreatureFeats, selectCreatureAbilities, selectFeats, selectCharacterChoices, selectSpells } = await import("./ai.mjs");
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
assert.ok(out.timing.jevMs >= 0 && "jevMs" in out.timing, "failed Jev call time is recorded");
assert.ok(out.usage.total >= 30, "fallback usage includes the chat call");

// Network error: same fallback.
jevReplies.push(new Error("offline"));
llmReplies.push({ equipment: [] });
out = await selectEquipment({ concept, candidates, jevConfig });
assert.equal(out.omitted, true);
assert.equal(out.timing.source, "llm");
assert.ok("jevMs" in out.timing, "errored Jev call time is recorded");

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
// Creature feats/abilities: Jev answers, falls back to the chat model on failure.
const featCandidates = [{ id: "F0", name: "Reactive Shield", ref: { packId: "sf2e.feats", _id: "shield" } }];
const grounded = { ...concept, feats: ["shield"], specialAbilities: [{ name: "Grab", glossary: "Grab" }] };
const entry = (choice, confidence = 0.9) => ({
  model: "typesafe/jev-1.13",
  answers: { entry0: { type: "choice", choice, confidence, probabilities: { [choice]: confidence } } },
  usage: { input_tokens: 40, output_tokens: 2 }
});
const jevBeforeFeats = seen.jev;
jevReplies.push(entry("F0"));
out = await selectCreatureFeats({ concept: grounded, candidates: featCandidates, jevConfig });
assert.deepEqual(out.feats, [{ name: "Reactive Shield", candidate: featCandidates[0].ref }]);
assert.equal(out.timing.source, "jev");
assert.equal(seen.jev, jevBeforeFeats + 1);

jevReplies.push(entry("none"));
out = await selectCreatureFeats({ concept: grounded, candidates: featCandidates, jevConfig });
assert.deepEqual([out.feats, out.omitted, out.timing.source], [[], true, "jev"]);

jevReplies.push(new Error("offline"));
llmReplies.push({ featIds: ["F0"] });
out = await selectCreatureFeats({ concept: grounded, candidates: featCandidates, jevConfig });
assert.equal(out.feats[0].name, "Reactive Shield");
assert.equal(out.timing.source, "llm");
assert.ok("jevMs" in out.timing);

const abilityCandidates = [{ id: "A0", name: "Grab", ref: { packId: "sf2e.glossary", _id: "grab" } }];
jevReplies.push(entry("A0"));
out = await selectCreatureAbilities({ concept: grounded, candidates: abilityCandidates, jevConfig });
assert.equal(out.abilities[0].name, "Grab");
assert.equal(out.timing.source, "jev");
jevReplies.push(entry("none"));
out = await selectCreatureAbilities({ concept: grounded, candidates: abilityCandidates, jevConfig });
assert.deepEqual(out.abilities, []);
jevReplies.push(new Error("offline"));
llmReplies.push({ abilityIds: ["A0"] });
out = await selectCreatureAbilities({ concept: grounded, candidates: abilityCandidates, jevConfig });
assert.equal(out.timing.source, "llm");

// PC feat slots: Jev picks with cross-slot dedupe; transport failure falls back to the chat model.
const pcConcept = { name: "Vex", level: 3, class: "Soldier", blurb: "b", feats: ["Alpha"] };
const slotFeat = (name) => ({ name, id: name, ref: { packId: "sf2e.feats", _id: name } });
const featSlots = [
  { type: "class", level: 1, candidates: [slotFeat("Alpha"), slotFeat("Beta")] },
  { type: "class", level: 2, candidates: [slotFeat("Alpha"), slotFeat("Beta")] }
];
const slotAnswer = (top, other, otherProbability) => ({
  type: "choice", choice: top, confidence: 0.9, probabilities: { [top]: 0.9, [other]: otherProbability }
});
jevReplies.push({
  model: "typesafe/jev-1.13",
  answers: { slot1: slotAnswer("F0", "F1", 0.05), slot2: slotAnswer("F0", "F1", 0.85) },
  usage: { input_tokens: 70, output_tokens: 2 }
});
out = await selectFeats({ concept: pcConcept, slots: featSlots, jevConfig });
assert.deepEqual(out.picks.map((p) => [p.slot, p.name]), [[1, "Alpha"], [2, "Beta"]], "slot 2 takes the next-best unused feat");
assert.equal(out.timing.source, "jev");

// Runner-up below the confidence bar: whole call goes to the chat model, which fills both slots.
jevReplies.push({
  model: "typesafe/jev-1.13",
  answers: { slot1: slotAnswer("F0", "F1", 0.05), slot2: slotAnswer("F0", "F1", 0.05) }, usage: null
});
llmReplies.push({ picks: [{ slot: 1, id: "F0" }, { slot: 2, id: "F1" }] });
out = await selectFeats({ concept: pcConcept, slots: featSlots, jevConfig });
assert.deepEqual(out.picks.map((p) => p.name), ["Alpha", "Beta"]);
assert.equal(out.timing.source, "llm");
assert.ok("jevMs" in out.timing);

jevReplies.push(new Error("offline"));
llmReplies.push({ picks: [{ slot: 1, id: "F0" }] });
out = await selectFeats({ concept: pcConcept, slots: featSlots, jevConfig });
assert.equal(out.timing.source, "llm");

// Character choices: Jev answer is validated like a chat-model one; any miss falls back.
const choiceGroups = [{ id: "choice-a", item: "Fighter", prompt: "Choose a skill", options: [{ id: "a-ath", label: "Athletics" }, { id: "a-acr", label: "Acrobatics" }] }];
jevReplies.push({
  model: "typesafe/jev-1.13",
  answers: { group0: { type: "choice", choice: "a-acr", confidence: 0.9, probabilities: { "a-acr": 0.9, "a-ath": 0.1 } } },
  usage: { input_tokens: 30, output_tokens: 2 }
});
out = await selectCharacterChoices({ concept: pcConcept, groups: choiceGroups, jevConfig });
assert.deepEqual(out.picks, [{ choice: "choice-a", option: "a-acr" }]);
assert.equal(out.timing.source, "jev");
jevReplies.push({
  model: "typesafe/jev-1.13",
  answers: { group0: { type: "choice", choice: "a-acr", confidence: 0.2, probabilities: { "a-acr": 0.2, "a-ath": 0.1 } } }, usage: null
});
llmReplies.push({ picks: [{ choice: "choice-a", option: "a-ath" }] });
out = await selectCharacterChoices({ concept: pcConcept, groups: choiceGroups, jevConfig });
assert.deepEqual(out.picks, [{ choice: "choice-a", option: "a-ath" }]);
assert.equal(out.timing.source, "llm");

// Spells: PC slot plan goes through Jev; a miss runs the chat model, which keeps its own validation.
const spellRef = (id) => ({ packId: "sf2e.spells", _id: id });
const spellCandidates = [
  { id: "S0", name: "Detect Magic", rank: 0, ref: spellRef("s0") }, { id: "S1", name: "Force Barrage", rank: 1, ref: spellRef("s1") }
];
const pcSpellArgs = {
  concept: { ...pcConcept, traits: [], spellcasting: { tradition: "arcane", spells: [] } },
  candidates: spellCandidates, maxRank: 1, plannedPicks: { 0: 1, 1: 1 }, preparationMode: "prepared", jevConfig
};
const spellScore = (score, confidence = 0.9) => ({
  type: "score", score, confidence, probabilities: {}, legend: { 0: "poor", 1: "fair", 2: "good", 3: "excellent" }
});
jevReplies.push({ model: "typesafe/jev-1.13", answers: { spell_0: spellScore(2), spell_1: spellScore(3) }, usage: { input_tokens: 40, output_tokens: 2 } });
const seenBefore = { ...seen };
out = await selectSpells(pcSpellArgs);
assert.equal(seen.llm, seenBefore.llm, "no chat-model request");
assert.deepEqual(out.spells, [
  { name: "Detect Magic", candidate: spellCandidates[0].ref, rank: 0 }, { name: "Force Barrage", candidate: spellCandidates[1].ref, rank: 1 }
]);
assert.equal(out.timing.source, "jev");
jevReplies.push({ model: "typesafe/jev-1.13", answers: { spell_0: spellScore(2, 0.2), spell_1: spellScore(3) }, usage: null });
llmReplies.push({ spells: [{ id: "S0", rank: "cantrip", signature: "regular" }, { id: "S1", rank: "rank-one", signature: "regular" }], focusSpellIds: [] });
out = await selectSpells(pcSpellArgs);
assert.deepEqual(out.spells.map((s) => s.name), ["Detect Magic", "Force Barrage"]);
assert.equal(out.timing.source, "llm");
assert.ok("jevMs" in out.timing);
// Creature (no slot plan) never asks Jev.
const spellJevBefore = seen.jev;
llmReplies.push({ spells: [{ id: "S1", rank: 1 }], focusSpellIds: [] });
out = await selectSpells({ concept: pcSpellArgs.concept, candidates: spellCandidates, maxRank: 1, jevConfig });
assert.equal(seen.jev, spellJevBefore);
assert.equal(out.timing, undefined);
console.log("ai.jevPicks tests passed");
