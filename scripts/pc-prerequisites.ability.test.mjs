// Ability-modifier prerequisites (sf2e "Charisma +2") and " or " disjunctions
// over ability or skill-rank clauses. The legacy score form ("Strength 14")
// is not an ability clause. Fail closed when the staged context lacks an ability.
// Run: node scripts/pc-prerequisites.ability.test.mjs
import assert from "node:assert/strict";
import { featPrerequisitesMet, stagedActorContext } from "./pc-prerequisites.mjs";

const feat = (prerequisites) => ({ system: { prerequisites: { value: prerequisites } } });
const met = (clause, context) => featPrerequisitesMet(feat([{ value: clause }]), context);
const withAbilities = (abilities) => stagedActorContext({ level: 1, abilities });

assert.equal(met("Charisma +2", withAbilities({ cha: 2 })), true, "a modifier equal to the requirement passes");
assert.equal(met("Charisma +2", withAbilities({ cha: 3 })), true, "a modifier above the requirement passes");
assert.equal(met("Charisma +2", withAbilities({ cha: 1 })), false, "a modifier below the requirement is blocked");
assert.equal(met("Charisma +2", withAbilities({})), false, "a missing ability fails closed");
assert.equal(met("Charisma +2", withAbilities({ str: 4 })), false, "a different ability does not satisfy it");
assert.equal(met("charisma +2", withAbilities({ cha: 2 })), true, "ability names are case-insensitive");
assert.equal(met("Charisma +1", withAbilities({ cha: -1 })), false, "a negative modifier is kept and blocks");
assert.equal(met("Charisma +1", withAbilities({ cha: 0 })), false, "a zero modifier is kept and blocks");
assert.equal(met("Charisma +0", withAbilities({ cha: 0 })), true, "a zero modifier satisfies a +0 requirement");
assert.equal(met("Charisma +2", withAbilities({ cha: "2" })), false,
  "a non-numeric modifier is dropped by stagedActorContext and fails closed");

assert.equal(met("Strength 14", withAbilities({ str: 5 })), false,
  "the legacy score form is not an ability clause, so a high modifier does not meet it");
assert.equal(met("Strength 14", withAbilities({ str: 2 })), false,
  "the legacy score form is not converted to a modifier");
assert.equal(met("Strength 14", withAbilities({})), false, "the legacy score form fails closed");

assert.equal(met("Intelligence +2 or Charisma +2", withAbilities({ int: 2 })), true,
  "a disjunction passes when the first ability is met");
assert.equal(met("Intelligence +2 or Charisma +2", withAbilities({ cha: 2 })), true,
  "a disjunction passes when the second ability is met");
assert.equal(met("Intelligence +2 or Charisma +2", withAbilities({ int: 1, cha: 1 })), false,
  "a disjunction is blocked when neither ability is met");
assert.equal(met("Intelligence +2 or Charisma +2", withAbilities({ str: 5 })), false,
  "a disjunction is blocked when both abilities are missing");
assert.equal(met("Intelligence +2 OR Charisma +2", withAbilities({ cha: 2 })), true,
  "the disjunction word is case-insensitive");

assert.equal(met("trained in Arcana or trained in Occultism", stagedActorContext({ level: 1, skills: { occultism: 1 } })), true,
  "a skill-rank disjunction passes when one skill is trained");
assert.equal(met("trained in Arcana or trained in Occultism", stagedActorContext({ level: 1, skills: { society: 1 } })), false,
  "a skill-rank disjunction is blocked when neither skill is trained");

assert.equal(met("Dragon Stance or Tiger Stance", stagedActorContext({ level: 1, feats: ["Tiger Stance"] })), true,
  "a name clause containing or still matches by name");
assert.equal(met("Dragon Stance or Tiger Stance", stagedActorContext({ level: 1 })), false,
  "a name disjunction is blocked without any listed name");
assert.equal(met("Charisma +2 or Dragon Stance", stagedActorContext({ level: 1, abilities: { cha: 5 } })), false,
  "a mixed ability and name disjunction is not split and stays unmet");

const full = featPrerequisitesMet(feat([
  { value: "Intelligence +2 or Charisma +2" },
  { value: "trained in Arcana" }
]), stagedActorContext({ level: 1, abilities: { cha: 2 }, skills: { arcana: 1 } }));
assert.equal(full, true, "a full feat passes when its ability disjunction and skill clauses are both proven");
const missingSkill = featPrerequisitesMet(feat([
  { value: "Intelligence +2 or Charisma +2" },
  { value: "trained in Arcana" }
]), stagedActorContext({ level: 1, abilities: { cha: 2 } }));
assert.equal(missingSkill, false, "a full feat is blocked when any clause is unproven");

console.log("pc-prerequisites.ability.test.mjs: ability modifier and disjunction prerequisites passed");
