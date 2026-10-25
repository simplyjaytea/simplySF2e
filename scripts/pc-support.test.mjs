import assert from "node:assert/strict";
import {
  COMPLETE_PC_CLASS_SLUGS, DRONE_MANUAL_KEY, MECHANIC_DRONE_ID, SF2E_MULTICLASS_DEDICATIONS,
  TECHNOMANCER_INITIAL_HACKS, classManualNotes, freeArchetypeNeedsPrerequisiteValidation,
  getMulticlassDedicationSlug, isCompletePCClass, manualNotesContent, stagedPathSelectionId,
  supportedClassCandidates, technomancerInitialHack, withInitialFocusSpell
} from "./pc-support.mjs";

assert.deepEqual([...COMPLETE_PC_CLASS_SLUGS].sort(),
  ["envoy", "mechanic", "mystic", "operative", "solarian", "soldier", "technomancer", "witchwarper"],
  "complete-only is exactly the eight published SF2e classes");
const candidates = ["Soldier", "Envoy", "Operative", "Fighter", "Rogue", "Investigator", "Witchwarper", "Mystic", "Solarian", "Mechanic", "Technomancer"].map((name) => ({ name }));
assert.deepEqual(supportedClassCandidates(candidates).map((c) => c.name),
  ["Soldier", "Envoy", "Operative", "Witchwarper", "Mystic", "Solarian", "Mechanic", "Technomancer"],
  "complete-only selection keeps SF2e classes in offered order and drops PF2e classes");
assert.equal(isCompletePCClass("Soldier"), true);
assert.equal(isCompletePCClass("Envoy"), true);
assert.equal(isCompletePCClass("Mystic"), true);
assert.equal(isCompletePCClass("Solarian"), true);
assert.equal(isCompletePCClass("Witchwarper"), true);
assert.equal(isCompletePCClass({ name: "Operative" }), true,
  "Operative specializations are staged closed by stageClassPaths");
assert.equal(isCompletePCClass("Mechanic"), true);
assert.equal(isCompletePCClass({ name: "Technomancer" }), true);
assert.equal(getMulticlassDedicationSlug("Mechanic"), "mechanic-dedication");
assert.equal(getMulticlassDedicationSlug("technomancer"), "technomancer-dedication");
assert.equal(Object.keys(SF2E_MULTICLASS_DEDICATIONS).length, COMPLETE_PC_CLASS_SLUGS.size,
  "every complete class has a dedication");
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
// Technomancer: initial hack per Programming Language (sf2e-1.6.1 ids).
const warnings = [];
console.warn = (...args) => warnings.push(args.join(" "));
const stagedLanguage = (id) => [{ name: "Programming Language", system: { rules: [
  { key: "ChoiceSet", flag: "programmingLanguage", selection: `Compendium.sf2e.class-features.Item.${id}` },
  { key: "GrantItem", uuid: "{item|flags.system.rulesSelections.programmingLanguage}" }
] } }];
const expectedHacks = {
  msU9FRYDZwkYvLNH: ["DPS++", "5kzAMtSSpGDJTIWV"],
  "7yxVnWzTynBvFVjr": ["FORTRUN", "1Wp3rkKJQef7K8Tn"],
  KVc89RjerouF0wo1: ["Servoshell", "xNU0CX0Wt0MwOHes"],
  KWVSfZLZIW4zCW7K: ["Viper", "FfkyvwVrY3sx9NOQ"]
};
assert.deepEqual(Object.keys(TECHNOMANCER_INITIAL_HACKS).sort(), Object.keys(expectedHacks).sort());
for (const [languageId, [language, spellId]] of Object.entries(expectedHacks)) {
  const hack = technomancerInitialHack(stagedLanguage(languageId));
  assert.equal(hack.language, language);
  assert.equal(hack.spellId, spellId);
}
assert.equal(warnings.length, 0, "known languages do not warn");
assert.equal(technomancerInitialHack(stagedLanguage("UnknownLanguage1")), null);
assert.equal(warnings.length, 1, "an unknown language warns and adds no hack");
assert.equal(technomancerInitialHack(stagedLanguage("toString")), null, "prototype keys are not languages");
assert.equal(technomancerInitialHack([]), null);
assert.equal(technomancerInitialHack(null), null);
assert.equal(technomancerInitialHack([{ system: { rules: [{ key: "ChoiceSet", flag: "programmingLanguage", selection: "Compendium.sf2e.class-features.Item.Viper" }] } }]), null,
  "a name-based uuid is not a known language id");
assert.equal(warnings.length, 5, "every miss warns");

const hack = { name: "Amplify Vulnerability", entry: { packId: "sf2e.spells", _id: "FfkyvwVrY3sx9NOQ" } };
assert.deepEqual(withInitialFocusSpell([], hack), [hack]);
assert.deepEqual(withInitialFocusSpell([{ name: "Other Hack", entry: { packId: "sf2e.spells", _id: "x" } }], hack).map((s) => s.name),
  ["Amplify Vulnerability", "Other Hack"], "the language hack leads");
assert.deepEqual(withInitialFocusSpell([{ name: "amplify vulnerability", entry: null }, { name: "Z", entry: { _id: "FfkyvwVrY3sx9NOQ" } }], hack), [hack],
  "AI picks of the same hack dedupe by name or id");
assert.equal(withInitialFocusSpell(["a", "b", "c"].map((name) => ({ name, entry: { _id: name } })), hack).length, 3,
  "the focus list stays at the pool ceiling of 3");
const aiOnly = [{ name: "Z", entry: null }];
assert.equal(withInitialFocusSpell(aiOnly, null), aiOnly, "no hack leaves the list untouched");

// Mechanic Drone: GM-facing manual note; Mine and Turret stay silent.
const stagedExocortex = (id) => [{ name: "Exocortex", system: { rules: [
  { key: "ChoiceSet", flag: "exocortex", selection: `Compendium.sf2e.class-features.Item.${id}` }
] } }];
assert.equal(stagedPathSelectionId(stagedExocortex(MECHANIC_DRONE_ID), "exocortex"), "UCilslXlrd7ihsgY");
assert.deepEqual(classManualNotes(stagedExocortex("UCilslXlrd7ihsgY")), ["SIMPLYSF2E.PC.DroneManual"]);
assert.equal(DRONE_MANUAL_KEY, "SIMPLYSF2E.PC.DroneManual");
assert.deepEqual(classManualNotes(stagedExocortex("peXRQKUzkAGqduHP")), [], "Mine needs no note");
assert.deepEqual(classManualNotes(stagedExocortex("V7LMvEnxI7hN1n8Z")), [], "Turret needs no note");
assert.deepEqual(classManualNotes(stagedLanguage("msU9FRYDZwkYvLNH")), [], "other bridges need no note");
assert.deepEqual(classManualNotes([]), []);
const lang = JSON.parse((await import("node:fs")).readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));
assert.equal(lang.SIMPLYSF2E.PC.DroneManual,
  "Drone exocortex: set up the drone companion by hand; SimplySF2e does not create companion actors.");
const body = manualNotesContent("Ada <b>", ["SIMPLYSF2E.PC.DroneManual"], (key) => key === DRONE_MANUAL_KEY ? lang.SIMPLYSF2E.PC.DroneManual : key);
assert.ok(body.includes("Ada &lt;b&gt;") && body.includes("set up the drone companion by hand"), "whisper body is escaped and carries the note");
assert.equal(manualNotesContent("Ada", [], (k) => k), "");

console.log("pc-support.test.mjs: complete-only class registry passed");
