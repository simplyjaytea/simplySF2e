// The creature draft reaches the caller through onDraft right after the AI draft,
// before any grounding step, so a refine-time render already shows it.
// Run: node scripts/creature-pipeline.draft.test.mjs
import assert from "node:assert/strict";
import { generateCreature } from "./creature-pipeline.mjs";

const events = [];
const rawDraft = { name: "Test Bandit", level: 2, specialAbilities: [], feats: [], equipment: [], strikes: [], loot: [] };
// Every AI selector must stay unused: an empty draft has nothing to ground.
const unexpected = (name) => async () => { throw new Error(`unexpected AI call: ${name}`); };
const ai = {
  generateConcept: async () => ({ concept: rawDraft, usage: null }),
  designEncounter: unexpected("designEncounter"), chooseSpellFocus: unexpected("chooseSpellFocus"),
  selectSpells: unexpected("selectSpells"), selectCreatureAbilities: unexpected("selectCreatureAbilities"),
  selectCreatureFeats: unexpected("selectCreatureFeats"), selectEquipment: unexpected("selectEquipment"),
  selectLoot: unexpected("selectLoot")
};

let drafted = null;
await assert.rejects(generateCreature({
  mode: "npc", prompt: "a bandit", level: 2, rarity: "common", allowSpellcasting: false, treasureAmount: "standard",
  ai,
  onDraft: (concept) => { drafted = concept; events.push("draft"); },
  onStep: (id, state) => {
    events.push(`step:${id}`);
    if (id === "concept") assert.equal(drafted, null, "the draft is not shown before the AI returns it");
    if (id === "match") {
      assert.ok(drafted, "the draft was handed over before the grounding steps");
      assert.equal(state.concept, drafted, "the step carries the same live concept object");
      throw new Error("stop after grounding");
    }
  }
}), /stop after grounding/);

assert.deepEqual(events, ["step:concept", "draft", "step:match"], "onDraft fires between the concept step and the first grounding step");
assert.equal(drafted.name, "Test Bandit");
assert.equal(drafted.gmPrompt, "a bandit", "the handed-over draft carries the GM prompt");

console.log("creature-pipeline.draft.test.mjs: draft handed over before grounding passed");
