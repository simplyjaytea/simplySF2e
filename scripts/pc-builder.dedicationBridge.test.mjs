// Mystic/Witchwarper dedication bridges: Connection/Paradox pre-answered through
// the native GrantItem preselect, the option's tradition feeds the archetype
// entry, and an unanswered bridge warns and leaves a GM note.
// Run: node scripts/pc-builder.dedicationBridge.test.mjs
import assert from "node:assert/strict";

const docs = new Map();
const CLASS_PACK = "sf2e.class-features";
const FEAT_PACK = "sf2e.feats";
const uuid = (pack, id) => `Compendium.${pack}.Item.${id}`;
const doc = (pack, id, name, system, type = "feat") => ({
  pack, uuid: uuid(pack, id), name, _id: id,
  toObject: () => ({ _id: id, name, type, system: structuredClone(system) })
});
const option = (id, name, tag, tradition, flag) => docs.set(uuid(CLASS_PACK, id), doc(CLASS_PACK, id, name, {
  category: "classfeature", traits: { otherTags: [tag] },
  rules: [{ key: "ActiveEffectLike", mode: "override", path: `flags.system.${flag}.tradition`, value: tradition }]
}));

// sf2e-1.6.1 connections.json / paradoxes.json shape: one ChoiceSet on the
// item:tag filter, then the templated GrantItem. Options carry the tradition.
docs.set(uuid(CLASS_PACK, "Connection"), doc(CLASS_PACK, "Connection", "Connection", { rules: [
  { adjustName: false, choices: { filter: ["item:tag:mystic-connection"] }, flag: "connection", key: "ChoiceSet", prompt: "SF2E.SpecificRule.Mystic.Connection.Prompt" },
  { key: "GrantItem", uuid: "{item|flags.system.rulesSelections.connection}" }
] }, "feat"));
docs.set(uuid(CLASS_PACK, "Paradox"), doc(CLASS_PACK, "Paradox", "Paradox", { rules: [
  { adjustName: false, choices: { filter: ["item:tag:witchwarper-paradox"] }, flag: "paradox", key: "ChoiceSet", prompt: "SF2E.SpecificRule.Witchwarper.Paradox.Prompt" },
  { key: "GrantItem", uuid: "{item|flags.system.rulesSelections.paradox}" }
] }, "feat"));
option("akashic", "Akashic", "mystic-connection", "occult", "mystic");
option("healing", "Healing", "mystic-connection", "divine", "mystic");
option("analyst", "Analyst", "witchwarper-paradox", "arcane", "witchwarper");
option("precog", "Precog", "witchwarper-paradox", "occult", "witchwarper");

// Dedications: a static GrantItem to the bridge plus a second grant (Mystic Bond /
// Warp Reality) that is not a bridge and stays native.
docs.set(uuid(FEAT_PACK, "mystic"), doc(FEAT_PACK, "mystic", "Mystic Dedication", { rules: [
  { key: "GrantItem", uuid: uuid(CLASS_PACK, "Connection") },
  { key: "GrantItem", uuid: uuid(CLASS_PACK, "MysticBond") }
] }));
docs.set(uuid(FEAT_PACK, "witchwarper"), doc(FEAT_PACK, "witchwarper", "Witchwarper Dedication", { rules: [
  { key: "GrantItem", uuid: uuid(CLASS_PACK, "Paradox") },
  { key: "GrantItem", uuid: uuid("sf2e.actions", "WarpReality") }
] }));

const classFeatureEntry = (id, name, tag) => ({ _id: id, name, type: "feat", system: { category: "classfeature", level: { value: 1 }, traits: { value: [], otherTags: [tag] } } });
const classPack = {
  async getIndex() {
    return [
      classFeatureEntry("akashic", "Akashic", "mystic-connection"),
      classFeatureEntry("healing", "Healing", "mystic-connection"),
      classFeatureEntry("analyst", "Analyst", "witchwarper-paradox"),
      classFeatureEntry("precog", "Precog", "witchwarper-paradox")
    ];
  },
  getDocument: async (id) => docs.get(uuid(CLASS_PACK, id)) ?? null
};
const featPack = {
  getDocument: async (id) => docs.get(uuid(FEAT_PACK, id)) ?? null
};

globalThis.foundry = { utils: { randomID: (() => { let i = 0; return () => `id-${++i}`; })() } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 50 } };
globalThis.CONFIG = { PF2E: { languages: {} } };
globalThis.fromUuid = async (id) => docs.get(id) ?? null;
globalThis.game = {
  i18n: {
    localize: (key) => key,
    format: (key, data) => "{dedication}: choose its {choice} on the sheet, then add its spellcasting entry by hand."
      .replace(/\{(\w+)\}/g, (_, name) => data[name])
  },
  packs: new Map([[CLASS_PACK, classPack], [FEAT_PACK, featPack]]),
  settings: { get: () => undefined }
};
let embedded;
globalThis.Actor = { create: async () => ({
  system: { attributes: { hp: { max: 20 } }, abilities: { int: { mod: 0 } } },
  async createEmbeddedDocuments(_type, items, options) {
    assert.equal(options.keepId, true);
    embedded = items;
  }, async update() {}, async delete() {}
}) };

const { createCharacterActor, resolveArchetypeBridges, archetypeCasterPlan } = await import("./pc-builder.mjs");
const common = {
  name: "Bridge Caster", level: 8, keyAbility: "wis", languages: [], backstory: "", appearance: "", personality: "", alignmentFlavor: "",
  likes: "", dislikes: "", allies: "", enemies: "", organizations: "", age: "", gender: "", height: "", weight: "", ethnicity: "", nationality: ""
};
const classDoc = { type: "class", name: "Technomancer", system: { slug: "technomancer", publication: { title: "Starfinder Tech Core", remaster: true }, keyAbility: { value: ["int"] }, trainedSkills: { value: [], additional: 0 } }, toObject() { return { type: "class", name: "Technomancer", system: structuredClone(this.system) }; } };
const backgroundDoc = { type: "background", name: "background", system: { boosts: {}, trainedSkills: { value: [] } }, toObject() { return { type: "background", name: "background", system: structuredClone(this.system) }; } };
const ancestryDoc = { type: "ancestry", name: "ancestry", system: { boosts: {}, additionalLanguages: {}, languages: { value: [] } }, toObject() { return { type: "ancestry", name: "ancestry", system: structuredClone(this.system) }; } };
const dedicationFeat = (name, pack, id) => ({ name, type: "class", level: 2, entry: { packId: pack, _id: id } });
const resolvedWith = (feats, extra = {}) => ({
  ancestryDoc, backgroundDoc, classDoc, heritageDoc: null, focusSpells: [], equipment: [], loot: [], spells: [], archetypeSpells: [],
  feats, ...extra
});
async function captureWarnings(fn) {
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try { return { result: await fn(), warnings }; } finally { console.warn = warn; }
}
const entryNamed = (name) => embedded.find((item) => item.type === "spellcastingEntry" && item.name === name);
const dedicationItem = (name) => embedded.find((item) => item.type === "feat" && item.name === name);
const pickNamed = (label) => async (groups) => ({ picks: [{ choice: groups[0].id, option: groups[0].options.find((entry) => entry.label === label).id }] });

// 1. Mystic Dedication, AI picks Healing -> divine archetype entry.
{
  const resolved = resolvedWith([dedicationFeat("Mystic Dedication", FEAT_PACK, "mystic")]);
  resolved.archetypeBridges = await resolveArchetypeBridges(common, resolved, { selectChoices: pickNamed("Healing") });
  assert.equal(resolved.archetypeBridges["mystic-dedication"].option.uuid, uuid(CLASS_PACK, "healing"));
  assert.equal(archetypeCasterPlan({ ...common, level: 8 }, resolved)?.tradition, "divine", "the Healing option's tradition is divine");

  embedded = [];
  const { expectedItems, manualNotes } = await createCharacterActor({ ...common, archetypeSpellcasting: { tradition: "divine" } }, resolved);
  const granted = dedicationItem("Mystic Dedication").system.rules.find((rule) => rule.key === "GrantItem" && rule.uuid === uuid(CLASS_PACK, "Connection"));
  assert.deepEqual(granted.preselectChoices, { connection: uuid(CLASS_PACK, "healing") }, "the dedication's GrantItem is pre-answered");
  assert.equal(entryNamed("Divine Archetype Spells")?.system.tradition.value, "divine", "divine archetype entry");
  assert.deepEqual(manualNotes, [], "a pre-answered bridge adds no GM note");
  assert.ok(expectedItems.some((item) => item._stats?.compendiumSource === uuid(CLASS_PACK, "Connection")), "the Connection is verified after create");
  assert.ok(expectedItems.some((item) => item._stats?.compendiumSource === uuid(CLASS_PACK, "healing")), "the chosen option is verified after create");
}

// 2. Witchwarper Analyst, no AI callback -> deterministic first option -> arcane.
{
  const resolved = resolvedWith([dedicationFeat("Witchwarper Dedication", FEAT_PACK, "witchwarper")], { abilityMods: { int: 2, cha: 1 } });
  resolved.archetypeBridges = await resolveArchetypeBridges(common, resolved, { selectChoices: null });
  assert.equal(resolved.archetypeBridges["witchwarper-dedication"].option.name, "Analyst", "first offered paradox without a callback");

  embedded = [];
  const { manualNotes } = await createCharacterActor({ ...common, archetypeSpellcasting: { tradition: "arcane" } }, resolved);
  assert.equal(entryNamed("Arcane Archetype Spells")?.system.tradition.value, "arcane", "Analyst is arcane");
  assert.deepEqual(manualNotes, []);
}

// 3. Mystic Dedication, the chooser offers and the AI returns no pick -> warn, GM note, no entry.
{
  const resolved = resolvedWith([dedicationFeat("Mystic Dedication", FEAT_PACK, "mystic")]);
  const { result: bridges, warnings: bridgeWarnings } = await captureWarnings(() => resolveArchetypeBridges(common, resolved, {
    selectChoices: async () => ({ picks: [] })
  }));
  resolved.archetypeBridges = bridges;
  assert.equal(bridges["mystic-dedication"].option, null, "an unanswered connection is not pre-answered");
  assert.equal(bridges["mystic-dedication"].choice, "Connection");
  assert.ok(bridgeWarnings.some((line) => /Connection not pre-answered/.test(line)), "the unanswered bridge is warned");

  embedded = [];
  const { result: created, warnings } = await captureWarnings(() => createCharacterActor({ ...common, archetypeSpellcasting: { tradition: "divine" } }, resolved));
  assert.equal(entryNamed("Divine Archetype Spells"), undefined, "no archetype entry without a proven tradition");
  assert.ok(warnings.some((line) => /mystic-dedication/.test(line)), "the skipped entry is warned");
  assert.deepEqual(created.manualNotes, ["Mystic Dedication: choose its Connection on the sheet, then add its spellcasting entry by hand."],
    "the GM is told to add the entry by hand");
  assert.equal(dedicationItem("Mystic Dedication").system.rules.find((rule) => rule.uuid === uuid(CLASS_PACK, "Connection")).preselectChoices, undefined,
    "no partial preselect is written");
}

// 4. Without archetype spellcasting the dedication stays native and gets no note.
{
  const resolved = resolvedWith([dedicationFeat("Mystic Dedication", FEAT_PACK, "mystic")]);
  resolved.archetypeBridges = await resolveArchetypeBridges(common, resolved, { selectChoices: async () => ({ picks: [] }) });
  embedded = [];
  const { result: created } = await captureWarnings(() => createCharacterActor({ ...common, archetypeSpellcasting: null }, resolved));
  assert.deepEqual(created.manualNotes, [], "no spellcasting, no archetype note");
}

console.log("dedication bridges: all assertions passed");
