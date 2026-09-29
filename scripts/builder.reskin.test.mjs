// Test reskinActor preserving statistics while applying new narrative
// Run: node scripts/builder.reskin.test.mjs

import assert from "node:assert/strict";
import { reskinActor } from "./builder.mjs";

let createdData = null;
globalThis.Actor = {
  create: async (data) => {
    createdData = data;
    return { id: "created-reskinned-actor", ...data };
  }
};
globalThis.foundry = { utils: { escapeHTML: (s) => String(s ?? "") } };

const mockBaseDoc = {
  name: "Necrovite",
  toObject: () => ({
    _id: "base-necrovite-id",
    name: "Necrovite",
    type: "npc",
    system: {
      details: { level: { value: 13 }, blurb: "Original blurb", publicNotes: "Original notes" },
      attributes: { ac: { value: 34 }, hp: { value: 215, max: 215 } },
      traits: { value: ["undead"], rarity: "rare" }
    },
    items: [{ name: "Disintegration Beam", type: "melee" }]
  })
};

const newFlavor = {
  name: "Drift Lich Sovereign",
  blurb: "A digital consciousness commanding a phantom armada.",
  description: "Floating within an aura of glowing violet datastreams...",
  readAloud: "The hologram flickers, revealing a desiccated cybernetic visage.",
  recallKnowledge: "They were an engineer from the First Drift Beacon expedition."
};

const result = await reskinActor(mockBaseDoc, newFlavor);

assert.ok(result, "Reskinned actor created");
assert.equal(createdData.name, "Drift Lich Sovereign", "Name updated");
assert.equal(createdData._id, undefined, "_id cleared for new document creation");
assert.equal(createdData.system.attributes.ac.value, 34, "Mathematical AC preserved");
assert.equal(createdData.system.attributes.hp.value, 215, "Mathematical HP preserved");
assert.equal(createdData.system.details.level.value, 13, "Level preserved");
assert.equal(createdData.system.details.blurb, "A digital consciousness commanding a phantom armada.");
assert.ok(createdData.system.details.publicNotes.includes("Floating within an aura"));
assert.ok(createdData.system.details.publicNotes.includes("Drift-read-aloud") || createdData.system.details.publicNotes.includes("spf-read-aloud"));
assert.ok(createdData.system.details.publicNotes.includes("Recall Knowledge"));
assert.equal(createdData.items.length, 1, "Native items preserved");

console.log("builder.reskin.test.mjs: reskinActor preserves 100% of base stats and embeds new flavor");
