// Glossary abilities whose published text has blank placeholder values
// (I-ZERO) are never offered as candidates and never cloned. Fixtures are
// copied from the sf2e 1.7.0 bestiary glossary (cache not required in CI).
//
// Run: node scripts/ability-placeholders.test.mjs

import assert from "node:assert/strict";

const ABILITY_PACK = "sf2e.bestiary-ability-glossary-srd";

// Real published text (sf2e 52dfeee, constrict.json / stench.json / darkvision.json).
const CONSTRICT_PLACEHOLDER = "<p>@Damage[(0)[bludgeoning]], @Check[fortitude|dc:|basic]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.Constrict]</p>";
const STENCH_PLACEHOLDER = "<p>0 feet. @Check[fortitude|dc:|options:area-effect,inflicts:sickened,inflicts:slowed]</p><hr /><p>@Localize[PF2E.NPC.Abilities.Glossary.Stench]</p>";
const STENCH_PLACEHOLDER_RULES = [{ key: "Aura", radius: 0, slug: "stench", traits: ["olfactory"] }];
const DARKVISION_PUBLISHED = "<p>@Localize[PF2E.NPC.Abilities.Glossary.Darkvision]</p>";
// Filled copies in the shape of published NPC embeds (cerebinite.json, haeshi-shaa-shaa-form.json).
const CONSTRICT_FILLED = "<p>@Damage[(1d8)[bludgeoning]], @Check[fortitude|dc:22|basic]</p>";
const STENCH_FILLED = "<p>30 feet. @Check[fortitude|dc:34|options:area-effect,inflicts:sickened,inflicts:slowed]</p>";
const STENCH_FILLED_RULES = [{ key: "Aura", radius: 30, slug: "stench", traits: ["olfactory"] }];

const { hasPlaceholderValues, getAbilityCandidates, isPlaceholderEntry } = await import("./compendium.mjs");

// Pure detection.
assert.equal(hasPlaceholderValues({ system: { description: { value: CONSTRICT_PLACEHOLDER }, rules: [] } }), true, "Constrict placeholder");
assert.equal(hasPlaceholderValues({ system: { description: { value: CONSTRICT_FILLED }, rules: [] } }), false, "filled Constrict");
assert.equal(hasPlaceholderValues({ system: { description: { value: STENCH_PLACEHOLDER }, rules: STENCH_PLACEHOLDER_RULES } }), true, "Stench placeholder");
assert.equal(hasPlaceholderValues({ system: { description: { value: STENCH_PLACEHOLDER }, rules: [] } }), true, "0 feet text alone");
assert.equal(hasPlaceholderValues({ system: { description: { value: STENCH_FILLED }, rules: STENCH_FILLED_RULES } }), false, "filled Stench, radius 30");
assert.equal(hasPlaceholderValues({ system: { description: { value: "<p>Creatures within 10 feet take 2d6 damage.</p>" }, rules: [] } }), false, "10 feet is not 0 feet");
assert.equal(hasPlaceholderValues({ system: { description: { value: DARKVISION_PUBLISHED }, rules: [] } }), false, "normal glossary item");
assert.equal(hasPlaceholderValues({ system: { description: { value: "<p>[Listed Size]</p>" }, rules: [] } }), true, "bracketed fill-in");
assert.equal(hasPlaceholderValues({ system: { description: { value: "<p>[Strike] hits</p>" }, rules: [] } }), true, "[Strike] fill-in");
assert.equal(hasPlaceholderValues({ system: { description: { value: "<p>Check [Fire] immunity</p>" }, rules: [] } }), false, "ordinary bracket text");
assert.equal(hasPlaceholderValues({ system: { description: { value: "<p>[[/act escape dc=0]]</p>" }, rules: [] } }), true, "dc=0 check");
assert.equal(hasPlaceholderValues(null), false, "a missing doc is failed closed by isPlaceholderEntry, not here");

// Candidate filter on a stubbed glossary pack.
const docs = {
  constrict: { _id: "constrict", name: "Constrict", type: "action", system: { description: { value: CONSTRICT_PLACEHOLDER }, rules: [] } },
  "constrict-filled": { _id: "constrict-filled", name: "Constrict (Filled)", type: "action", system: { description: { value: CONSTRICT_FILLED }, rules: [] } },
  stench: { _id: "stench", name: "Stench", type: "action", system: { description: { value: STENCH_PLACEHOLDER }, rules: STENCH_PLACEHOLDER_RULES } },
  darkvision: { _id: "darkvision", name: "Darkvision", type: "action", system: { description: { value: DARKVISION_PUBLISHED }, rules: [] } }
};
const indexed = [];
const pack = {
  async getIndex() {
    indexed.push("index");
    return Object.values(docs).map(({ _id, name, type, system }) => ({ _id, name, type, system: { traits: { value: [] }, actionType: { value: "action" } } }));
  },
  async getDocument(id) {
    const doc = docs[id];
    return doc ? { ...doc, uuid: `Compendium.${ABILITY_PACK}.Item.${id}`, toObject: () => structuredClone(doc) } : null;
  }
};
const warnings = [];
const originalWarn = console.warn;
console.warn = (message) => warnings.push(message);
globalThis.game = {
  settings: { get: () => ({}) },
  packs: new Map([[ABILITY_PACK, pack]])
};

try {
  const candidates = await getAbilityCandidates(["Constrict", "Stench", "Darkvision"]);
  const names = candidates.map((c) => c.name).sort();
  assert.deepEqual(names, ["Constrict (Filled)", "Darkvision"], "placeholder items are not offered; filled and normal items are");
  assert.equal(candidates.find((c) => c.name === "Darkvision").ref._id, "darkvision");

  const entry = { packId: ABILITY_PACK, _id: "stench", name: "Stench" };
  assert.equal(await isPlaceholderEntry(entry), true, "stench is flagged through the document, not the index");
  assert.equal(await isPlaceholderEntry({ packId: ABILITY_PACK, _id: "darkvision", name: "Darkvision" }), false);
  assert.equal(await isPlaceholderEntry({ packId: ABILITY_PACK, _id: "missing", name: "Missing" }), true, "an unreadable entry fails closed");
  assert.equal(warnings.length, 0, "the candidate filter itself stays quiet");
} finally {
  console.warn = originalWarn;
}

// Name lookup in resolveConcept: a placeholder match becomes narrative-only
// (or is dropped when its text names mechanics), with a warning naming it.
globalThis.game.packs = new Map([[ABILITY_PACK, pack]]);
const { resolveConcept, normalizeConcept } = await import("./builder.mjs");
const lookupWarnings = [];
console.warn = (message) => lookupWarnings.push(message);
try {
  const concept = normalizeConcept({
    specialAbilities: [
      { name: "Constrict", glossary: "Constrict", description: "It coils around a foe it has grabbed." },
      { name: "Stench", glossary: "Stench", description: "A rank odor rolls out; DC 20 Fortitude or be sickened." },
      { name: "Darkvision", glossary: "Darkvision", description: "It sees in the dark." }
    ]
  }, { level: 5, rarity: "common" });
  const resolved = await resolveConcept(concept);
  const byName = Object.fromEntries(resolved.abilities.map((r) => [r.ability.name, r]));
  assert.equal(byName.Constrict.entry, null, "placeholder name match is not cloned");
  assert.equal(byName.Constrict.ability.narrative, true, "its thematic text stays as narrative-only");
  assert.equal(byName.Stench.entry, null, "placeholder name match is not cloned");
  assert.notEqual(byName.Stench.ability.narrative, true, "text with a DC is not kept as narrative");
  assert.ok(byName.Darkvision.entry, "a normal glossary item still resolves");
  assert.equal(lookupWarnings.length, 2, "each dropped or narrative-only placeholder is named");
  assert.match(lookupWarnings[0], /Constrict/);
  assert.match(lookupWarnings[1], /Stench/);
} finally {
  console.warn = originalWarn;
}

console.log("ability-placeholders.test.mjs: ok");
