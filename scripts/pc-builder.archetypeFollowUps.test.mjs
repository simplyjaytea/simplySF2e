// Archetype follow-ups across Free Archetype slots. Candidate time offers a
// follow-up whose prerequisite names an archetype feat offered to an earlier
// archetype slot; pick time refuses that follow-up unless the feat it names was
// actually taken (warn, then the next legal candidate). A level-6 build where the
// level-2 dedication is taken gets its follow-ups at levels 4 and 6.
// Run: node scripts/pc-builder.archetypeFollowUps.test.mjs
//
// Uses the real resolvePCConcept, resolveFeatPicks and getFeatCandidates with
// stubbed Foundry globals.
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

// Human with a fixed Charisma boost; the Charisma key ability gives "Charisma +2" at level 2.
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

const feat = (_id, name, { level, traits = ["archetype"], prerequisites = [], category = "class" }) => ({
  _id, name, type: "feat",
  system: {
    category, level: { value: level }, traits: { value: traits },
    prerequisites: { value: prerequisites.map((value) => ({ value })) }
  }
});
const featEntries = [
  // Operative class feats fill the class slots, so they never fall back to an archetype feat.
  feat("operative-tactic", "Operative Tactic", { level: 1, traits: ["operative"] }),
  feat("operative-finesse", "Operative Finesse", { level: 2, traits: ["operative"] }),
  feat("envoy-dedication", "Envoy Dedication", { level: 2, traits: ["archetype", "dedication", "multiclass"], prerequisites: ["Charisma +2"] }),
  // Two archetype feats with no prerequisite: the alphabetical fallback order is Aardvark, Cedar, Envoy.
  feat("aardvark-trick", "Aardvark Trick", { level: 2, prerequisites: [] }),
  feat("cedar-trick", "Cedar Trick", { level: 2, prerequisites: [] }),
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
  settings: { get: (_module, key) => (key === "freeArchetype" ? true : {}) },
  i18n: { localize: (k) => k }
};
globalThis.CONFIG = { PF2E: {} };
globalThis.fromUuid = async (id) => docs.get(id) ?? null;
globalThis.foundry = { utils: { randomID: (() => { let id = 0; return () => `id-${++id}`; })() } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 50 } };

const { resolvePCConcept, resolveFeatPicks } = await import("./pc-builder.mjs");

const warnings = [];
const origWarn = console.warn;
const captureWarnings = () => { warnings.length = 0; console.warn = (msg) => warnings.push(String(msg)); };
const restoreWarnings = () => { console.warn = origWarn; };

const baseConcept = {
  name: "Archetype Follow-up Test",
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
const archetypeRows = (rows) => rows.filter((row) => row.archetype);
// An AI pick for the archetype slot at `level`, carrying the exact reference offered to it.
const pickAt = (featSlots, level, name) => {
  const index = featSlots.findIndex((slot) => slot.archetype && slot.level === level);
  return { slot: index + 1, name, candidate: featSlots[index].candidates.find((c) => c.name === name)?.ref };
};

/* 1. Level 6: the level-2 dedication is taken, so its follow-ups are offered and taken at levels 4 and 6. */
{
  const resolved = await resolvePCConcept({ ...baseConcept, level: 6 });
  const [l2, l4, l6] = archetypeSlots(resolved);
  assert.deepEqual(archetypeSlots(resolved).map((slot) => slot.level), [2, 4, 6],
    "Free Archetype gives an archetype slot at each even level up to 6");
  assert.ok(names(l2).includes("Envoy Dedication"), "the level-2 slot offers the dedication");
  assert.ok(names(l4).includes("Basic Leadership"), "the level-4 slot offers the follow-up of the level-2 dedication");
  assert.ok(names(l6).includes("Advanced Leadership"), "the level-6 slot offers the follow-up of the level-4 follow-up");

  const picks = [pickAt(resolved.featSlots, 2, "Envoy Dedication"), pickAt(resolved.featSlots, 4, "Basic Leadership"),
    pickAt(resolved.featSlots, 6, "Advanced Leadership")];
  captureWarnings();
  const out = await resolveFeatPicks(resolved.featSlots, picks, { exactContent: true });
  restoreWarnings();
  assert.deepEqual(archetypeRows(out).map((row) => row.name), ["Envoy Dedication", "Basic Leadership", "Advanced Leadership"],
    "the dedication is taken, then its follow-ups fill levels 4 and 6");
  assert.ok(archetypeRows(out).every((row) => row.entry), "every archetype slot is filled");
  assert.deepEqual(warnings.filter((w) => /skipped|did not resolve|moved/.test(w)), [],
    "no archetype pick is skipped or moved");
}

/* 2. A follow-up whose dedication was NOT taken is offered, refused at pick time, and the next legal candidate is used. */
{
  const resolved = await resolvePCConcept({ ...baseConcept, level: 4 });
  const [, l4] = archetypeSlots(resolved);
  assert.ok(names(l4).includes("Basic Leadership"),
    "Basic Leadership is offered at level 4 although Envoy Dedication was never taken (candidate time)");

  const picks = [pickAt(resolved.featSlots, 2, "Aardvark Trick"), pickAt(resolved.featSlots, 4, "Basic Leadership")];
  captureWarnings();
  const out = await resolveFeatPicks(resolved.featSlots, picks, { exactContent: true });
  restoreWarnings();
  const rows = archetypeRows(out);
  assert.equal(rows[0].name, "Aardvark Trick", "the level-2 pick is kept");
  assert.equal(rows[1].name, "Cedar Trick", "the refused follow-up is replaced by the next legal candidate");
  assert.equal(rows[1].entry, l4.candidates.find((c) => c.name === "Cedar Trick").ref,
    "the replacement carries its exact issued reference");
  const skipWarnings = warnings.filter((w) => w.includes('"Basic Leadership"') && w.includes("(archetype, level 4)"));
  assert.equal(skipWarnings.length, 1, "the refused follow-up warns once");
  assert.ok(skipWarnings[0].includes("skipped: prerequisites not met"), "the warning names the unproven prerequisite");
  assert.ok(skipWarnings[0].includes('took "Cedar Trick"'), "the warning names the substitute");
}

console.log("pc-builder.archetypeFollowUps.test.mjs: archetype follow-ups offered and proven across slots verified");
