// Glossary abilities whose published text has blank placeholder values
// (I-ZERO) are never offered as candidates and never cloned. Fixtures are
// copied from sf2e 52dfeee (bestiary glossary and published NPC embeds), so
// CI does not need the class-bench cache.
//
// Run: node scripts/ability-placeholders.test.mjs

import assert from "node:assert/strict";

const ABILITY_PACK = "sf2e.bestiary-ability-glossary-srd";

// Real published text.
const CONSTRICT_PLACEHOLDER = "<p>@Damage[(0)[bludgeoning]], @Check[fortitude|dc:|basic]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.Constrict]</p>";
const STENCH_PLACEHOLDER = "<p>0 feet. @Check[fortitude|dc:|options:area-effect,inflicts:sickened,inflicts:slowed]</p><hr /><p>@Localize[PF2E.NPC.Abilities.Glossary.Stench]</p>";
const STENCH_PLACEHOLDER_RULES = [{ key: "Aura", radius: 0, slug: "stench", traits: ["olfactory"] }];
const DARKVISION_PUBLISHED = "<p>@Localize[PF2E.NPC.Abilities.Glossary.Darkvision]</p>";
// Filled copies in the shape of published NPC embeds (cerebinite.json, haeshi-shaa-shaa-form.json).
const CONSTRICT_FILLED = "<p>@Damage[(1d8)[bludgeoning]], @Check[fortitude|dc:22|basic]</p>";
const STENCH_FILLED = "<p>30 feet. @Check[fortitude|dc:34|options:area-effect,inflicts:sickened,inflicts:slowed]</p>";
const STENCH_FILLED_RULES = [{ key: "Aura", radius: 30, slug: "stench", traits: ["olfactory"] }];
// Published NPC crest-eater-necrograft-zombie.json: Aura radius 0 with filled text.
const CRESTEATER_STENCH = "<p>10 feet. @Check[fortitude|dc:22|options:area-effect,inflicts:sickened,inflicts:slowed]</p><hr /><p>@Localize[PF2E.NPC.Abilities.Glossary.Stench]</p>";

const { hasPlaceholderValues, getAbilityCandidates, isPlaceholderEntry, clearPlaceholderCache } = await import("./compendium.mjs");
const { refineCreatureAbilities } = await import("./creature-pipeline.mjs");

const text = (value, rules = []) => ({ system: { description: { value }, rules } });

// One placeholder per fixture, otherwise clean text: each production pattern must be the only reason it is true.
const onePlaceholder = [
  ["@Damage[(0)[bludgeoning]] alone", "<p>The creature grabs the target. @Damage[(0)[bludgeoning]] each round.</p>"],
  ["@Check[fortitude|dc:|basic] alone", "<p>The creature holds on. @Check[fortitude|dc:|basic]</p>"],
  ["@Check[reflex|dc:] alone", "<p>The creature lunges. @Check[reflex|dc:]</p>"],
  ["Rupture [0] alone", "<p>The wound bleeds. Rupture [0] per round.</p>"],
  ["[[/act escape dc=0]] alone", "<p>[[/act escape dc=0]] to end the hold.</p>"],
  ["<p>0 feet. alone", "<p>0 feet. The creature moves in a cone.</p>"],
  ["[Listed Size] alone", "<p>[Listed Size] creatures are affected.</p>"]
];
for (const [label, value] of onePlaceholder) {
  assert.equal(hasPlaceholderValues(text(value)), true, `one-leaf placeholder: ${label}`);
}

// Negatives: legitimate published text that is not a placeholder.
assert.equal(hasPlaceholderValues(text("<p>It can Fly 0 feet to hover in place.</p>")), false, "Fly 0 feet is a real action");
assert.equal(hasPlaceholderValues(text("<p>Its speed has a minimum 0 feet.</p>")), false, "minimum 0 feet is a real rule");
assert.equal(hasPlaceholderValues(text("<p>Creatures within 10 feet take 2d6 damage.</p>")), false, "10 feet is not 0 feet");
assert.equal(hasPlaceholderValues(text(DARKVISION_PUBLISHED)), false, "normal glossary item");
assert.equal(hasPlaceholderValues(text("<p>Check [Fire] immunity</p>")), false, "ordinary bracket text");
assert.equal(hasPlaceholderValues(text(CRESTEATER_STENCH, [{ key: "Aura", radius: 0, slug: "stench" }])), false, "published Stench with radius 0 and filled text");

// Glossary placeholders, filled copies and the Aura arm (removed: text decides).
assert.equal(hasPlaceholderValues(text(CONSTRICT_PLACEHOLDER)), true, "Constrict placeholder");
assert.equal(hasPlaceholderValues(text(CONSTRICT_FILLED)), false, "filled Constrict");
assert.equal(hasPlaceholderValues(text(STENCH_PLACEHOLDER, STENCH_PLACEHOLDER_RULES)), true, "Stench placeholder");
assert.equal(hasPlaceholderValues(text(STENCH_FILLED, STENCH_FILLED_RULES)), false, "filled Stench, radius 30");
assert.equal(hasPlaceholderValues(text("<p>Clean text.</p>", STENCH_PLACEHOLDER_RULES)), false, "radius 0 alone is not a placeholder");
assert.equal(hasPlaceholderValues(null), false, "a missing doc is failed closed by isPlaceholderEntry, not here");

// Candidate filter and parallel loading on a stubbed glossary pack.
const docs = {
  constrict: { _id: "constrict", name: "Constrict", type: "action", system: { description: { value: CONSTRICT_PLACEHOLDER }, rules: [] } },
  "constrict-filled": { _id: "constrict-filled", name: "Constrict (Filled)", type: "action", system: { description: { value: CONSTRICT_FILLED }, rules: [] } },
  stench: { _id: "stench", name: "Stench", type: "action", system: { description: { value: STENCH_PLACEHOLDER }, rules: STENCH_PLACEHOLDER_RULES } },
  darkvision: { _id: "darkvision", name: "Darkvision", type: "action", system: { description: { value: DARKVISION_PUBLISHED }, rules: [] } },
  flaky: { _id: "flaky", name: "Flaky Grasp", type: "action", system: { description: { value: CONSTRICT_FILLED }, rules: [] } },
  late: { _id: "late", name: "Late Grasp", type: "action", system: { description: { value: CONSTRICT_FILLED }, rules: [] } }
};
let failing = true;
let inFlight = 0;
let maxInFlight = 0;
const makePack = (source) => ({
  async getIndex() {
    return Object.values(source).map(({ _id, name, type }) => ({ _id, name, type, system: { traits: { value: [] }, actionType: { value: "action" } } }));
  },
  async getDocument(id) {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await new Promise((resolve) => setImmediate(resolve));
      if (id === "flaky" && failing) throw new Error("transient read error");
      const doc = source[id];
      return doc ? { ...doc, uuid: `Compendium.${ABILITY_PACK}.Item.${id}`, toObject: () => structuredClone(doc) } : null;
    } finally {
      inFlight -= 1;
    }
  }
});
const warnings = [];
const originalWarn = console.warn;
console.warn = (message) => warnings.push(String(message));
globalThis.game = {
  settings: { get: () => ({}) },
  packs: new Map([[ABILITY_PACK, makePack(docs)]])
};

try {
  const candidates = await getAbilityCandidates(["Constrict", "Stench", "Darkvision"]);
  const names = candidates.map((c) => c.name).sort();
  assert.deepEqual(names, ["Constrict (Filled)", "Darkvision", "Late Grasp"], "placeholder and unreadable items are not offered");
  assert.equal(candidates.find((c) => c.name === "Darkvision").ref._id, "darkvision");
  assert.ok(maxInFlight > 1, "documents are loaded in parallel, not one by one");
  assert.ok(warnings.some((w) => /could not read ability "Flaky Grasp", skipped/.test(w)), "a read failure is named as a read failure");
  assert.ok(!warnings.some((w) => /Flaky Grasp.*blank/.test(w)), "a read failure is not reported as blank values");

  // Fail closed for a thrown read, and do not cache the failure.
  const flakyEntry = { packId: ABILITY_PACK, _id: "flaky", name: "Flaky Grasp" };
  assert.equal(await isPlaceholderEntry(flakyEntry), true, "a thrown read is excluded (fail closed)");
  failing = false;
  assert.equal(await isPlaceholderEntry(flakyEntry), false, "after the read recovers the ability is offered again");
  failing = true;

  const stenchEntry = { packId: ABILITY_PACK, _id: "stench", name: "Stench" };
  assert.equal(await isPlaceholderEntry(stenchEntry), true, "stench is flagged through the document, not the index");
  assert.equal(await isPlaceholderEntry({ packId: ABILITY_PACK, _id: "darkvision", name: "Darkvision" }), false);
  assert.equal(await isPlaceholderEntry({ packId: ABILITY_PACK, _id: "missing", name: "Missing" }), true, "a missing doc fails closed");

  // Cancellation: a cancelled run stops after loading, with the app's cancel marker.
  await assert.rejects(getAbilityCandidates([], { signal: { aborted: true } }), (err) => err.cancelled === true, "cancelled run throws the cancel marker");
} finally {
  console.warn = originalWarn;
}

// Name lookup in resolveConcept: a placeholder match becomes narrative-only
// (or is dropped when its text names mechanics), with a warning naming it.
clearPlaceholderCache();
globalThis.game.packs = new Map([[ABILITY_PACK, makePack(docs)]]);
failing = false;
const { resolveConcept, normalizeConcept } = await import("./builder.mjs");
const lookupWarnings = [];
console.warn = (message) => lookupWarnings.push(String(message));
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

// exactContent path: an issued candidate that has since gone blank is not cloned.
const issued = await getAbilityCandidates(["Late"]);
const issuedRef = issued.find((c) => c.name === "Late Grasp")?.ref;
assert.ok(issuedRef, "a clean ability is issued as a candidate");
docs.late.system.description.value = CONSTRICT_PLACEHOLDER;
clearPlaceholderCache();
const exactWarnings = [];
console.warn = (message) => exactWarnings.push(String(message));
try {
  const exactConcept = normalizeConcept({
    specialAbilities: [{ name: "Late Grasp", glossary: "Late Grasp", description: "It holds the target fast.", candidate: issuedRef }]
  }, { level: 5, rarity: "common" });
  const exact = await resolveConcept(exactConcept, { exactContent: true });
  assert.equal(exact.abilities[0].entry, null, "an issued candidate that is now blank is not cloned under exactContent");
  assert.equal(exact.abilities[0].ability.narrative, true, "its thematic text stays narrative-only");
  assert.equal(exactWarnings.length, 1, "the exactContent drop is named");
} finally {
  console.warn = originalWarn;
}

// Creature pipeline: a draft glossary name held back for blank values is named.
docs.late.system.description.value = CONSTRICT_FILLED;
clearPlaceholderCache();
const pipelineWarnings = [];
console.warn = (message) => pipelineWarnings.push(String(message));
try {
  const concept = {
    level: 5,
    specialAbilities: [{ name: "Constrict", glossary: "Constrict", description: "It coils around a foe it has grabbed." }]
  };
  await refineCreatureAbilities(concept, {
    ai: { selectCreatureAbilities: async () => ({ abilities: [], usage: null, timing: null }) },
    labels: {},
    onTokens: () => {}
  });
  assert.ok(pipelineWarnings.some((w) => /"Constrict" is a glossary ability with blank published values; not offered to the model/.test(w)),
    "the held-back draft ability is named");
} finally {
  console.warn = originalWarn;
}

console.log("ability-placeholders.test.mjs: ok");
