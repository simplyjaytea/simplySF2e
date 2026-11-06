// Re-level loads the glossary sources behind filled abilities before it rebuilds them (T-RELEVEL fix 1).
// The creature is built through the production path (normalizeConcept -> resolveConcept -> createActor,
// Actor.create stubbed); the glossary documents come from a stubbed fetchDoc, as fromUuid would return them.
// Run: node scripts/relevel-sources.test.mjs

import assert from "node:assert/strict";

const PACK = "sf2e.bestiary-ability-glossary-srd";
const CONSTRICT = "<p>@Damage[(0)[bludgeoning]], @Check[fortitude|dc:|basic]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.Constrict]</p>";
const SWALLOW = "<p>[Listed Size], @Damage[(0)[bludgeoning]], Rupture [0]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.SwallowWhole]</p>";
const docs = {
  constrict: { _id: "constrict", name: "Constrict", type: "action", system: { slug: "constrict", description: { value: CONSTRICT }, rules: [] } },
  swallow: { _id: "swallow", name: "Swallow Whole", type: "action", system: { slug: "swallow-whole", description: { value: SWALLOW }, rules: [] } }
};
const uuidOf = (id) => `Compendium.${PACK}.Item.${id}`;
const pack = {
  async getIndex() { return Object.values(docs).map(({ _id, name, type, system }) => ({ _id, name, type, system: { slug: system.slug, traits: { value: [] }, actionType: { value: "action" } } })); },
  async getDocument(id) { const d = docs[id]; return d ? { ...d, uuid: uuidOf(id), toObject: () => structuredClone(d) } : null; }
};
globalThis.game = { settings: { get: () => ({}) }, packs: new Map([[PACK, pack]]), i18n: { localize: (k) => k, format: (k) => k } };
globalThis.CONFIG = { PF2E: { damageTypes: {}, npcAttackTraits: {}, attackEffects: {} } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 20 } };
globalThis.foundry = { utils: { randomID: () => "id" } };
console.warn = () => {};

const { normalizeConcept, resolveConcept, createActor } = await import("./builder.mjs");
const { relevelActorData, relevelSourceUuids, loadRelevelSources, relevelReskin, relevelPreview, rebuildModuleAbilities } = await import("./relevel.mjs");
const { refineCreatureAbilities } = await import("./creature-pipeline.mjs");

// Real {name, candidate} selector shape; it picks only the glossary names the draft asked for.
const selector = async ({ candidates, concept }) => {
  const wanted = new Set(concept.specialAbilities.map((a) => a.glossary).filter(Boolean));
  return { abilities: candidates.filter((c) => wanted.has(c.name)).map((c) => ({ name: c.name, candidate: c.ref })), usage: null, timing: null };
};

async function buildCreature(draft) {
  const concept = normalizeConcept({
    name: "Test Brute", level: 7, size: "lg",
    strikes: [{ name: "Tusk", attackScale: "high", damageScale: "high", damageType: "piercing", traits: [], attackEffects: [] }],
    specialAbilities: draft
  }, { level: 7, rarity: "common" });
  await refineCreatureAbilities(concept, { ai: { selectCreatureAbilities: selector }, labels: {}, onTokens: () => {} });
  const resolved = await resolveConcept(concept);
  let created = null;
  globalThis.Actor = { create: async (data) => { created = data; return data; } };
  await createActor(concept, resolved, {});
  return created;
}
const byName = (actor, name) => actor.items.find((item) => item.name === name);
const text = (actor, name) => byName(actor, name).system.description.value;

// Constrict is filled (flagged glossary-fill). A published Swallow Whole clone carries its
// compendium source but no provenance flag, so it must never be fetched or rebuilt.
const actor = await buildCreature([
  { name: "Frost Breath", description: "", template: "area-blast", shape: "cone", use: "limited", damageType: "cold" },
  { name: "Constrict", glossary: "Constrict", description: "It crushes." }
]);
actor.items.push({
  _id: "published-swallow", name: "Swallow Whole", type: "action",
  system: { description: { value: SWALLOW }, rules: [] }, _stats: { compendiumSource: uuidOf("swallow") }
});
assert.ok(byName(actor, "Constrict").flags.simplysf2e.built, "Constrict carries the glossary-fill flag");

// 1. Only the flagged fill's source is asked for.
assert.deepEqual(relevelSourceUuids(actor), [uuidOf("constrict")], "source uuids: flagged fills only");

// 2. Loader: fetched by uuid, stored as item data; a source that throws or is missing is left out.
{
  const fetched = [];
  const fetchDoc = async (uuid) => {
    fetched.push(uuid);
    if (uuid === uuidOf("constrict")) return { toObject: () => structuredClone(docs.constrict) };
    return null;
  };
  const sources = await loadRelevelSources(actor, fetchDoc);
  assert.deepEqual(fetched, [uuidOf("constrict")], "fetchDoc called once, for the flagged fill");
  assert.equal(sources[uuidOf("constrict")].name, "Constrict", "loaded source is the glossary item data");

  const throwing = await loadRelevelSources(actor, async () => { throw new Error("pack missing"); });
  assert.deepEqual(throwing, {}, "a throwing source load is left out, not fatal");
}

// 3. The real path the app uses: loaded sources reach the rebuild, so Constrict is rebuilt at 12.
{
  const fetchDoc = async (uuid) => (uuid === uuidOf("constrict") ? { toObject: () => structuredClone(docs.constrict) } : null);
  const releveled = await relevelReskin(structuredClone(actor), 12, fetchDoc);
  assert.match(text(releveled.data, "Constrict"), /@Damage\[\(5d8\)\[bludgeoning\]\]/, "Constrict dice rebuilt at 12");
  assert.match(text(releveled.data, "Constrict"), /dc:32/, "Constrict DC rebuilt at 12 (high)");
  const lines = releveled.abilities;
  assert.equal(lines.find((line) => line.name === "Constrict").status, "rebuilt", "report: Constrict rebuilt");
  assert.equal(lines.some((line) => line.name === "Swallow Whole"), false, "published Swallow Whole is not in the report");
  assert.equal(text(releveled.data, "Swallow Whole"), SWALLOW, "published Swallow Whole text unchanged");
}

// 4. A source that cannot be loaded: Constrict is reported kept with the reason and its text is not guessed.
{
  const releveled = await relevelReskin(structuredClone(actor), 12, async () => null);
  assert.equal(text(releveled.data, "Constrict"), byName(actor, "Constrict").system.description.value, "text unchanged without the source");
  const kept = releveled.abilities.find((line) => line.name === "Constrict");
  assert.deepEqual([kept.status, kept.reason], ["kept", "the glossary source is not loaded"], "report: Constrict kept with the reason");
}

// 5. Same-level re-level loads nothing to rebuild and reports nothing.
{
  const releveled = await relevelReskin(structuredClone(actor), 7, async () => { throw new Error("not called"); });
  assert.deepEqual(releveled.abilities, [], "no report at the same level");
}

// 6. The plain relevelActorData with the sources it is given (no loader) still rebuilds at 2.
{
  const sources = { [uuidOf("constrict")]: structuredClone(docs.constrict) };
  const releveled = relevelActorData(structuredClone(actor), 2, { sources });
  assert.match(text(releveled.data, "Constrict"), /@Damage\[\(2d6\)\[bludgeoning\]\]/, "Constrict dice at 2");
}

// 7. Preview (sync, the app calls it on each level change): rows and labelled lines come from the sources it is given.
{
  const sources = { [uuidOf("constrict")]: structuredClone(docs.constrict) };
  const preview = relevelPreview(structuredClone(actor), 12, sources);
  assert.equal(preview.level, 12, "preview level");
  assert.deepEqual(preview.abilities.find((line) => line.name === "Constrict"), { name: "Constrict", rebuilt: true }, "preview: Constrict rebuilt with sources");
  const without = relevelPreview(structuredClone(actor), 12, {});
  assert.deepEqual(without.abilities.find((line) => line.name === "Constrict"),
    { name: "Constrict", rebuilt: false, reason: "the glossary source is not loaded" }, "preview: kept without sources");
}

// 8. Source lookup: the flag's source is used; the compendium stamp is the fallback for items without it.
{
  const flagOnly = structuredClone(actor);
  delete byName(flagOnly, "Constrict")._stats;
  byName(flagOnly, "Constrict").flags.simplysf2e.built.source = uuidOf("constrict");
  assert.deepEqual(relevelSourceUuids(flagOnly), [uuidOf("constrict")], "uuid from the flag alone");
  const releveledFlag = await relevelReskin(flagOnly, 12, async (uuid) => (uuid === uuidOf("constrict") ? { toObject: () => structuredClone(docs.constrict) } : null));
  assert.match(text(releveledFlag.data, "Constrict"), /\(5d8\)/, "rebuilt from the flag's source");

  const stampOnly = structuredClone(actor);
  delete byName(stampOnly, "Constrict").flags.simplysf2e.built.source;
  assert.deepEqual(relevelSourceUuids(stampOnly), [uuidOf("constrict")], "uuid from the compendium stamp");
  const releveledStamp = await relevelReskin(stampOnly, 12, async (uuid) => (uuid === uuidOf("constrict") ? { toObject: () => structuredClone(docs.constrict) } : null));
  assert.match(text(releveledStamp.data, "Constrict"), /\(5d8\)/, "rebuilt from the stamp");
}

// 9. Apply path drops sources -> the fill is kept (mutation target). Already covered in 3; here the same fetch with the sources map.
{
  const sources = { [uuidOf("constrict")]: structuredClone(docs.constrict) };
  const releveled = relevelActorData(structuredClone(actor), 12, { sources });
  assert.match(text(releveled.data, "Constrict"), /\(5d8\)/, "relevelActorData with sources rebuilds");
}

// 10. Reasons: a broken template spec and a level outside the tables are named as such.
{
  const broken = structuredClone(actor);
  byName(broken, "Frost Breath").flags.simplysf2e.built.spec.shape = "bogus";
  const report = relevelActorData(broken, 12, { sources: {} }).abilities.find((r) => r.name === "Frost Breath");
  assert.equal(report.status, "kept", "broken spec kept");
  assert.equal(report.reason, "its saved template spec is no longer valid", "broken spec reason");
  const outside = rebuildModuleAbilities(structuredClone(actor), 30, { sources: {} }).find((r) => r.name === "Frost Breath");
  assert.equal(outside.reason, "level 30 is outside the GM Core tables (-1 to 24)", "out-of-range reason");
}

console.log("relevel-sources: ok");
