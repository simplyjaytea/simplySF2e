// Test Elite and Weak creature adjustments (Alien Core pp. 204/207)
// Run: node scripts/builder.adjustment.test.mjs

import assert from "node:assert/strict";
import { normalizeConcept, computeStats, adjustedStats, adjustedLevel, hpAdjustment, createActor } from "./builder.mjs";

const raw = {
  name: "Drift Zombie",
  level: 4,
  rarity: "common",
  abilityScales: { str: "high", dex: "moderate", con: "high", int: "low", wis: "moderate", cha: "low" },
  acScale: "moderate",
  hpScale: "high",
  perceptionScale: "moderate",
  saveScales: { fortitude: "high", reflex: "moderate", will: "low" },
  speeds: [{ type: "land", value: 25 }],
  strikes: [{ name: "Claw", type: "melee", attackScale: "high", damageScale: "high", damageType: "slashing", traits: [] }],
  specialAbilities: [],
  feats: [],
  equipment: [],
  loot: [],
  traits: ["undead"],
  languages: [],
  senses: [],
  resistances: [],
  weaknesses: [],
  immunities: []
};

// pf2e v14-dev npc/document.ts applies Elite/Weak itself on every prep
// (level shift, `getNewValue: (base: number) => base + 2` on every base
// modifier, getHpAdjustment on HP), so the stored numbers must stay at the
// base level or the adjustment counts twice.
const normalConcept = normalizeConcept(raw, { level: 4, rarity: "common" });
const normalStats = computeStats(normalConcept);
const eliteConcept = { ...normalConcept, adjustment: "elite" };
const weakConcept = { ...normalConcept, adjustment: "weak" };
assert.deepEqual(computeStats(eliteConcept), normalStats, "stored Elite stats stay at the base level");
assert.deepEqual(computeStats(weakConcept), normalStats, "stored Weak stats stay at the base level");

// Preview mirrors what the sheet shows.
const elite = adjustedStats(normalStats, eliteConcept);
assert.equal(elite.level, 5);
assert.equal(elite.ac, normalStats.ac + 2);
assert.equal(elite.perception, normalStats.perception + 2);
assert.equal(elite.saves.fortitude, normalStats.saves.fortitude + 2);
assert.equal(elite.strikes[0].bonus, normalStats.strikes[0].bonus + 2);
assert.equal(elite.hp, normalStats.hp + 15, "elite HP +15 at base level 2~4");
const weak = adjustedStats(normalStats, weakConcept);
assert.equal(weak.level, 3);
assert.equal(weak.ac, normalStats.ac - 2);
assert.equal(weak.hp, normalStats.hp - 15, "weak HP -15 at base level 3~5");
assert.deepEqual(adjustedStats(normalStats, normalConcept), { ...normalStats, level: 4 });

// Damage formula shifts its flat bonus.
const [, flat] = /([+-]\d+)$/.exec(normalStats.strikes[0].damage);
assert.ok(elite.strikes[0].damage.endsWith(`+${Number(flat) + 2}`), elite.strikes[0].damage);

// Level edge cases from npc/document.ts.
assert.equal(adjustedLevel(-1, "elite"), 1);
assert.equal(adjustedLevel(0, "elite"), 2);
assert.equal(adjustedLevel(1, "weak"), -1);
assert.equal(adjustedLevel(2, "weak"), 1);
// getHpAdjustment boundaries.
assert.deepEqual([1, 2, 4, 5, 19, 20].map((l) => hpAdjustment(l, "elite")), [10, 15, 15, 20, 20, 30]);
assert.deepEqual([1, 2, 3, 5, 6, 20, 21].map((l) => hpAdjustment(l, "weak")), [-10, -10, -15, -15, -20, -20, -30]);

// The created actor stores base numbers, the adjustment flag, and full HP.
globalThis.CONFIG = { PF2E: { damageTypes: { slashing: "" }, npcAttackTraits: {}, attackEffects: {} } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 20 } };
globalThis.foundry = { utils: { randomID: () => "id" } };
let created = null;
globalThis.Actor = { create: async (data) => (created = data) };
await createActor(eliteConcept, { abilities: [], feats: [], spells: [], focusSpells: [], equipment: [], loot: [] });
assert.equal(created.system.details.level.value, 4);
assert.equal(created.system.attributes.adjustment, "elite");
assert.equal(created.system.attributes.ac.value, normalStats.ac);
assert.equal(created.system.attributes.hp.max, normalStats.hp, "pf2e adds the Elite HP modifier to max on prep");
assert.equal(created.system.attributes.hp.value, normalStats.hp + 15, "the creature starts at full adjusted HP");

console.log("builder.adjustment.test.mjs: Elite/Weak applied once, by the system");
