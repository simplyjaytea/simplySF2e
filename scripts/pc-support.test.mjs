import assert from "node:assert/strict";
import {
  COMPLETE_PC_CLASS_SLUGS, freeArchetypeNeedsPrerequisiteValidation,
  isCompletePCClass, supportedClassCandidates
} from "./pc-support.mjs";

assert.deepEqual([...COMPLETE_PC_CLASS_SLUGS].sort(),
  ["envoy", "mystic", "operative", "solarian", "soldier", "witchwarper"],
  "complete-only is exactly the six published SF2e classes");
const candidates = ["Soldier", "Envoy", "Operative", "Fighter", "Rogue", "Investigator", "Witchwarper", "Mystic", "Solarian"].map((name) => ({ name }));
assert.deepEqual(supportedClassCandidates(candidates).map((c) => c.name),
  ["Soldier", "Envoy", "Operative", "Witchwarper", "Mystic", "Solarian"],
  "complete-only selection keeps SF2e classes in offered order and drops PF2e classes");
assert.equal(isCompletePCClass("Soldier"), true);
assert.equal(isCompletePCClass("Envoy"), true);
assert.equal(isCompletePCClass("Mystic"), true);
assert.equal(isCompletePCClass("Solarian"), true);
assert.equal(isCompletePCClass("Witchwarper"), true);
assert.equal(isCompletePCClass({ name: "Operative" }), true,
  "Operative specializations are staged closed by stageClassPaths");
assert.equal(isCompletePCClass("Fighter"), false);
assert.equal(isCompletePCClass("Rogue"), false);
assert.equal(isCompletePCClass("Investigator"), false);
assert.equal(freeArchetypeNeedsPrerequisiteValidation(1, true), false,
  "Free Archetype has no feat slot at level 1");
assert.equal(freeArchetypeNeedsPrerequisiteValidation(2, true), false,
  "level 2 archetype slots now carry staged validation instead of a pre-provider stop");
assert.equal(freeArchetypeNeedsPrerequisiteValidation(1.5, true), false,
  "the gate stays open while rounding still applies upstream");
assert.equal(freeArchetypeNeedsPrerequisiteValidation(1.49, true), false,
  "a value that normalizes to level 1 remains unaffected");
assert.equal(freeArchetypeNeedsPrerequisiteValidation(20, true), false,
  "higher-level archetype slots validate the same staged way");
assert.equal(freeArchetypeNeedsPrerequisiteValidation(20, false), false,
  "ordinary complete PC requests remain available");
console.log("pc-support.test.mjs: complete-only class registry passed");
