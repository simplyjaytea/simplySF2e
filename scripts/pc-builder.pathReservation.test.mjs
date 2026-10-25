// Production resolution of class-path reservations against the build's own
// ABC grants (A1) and name-form reserved feats (A2).
// Run: node scripts/pc-builder.pathReservation.test.mjs
import assert from "node:assert/strict";

const CF = "test.classfeatures";
const FEATS = "test.feats";
const docs = new Map();
const cfUuid = (id) => `Compendium.${CF}.Item.${id}`;
const featUuid = (id) => `Compendium.${FEATS}.Item.${id}`;
const packs = new Map();

const putDocument = (packId, id, type, name, system) => {
  const uuid = `Compendium.${packId}.Item.${id}`;
  const document = { pack: packId, uuid, name, type, system, toObject: () => ({ _id: id, name, type, system: structuredClone(system) }) };
  docs.set(uuid, document);
  return document;
};
const indexEntry = (id, name, type, system) => ({ _id: id, name, type, system: structuredClone(system) });
const classFeature = (id, name, tag, rules) => {
  const system = { category: "classfeature", level: { value: 1 }, traits: { value: [], otherTags: [tag] }, rules };
  putDocument(CF, id, "feat", name, system);
  return indexEntry(id, name, "feat", system);
};
const skillFeat = (id, name, prerequisite) => {
  const system = { category: "skill", level: { value: 1 }, traits: { value: [] }, prerequisites: { value: prerequisite ? [{ value: prerequisite }] : [] }, rules: [] };
  putDocument(FEATS, id, "feat", name, system);
  return indexEntry(id, name, "feat", system);
};

// Striker's own skill-feat query (Operative specialization shape) reserves
// the first closed level-one skill feat. Athlete grants Deadlift natively.
const featEntries = [
  skillFeat("deadlift", "Deadlift", "trained in Athletics"),
  skillFeat("hefty", "Hefty Haul", "trained in Athletics"),
  skillFeat("keep", "Keep Them in Your Sights", null)
];
const classEntries = [
  classFeature("striker", "Striker", "operative-specialization", [
    { key: "ActiveEffectLike", mode: "upgrade", path: "system.skills.athletics.rank", value: 1 },
    { adjustName: false, choices: { filter: ["item:category:skill", "item:level:1"], itemType: "feat" }, flag: "feat", key: "ChoiceSet", prompt: "PF2E.SpecificRule.Prompt.SkillFeat" },
    { key: "GrantItem", uuid: "{item|flags.system.rulesSelections.feat}" }
  ]),
  // Name-form bonus feat, as Sniper's published bonusFeat stores it.
  classFeature("marks", "Marksman", "operative-specialization", [
    { key: "ActiveEffectLike", mode: "upgrade", path: "system.skills.stealth.rank", value: 1 },
    {
      adjustName: false, flag: "bonusFeat", key: "ChoiceSet", predicate: ["class:operative"],
      choices: [{ value: featUuid("Keep Them in Your Sights") }, { value: featUuid("Scope Sight") }]
    },
    { key: "GrantItem", predicate: ["class:operative"], uuid: "{item|flags.system.rulesSelections.bonusFeat}" }
  ])
];
// Name-form feat documents load by name, as Sniper's native grant does.
putDocument(FEATS, "Keep Them in Your Sights", "feat", "Keep Them in Your Sights", { category: "class", level: { value: 1 }, rules: [] });
putDocument(FEATS, "Scope Sight", "feat", "Scope Sight", { category: "class", level: { value: 1 }, rules: [] });
// The bridge is not a candidate; its own ChoiceSet filters by path tag.
putDocument(CF, "spec", "feat", "Operative's Specialization", { category: "classfeature", rules: [
  { key: "ChoiceSet", flag: "specialization", choices: { filter: ["item:tag:operative-specialization"] } },
  { key: "GrantItem", uuid: "{item|flags.system.rulesSelections.specialization}" }
] });

const pack = (id, entries) => ({
  collection: id, metadata: { type: "Item", label: id },
  getIndex: async () => entries,
  getDocument: async (entryId) => docs.get(`Compendium.${id}.Item.${entryId}`) ?? null
});
const classSystem = {
  slug: "operative", keyAbility: { value: ["dex"] }, trainedSkills: { value: [], additional: 7 },
  skillIncreaseLevels: { value: [3, 5, 7, 9, 11, 13, 15, 17, 19] },
  ancestryFeatLevels: { value: [1, 5, 9, 13, 17] }, classFeatLevels: { value: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
  generalFeatLevels: { value: [3, 7, 11, 15, 19] }, skillFeatLevels: { value: Array.from({ length: 20 }, (_, index) => index + 1) },
  items: { spec: { level: 1, uuid: cfUuid("spec") } }
};
const classDocument = { type: "class", name: "Operative", system: classSystem, toObject: () => ({ type: "class", name: "Operative", system: structuredClone(classSystem) }) };
const athleteSystem = { boosts: {}, trainedSkills: { value: ["athletics"], lore: [] }, items: { deadlift: { uuid: featUuid("deadlift"), name: "Deadlift" } } };
const humanSystem = { boosts: {}, additionalLanguages: {}, languages: { value: [] } };
const backgroundDocument = { type: "background", name: "Athlete", system: athleteSystem, toObject: () => ({ type: "background", name: "Athlete", system: structuredClone(athleteSystem) }) };
const ancestryDocument = { type: "ancestry", name: "Human", system: humanSystem, toObject: () => ({ type: "ancestry", name: "Human", system: structuredClone(humanSystem) }) };
packs.set(CF, pack(CF, classEntries));
packs.set(FEATS, pack(FEATS, featEntries));
packs.set("test.ancestry", { collection: "test.ancestry", metadata: { type: "Item", label: "Ancestry" },
  getIndex: async () => [{ _id: "human", name: "Human", type: "ancestry", system: {} }], getDocument: async () => ancestryDocument });
packs.set("test.background", { collection: "test.background", metadata: { type: "Item", label: "Background" },
  getIndex: async () => [{ _id: "athlete", name: "Athlete", type: "background", system: {} }], getDocument: async () => backgroundDocument });
packs.set("test.class", { collection: "test.class", metadata: { type: "Item", label: "Class" },
  getIndex: async () => [{ _id: "operative", name: "Operative", type: "class", system: {} }], getDocument: async () => classDocument });

const sourcePacks = { ancestries: ["test.ancestry"], backgrounds: ["test.background"], classes: ["test.class"], feats: [FEATS], classFeatures: [CF] };
globalThis.game = {
  settings: { get: (_module, key) => key === "freeArchetype" ? false : sourcePacks },
  packs: { get: (id) => packs.get(id), [Symbol.iterator]: () => packs.values() }
};
globalThis.CONFIG = { PF2E: {} };
globalThis.fromUuid = async (uuid) => docs.get(uuid) ?? null;

const { resolvePCConcept } = await import("./pc-builder.mjs");
const concept = { ancestry: "Human", background: "Athlete", class: "Operative", keyAbility: "dex", level: 1,
  focusSpells: [], equipment: [], loot: [], feats: [] };

// A1: Athlete grants Deadlift, so Striker's own choice must reserve the next
// closed skill feat instead of Deadlift.
const striker = await resolvePCConcept({ ...concept, feats: ["Striker"] });
const strikerPlan = striker.pathPlan["operative-specialization"];
assert.equal(strikerPlan.name, "Striker");
assert.deepEqual(strikerPlan.reservedFeats, [featUuid("hefty")],
  "an ABC-granted feat is never reserved for a path's own choice");
assert.deepEqual(strikerPlan.reservedFeatNames, ["hefty-haul"]);
assert.ok(!strikerPlan.reservedFeats.includes(featUuid("deadlift")));

// A2: a name-form reservation is excluded from the class-1 skill slot by its
// loaded name, so the slot cannot duplicate the path's own grant.
const marks = await resolvePCConcept({ ...concept, feats: ["Marksman"] });
const marksPlan = marks.pathPlan["operative-specialization"];
assert.equal(marksPlan.name, "Marksman");
assert.deepEqual(marksPlan.reservedFeatNames, ["keep-them-in-your-sights"]);
const classOneSkillSlot = marks.featSlots.find((slot) => slot.type === "skill" && slot.level === 1);
assert.ok(classOneSkillSlot, "a level-one skill slot exists");
assert.ok(!classOneSkillSlot.candidates.some((candidate) => candidate.name === "Keep Them in Your Sights"),
  "slots do not offer a feat reserved by name-form uuid");
assert.ok(classOneSkillSlot.candidates.some((candidate) => candidate.name === "Hefty Haul"),
  "unreserved skill feats remain offered to the slot");

console.log("pc-builder.pathReservation.test.mjs: ABC-aware and name-form path reservations passed");
