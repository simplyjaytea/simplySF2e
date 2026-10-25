// Caster dedication archetype entries and the technomancer spell database, through createCharacterActor.
import assert from "node:assert/strict";

const docs = new Map();
const entry = (id) => ({ packId: "spells", _id: id, uuid: `Compendium.spells.Item.${id}` });
const spellDoc = (id, level, traits = []) => ({
  id, uuid: `Compendium.spells.Item.${id}`,
  toObject: () => ({ _id: id, name: id, type: "spell", system: { level: { value: level }, traits: { value: traits, traditions: ["arcane"], rarity: "common" }, location: { value: "stale" } } })
});
for (let i = 0; i < 12; i++) docs.set(`cantrip-${i}`, spellDoc(`cantrip-${i}`, 1, ["cantrip"]));
for (let i = 0; i < 8; i++) docs.set(`rank-one-${i}`, spellDoc(`rank-one-${i}`, 1));
docs.set("fireball", spellDoc("fireball", 3));
docs.set("magic-missile", spellDoc("magic-missile", 1));

globalThis.foundry = { utils: { randomID: (() => { let i = 0; return () => `id-${++i}`; })() } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 50 } };
globalThis.CONFIG = { PF2E: { languages: {} } };
globalThis.game = { i18n: { localize: (x) => x }, packs: new Map([["spells", { getDocument: async (id) => docs.get(id) }]]) };
let embedded;
globalThis.Actor = { create: async () => ({
  system: { attributes: { hp: { max: 20 } }, abilities: { int: { mod: 0 } } },
  async createEmbeddedDocuments(_type, items, options) {
    assert.equal(options.keepId, true);
    embedded = items;
  }, async update() {}, async delete() {}
}) };
const { createCharacterActor, archetypeCasterPlan } = await import("./pc-builder.mjs");
const { technomancerDatabasePlan } = await import("./pc-tables.mjs");
const doc = (type, system, name = type) => ({ type, name, system, toObject: () => ({ name, type, system: structuredClone(system) }) });
const common = {
  name: "Dual Caster", level: 8, keyAbility: "int", languages: [], backstory: "", appearance: "", personality: "", alignmentFlavor: "",
  likes: "", dislikes: "", allies: "", enemies: "", organizations: "", age: "", gender: "", height: "", weight: "", ethnicity: "", nationality: ""
};
const feat = (name, placed = true) => ({ name, type: "class", level: 4, entry: placed ? { packId: "feats", _id: name } : null });
const technomancerClass = doc("class", { slug: "technomancer", publication: { title: "Starfinder Tech Core", remaster: true }, keyAbility: { value: ["int"] }, trainedSkills: { value: [], additional: 0 } }, "Technomancer");
const resolvedWith = (feats, extra = {}) => ({
  ancestryDoc: doc("ancestry", { boosts: {}, additionalLanguages: {}, languages: { value: [] } }),
  backgroundDoc: doc("background", { boosts: {}, trainedSkills: { value: [] } }),
  classDoc: technomancerClass, heritageDoc: null, focusSpells: [], equipment: [], loot: [], spells: [], archetypeSpells: [],
  feats, ...extra
});
const pick = (id, rank) => ({ spell: { name: id, rank }, entry: entry(id) });
async function captureWarnings(fn) {
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try { await fn(); } finally { console.warn = warn; }
  return warnings;
}
const archetypeOf = () => embedded.find((item) => item.type === "spellcastingEntry" && item.name === "Arcane Archetype Spells");
const build = (concept, resolved) => createCharacterActor({ ...common, ...concept }, resolved);

// Plan: only a placed, proven caster dedication makes a plan.
const expertTechnomancer = [feat("Technomancer Dedication"), feat("Basic Technomancer Spellcasting"), feat("Expert Technomancer Spellcasting")];
assert.deepEqual(archetypeCasterPlan({ level: 12 }, resolvedWith(expertTechnomancer)), {
  dedication: "technomancer-dedication", mode: "prepared", tradition: "arcane", ability: "int", proficiency: 2,
  counts: { 0: 2, 1: 1, 2: 1, 3: 1, 4: 1 }, maxRank: 4
});
assert.deepEqual(archetypeCasterPlan({ level: 4 }, resolvedWith([feat("Technomancer Dedication")])).counts, { 0: 2 },
  "dedication alone grants two cantrips and no ranked slot");
assert.equal(archetypeCasterPlan({ level: 4 }, resolvedWith([feat("Technomancer Dedication", false)])), null, "an unplaced feat is not a grant");
assert.equal(archetypeCasterPlan({ level: 4 }, resolvedWith([feat("Fighter Dedication")])), null);
assert.equal(archetypeCasterPlan({ level: 8 }, resolvedWith([feat("Technomancer Dedication"), feat("Mystic Dedication")])), null,
  "two caster dedications are not planned");
let warnings = await captureWarnings(async () => {
  assert.equal(archetypeCasterPlan({ level: 8 }, resolvedWith([feat("Mystic Dedication")])), null, "mystic tradition is unproven");
  assert.equal(archetypeCasterPlan({ level: 8 }, resolvedWith([feat("Witchwarper Dedication")])), null, "witchwarper tradition is unproven");
});
assert.equal(warnings.length, 2, "each unproven caster dedication warns");

// Entry: a separate archetype entry, only when the concept planned it.
const level8 = [feat("Technomancer Dedication"), feat("Basic Technomancer Spellcasting")];
embedded = [];
await build({ level: 8, archetypeSpellcasting: null }, resolvedWith(level8));
assert.equal(embedded.filter((item) => item.type === "spellcastingEntry").length, 0, "no archetype plan, no archetype entry");

embedded = [];
await build({ level: 8, archetypeSpellcasting: { tradition: "arcane" } }, resolvedWith(level8, {
  archetypeSpells: [pick("cantrip-0", 0), pick("cantrip-1", 0), pick("rank-one-0", 1), pick("fireball", 3), pick("rank-one-1", 2)]
}));
const archetypeEntry = archetypeOf();
assert.ok(archetypeEntry, "the archetype entry exists");
assert.equal(embedded.filter((item) => item.type === "spellcastingEntry").length, 1, "no class entry is created when the class does not cast");
assert.equal(archetypeEntry.system.prepared.value, "prepared");
assert.equal(archetypeEntry.system.ability.value, "int");
assert.equal(archetypeEntry.system.proficiency.value, 1, "basic only is trained");
assert.equal(archetypeEntry.system.slots.slot0.max, 2);
assert.equal(archetypeEntry.system.slots.slot1.max, 1);
assert.equal(archetypeEntry.system.slots.slot3.max, 1);
assert.equal(archetypeEntry.system.slots.slot2.max, 1);
assert.equal(archetypeEntry.system.slots.slot0.prepared.length, 2);
assert.equal(archetypeEntry.system.slots.slot1.prepared.length, 1);
assert.equal(archetypeEntry.system.slots.slot3.prepared.length, 1, "heightened spell prepares at the rank it is picked for");
const archetypeSpells = embedded.filter((item) => item.type === "spell");
assert.ok(archetypeSpells.every((item) => item.system.location.value === archetypeEntry._id), "archetype spells belong to the archetype entry only");

// Class and archetype entries coexist, each with its own id.
embedded = [];
const classCasting = { tradition: "arcane", spells: [] };
await build({ level: 8, spellcasting: classCasting, archetypeSpellcasting: { tradition: "arcane" } }, { ...resolvedWith(level8), spells: [pick("magic-missile", 1)], archetypeSpells: [pick("cantrip-0", 0)] });
const entries = embedded.filter((item) => item.type === "spellcastingEntry");
assert.equal(entries.length, 2, "class and archetype entries are separate");
assert.notEqual(entries[0]._id, entries[1]._id);
assert.deepEqual(entries.map((item) => item.name).sort(), ["Arcane Archetype Spells", "Arcane Spells"]);
const classEntry = entries.find((item) => item.name === "Arcane Spells");
assert.equal(classEntry.system.slots.slot1.prepared.length, 1, "class entry keeps its own prepared spell");
assert.ok(embedded.filter((item) => item.type === "spell" && item.name === "cantrip-0").every((item) => item.system.location.value !== classEntry._id));

// Expert and master feats raise the archetype proficiency floor.
embedded = [];
await build({ level: 20, archetypeSpellcasting: { tradition: "arcane" } }, resolvedWith([
  feat("Technomancer Dedication"), feat("Basic Technomancer Spellcasting"), feat("Expert Technomancer Spellcasting"), feat("Master Technomancer Spellcasting")
], { archetypeSpells: [] }));
assert.equal(archetypeOf().system.proficiency.value, 3, "master is the top grant");
assert.equal(archetypeOf().system.slots.slot7.max, 1, "master grants rank 7 at level 18");
assert.equal(archetypeOf().system.slots.slot8.max, 1, "master grants rank 8 at level 20");
embedded = [];
await build({ level: 12, archetypeSpellcasting: { tradition: "arcane" } }, resolvedWith([feat("Technomancer Dedication"), feat("Expert Technomancer Spellcasting")], { archetypeSpells: [] }));
assert.equal(archetypeOf().system.proficiency.value, 2, "expert raises the floor to expert");

// Mystic is never built into an entry without a proven tradition.
embedded = [];
warnings = await captureWarnings(() => build({ level: 8, archetypeSpellcasting: { tradition: "divine" } }, resolvedWith([feat("Mystic Dedication")], { archetypeSpells: [pick("cantrip-0", 0)] })));
assert.equal(embedded.filter((item) => item.type === "spellcastingEntry").length, 0, "unproven mystic tradition creates no entry");
assert.ok(warnings.some((line) => /mystic-dedication/.test(line)), "the skipped dedication is warned");

// Technomancer database, class entry: each spell once, capped, prepared from the database.
for (const level of [1, 5, 10]) {
  embedded = [];
  const concept = { level, spellcasting: { tradition: "arcane", spells: [] } };
  const cantrips = Array.from({ length: 12 }, (_, i) => pick(`cantrip-${i}`, 0));
  const ranked = Array.from({ length: 8 }, (_, i) => pick(`rank-one-${i}`, 1));
  const warned = await captureWarnings(() => build(concept, { ...resolvedWith([]), spells: [...cantrips, ...ranked, pick("fireball", 3), pick("magic-missile", 1), pick("magic-missile", 1)] }));
  const casting = embedded.find((item) => item.type === "spellcastingEntry" && item.name === "Arcane Spells");
  const database = embedded.filter((item) => item.type === "spell");
  const caps = technomancerDatabasePlan(level).caps;
  const cantripsIn = database.filter((item) => item.system.traits.value.includes("cantrip"));
  assert.equal(cantripsIn.length, 10, `level ${level}: database holds at most ten cantrips`);
  assert.ok(database.filter((item) => item.name === "magic-missile").length <= 1, "a spell is stored once");
  const rankOneIn = database.filter((item) => !item.system.traits.value.includes("cantrip") && item.system.level.value === 1).length;
  // Eight distinct rank-1 picks plus magic-missile (the duplicate is dropped), capped by the plan.
  assert.equal(rankOneIn, Math.min(9, caps[1]), `level ${level}: rank-1 picks are capped by the database plan`);
  assert.equal(casting.system.slots.slot0.prepared.length, 5, "five cantrips prepared from the database");
  assert.ok(casting.system.slots.slot0.prepared.every((p) => database.some((item) => item._id === p.id)), "prepared cantrips reference database spells");
  for (const [key, slot] of Object.entries(casting.system.slots)) {
    assert.ok(slot.prepared.length <= slot.max, `level ${level}: ${key} never over-prepares`);
  }
  const preparedIds = Object.values(casting.system.slots).flatMap((slot) => slot.prepared.map((p) => p.id));
  assert.equal(new Set(preparedIds).size, preparedIds.length, "daily slots prepare distinct database spells");
  assert.equal(database.length < technomancerDatabasePlan(level).size, warned.some((line) => /database holds/.test(line)),
    `level ${level}: a short database is warned, not padded`);
}

// A cache spell cannot be looked up here (no language staged), so the database lists no cache entry and warns.
embedded = [];
const noLanguage = await captureWarnings(() => build({ level: 1, spellcasting: { tradition: "arcane", spells: [] } }, { ...resolvedWith([]), spells: [pick("cantrip-0", 0)] }));
assert.ok(noLanguage.some((line) => /no known Programming Language/.test(line)), "no staged language warns");
assert.ok(noLanguage.some((line) => /database holds 1 of 16/.test(line)), "the short database is reported against the cited size");

console.log("caster dedication archetype entries and technomancer database: all assertions passed");
