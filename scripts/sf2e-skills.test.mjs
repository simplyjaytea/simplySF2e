import assert from "node:assert/strict";
import { SKILL_ATTRIBUTES, CORE_SKILLS, normalizeSkillPriorities, skillPriorityOrder } from "./pc-skills.mjs";
import { normalizeConcept, enrichDescription } from "./builder.mjs";
import { ITEM_BONUS_STATISTICS } from "./rule-templates.mjs";

// pf2e v14-dev src/scripts/config/index.ts, SYSTEM_ID === "sf2e":
//   computers: { label: "PF2E.Skill.Computers", attribute: "int" },
//   piloting: { label: "PF2E.Skill.Piloting", attribute: "dex" },
assert.equal(SKILL_ATTRIBUTES.computers, "int");
assert.equal(SKILL_ATTRIBUTES.piloting, "dex");
assert.equal(CORE_SKILLS.length, 18, "16 core skills plus the two sf2e skills");

assert.deepEqual(normalizeSkillPriorities(["piloting", "computers", "warp"]), ["piloting", "computers"],
  "PC skill priorities keep the sf2e skills");
assert.ok(skillPriorityOrder([], "int").order.includes("computers"), "Int defaults can train Computers");

const concept = normalizeConcept({ skills: [
  { name: "Computers", scale: "high" },
  { name: "Piloting", scale: "moderate" }
] }, { level: 3, rarity: "common" });
assert.deepEqual(concept.skills.map((skill) => skill.name), ["Computers", "Piloting"],
  "NPC skills keep the sf2e skills");

const enriched = enrichDescription("Attempt a high DC Computers check, then a DC 20 Piloting check.", 3);
assert.match(enriched, /@Check\[type:computers\|dc:\d+\] check/);
assert.match(enriched, /@Check\[type:piloting\|dc:20\] check/);

assert.ok(ITEM_BONUS_STATISTICS.has("computers") && ITEM_BONUS_STATISTICS.has("piloting"));
console.log("sf2e-skills.test.mjs: Computers and Piloting are first-class skills");
