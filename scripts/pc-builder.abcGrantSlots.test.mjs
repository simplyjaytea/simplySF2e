// Feats the ancestry, heritage or background already grant, and feats the
// selected class path grants outright, are never offered to a feat slot.
// Run: node scripts/pc-builder.abcGrantSlots.test.mjs
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
const feat = (id, name, category, { prerequisite = null, traits = [], extra = {} } = {}) => {
  const system = { category, level: { value: 1 }, traits: { value: traits }, prerequisites: { value: prerequisite ? [{ value: prerequisite }] : [] }, rules: [], ...extra };
  putDocument(FEATS, id, "feat", name, system);
  // Real backgrounds grant by name-form uuid ("Compendium.sf2e.feats.Item.Deadlift").
  docs.set(featUuid(name), docs.get(featUuid(id)));
  return indexEntry(id, name, "feat", system);
};

// Background grants: Deadlift (single-take) and Assurance, whose published
// source carries `maxTakable: null` (sf2e 1.7.0 feats/skill/assurance.json).
const featEntries = [
  feat("deadlift", "Deadlift", "skill", { prerequisite: "trained in Athletics" }),
  feat("assurance", "Assurance", "skill", { extra: { maxTakable: null } }),
  feat("hefty", "Hefty Hauler", "skill", { prerequisite: "trained in Athletics" }),
  feat("toughness", "Toughness", "general"),
  feat("reach", "Reach Spell", "class", { traits: ["operative"] }),
  feat("aim", "Steady Aim", "class", { traits: ["operative"] })
];
// A closed path option that grants a class feat by fixed uuid, as sf2e
// DPS++ grants Reach Spell (class-features/technomancer/dps.json).
const classEntries = [{ _id: "striker", name: "Striker", type: "feat", system: { category: "classfeature", level: { value: 1 }, traits: { value: [], otherTags: ["operative-specialization"] } } }];
putDocument(CF, "striker", "feat", "Striker", { category: "classfeature", level: { value: 1 }, traits: { value: [], otherTags: ["operative-specialization"] }, rules: [
  { key: "GrantItem", uuid: featUuid("Reach Spell") }
] });
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
  skillIncreaseLevels: { value: [3] }, ancestryFeatLevels: { value: [] }, classFeatLevels: { value: [1] },
  generalFeatLevels: { value: [3] }, skillFeatLevels: { value: [2] },
  items: { spec: { level: 1, uuid: cfUuid("spec") } }
};
const classDocument = { type: "class", name: "Operative", system: classSystem, toObject: () => ({ type: "class", name: "Operative", system: structuredClone(classSystem) }) };
const athleteSystem = { boosts: {}, trainedSkills: { value: ["athletics"], lore: [] }, items: {
  a: { uuid: featUuid("Deadlift"), name: "Deadlift", level: 1 },
  b: { uuid: featUuid("Assurance"), name: "Assurance", level: 1 }
} };
const humanSystem = { boosts: {}, additionalLanguages: {}, languages: { value: [] } };
const backgroundDocument = { type: "background", name: "Athlete", system: athleteSystem, toObject: () => ({ type: "background", name: "Athlete", system: structuredClone(athleteSystem) }) };
const plainBackgroundSystem = { boosts: {}, trainedSkills: { value: ["athletics"], lore: [] }, items: {} };
const plainBackground = { type: "background", name: "Plain", system: plainBackgroundSystem, toObject: () => ({ type: "background", name: "Plain", system: structuredClone(plainBackgroundSystem) }) };
const ancestryDocument = { type: "ancestry", name: "Human", system: humanSystem, toObject: () => ({ type: "ancestry", name: "Human", system: structuredClone(humanSystem) }) };
packs.set(CF, pack(CF, classEntries));
packs.set(FEATS, pack(FEATS, featEntries));
packs.set("test.ancestry", { collection: "test.ancestry", metadata: { type: "Item", label: "Ancestry" },
  getIndex: async () => [{ _id: "human", name: "Human", type: "ancestry", system: {} }], getDocument: async () => ancestryDocument });
packs.set("test.background", { collection: "test.background", metadata: { type: "Item", label: "Background" },
  getIndex: async () => [{ _id: "athlete", name: "Athlete", type: "background", system: {} }, { _id: "plain", name: "Plain", type: "background", system: {} }],
  getDocument: async (id) => (id === "plain" ? plainBackground : backgroundDocument) });
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
const concept = { ancestry: "Human", background: "Athlete", class: "Operative", keyAbility: "dex", level: 3,
  focusSpells: [], equipment: [], loot: [], feats: [] };
const names = (slot) => slot.candidates.map((candidate) => candidate.name);
const slotOf = (resolved, type) => resolved.featSlots.find((slot) => slot.type === type);

const athlete = await resolvePCConcept(concept);
assert.equal(athlete.pathPlan["operative-specialization"].name, "Striker");
const skillSlot = slotOf(athlete, "skill");
const generalSlot = slotOf(athlete, "general");
assert.ok(!names(skillSlot).includes("Deadlift"), "a background-granted skill feat is not offered to a skill slot");
assert.ok(!names(generalSlot).includes("Deadlift"), "nor to a general slot (which also takes skill feats)");
assert.ok(names(skillSlot).includes("Hefty Hauler"), "an unrelated skill feat is still offered");
assert.ok(names(generalSlot).includes("Toughness"), "an unrelated general feat is still offered");
// Fail closed: Assurance's `maxTakable: null` is not proven to allow a second
// copy by any cited source, so the granted copy keeps it out of slots too.
assert.ok(!names(skillSlot).includes("Assurance"), "a granted feat with maxTakable null stays excluded (unproven multi-take)");

// The path's fixed grant is on the sheet already, so the class slot skips it.
const classSlot = slotOf(athlete, "class");
assert.deepEqual(athlete.pathPlan["operative-specialization"].grantedFeats, [featUuid("Reach Spell")]);
assert.deepEqual(athlete.pathPlan["operative-specialization"].grantedFeatNames, ["reach-spell"]);
assert.ok(!names(classSlot).includes("Reach Spell"), "a feat the selected path grants is not offered to a class slot");
assert.ok(names(classSlot).includes("Steady Aim"), "an unrelated class feat is still offered");

// Control: without the grant, the same feats are offered.
const plain = await resolvePCConcept({ ...concept, background: "Plain", backgroundCandidate: null });
assert.ok(names(slotOf(plain, "skill")).includes("Deadlift"), "Deadlift is a normal candidate when nothing grants it");
assert.ok(names(slotOf(plain, "skill")).includes("Assurance"), "Assurance is a normal candidate when nothing grants it");

console.log("pc-builder.abcGrantSlots.test.mjs: ABC- and path-granted feats stay out of feat slots");
