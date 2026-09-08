import assert from "node:assert/strict";
import {
  COMPLETE_PC_CLASS_SLUGS, freeArchetypeNeedsPrerequisiteValidation,
  isCompletePCClass, supportedClassCandidates
} from "./pc-support.mjs";

assert.equal(COMPLETE_PC_CLASS_SLUGS.size, 0, "no SF2e class is proven complete-only yet");
const candidates = ["Soldier", "Envoy", "Fighter", "Rogue", "Investigator", "Witchwarper"].map((name) => ({ name }));
assert.deepEqual(supportedClassCandidates(candidates), [],
  "complete-only selection must stay empty until an SF2e staging path is cited");
assert.equal(isCompletePCClass("Soldier"), false);
assert.equal(isCompletePCClass("Envoy"), false);
assert.equal(isCompletePCClass("Fighter"), false);
assert.equal(isCompletePCClass("Rogue"), false);
assert.equal(isCompletePCClass("Investigator"), false);
assert.equal(freeArchetypeNeedsPrerequisiteValidation(1, true), false,
  "Free Archetype has no feat slot at level 1");
assert.equal(freeArchetypeNeedsPrerequisiteValidation(2, true), true,
  "level 2 Free Archetype requires unimplemented prerequisite validation");
assert.equal(freeArchetypeNeedsPrerequisiteValidation(1.5, true), true,
  "the gate uses the same rounded PC level as concept normalization");
assert.equal(freeArchetypeNeedsPrerequisiteValidation(1.49, true), false,
  "a value that normalizes to level 1 remains unaffected");
assert.equal(freeArchetypeNeedsPrerequisiteValidation(20, true), true,
  "higher-level Free Archetype remains blocked until its graph is validated");
assert.equal(freeArchetypeNeedsPrerequisiteValidation(20, false), false,
  "ordinary complete PC requests remain available");
console.log("pc-support.test.mjs: complete-only class registry passed");
