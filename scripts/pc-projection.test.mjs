import assert from "node:assert/strict";
import { ABILITY_KEYS, assignAbilityBoosts, assignItemBoosts, boostPriority, normalizeAbilityPriorities, projectAttributeModifiers, projectSkillRanks } from "./pc-projection.mjs";

const free = () => ({ value: [...ABILITY_KEYS] });
const ancestry = () => ({
  boosts: { fixed: { value: ["str"] }, free1: free(), free2: free() },
  flaws: { flaw: { value: ["cha"] } }
});
const background = () => ({ boosts: { choice: { value: ["int", "wis"] } } });
const project = (level, overrides = {}) => projectAttributeModifiers({
  ancestrySystem: ancestry(), backgroundSystem: background(), keyAbility: "int", preferences: [], level, ...overrides
});

assert.deepEqual(normalizeAbilityPriorities(["dex", "dex", "bad", "wis"]), ["dex", "wis"]);
assert.deepEqual(boostPriority("int", []), ["int", "str", "dex", "con", "wis", "cha"]);
assert.deepEqual(assignAbilityBoosts("int", [])[5], ["int", "str", "dex", "con"]);

// Ancestry: fixed str, free -> int, free -> dex, flaw cha. Background: choice -> int. Class: int.
// Level 1 tier: int, str, dex, con. Each boost adds 1 below +4, 0.5 at +4 or more; flaw subtracts 1.
assert.deepEqual(project(1), { str: 2, dex: 2, con: 1, int: 4, wis: 0, cha: -1 });
// Level 5 tier: int 4 -> 4.5, the half-boost rule; trunc gives 4.
assert.deepEqual(project(5), { str: 3, dex: 3, con: 2, int: 4, wis: 0, cha: -1 });
// Level 10 tier: int 4.5 -> 5.0 ("+4 then two boosts -> +5").
assert.deepEqual(project(10), { str: 4, dex: 4, con: 3, int: 5, wis: 0, cha: -1 });
assert.deepEqual(project(20), { str: 5, dex: 5, con: 4, int: 6, wis: 0, cha: -1 });
assert.deepEqual(project(4), project(1), "levels below 5 get no level-5 tier");

// Input is cloned: the caller's ABC systems are not mutated.
const input = { ancestrySystem: ancestry(), backgroundSystem: background(), keyAbility: "int", level: 5 };
projectAttributeModifiers(input);
assert.equal(input.ancestrySystem.boosts.free1.selected, undefined);
assert.equal(input.backgroundSystem.boosts.choice.selected, undefined);

// Malformed input proves nothing.
assert.equal(project(0), null);
assert.equal(project(21), null);
assert.equal(project(1.5), null);
assert.equal(project(1, { keyAbility: "luck" }), null);
assert.equal(project(1, { ancestrySystem: undefined }), null);
assert.equal(project(1, { backgroundSystem: "human" }), null);
assert.equal(project(1, { ancestrySystem: { flaws: {} } }), null);
assert.equal(project(1, { ancestrySystem: { boosts: { bad: { value: "str" } }, flaws: {} } }), null);
assert.equal(project(1, { ancestrySystem: { boosts: {}, flaws: { two: { value: ["str", "dex"] } } } }), null);
assert.equal(project(1, { backgroundSystem: { boosts: { bad: { value: ["luck"] } } } }), null);

// assignItemBoosts still fills an unset constrained choice with a legal ability.
const item = { boosts: { choice: { value: ["wis", "cha"] } } };
assignItemBoosts(item, "int", []);
assert.equal(item.boosts.choice.selected, "wis");

// Skills: class trains computers (proven at 1) + 2 additional, increases at 3/5/7.
const classSystem = { trainedSkills: { value: ["computers"], additional: 2 }, skillIncreaseLevels: { value: [3, 5, 7] } };
const proven = { computers: 1, society: 2 };
const skills = projectSkillRanks({
  classSystem, backgroundSystem: { trainedSkills: { value: [] } }, provenSkills: proven,
  intelligence: 0, initialIntelligence: 0, keyAbility: "int", priorities: ["stealth", "athletics"], level: 7
});
assert.ok(skills);
assert.equal(skills.plan.trainingBudget, 2);
assert.deepEqual(skills.plan.events, [
  { level: 3, slug: "stealth", rank: 2 },
  { level: 5, slug: "athletics", rank: 2 },
  { level: 7, slug: "stealth", rank: 3 }
]);
const at1 = skills.ranksAt(1);
assert.equal(at1.stealth, 1);
assert.equal(at1.athletics, 1);
assert.equal(at1.computers, 1);
assert.equal(at1.society, 2, "proven ranks are never lowered");
const at3 = skills.ranksAt(3);
assert.equal(at3.stealth, 2);
assert.equal(at3.athletics, 1);
const at7 = skills.ranksAt(7);
assert.equal(at7.stealth, 3);
assert.equal(at7.athletics, 2);
assert.equal(at7.society, 2);
assert.equal(at7.computers, 1);

// A background duplicate of a class skill is a replacement: one more training.
const replaced = projectSkillRanks({
  classSystem, backgroundSystem: { trainedSkills: { value: ["computers"] } }, provenSkills: proven,
  intelligence: 0, initialIntelligence: 0, keyAbility: "int", priorities: ["stealth", "athletics"], level: 1
});
assert.equal(replaced.plan.trainingBudget, 3);

// Bad input fails closed: native-data (out-of-range proven rank or bad level) returns null.
assert.equal(projectSkillRanks({ classSystem, provenSkills: { stealth: 9 }, intelligence: 0, initialIntelligence: 0, keyAbility: "int", level: 1 }), null);
assert.equal(projectSkillRanks({ classSystem, provenSkills: proven, intelligence: 0, initialIntelligence: 0, keyAbility: "int", level: 0 }), null);

console.log("pc-projection.test.mjs: projected attribute modifiers and skill ranks passed");
