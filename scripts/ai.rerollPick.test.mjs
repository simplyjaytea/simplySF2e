// Drive the reroll-one-pick selector through the production provider path.
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";
import { candidateId } from "./compendium.mjs";

const settings = new Map([
  [SETTINGS.apiBaseUrl, "http://localhost:11434/v1"], [SETTINGS.apiKey, ""],
  [SETTINGS.apiKeyBaseUrl, ""], [SETTINGS.model, "test-model"],
  [SETTINGS.temperature, 0.8], [SETTINGS.maxTokens, 8000], [SETTINGS.requestTimeout, 90]
]);
globalThis.game = {
  settings: { get: (_module, key) => settings.get(key) },
  i18n: { localize: (key) => key, format: (key, data) => `${key}:${JSON.stringify(data)}` }
};

const replies = [];
const requests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, options) => {
  requests.push(JSON.parse(options.body));
  assert.ok(replies.length, "unexpected provider request");
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(replies.shift()) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 }
  }), { headers: { "content-type": "application/json" } });
};

try {
  const { selectRerollPick } = await import("./ai.mjs");
  const concept = {
    name: "Storm Adept", level: 5, blurb: "Rides the lightning", description: "", traits: ["humanoid"],
    spellcasting: { tradition: "arcane", spells: [{ name: "Shock", rank: 2 }, { name: "Haste", rank: 3 }] },
    feats: [], specialAbilities: []
  };
  // Production-shaped catalog ids (the opaque c-<base64> form); the model only ever sees R1, R2.
  const candidates = [
    { id: candidateId({ packId: "sf2e.spells", _id: "fear" }), name: "Fear", rank: 1, ref: { packId: "sf2e.spells", _id: "fear" } },
    { id: candidateId({ packId: "sf2e.spells", _id: "blur" }), name: "Blur", rank: 2, ref: { packId: "sf2e.spells", _id: "blur" } }
  ];

  replies.push({ id: "R2" });
  const picked = await selectRerollPick({ concept, kind: "spell", current: "Shock", candidates });
  assert.equal(picked.candidate, candidates[1], "the issued candidate object (and its reference) comes back");
  assert.equal(picked.usage.total, 25);
  const [request] = requests;
  assert.match(request.messages[0].content, /"id"/);
  assert.match(request.messages[1].content, /Replacing: Shock/);
  assert.match(request.messages[1].content, /Already has \(do not repeat\): Haste/);
  assert.match(request.messages[1].content, /R2 Blur \(rank 2\)/);
  assert.doesNotMatch(request.messages[1].content, /c-[A-Za-z0-9+/]{8,}/, "no opaque c- id reaches the model");
  assert.match(request.messages[1].content, /Tradition: arcane/);
  assert.equal(request.max_tokens, 512);
  assert.notEqual(request.temperature, 0, "rerolls are not deterministic, so repeated rerolls can differ");

  replies.push({ id: "invented" });
  const invalid = await selectRerollPick({ concept, kind: "spell", current: "Shock", candidates });
  assert.equal(invalid.candidate, null, "an ID outside the catalog never becomes a pick");

  replies.push({ id: candidates[1].id });
  const forged = await selectRerollPick({ concept, kind: "spell", current: "Shock", candidates });
  assert.equal(forged.candidate, null, "a c- id the model was never shown resolves nothing");

  replies.push({ id: "Fear" });
  const byName = await selectRerollPick({ concept, kind: "spell", current: "Shock", candidates });
  assert.equal(byName.candidate, candidates[0], "an exact catalog name in the id field is accepted, as elsewhere");

  replies.push({ pick: "R1" }, { id: "R1" });
  const retried = await selectRerollPick({ concept, kind: "feat", current: "Quick Draw", candidates });
  assert.equal(retried.candidate, candidates[0], "a wrong response key is retried once with the same contract");
  assert.doesNotMatch(requests.at(-1).messages[1].content, /\(rank/, "feat catalogs carry no spell rank");

  await assert.rejects(selectRerollPick({ concept, kind: "spell", current: "Shock", candidates: [] }), TypeError);
  await assert.rejects(selectRerollPick({ concept, kind: "loot", current: "Shock", candidates }), TypeError);
  assert.equal(replies.length, 0);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("ai reroll pick: production task contract and exact-ID filtering passed");
