// Jev equipment/loot pick logic with an injected request function (no network).
import assert from "node:assert/strict";
import { jevPickEquipment, jevPickLoot, jevScoreIndex, mergeUsage, JEV_NONE_KEY } from "./jev-picks.mjs";

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
console.log("jev-picks tests passed");
