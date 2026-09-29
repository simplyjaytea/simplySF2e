// Test Elite and Weak creature adjustments (Alien Core pp. 204/207)
// Run: node scripts/builder.adjustment.test.mjs

import assert from "node:assert/strict";
import { normalizeConcept, computeStats } from "./builder.mjs";

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

// 1. Normal stats at level 4
const normalConcept = normalizeConcept(raw, { level: 4, rarity: "common" });
const normalStats = computeStats(normalConcept);

// 2. Elite adjustment (+1 level equivalent)
const eliteConcept = { ...normalConcept, adjustment: "elite" };
const eliteStats = computeStats(eliteConcept);

assert.ok(eliteStats.ac > normalStats.ac, "Elite AC increases");
assert.ok(eliteStats.hp > normalStats.hp, "Elite HP increases");
assert.ok(eliteStats.perception > normalStats.perception, "Elite Perception increases");
assert.ok(eliteStats.saves.fortitude > normalStats.saves.fortitude, "Elite saves increase");
assert.ok(eliteStats.strikes[0].bonus > normalStats.strikes[0].bonus, "Elite strike bonus increases");

// 3. Weak adjustment (-1 level equivalent)
const weakConcept = { ...normalConcept, adjustment: "weak" };
const weakStats = computeStats(weakConcept);

assert.ok(weakStats.ac < normalStats.ac, "Weak AC decreases");
assert.ok(weakStats.hp < normalStats.hp, "Weak HP decreases");
assert.ok(weakStats.perception < normalStats.perception, "Weak Perception decreases");
assert.ok(weakStats.saves.fortitude < normalStats.saves.fortitude, "Weak saves decrease");
assert.ok(weakStats.strikes[0].bonus < normalStats.strikes[0].bonus, "Weak strike bonus decreases");

console.log("builder.adjustment.test.mjs: Alien Core Elite and Weak adjustments verified");
