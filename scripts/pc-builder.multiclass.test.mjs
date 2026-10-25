// Multiclass slot pinning (M3, Free Archetype only): the first archetype slot
// takes the second class's dedication as its only candidate, an unprovable
// dedication falls back with a warning, follow-ups of that archetype come first
// in later archetype slots, FA off ignores multiclass, normalizePCConcept keeps
// only a complete second class, and candidate records carry prerequisite text so
// a second dedication is accepted only after two follow-ups. Uses the real
// resolvePCConcept/getFeatCandidates with stubbed Foundry globals.
// Run: node scripts/pc-builder.multiclass.test.mjs
import assert from "node:assert/strict";

let freeArchetypeOn = true;
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

// Human with a fixed Charisma boost; the concept's key ability decides the rest.
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

// Index entries for sf2e.feats, shaped like the real pack index fields.
const feat = (_id, name, { level, traits = ["archetype"], prerequisites = [], category = "class" }) => ({
  _id, name, type: "feat",
  system: {
    category, level: { value: level }, traits: { value: traits },
    prerequisites: { value: prerequisites.map((value) => ({ value })) }
  }
});
const featEntries = [
  feat("envoy-dedication", "Envoy Dedication", { level: 2, traits: ["archetype", "dedication", "multiclass"], prerequisites: ["Charisma +2"] }),
  // Second dedication: Constitution +2 is unprovable for this fixture.
  feat("soldier-dedication", "Soldier Dedication", { level: 2, traits: ["archetype", "dedication", "multiclass"], prerequisites: ["Constitution +2"] }),
  // Unrelated archetype feat, provable and sorted before the follow-up by name.
  feat("aardvark-trick", "Aardvark Trick", { level: 2, prerequisites: [] }),
  // Envoy follow-up: names the dedication, so it is provable once the dedication is possessed.
  feat("basic-leadership", "Basic Leadership", { level: 4, prerequisites: ["Envoy Dedication"] }),
  feat("advanced-leadership", "Advanced Leadership", { level: 6, prerequisites: ["Basic Leadership"] })
];

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
  ["sf2e.feats", makePack("sf2e.feats", "Feats", featEntries)]
]);
packs[Symbol.iterator] = function* () { yield* this.values(); };

globalThis.game = {
  packs,
  settings: { get: (_module, key) => (key === "freeArchetype" ? freeArchetypeOn : {}) },
  i18n: { localize: (k) => k }
};
globalThis.CONFIG = { PF2E: {} };
globalThis.fromUuid = async (id) => docs.get(id) ?? null;
globalThis.foundry = { utils: { randomID: (() => { let id = 0; return () => `id-${++id}`; })() } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 50 } };

const { normalizePCConcept, resolvePCConcept } = await import("./pc-builder.mjs");
const { getFeatCandidates } = await import("./compendium.mjs");
const { validateArchetypeSlotPlacement } = await import("./pc-prerequisites.mjs");

const warnings = [];
const origWarn = console.warn;
console.warn = (msg) => warnings.push(String(msg));

const baseConcept = {
  name: "Multiclass Test",
  level: 4,
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

const archetypeSlots = (resolved) => resolved.featSlots.filter((slot) => slot.archetype);
const names = (slot) => slot.candidates.map((candidate) => candidate.name);

// --- resolvePCConcept: pinned dedication, fallback, follow-up order ---
warnings.length = 0;
const pinned = await resolvePCConcept({ ...baseConcept, multiclass: "envoy" });
assert.deepEqual(pinned.multiclass, { class: "envoy", dedication: "Envoy Dedication" },
  "a provable dedication is returned for the preview");
assert.deepEqual(names(archetypeSlots(pinned)[0]), ["Envoy Dedication"],
  "the first archetype slot (level 2) takes the dedication as its only candidate");
assert.deepEqual(warnings.filter((w) => w.includes("not legal")), [],
  "a provable dedication raises no fallback warning");

const followUpNames = names(archetypeSlots(pinned)[1]);
assert.equal(followUpNames[0], "Basic Leadership",
  "the pinned archetype's follow-up leads the later archetype slot, ahead of its name order");
assert.ok(followUpNames.includes("Aardvark Trick"), "other provable archetype feats stay available (preferred, not exclusive)");
assert.ok(followUpNames.indexOf("Basic Leadership") < followUpNames.indexOf("Aardvark Trick"),
  "follow-ups precede other candidates in the later archetype slot");

// Unprovable dedication: Strength key gives Charisma +1, so "Charisma +2" fails.
warnings.length = 0;
const unprovable = await resolvePCConcept({ ...baseConcept, keyAbility: "str", multiclass: "envoy" });
assert.equal(unprovable.multiclass, null, "an unprovable dedication is not reported as pinned");
assert.equal(names(archetypeSlots(unprovable)[0]).includes("Envoy Dedication"), false,
  "an unprovable dedication is not forced into the slot");
assert.ok(names(archetypeSlots(unprovable)[0]).includes("Aardvark Trick"),
  "the slot falls back to ordinary archetype candidates");
assert.ok(warnings.some((w) => w === "simplysf2e | multiclass envoy dedication not legal for this character — using ordinary archetype candidates"),
  "an unprovable dedication warns and falls back");
console.warn = origWarn;

// Free Archetype off: multiclass is ignored, with no archetype slots at all.
freeArchetypeOn = false;
warnings.length = 0;
console.warn = (msg) => warnings.push(String(msg));
const faOff = await resolvePCConcept({ ...baseConcept, multiclass: "envoy" });
console.warn = origWarn;
freeArchetypeOn = true;
assert.equal(faOff.multiclass, null, "Free Archetype off leaves multiclass unset");
assert.equal(archetypeSlots(faOff).length, 0, "Free Archetype off creates no archetype slots");
assert.deepEqual(warnings.filter((w) => w.includes("multiclass")), [], "Free Archetype off does not warn about multiclass");

// --- normalizePCConcept: only a complete second class that differs from the main class ---
const normalize = (multiclass, extra = {}) => normalizePCConcept({ class: "Operative", multiclass, ...extra }, { level: 4 }).multiclass;
{
  warnings.length = 0;
  console.warn = (msg) => warnings.push(String(msg));
  assert.equal(normalize("envoy"), "envoy", "a complete second class slug is kept");
  assert.equal(normalize("Envoy"), "envoy", "a capitalized complete class is normalized to its slug");
  assert.equal(normalize("ai"), null, "an unresolved AI choice becomes null");
  assert.equal(normalize(null), null, "null stays null");
  assert.equal(normalize(undefined), null, "a missing field stays null");
  assert.deepEqual(warnings, [], "null, empty and unresolved AI values warn nothing");

  assert.equal(normalize("operative"), null, "the main class is not a second class");
  assert.equal(normalize("wizard"), null, "an unknown slug is dropped");
  assert.equal(normalize(7), null, "a non-string value is dropped");
  assert.equal(warnings.length, 3, "each dropped value warns once");
  console.warn = origWarn;
}

// --- candidate records: prerequisite text rides on feat candidates ---
const basic = (await getFeatCandidates({ level: 4, category: "class", traits: ["archetype"] }))
  .find((candidate) => candidate.name === "Basic Leadership");
assert.deepEqual(basic?.prerequisites, ["Envoy Dedication"],
  "a feat candidate record carries its prerequisite strings");

// --- Free Archetype placement from candidate records: second dedication after two follow-ups ---
const ref = (id) => ({ packId: "sf2e.feats", _id: id });
const record = (name, { level, traits = ["archetype"], prerequisites = [] }) => ({
  name, level, traits, prerequisites, ref: ref(name.toLowerCase().replaceAll(" ", "-"))
});
const envoy = record("Envoy Dedication", { level: 2, traits: ["archetype", "dedication", "multiclass"], prerequisites: ["Charisma +2"] });
const basicRec = record("Basic Leadership", { level: 4, prerequisites: ["Envoy Dedication"] });
const advancedRec = record("Advanced Leadership", { level: 6, prerequisites: ["Basic Leadership"] });
const soldierRec = record("Soldier Dedication", { level: 8, traits: ["archetype", "dedication", "multiclass"], prerequisites: ["Constitution +2"] });
const slotOf = (level, candidates) => ({ type: "class", level, archetype: true, candidates });
const fillOf = (rec) => ({ name: rec.name, entry: rec.ref });

warnings.length = 0;
console.warn = (msg) => warnings.push(String(msg));
{
  const slots = [slotOf(2, [envoy]), slotOf(4, [basicRec]), slotOf(6, [advancedRec]), slotOf(8, [soldierRec])];
  const result = validateArchetypeSlotPlacement(slots, [envoy, basicRec, advancedRec, soldierRec].map(fillOf), null);
  assert.deepEqual(result.placed, [0, 1, 2, 3], "a second dedication is accepted after two follow-ups read from candidate records");
  assert.deepEqual(result.dropped, [], "nothing is dropped on the complete chain");
}
{
  const soldierAtSix = record("Soldier Dedication", { level: 6, traits: ["archetype", "dedication", "multiclass"], prerequisites: ["Constitution +2"] });
  const slots = [slotOf(2, [envoy]), slotOf(4, [basicRec]), slotOf(6, [soldierAtSix])];
  const result = validateArchetypeSlotPlacement(slots, [envoy, basicRec, soldierAtSix].map(fillOf), null);
  assert.deepEqual(result.placed, [0, 1], "a second dedication after one follow-up is still rejected");
  assert.ok(result.dropped.some((d) => d.reason.includes("dedication rule")), "the early dedication names the dedication rule");
}
console.warn = origWarn;

console.log("pc-builder.multiclass.test.mjs: multiclass slot pinning, normalization and placement verified");
