import assert from "node:assert/strict";
import {
  COMPLETE_PC_CLASS_SLUGS, freeArchetypeNeedsPrerequisiteValidation,
  isCompletePCClass, supportedClassCandidates
} from "./pc-support.mjs";

assert.deepEqual([...COMPLETE_PC_CLASS_SLUGS].sort(),
  ["envoy", "mystic", "solarian", "soldier", "witchwarper"],
  "complete-only includes cited SF2e item:tag path classes, not Operative");
const candidates = ["Soldier", "Envoy", "Operative", "Fighter", "Rogue", "Investigator", "Witchwarper", "Mystic", "Solarian"].map((name) => ({ name }));
assert.deepEqual(supportedClassCandidates(candidates).map((c) => c.name),
  ["Soldier", "Envoy", "Witchwarper", "Mystic", "Solarian"],
  "complete-only selection is the five cited SF2e classes");
assert.equal(isCompletePCClass("Soldier"), true);
assert.equal(isCompletePCClass("Envoy"), true);
assert.equal(isCompletePCClass("Mystic"), true);
assert.equal(isCompletePCClass("Solarian"), true);
assert.equal(isCompletePCClass("Witchwarper"), true);
assert.equal(isCompletePCClass("Operative"), false,
  "Operative specializations are not closed under stageClassPaths");
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
