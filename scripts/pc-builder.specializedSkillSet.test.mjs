// Regression test: Operative's Specialized Skill Set slots (levels 3, 7, 15)
// are strictly constrained to the specialization's trained skill (e.g. Stealth for Sniper),
// even when background or ancestry grants training in a different skill (e.g. Athletics).
// Run: node scripts/pc-builder.specializedSkillSet.test.mjs
import assert from "node:assert/strict";

const docs = new Map();
const doc = (pack, id, name, type, system) => {
  const compendiumUuid = `Compendium.${pack}.Item.${id}`;
  const d = {
    pack,
    uuid: compendiumUuid,
    _id: id,
    name,
    type,
    system: structuredClone(system),
    toObject: () => ({ _id: id, name, type, system: structuredClone(system) })
  };
  docs.set(compendiumUuid, d);
  docs.set(id, d);
  return d;
};

// Operative's Specialization bridge
doc("sf2e.class-features", "opspec", "Operative's Specialization", "feat", {
  category: "classfeature",
  rules: [
    { key: "ChoiceSet", flag: "specialization", choices: { filter: ["item:tag:operative-specialization"] } },
    { key: "GrantItem", uuid: "{item|flags.system.rulesSelections.specialization}" }
  ]
});

// Sniper specialization: upgrades Stealth to rank 1
doc("sf2e.class-features", "sniper", "Sniper", "feat", {
  category: "classfeature", traits: { otherTags: ["operative-specialization"] }, rules: [
    { key: "ActiveEffectLike", mode: "upgrade", path: "system.skills.stealth.rank", value: 1 },
    { key: "ChoiceSet", flag: "feat", choices: { filter: ["item:category:skill", "item:level:1"], itemType: "feat" } },
    { key: "GrantItem", uuid: "{item|flags.system.rulesSelections.feat}" }
  ]
});

// Specialized Skill Set (Level 3 feature)
doc("sf2e.class-features", "spec-skill-set", "Specialized Skill Set", "feat", {
  category: "classfeature",
  rules: []
});

// Level 1-2 Feats: Stealth vs Athletics
doc("sf2e.feats", "stealth-feat", "Quiet Move", "feat", {
  category: "skill", level: { value: 1 }, prerequisites: { value: [{ value: "trained in stealth" }] }, rules: []
});
doc("sf2e.feats", "athletics-feat", "Hefty Hauler", "feat", {
  category: "skill", level: { value: 1 }, prerequisites: { value: [{ value: "trained in athletics" }] }, rules: []
});

// ABC items
doc("sf2e.ancestries", "human", "Human", "ancestry", {
  boosts: {}, additionalLanguages: {}, languages: { value: [] }
});
doc("sf2e.backgrounds", "athlete", "Athlete", "background", {
  boosts: {}, trainedSkills: { value: ["athletics"] }, items: {}
});
doc("sf2e.classes", "opclass", "Operative", "class", {
  slug: "operative", keyAbility: { value: ["dex"] }, trainedSkills: { value: [], additional: 3 },
  skillFeatLevels: { value: [2, 3] }, classFeatLevels: { value: [1, 2] }, ancestryFeatLevels: { value: [1] }, generalFeatLevels: { value: [3] },
  items: {
    spec: { level: 1, name: "Operative's Specialization", uuid: "Compendium.sf2e.class-features.Item.opspec" },
    skillSet: { level: 3, name: "Specialized Skill Set", uuid: "Compendium.sf2e.class-features.Item.Specialized Skill Set" }
  }
});

const makePack = (collection, title, indexEntries) => ({
  collection,
  title,
  metadata: { type: "Item" },
  async getIndex() { return indexEntries; },
  getDocument: async (id) => docs.get(id) ?? docs.get(`Compendium.${collection}.Item.${id}`) ?? null
});

const classPack = makePack("sf2e.class-features", "Class Features", [
  { _id: "sniper", name: "Sniper", type: "feat", system: { category: "classfeature", level: { value: 1 }, traits: { value: [], otherTags: ["operative-specialization"] } } },
  { _id: "spec-skill-set", name: "Specialized Skill Set", type: "feat", system: { category: "classfeature", level: { value: 3 }, traits: { value: [] } } }
]);
const featPack = makePack("sf2e.feats", "Feats", [
  { _id: "stealth-feat", name: "Quiet Move", type: "feat", system: { category: "skill", level: { value: 1 }, prerequisites: { value: [{ value: "trained in stealth" }] }, traits: { value: [] } } },
  { _id: "athletics-feat", name: "Hefty Hauler", type: "feat", system: { category: "skill", level: { value: 1 }, prerequisites: { value: [{ value: "trained in athletics" }] }, traits: { value: [] } } }
]);
const ancestryPack = makePack("sf2e.ancestries", "Ancestries", [
  { _id: "human", name: "Human", type: "ancestry" }
]);
const bgPack = makePack("sf2e.backgrounds", "Backgrounds", [
  { _id: "athlete", name: "Athlete", type: "background" }
]);
const classItemPack = makePack("sf2e.classes", "Classes", [
  { _id: "opclass", name: "Operative", type: "class" }
]);

const packs = new Map([
  ["sf2e.class-features", classPack],
  ["sf2e.feats", featPack],
  ["sf2e.ancestries", ancestryPack],
  ["sf2e.backgrounds", bgPack],
  ["sf2e.classes", classItemPack]
]);
packs[Symbol.iterator] = function*() { yield* this.values(); };

globalThis.game = {
  packs,
  settings: { get: () => ({}) },
  i18n: { localize: (k) => k }
};
globalThis.CONFIG = { PF2E: {} };
globalThis.fromUuid = async (id) => docs.get(id) ?? null;
globalThis.foundry = { utils: { randomID: (() => { let id = 0; return () => `id-${++id}`; })() } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 50 } };

const { resolvePCConcept } = await import("./pc-builder.mjs");

// Concept is a level 3 Operative Sniper
const concept = {
  name: "Operative Skill Set Test",
  level: 3,
  keyAbility: "dex",
  ancestry: "Human",
  background: "Athlete",
  class: "Operative",
  feats: ["Sniper"],
  equipment: [],
  loot: [],
  spellcasting: null,
  focusSpells: []
};

const resolved = await resolvePCConcept(concept);

// 1. Path plan must be resolved to Sniper with trainedSkill 'stealth'
assert.ok(resolved.pathPlan, "pathPlan exists on resolved PC concept");
const operativePlan = resolved.pathPlan["operative-specialization"];
assert.ok(operativePlan, "operative-specialization was planned");
assert.equal(operativePlan.name, "Sniper");
assert.equal(operativePlan.trainedSkill, "stealth");

// 2. Find skill feat slots: level 2 and level 3
const skillSlots = resolved.featSlots.filter((slot) => slot.type === "skill");
const slotLevel2 = skillSlots.find((slot) => slot.level === 2);
const slotLevel3 = skillSlots.find((slot) => slot.level === 3);

assert.ok(slotLevel2, "level 2 skill feat slot exists");
assert.ok(slotLevel3, "level 3 skill feat slot exists");

// Level 2 slot is an ordinary skill slot: both Athletics (from background) and Stealth (from Sniper) are available
const level2Names = slotLevel2.candidates.map((c) => c.name);
assert.ok(level2Names.includes("Hefty Hauler"), "level 2 slot contains Athletics feat from background");
assert.ok(level2Names.includes("Quiet Move"), "level 2 slot contains Stealth feat from Sniper specialization");

// Level 3 slot is Specialized Skill Set: MUST ONLY contain Stealth feats, NO Athletics feats
const level3Names = slotLevel3.candidates.map((c) => c.name);
assert.ok(level3Names.includes("Quiet Move"), "level 3 slot contains Stealth feat for Sniper specialization");
assert.equal(level3Names.includes("Hefty Hauler"), false, "level 3 slot DOES NOT contain Athletics feat despite background training");

console.log("pc-builder.specializedSkillSet.test.mjs: Operative Specialized Skill Set constraints verified");
