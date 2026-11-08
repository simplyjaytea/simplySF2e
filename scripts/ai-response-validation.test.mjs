import assert from "node:assert/strict";
import { AI_TASK } from "./ai-task-profiles.mjs";
import { taskResponseProblem } from "./ai-response-validation.mjs";

assert.equal(taskResponseProblem(AI_TASK.LOOT_DRAFT, { loot: [] }), null);
assert.match(
  taskResponseProblem(AI_TASK.LOOT_DRAFT, {}),
  /missing required fields: loot/,
  "valid JSON missing its operation payload must fail"
);
assert.match(
  taskResponseProblem(AI_TASK.CREATURE_CONCEPT, { name: "Incomplete" }),
  /missing required fields/,
  "valid but partial creature JSON must not reach normalization"
);
assert.match(
  taskResponseProblem(AI_TASK.SPELL_SELECTION, { spells: {} }),
  /fields must be arrays: spells/
);
assert.equal(
  taskResponseProblem(AI_TASK.ABC_SELECTION, {
    ancestry: "Dwarf", heritage: null, background: "Guard", class: "Fighter", keyAbility: "str"
  }),
  null
);
// ABC: the prompt asks for ids; names are accepted too. Each slot needs one non-empty id or name.
assert.equal(taskResponseProblem(AI_TASK.ABC_SELECTION, {
  ancestryId: "C1", heritageId: null, backgroundId: "C3", classId: "C4", keyAbility: "dex"
}), null, "an id-only reply is valid");
assert.equal(taskResponseProblem(AI_TASK.ABC_SELECTION, {
  ancestryId: "C1", background: "Guard", classId: "C4", keyAbility: "dex"
}), null, "ids and names may be mixed per slot");
assert.match(taskResponseProblem(AI_TASK.ABC_SELECTION, {
  ancestryId: "C1", backgroundId: "C3", keyAbility: "dex"
}), /fields must be non-empty strings: classId or class/, "a slot with neither id nor name fails");
assert.match(taskResponseProblem(AI_TASK.ABC_SELECTION, {
  ancestryId: "", ancestry: " ", backgroundId: "C3", classId: "C4", keyAbility: "dex"
}), /ancestryId or ancestry/, "blank ids and names do not count");
assert.match(taskResponseProblem(AI_TASK.ABC_SELECTION, {}), /missing required fields: keyAbility/);
assert.match(taskResponseProblem(AI_TASK.ABC_SELECTION, { ancestryId: "C1", backgroundId: "C3", classId: "C4" }), /missing required fields: keyAbility/);
assert.match(taskResponseProblem("unknown", {}), /unknown task/);
assert.equal(taskResponseProblem(AI_TASK.CHARACTER_CHOICES, { picks: [] }), null);
assert.match(taskResponseProblem(AI_TASK.CHARACTER_CHOICES, {}), /missing required fields: picks/);
assert.match(taskResponseProblem(AI_TASK.CHARACTER_CHOICES, { picks: {} }), /fields must be arrays: picks/);
assert.equal(taskResponseProblem(AI_TASK.ABILITY_SELECTION, { abilityIds: [] }), null);
assert.match(taskResponseProblem(AI_TASK.ABILITY_SELECTION, { picks: [] }), /missing required fields: abilityIds/);
assert.equal(taskResponseProblem(AI_TASK.CREATURE_FEAT_SELECTION, { featIds: [] }), null);
assert.match(taskResponseProblem(AI_TASK.CREATURE_FEAT_SELECTION, { picks: [] }), /missing required fields: featIds/);

console.log("ai-response-validation.test.mjs: all response-shape assertions passed");
