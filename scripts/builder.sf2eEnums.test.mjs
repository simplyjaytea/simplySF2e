// NPC languages, senses, and IWR types follow v14-dev sf2e lists
// (src/module/actor/creature/values.ts LANGUAGES_BY_RARITY.sf2e and
// SENSE_TYPES; src/scripts/config/iwr.ts). PF2e-only languages are dropped.
// Run: node scripts/builder.sf2eEnums.test.mjs

import assert from "node:assert/strict";

globalThis.CONFIG = { PF2E: { damageTypes: {}, npcAttackTraits: {}, attackEffects: {} } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 20 } };
globalThis.foundry = { utils: { randomID: () => "test-id" } };

const { normalizeConcept } = await import("./builder.mjs");

const warnings = [];
const realWarn = console.warn;
console.warn = (...args) => warnings.push(args.join(" "));
let concept;
try {
  concept = normalizeConcept({
    name: "Void Courier",
    languages: ["Pact Common", "Vesk", "Shirren", "Taldane", "Sakvroth"],
    senses: [{ type: "electromagnetic sense" }, { type: "bloodsense" }, { type: "darkvision" }],
    immunities: ["time", "aging", "prediction"],
    weaknesses: [{ type: "peachwood" }],
    resistances: [{ type: "time" }]
  }, { level: 5, rarity: "common" });
} finally {
  console.warn = realWarn;
}

assert.deepEqual(concept.languages, ["pact-common", "vesk", "shirren"], "sf2e languages kept, PF2e-only ones dropped");
assert.ok(warnings.some((w) => w.includes("taldane") && w.includes("sakvroth")), "dropped languages are warned");
assert.deepEqual(concept.senses.map((s) => s.type), ["electromagnetic-sense", "bloodsense", "darkvision"]);

assert.deepEqual(concept.immunities, ["time", "aging", "prediction"], "iwr.ts immunity keys are accepted");
assert.deepEqual(concept.weaknesses, ["peachwood"], "peachwood is an iwr.ts material");
assert.deepEqual(concept.resistances, ["time"]);

console.log("builder.sf2eEnums.test.mjs: sf2e languages, senses and IWR types verified");
