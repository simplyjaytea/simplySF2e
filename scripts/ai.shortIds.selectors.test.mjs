// Short per-request ids through the production provider path for the selectors the
// other ai.* tests do not reach: shop stock, treasure picks, loot with spell gems, and the
// character's ancestry/background/class. The model sees S1/T1/L1/C1 ids, never the opaque
// c- ids, and a forged or never-shown id resolves nothing.
// Run: node scripts/ai.shortIds.selectors.test.mjs
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";
import { candidateId } from "./compendium.mjs";
import { pickShopStock } from "./shop.mjs";
import { resolveIssuedPicks } from "./treasure.mjs";

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
    usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
  }), { headers: { "content-type": "application/json" } });
};
const opaque = /\bc-[A-Za-z0-9+/]{8,}/;
const bodyText = () => JSON.stringify(requests.at(-1));

try {
  const { selectShopStock, selectTreasureItems, selectLoot, selectAncestryBackgroundClass } = await import("./ai.mjs");
  const item = (name, type, level, id) => {
    const entry = { packId: "sf2e.equipment", _id: id };
    return { id: candidateId(entry), ref: entry, name, type, level };
  };
  const items = [item("Medkit", "equipment", 1, "medkit"), item("Laser Pistol", "weapon", 2, "pistol"), item("Battery", "consumable", 0, "battery")];

  // Shop: the model answers short ids; the module's own resolver gets the catalog ids back.
  const concept = { name: "Dock Stall", shopkeeper: "Ro", blurb: "", description: "", keywords: ["tools"] };
  replies.push({ ids: ["S2", "S99", items[0].id, "Battery", "S2"] });
  const shop = await selectShopStock({ concept, candidates: items, count: 3 });
  assert.doesNotMatch(bodyText(), opaque, "no opaque c- id in the shop request");
  assert.match(bodyText(), /S1 \| Medkit/);
  const stock = pickShopStock(shop.ids, items, 3);
  assert.deepEqual(stock.stock.map((entry) => entry.name), ["Laser Pistol", "Battery"],
    "S2 and the exact name resolve; S99 and the typed-back catalog id do not");
  assert.equal(stock.unknown.length, 2, "the forged and the unissued ids are counted as dropped");
  assert.ok(shop.ids.every((id) => id !== items[0].id), "a catalog id the model was never shown never reaches the resolver as a match");

  // Treasure: same contract.
  replies.push({ ids: ["T3", "T1", items[1].id, "forged"] });
  const treasure = await selectTreasureItems({ concept: { ...concept, name: "Cache" }, candidates: items, count: 3 });
  assert.doesNotMatch(bodyText(), opaque);
  assert.match(bodyText(), /T3 \| Battery/);
  const { issued, unknown } = resolveIssuedPicks(treasure.ids, items);
  assert.deepEqual(issued.map((entry) => entry.name), ["Battery", "Medkit"]);
  assert.equal(unknown.length, 2);

  // Loot: item ids L1.. and spell-gem spell ids continue the same counter.
  const spell = { id: candidateId({ packId: "sf2e.spells", _id: "fireball" }), ref: { packId: "sf2e.spells", _id: "fireball" }, name: "Fireball", rank: 3 };
  replies.push({ loot: [{ id: "L2", quantity: 2 }, { id: items[0].id, quantity: 1 }, { gemSpellId: "L4", rank: 3, quantity: 1 }, { gemSpellId: spell.id, rank: 3, quantity: 1 }] });
  const lootConcept = { name: "Raider", level: 5, rarity: "common", blurb: "", traits: [], loot: [{ name: "Spell Gem of Fireball (Rank 3)", quantity: 1 }], equipment: [] };
  const loot = await selectLoot({ concept: lootConcept, candidates: items, scrollCandidates: [spell], jevConfig: null });
  assert.doesNotMatch(bodyText(), opaque);
  assert.match(bodyText(), /L4 \| Fireball \| 3/, "the spell-gem list continues the loot ids");
  assert.deepEqual(loot.loot.map((row) => row.name), ["Laser Pistol", "Spell Gem of Fireball (Rank 3)"],
    "L2 and the gem spell L4 resolve; the typed-back catalog id and gem id resolve nothing");

  // Ancestry, heritage, background, class: one encoder, ids C1...
  const lists = ["ancestry", "heritage", "background", "class"].map((kind) => [{
    id: candidateId({ packId: `sf2e.${kind}`, _id: `${kind}1` }), ref: { packId: `sf2e.${kind}`, _id: `${kind}1` }, name: `Chosen ${kind}`
  }]);
  const [ancestry, heritage, background, pcClass] = lists;
  // The response validator also requires the name keys (pre-existing contract), so the reply carries both.
  replies.push({ ancestryId: "C1", heritageId: "C2", backgroundId: "C3", classId: pcClass[0].id, keyAbility: "dex", ancestry: "a", heritage: "h", background: "b", class: "c" });
  const abc = await selectAncestryBackgroundClass({
    concept: { name: "Pc", level: 1, ancestry: "x", background: "y", class: "z", keyAbility: "dex", blurb: "", backstory: "" },
    ancestryCandidates: ancestry, heritageCandidates: heritage, backgroundCandidates: background, classCandidates: pcClass
  });
  assert.doesNotMatch(bodyText(), opaque);
  assert.match(bodyText(), /C3 \| Chosen background/);
  assert.equal(abc.ancestryCandidate, ancestry[0].ref);
  assert.equal(abc.heritageCandidate, heritage[0].ref);
  assert.equal(abc.backgroundCandidate, background[0].ref);
  assert.equal(abc.classCandidate, null, "the class id typed back as the opaque c- id resolves nothing");
  assert.equal(replies.length, 0);
} finally {
  globalThis.fetch = originalFetch;
}
console.log("ai.shortIds.selectors.test.mjs: shop, treasure, loot and ABC short ids passed");
