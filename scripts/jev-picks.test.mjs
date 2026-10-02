// Jev equipment/loot pick logic with an injected request function (no network).
import assert from "node:assert/strict";
import { jevPickEquipment, jevPickLoot, jevPickCreatureFeats, jevPickCreatureAbilities, jevPickFeats, jevPickCharacterChoices, jevScoreIndex, mergeUsage, JEV_NONE_KEY } from "./jev-picks.mjs";

const jevConfig = { endpoint: "https://openrouter.ai/api/v1/systemone", apiKey: "k" };
const ref = (id) => ({ packId: "sf2e.equipment", _id: id });
const candidates = [
  { id: "W0", name: "Tactical Pistol", type: "weapon", level: 1, ref: ref("pistol") },
  { id: "W1", name: "Combat Knife", type: "weapon", level: 0, ref: ref("knife") },
  { id: "A0", name: "Plasma Rounds", type: "ammo", level: 1, ref: ref("rounds") },
  { id: "E0", name: "Medkit", type: "equipment", level: 1, ref: ref("medkit") }
];
const choice = (id, confidence = 0.95) => ({ type: "choice", choice: id, confidence, probabilities: { [id]: confidence } });
const response = (answers, usage = { input_tokens: 100, output_tokens: 5, cost: 0.001 }) => ({ answers, usage, model: "m", ms: 40 });
const scripted = (...replies) => {
  const calls = [];
  const request = async (args) => { calls.push(args); const next = replies.shift(); return typeof next === "function" ? next(args) : next; };
  return { request, calls };
};
const concept = (extra = {}) => ({
  name: "Dock Guard", level: 2, blurb: "b", description: "d", traits: ["humanoid"], rarity: "common",
  strikes: [{ name: "Pistol", type: "ranged" }], equipment: [{ name: "pistol", quantity: 1 }, { name: "med kit", quantity: 1 }],
  loot: [], ...extra
});

// Confident draft picks keep the issued ref and key criteria by id.
{
  const { request, calls } = scripted(response({ draft0: choice("W0"), draft1: choice("E0") }));
  const out = await jevPickEquipment({ concept: concept(), candidates, jevConfig, request });
  assert.deepEqual(out.equipment.map((e) => [e.name, e.quantity]), [["Tactical Pistol", 1], ["Medkit", 1]]);
  assert.equal(out.equipment[0].candidate, candidates[0].ref, "must retain the identical issued ref object");
  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0].questions.draft0.criteria), ["W0", "W1", "A0", "E0"]);
  assert.equal(out.usage.total, 105);
  assert.ok(out.ms >= 0 && out.attempted === true);
}

// Low confidence on any draft item -> null (caller runs the chat model).
{
  const { request } = scripted(response({ draft0: choice("W0"), draft1: choice("E0", 0.4) }));
  assert.equal((await jevPickEquipment({ concept: concept(), candidates, jevConfig, request })).equipment, null);
}
// Transport failure -> null.
{
  const { request } = scripted(null);
  assert.equal((await jevPickEquipment({ concept: concept(), candidates, jevConfig, request })).equipment, null);
}
// No config -> no request at all.
{
  const { request, calls } = scripted();
  assert.equal((await jevPickEquipment({ concept: concept(), candidates, jevConfig: null, request })).equipment, null);
  assert.equal(calls.length, 0);
}
// Duplicate picks collapse to one row.
{
  const { request } = scripted(response({ draft0: choice("W0"), draft1: choice("W0") }));
  const out = await jevPickEquipment({ concept: concept({ strikes: [] }), candidates, jevConfig, request });
  assert.equal(out.equipment.length, 1);
}
// Strike with no matching draft weapon gets a weapon question with a none key; none/low-confidence is skipped, not a fallback.
{
  const c = concept({ equipment: [{ name: "medkit", quantity: 1 }], strikes: [{ name: "Knife slash", type: "melee" }, { name: "Bite", type: "melee" }] });
  const { request, calls } = scripted(response({ draft0: choice("E0"), strike0: choice("W1"), strike1: choice(JEV_NONE_KEY) }));
  const out = await jevPickEquipment({ concept: c, candidates, jevConfig, request });
  assert.deepEqual(out.equipment.map((e) => e.name), ["Medkit", "Combat Knife"]);
  assert.ok(Object.hasOwn(calls[0].questions.strike0.criteria, JEV_NONE_KEY));
  assert.ok(!Object.hasOwn(calls[0].questions.strike0.criteria, "E0"), "strike choices are weapons only");
}
// A strike the draft already names is not asked again.
{
  const { request, calls } = scripted(response({ draft0: choice("W0"), draft1: choice("E0") }));
  await jevPickEquipment({ concept: concept(), candidates, jevConfig, request });
  assert.deepEqual(Object.keys(calls[0].questions), ["draft0", "draft1"]);
}
// Ammunition quantity: second Score request mapped through the legend; unreadable -> 1.
{
  const c = concept({ equipment: [{ name: "rounds", quantity: 1 }], strikes: [] });
  const score = (n, legend) => ({ type: "score", score: n, confidence: 0.9, legend, probabilities: {} });
  const legend = { 0: "one", 1: "a few", 2: "several" };
  let { request } = scripted(response({ draft0: choice("A0") }), response({ qty_A0: score(1.8, legend) }));
  assert.equal((await jevPickEquipment({ concept: c, candidates, jevConfig, request })).equipment[0].quantity, 5);
  ({ request } = scripted(response({ draft0: choice("A0") }), response({ qty_A0: score(1, { 0: "x", 1: "y", 2: "z" }) })));
  assert.equal((await jevPickEquipment({ concept: c, candidates, jevConfig, request })).equipment[0].quantity, 1);
  ({ request } = scripted(response({ draft0: choice("A0") }), null));
  assert.equal((await jevPickEquipment({ concept: c, candidates, jevConfig, request })).equipment[0].quantity, 1);
}
assert.equal(jevScoreIndex({ type: "score", score: -3, legend: { 0: "one" } }, ["one", "a few"]), 0);
assert.equal(jevScoreIndex({ type: "choice" }, ["one"]), null);
assert.deepEqual(mergeUsage(null, null), null);
assert.equal(mergeUsage({ prompt: 1, completion: 1, total: 2, cost: 0.1 }, { prompt: 1, completion: 0, total: 1, cost: null }).cost, 0.1);

// Loot: draft quantity kept, coins skipped by the picker, duplicates merged.
{
  const loot = [
    { name: "Medkit", quantity: 2 }, { name: "Combat Medkit", quantity: 1 }, { name: "50 credits", quantity: 50 }
  ];
  const { request, calls } = scripted(response({ loot0: choice("E0"), loot1: choice("E0") }));
  const out = await jevPickLoot({ concept: concept({ loot }), candidates, jevConfig, request });
  assert.deepEqual(out.loot.map((l) => [l.name, l.quantity]), [["Medkit", 3]]);
  assert.deepEqual(Object.keys(calls[0].questions), ["loot0", "loot1"], "the coin entry gets no question");
}
// Loot: any spell gem entry -> whole step to the chat model, with no Jev request.
{
  const loot = [{ name: "Medkit", quantity: 1 }, { name: "Spell Gem of Fireball (Rank 3)", quantity: 1 }];
  const { request, calls } = scripted();
  assert.equal((await jevPickLoot({ concept: concept({ loot }), candidates, jevConfig, request })).loot, null);
  assert.equal(calls.length, 0);
}
// Loot: all coins -> nothing to ask; low confidence -> null.
{
  const { request, calls } = scripted();
  assert.equal((await jevPickLoot({ concept: concept({ loot: [{ name: "50 credits", quantity: 50 }] }), candidates, jevConfig, request })).loot, null);
  assert.equal(calls.length, 0);
  const lowReq = scripted(response({ loot0: choice("E0", 0.2) }));
  assert.equal((await jevPickLoot({ concept: concept({ loot: [{ name: "Medkit", quantity: 1 }] }), candidates, jevConfig, request: lowReq.request })).loot, null);
}
// Creature feats: one Choice per draft entry (cap 3) with a `none` key; none/low drops that entry.
{
  const feats = [{ id: "F0", name: "Reactive Shield", ref: ref("shield") }, { id: "F1", name: "Sudden Charge", ref: ref("charge") }];
  const draft = ["Shield thing", "Charge thing", "Dup charge", "Fourth"];
  const { request, calls } = scripted(response({ entry0: choice("F0"), entry1: choice("F1"), entry2: choice("F1") }));
  const out = await jevPickCreatureFeats({ concept: concept({ feats: draft }), candidates: feats, jevConfig, request });
  assert.deepEqual(out.feats.map((f) => f.name), ["Reactive Shield", "Sudden Charge"], "deduped");
  assert.equal(out.feats[0].candidate, feats[0].ref);
  assert.equal(out.omitted, false);
  assert.deepEqual(Object.keys(calls[0].questions), ["entry0", "entry1", "entry2"], "capped at 3");
  assert.deepEqual(Object.keys(calls[0].questions.entry0.criteria), ["F0", "F1", JEV_NONE_KEY]);

  // none and low confidence drop single entries.
  const mixed = scripted(response({ entry0: choice("F0"), entry1: choice(JEV_NONE_KEY), entry2: choice("F1", 0.2) }));
  const m = await jevPickCreatureFeats({ concept: concept({ feats: draft }), candidates: feats, jevConfig, request: mixed.request });
  assert.deepEqual(m.feats.map((f) => f.name), ["Reactive Shield"]);

  // Every entry confidently `none` -> omitted true (wishlist declined).
  const allNone = scripted(response({ entry0: choice(JEV_NONE_KEY), entry1: choice(JEV_NONE_KEY) }));
  const n = await jevPickCreatureFeats({ concept: concept({ feats: ["a", { name: "b" }] }), candidates: feats, jevConfig, request: allNone.request });
  assert.deepEqual([n.feats, n.omitted], [[], true]);

  // All dropped but some doubt -> chat model decides.
  const doubt = scripted(response({ entry0: choice(JEV_NONE_KEY), entry1: choice("F0", 0.2) }));
  const d = await jevPickCreatureFeats({ concept: concept({ feats: ["a", "b"] }), candidates: feats, jevConfig, request: doubt.request });
  assert.equal(d.feats, null);

  // Transport failure, no config, >255 candidates -> null.
  assert.equal((await jevPickCreatureFeats({ concept: concept({ feats: ["a"] }), candidates: feats, jevConfig, request: scripted(null).request })).feats, null);
  assert.equal((await jevPickCreatureFeats({ concept: concept({ feats: ["a"] }), candidates: feats, jevConfig: null })).feats, null);
  const many = Array.from({ length: 255 }, (_, i) => ({ id: `F${i}`, name: `Feat ${i}`, ref: ref(`f${i}`) }));
  const big = scripted();
  assert.equal((await jevPickCreatureFeats({ concept: concept({ feats: ["a"] }), candidates: many, jevConfig, request: big.request })).feats, null);
  assert.equal(big.calls.length, 0, "255 ids + none exceeds the choice cap, so no request");
}

// Creature abilities: glossary name preferred; none drops to narrative-only (caller keeps it).
{
  const acts = [{ id: "A0", name: "Grab", ref: ref("grab") }, { id: "A1", name: "Knockdown", ref: ref("kd") }];
  const specialAbilities = [{ name: "Tendrils", glossary: "Grab" }, { name: "Slam it" }, { name: "Flavor" }];
  const { request, calls } = scripted(response({ entry0: choice("A0"), entry1: choice("A1"), entry2: choice(JEV_NONE_KEY) }));
  const out = await jevPickCreatureAbilities({ concept: concept({ specialAbilities }), candidates: acts, jevConfig, request });
  assert.deepEqual(out.abilities.map((a) => a.name), ["Grab", "Knockdown"]);
  assert.match(calls[0].questions.entry0.instructions, /"Grab"/);
  assert.equal(out.abilities[0].candidate, acts[0].ref);
  const low = scripted(response({ entry0: choice("A0", 0.1), entry1: choice(JEV_NONE_KEY), entry2: choice(JEV_NONE_KEY) }));
  assert.deepEqual((await jevPickCreatureAbilities({ concept: concept({ specialAbilities }), candidates: acts, jevConfig, request: low.request })).abilities, []);
  assert.equal((await jevPickCreatureAbilities({ concept: concept({ specialAbilities }), candidates: acts, jevConfig, request: scripted(null).request })).abilities, null);
}

// PC feat slots: one Choice per slot over that slot's own ids; cross-slot dedupe by probability.
{
  const { encodeFeatCandidateSlots, resolveEncodedFeatPicks } = await import("./ai-candidate-format.mjs");
  const cand = (name) => ({ name, id: name, ref: ref(name) });
  const same = [cand("Alpha"), cand("Beta"), cand("Gamma")];
  const encoded = encodeFeatCandidateSlots([
    { type: "class", level: 1, candidates: same },
    { type: "class", level: 2, candidates: same },
    { type: "skill", level: 2, candidates: [cand("Delta")] },
    { type: "general", level: 3, candidates: [] }
  ]);
  const id = (name) => encoded.catalog.find((c) => c.name === name).id;
  const probs = (top, second) => ({ type: "choice", choice: top, confidence: 0.9, probabilities: { [top]: 0.9, [second]: 0.8 } });
  // Slots 1 and 2 both rank Alpha first: slot 2 takes its runner-up if that clears the confidence bar.
  let run = scripted(response({
    slot1: probs(id("Alpha"), id("Beta")), slot2: probs(id("Alpha"), id("Beta")), slot3: choice(id("Delta"))
  }));
  let out = await jevPickFeats({ concept: concept({ class: "Soldier" }), encoded, jevConfig, request: run.request });
  assert.deepEqual(out.picks, [{ slot: 1, id: id("Alpha") }, { slot: 2, id: id("Beta") }, { slot: 3, id: id("Delta") }]);
  assert.deepEqual(Object.keys(run.calls[0].questions), ["slot1", "slot2", "slot3"], "empty slot gets no question");
  assert.deepEqual(Object.keys(run.calls[0].questions.slot3.criteria), [id("Delta")]);
  assert.equal(resolveEncodedFeatPicks(encoded, out.picks).length, 3);
  // Runner-up below the confidence bar -> whole call goes to the chat model.
  run = scripted(response({
    slot1: choice(id("Alpha")), slot2: { type: "choice", choice: id("Alpha"), confidence: 0.9, probabilities: { [id("Alpha")]: 0.9, [id("Beta")]: 0.3 } }, slot3: choice(id("Delta"))
  }));
  out = await jevPickFeats({ concept: concept(), encoded, jevConfig, request: run.request });
  assert.equal(out.picks, null);
  assert.equal(out.attempted, true);
  // Top pick below the bar, transport failure, no config -> null.
  run = scripted(response({ slot1: choice(id("Alpha"), 0.4), slot2: choice(id("Beta")), slot3: choice(id("Delta")) }));
  assert.equal((await jevPickFeats({ concept: concept(), encoded, jevConfig, request: run.request })).picks, null);
  assert.equal((await jevPickFeats({ concept: concept(), encoded, jevConfig, request: scripted(null).request })).picks, null);
  assert.equal((await jevPickFeats({ concept: concept(), encoded, jevConfig: null })).picks, null);
  // A slot over the 255 cap -> no request at all.
  const wide = encodeFeatCandidateSlots([{ type: "class", level: 1, candidates: Array.from({ length: 256 }, (_, i) => cand(`F${i}`)) }]);
  run = scripted();
  assert.equal((await jevPickFeats({ concept: concept(), encoded: wide, jevConfig, request: run.request })).picks, null);
  assert.equal(run.calls.length, 0);
  // Big requests split into batches under the token budget; every slot is answered across them.
  const bigSlots = Array.from({ length: 12 }, (_, n) => ({
    type: "class", level: n + 1,
    candidates: Array.from({ length: 200 }, (_, i) => cand(`Long feat name number ${n}-${i} with extra words`))
  }));
  const bigEncoded = encodeFeatCandidateSlots(bigSlots);
  run = scripted();
  out = await jevPickFeats({ concept: concept(), encoded: bigEncoded, jevConfig, request: async (args) => {
    run.calls.push(args);
    return response(Object.fromEntries(Object.entries(args.questions).map(([key, q]) => [key, choice(Object.keys(q.criteria)[0])])));
  } });
  assert.equal(out.picks.length, 12);
  assert.ok(run.calls.length >= 2, "split across requests");
}

// Character choices: one Choice per group; any miss -> null for the whole batch.
{
  const catalog = [
    { id: "c1", item: "Fighter", prompt: "Choose a skill", options: [{ id: "ath", label: "Athletics" }, { id: "acr", label: "Acrobatics" }] },
    { id: "c2", item: "Soldier", prompt: "Choose a weapon", options: [{ id: "g", label: "Gun" }] }
  ];
  let run = scripted(response({ group0: choice("ath"), group1: choice("g") }));
  let out = await jevPickCharacterChoices({ concept: concept(), catalog, jevConfig, request: run.request });
  assert.deepEqual(out.picks, [{ choice: "c1", option: "ath" }, { choice: "c2", option: "g" }]);
  assert.deepEqual(run.calls[0].questions.group0.criteria, { ath: "Athletics", acr: "Acrobatics" });
  run = scripted(response({ group0: choice("ath"), group1: choice("g", 0.3) }));
  assert.equal((await jevPickCharacterChoices({ concept: concept(), catalog, jevConfig, request: run.request })).picks, null);
  assert.equal((await jevPickCharacterChoices({ concept: concept(), catalog, jevConfig, request: scripted(null).request })).picks, null);
  assert.equal((await jevPickCharacterChoices({ concept: concept(), catalog: [{ ...catalog[0], options: [] }], jevConfig, request: scripted().request })).picks, null);
  assert.equal((await jevPickCharacterChoices({ concept: concept(), catalog, jevConfig: null })).picks, null);
}
console.log("jev-picks tests passed");
