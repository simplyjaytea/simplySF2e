// NPC core skills are source data at system.skills.<slug>.base; only Lore
// skills are lore items. pf2e v14-dev item/lore.ts sluggifyLoreName appends
// "-lore" to any other lore item name, and npc/document.ts marks a skill
// proficient only when `slug in this._source.system.skills`.
// Run: node scripts/builder.npcSkills.test.mjs

import assert from "node:assert/strict";

globalThis.CONFIG = { PF2E: { damageTypes: {}, npcAttackTraits: {}, attackEffects: {} } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 20 } };
globalThis.foundry = { utils: { randomID: () => "test-id" } };
let created = null;
globalThis.Actor = { create: async (data) => (created = data) };

const { normalizeConcept, computeStats, createActor } = await import("./builder.mjs");

const concept = normalizeConcept({ name: "Deck Ace", skills: [
  { name: "Piloting", scale: "extreme" },
  { name: "Computers", scale: "high" },
  { name: "stealth", scale: "moderate" },
  { name: "Starship Lore", scale: "low" }
] }, { level: 4, rarity: "common" });
const stats = computeStats(concept);
const mod = (name) => stats.skills.find((skill) => skill.name.toLowerCase() === name).mod;

await createActor(concept, { abilities: [], feats: [], spells: [], focusSpells: [], equipment: [], loot: [] });
assert.deepEqual(created.system.skills, {
  piloting: { base: mod("piloting") },
  computers: { base: mod("computers") },
  stealth: { base: mod("stealth") }
}, "core skills land on the native NPC skill data");
const lores = created.items.filter((item) => item.type === "lore");
assert.deepEqual(lores.map((item) => item.name), ["Starship Lore"], "only Lore skills become lore items");
assert.equal(lores[0].system.mod.value, mod("starship lore"));
console.log("builder.npcSkills.test.mjs: NPC core skills are native, Lore skills are items");
