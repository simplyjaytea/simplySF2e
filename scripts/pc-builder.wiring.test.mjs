// Wiring check for the projected prerequisite context in resolvePCConcept:
// general slots offer skill feats, "Charisma +2" is proven from the projected
// Charisma modifier (not +1), and heritage-keyed feats are proven from the
// planned heritage. Uses the real resolvePCConcept with stubbed Foundry globals.
// Run: node scripts/pc-builder.wiring.test.mjs
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

// Ancestry with one fixed Charisma boost and no flaws (real flaws shape: {0: {value: []}}).
doc("sf2e.ancestries", "human", "Human", "ancestry", {
  boosts: { 0: { value: ["cha"] }, 1: { value: [] } }, flaws: { 0: { value: [] } },
  additionalLanguages: {}, languages: { value: [] }
});
doc("sf2e.backgrounds", "athlete", "Athlete", "background", {
  boosts: {}, trainedSkills: { value: ["athletics"] }, items: {}
});
doc("sf2e.classes", "opclass", "Operative", "class", {
  slug: "operative", keyAbility: { value: ["cha", "str", "dex"] }, trainedSkills: { value: [], additional: 3 },
  skillFeatLevels: { value: [2, 3] }, classFeatLevels: { value: [1, 2] }, ancestryFeatLevels: { value: [1] }, generalFeatLevels: { value: [3] },
  items: {}
});
doc("sf2e.heritages", "urbanite", "Urbanite", "heritage", { rules: [] });

// General feat gated on a projected Charisma modifier of +2.
doc("sf2e.feats", "charisma-feat", "Charming Presence", "feat", {
  category: "general", level: { value: 1 }, prerequisites: { value: [{ value: "Charisma +2" }] }, rules: []
});
// Skill feat, unrestricted: a general slot may take it.
doc("sf2e.feats", "silent-step-feat", "Silent Step", "feat", {
  category: "skill", level: { value: 1 }, prerequisites: { value: [] }, rules: []
});
// Heritage-keyed feat: its prerequisite names the planned heritage.
doc("sf2e.feats", "heritage-feat", "Urban Instincts", "feat", {
  category: "general", level: { value: 1 }, prerequisites: { value: [{ value: "Urbanite heritage" }] }, rules: []
});

const makePack = (collection, title, indexEntries) => ({
  collection,
  title,
  metadata: { type: "Item" },
  async getIndex() { return indexEntries; },
  getDocument: async (id) => docs.get(id) ?? docs.get(`Compendium.${collection}.Item.${id}`) ?? null
});

const packs = new Map([
  ["sf2e.ancestries", makePack("sf2e.ancestries", "Ancestries", [{ _id: "human", name: "Human", type: "ancestry" }])],
  ["sf2e.backgrounds", makePack("sf2e.backgrounds", "Backgrounds", [{ _id: "athlete", name: "Athlete", type: "background" }])],
  ["sf2e.classes", makePack("sf2e.classes", "Classes", [{ _id: "opclass", name: "Operative", type: "class" }])],
  ["sf2e.heritages", makePack("sf2e.heritages", "Heritages", [{ _id: "urbanite", name: "Urbanite", type: "heritage" }])],
  ["sf2e.feats", makePack("sf2e.feats", "Feats", [
    { _id: "charisma-feat", name: "Charming Presence", type: "feat", system: { category: "general", level: { value: 1 }, prerequisites: { value: [{ value: "Charisma +2" }] }, traits: { value: [] } } },
    { _id: "silent-step-feat", name: "Silent Step", type: "feat", system: { category: "skill", level: { value: 1 }, prerequisites: { value: [] }, traits: { value: [] } } },
    { _id: "heritage-feat", name: "Urban Instincts", type: "feat", system: { category: "general", level: { value: 1 }, prerequisites: { value: [{ value: "Urbanite heritage" }] }, traits: { value: [] } } }
  ])]
]);
packs[Symbol.iterator] = function* () { yield* this.values(); };

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

const warnings = [];
const origWarn = console.warn;
console.warn = (msg) => warnings.push(String(msg));

const baseConcept = {
  name: "Wiring Test",
  level: 3,
  keyAbility: "cha",
  ancestry: "Human",
  background: "Athlete",
  class: "Operative",
  feats: [],
  equipment: [],
  loot: [],
  spellcasting: null,
  focusSpells: []
};

const slotNames = (resolved, type, level) => resolved.featSlots
  .filter((slot) => slot.type === type && slot.level === level)
  .flatMap((slot) => slot.candidates.map((candidate) => candidate.name));

// Charisma +2: Human's fixed Charisma boost plus the class key ability at level 1.
const charismaTwo = await resolvePCConcept({ ...baseConcept, keyAbility: "cha" });
// Charisma +1: the same ancestry, but the class key ability is Strength.
const charismaOne = await resolvePCConcept({ ...baseConcept, keyAbility: "str" });
console.warn = origWarn;

assert.deepEqual(warnings.filter((w) => w.includes("could not project")), [],
  "the projection proves for this fixture, so the ABC-only fallback is not used");

// A general slot offers skill feats as well as general feats.
assert.ok(slotNames(charismaTwo, "general", 3).includes("Silent Step"),
  "a general slot at level 3 offers a skill feat");

// "Charisma +2" is offered at Charisma +2 and withheld at Charisma +1.
assert.ok(slotNames(charismaTwo, "general", 3).includes("Charming Presence"),
  "Charisma +2 feat is offered when the projected Charisma modifier is +2");
assert.equal(slotNames(charismaOne, "general", 3).includes("Charming Presence"), false,
  "Charisma +2 feat is withheld when the projected Charisma modifier is +1");

// Heritage-keyed feat: offered when the planned heritage exists, withheld without one.
const withHeritage = await resolvePCConcept({ ...baseConcept, keyAbility: "cha", heritage: "Urbanite" });
const withoutHeritage = await resolvePCConcept({ ...baseConcept, keyAbility: "cha", heritage: null });
assert.ok(withHeritage.heritageDoc, "the Urbanite heritage resolves for this fixture");
assert.ok(slotNames(withHeritage, "general", 3).includes("Urban Instincts"),
  "a feat keyed to the planned heritage is offered");
assert.equal(withoutHeritage.heritageDoc, null);
assert.equal(slotNames(withoutHeritage, "general", 3).includes("Urban Instincts"), false,
  "a heritage-keyed feat is withheld when no heritage is planned");

// The projection is returned for diagnostics.
assert.ok(charismaTwo.skillPlan, "resolvePCConcept returns the projected skill plan");

console.log("pc-builder.wiring.test.mjs: projected prerequisite context verified");
