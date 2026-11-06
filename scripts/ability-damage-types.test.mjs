// One source of truth for ability damage types. The creature system prompt's
// specialAbilities.damageType enum is built from ability-fill.mjs (glossary)
// and ability-templates.mjs (area-blast); this test captures the real prompt
// and fails if the enum or its note drift from the validators.
// Run: node scripts/ability-damage-types.test.mjs
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";
import { ABILITY_DAMAGE_TYPES } from "./ability-fill.mjs";
import { AREA_BLAST_DAMAGE_TYPES } from "./ability-templates.mjs";

const settings = new Map([
  [SETTINGS.apiBaseUrl, "http://localhost:11434/v1"], [SETTINGS.apiKey, ""],
  [SETTINGS.apiKeyBaseUrl, ""], [SETTINGS.model, "test-model"],
  [SETTINGS.temperature, 0.8], [SETTINGS.maxTokens, 8000], [SETTINGS.requestTimeout, 90]
]);
globalThis.game = { settings: { get: (_module, key) => settings.get(key) },
  i18n: { localize: (key) => key, format: (key, data) => `${key}:${JSON.stringify(data)}` } };
const requests = [];
let reply;
globalThis.fetch = async (_url, options) => {
  requests.push(JSON.parse(options.body));
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) }, finish_reason: "stop" }] }),
    { headers: { "content-type": "application/json" } });
};
const { generateConcept, ABILITY_DAMAGE_TYPE_SCHEMA, ABILITY_DAMAGE_TYPE_NOTE } = await import("./ai.mjs");

reply = { name: "Courier", description: "A courier", abilityScales: {}, saveScales: {},
  blurb: "", readAloud: "", recallKnowledge: "", size: "med", acScale: "moderate", hpScale: "moderate", perceptionScale: "moderate",
  spellcasting: null, ...Object.fromEntries(["traits", "languages", "speeds", "senses", "skills", "strikes", "specialAbilities",
    "focusSpells", "feats", "equipment", "loot", "resistances", "weaknesses", "immunities"].map((key) => [key, []])) };
await generateConcept({ prompt: "A courier.", level: 4, rarity: "common", allowSpellcasting: false, preset: null });
const system = requests.at(-1).messages[0].content;

// The prompt line for specialAbilities.damageType, and the enum tokens before its comment.
const match = system.match(/"abilityDcScale": [^\n]*\n\s*"damageType": ([^\n]*)/);
assert.ok(match, "the specialAbilities damageType line is in the captured prompt");
const promptEnum = match[1].split("//")[0].trim().replace(/,$/, "");
const tokens = [...promptEnum.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((t) => t !== "null");

// Exactly the union of the validators, no more, no less, no duplicates.
const union = [...new Set([...ABILITY_DAMAGE_TYPES, ...AREA_BLAST_DAMAGE_TYPES])];
assert.deepEqual([...tokens].sort(), [...union].sort(), "prompt enum equals the validators' union");
assert.equal(new Set(tokens).size, tokens.length, "no duplicate enum entries");
assert.ok(promptEnum.endsWith("|null"), "null is allowed");
assert.ok(system.includes(ABILITY_DAMAGE_TYPE_SCHEMA), "the prompt carries the exported schema text");
assert.ok(system.includes(ABILITY_DAMAGE_TYPE_NOTE), "the prompt carries the exported note");

// The note says which types apply to which kind of ability.
for (const type of ABILITY_DAMAGE_TYPES) assert.ok(ABILITY_DAMAGE_TYPE_NOTE.includes(type), `glossary type ${type} is named`);
for (const type of ["spirit", "mental", "force", "void"]) {
  assert.ok(!ABILITY_DAMAGE_TYPES.includes(type), `${type} is not a glossary type`);
  assert.ok(ABILITY_DAMAGE_TYPE_NOTE.includes(`${type}`) && ABILITY_DAMAGE_TYPE_NOTE.includes("area-blast only"), `${type} is named as area-blast only`);
}

// Drift guard: a validator list edit must reach the prompt. Checked by recomputing the
// expected enum from the validators and comparing it with the captured prompt.
const expected = `${union.map((type) => `"${type}"`).join("|")}|null`;
assert.equal(promptEnum, expected, "prompt enum is recomputed from the validators");

console.log("ability-damage-types.test.mjs: ok");
