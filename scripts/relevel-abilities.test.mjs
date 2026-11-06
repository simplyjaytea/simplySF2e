// Re-level rebuilds the module's own ability text at the new level (T-RELEVEL).
// The creature is built through the production path (normalizeConcept -> resolveConcept ->
// createActor, with Actor.create stubbed), then re-levelled with the real relevelActorData.
// Expected values are hand-written from the tables (SPELL_DC, AREA_DAMAGE).
// Run: node scripts/relevel-abilities.test.mjs

import assert from "node:assert/strict";

const PACK = "sf2e.bestiary-ability-glossary-srd";
const CONSTRICT = "<p>@Damage[(0)[bludgeoning]], @Check[fortitude|dc:|basic]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.Constrict]</p>";
const SWALLOW = "<p>[Listed Size], @Damage[(0)[bludgeoning]], Rupture [0]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.SwallowWhole]</p>";
const docs = {
  constrict: { _id: "constrict", name: "Constrict", type: "action", system: { slug: "constrict", description: { value: CONSTRICT }, rules: [] } },
  swallow: { _id: "swallow", name: "Swallow Whole", type: "action", system: { slug: "swallow-whole", description: { value: SWALLOW }, rules: [] } }
};
const pack = {
  async getIndex() { return Object.values(docs).map(({ _id, name, type, system }) => ({ _id, name, type, system: { slug: system.slug, traits: { value: [] }, actionType: { value: "action" } } })); },
  async getDocument(id) { const d = docs[id]; return d ? { ...d, uuid: `Compendium.${PACK}.Item.${id}`, toObject: () => structuredClone(d) } : null; }
};
globalThis.game = { settings: { get: () => ({}) }, packs: new Map([[PACK, pack]]), i18n: { localize: (k) => k, format: (k) => k } };
globalThis.CONFIG = { PF2E: { damageTypes: {}, npcAttackTraits: {}, attackEffects: {} } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 20 } };
globalThis.foundry = { utils: { randomID: () => "id" } };
console.warn = () => {};

const { normalizeConcept, resolveConcept, createActor } = await import("./builder.mjs");
const { relevelActorData } = await import("./relevel.mjs");
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
const sources = { [`Compendium.${PACK}.Item.constrict`]: docs.constrict, [`Compendium.${PACK}.Item.swallow`]: docs.swallow };
const byName = (actor, name) => actor.items.find((item) => item.name === name);
const text = (actor, name) => byName(actor, name).system.description.value;

const draft = [
  { name: "Frost Breath", description: "", template: "area-blast", shape: "cone", use: "limited", damageType: "cold" },
  { name: "Foul Air", description: "", template: "aura", kind: "condition", condition: "sickened" },
  { name: "Constrict", glossary: "Constrict", description: "It crushes." }
];
const actor = await buildCreature(draft);
assert.equal(actor.system.details.level.value, 7, "built at level 7");
assert.ok(byName(actor, "Frost Breath").flags.simplysf2e.built, "provenance flag on the blast");
assert.ok(byName(actor, "Foul Air").flags.simplysf2e.built, "provenance flag on the aura");
assert.ok(byName(actor, "Constrict").flags.simplysf2e.built, "provenance flag on the filled glossary ability");

// Re-level to 12: exact rebuilt text (limited blast 13d6 DC 32; sickened 2 DC 29; Constrict 5d8 DC 32).
{
  const releveled = relevelActorData(structuredClone(actor), 12, { sources });
  assert.equal(releveled.to, 12);
  assert.equal(text(releveled.data, "Frost Breath"), "<p>The creature deals @Damage[13d6[cold]|options:area-damage] damage in a @Template[type:cone|distance:30] (@Check[reflex|dc:32|basic|options:area-effect] save). It can't use Frost Breath again for [[/gmr 1d4 #Recharge Frost Breath]]{1d4 rounds}.</p>", "blast at 12");
  assert.equal(text(releveled.data, "Foul Air"), "<p>30 feet. A creature that enters or begins its turn in the aura must attempt a @Check[fortitude|dc:29] save. On a failure, it becomes sickened 2. A creature that succeeds is temporarily immune to Foul Air for 1 minute.</p>", "aura at 12");
  assert.equal(byName(releveled.data, "Foul Air").system.rules[0].radius, 30, "aura rule radius synced");
  assert.match(text(releveled.data, "Constrict"), /@Damage\[\(5d8\)\[bludgeoning\]\]/, "Constrict dice at 12");
  assert.match(text(releveled.data, "Constrict"), /dc:32/, "Constrict DC at 12 (high)");
  assert.ok(releveled.abilities.every((r) => r.status === "rebuilt"), "all three rebuilt");
}

// Re-level to 2: limited blast 3d6 DC 18; sickened 1 DC 15; Constrict 2d6 DC 18.
{
  const releveled = relevelActorData(structuredClone(actor), 2, { sources });
  assert.equal(text(releveled.data, "Frost Breath"), "<p>The creature deals @Damage[3d6[cold]|options:area-damage] damage in a @Template[type:cone|distance:30] (@Check[reflex|dc:18|basic|options:area-effect] save). It can't use Frost Breath again for [[/gmr 1d4 #Recharge Frost Breath]]{1d4 rounds}.</p>", "blast at 2");
  assert.equal(text(releveled.data, "Foul Air"), "<p>30 feet. A creature that enters or begins its turn in the aura must attempt a @Check[fortitude|dc:15] save. On a failure, it becomes sickened 1. A creature that succeeds is temporarily immune to Foul Air for 1 minute.</p>", "aura at 2");
  assert.match(text(releveled.data, "Constrict"), /@Damage\[\(2d6\)\[bludgeoning\]\]/, "Constrict dice at 2");
  assert.match(text(releveled.data, "Constrict"), /dc:18/, "Constrict DC at 2");
}

// The name is kept, and a renamed blast keeps its new name in the recharge sentence.
{
  const renamed = structuredClone(actor);
  byName(renamed, "Frost Breath").name = "Frost Gust";
  const releveled = relevelActorData(renamed, 12, { sources });
  assert.equal(byName(releveled.data, "Frost Gust").name, "Frost Gust", "the rename survives");
  assert.match(text(releveled.data, "Frost Gust"), /It can't use Frost Gust again for \[\[\/gmr 1d4 #Recharge Frost Gust\]\]/, "the recharge sentence uses the new name");
  assert.ok(!text(releveled.data, "Frost Gust").includes("Frost Breath"), "no stale name");
}

// An unflagged published ability is byte-identical after re-level.
{
  const published = structuredClone(actor);
  const bite = { _id: "pub1", name: "Published Bite", type: "action", system: { description: { value: "<p>DC 20 Fortitude. 2d8 damage.</p>" }, rules: [] } };
  published.items.push(bite);
  const releveled = relevelActorData(published, 12, { sources });
  assert.equal(JSON.stringify(byName(releveled.data, "Published Bite")), JSON.stringify(bite), "published ability untouched");
}

// A rebuild that returns null leaves the item unchanged and is reported.
{
  const swallowed = await buildCreature([{ name: "Swallow Whole", glossary: "Swallow Whole", description: "" }]);
  const before = text(swallowed, "Swallow Whole");
  const tiny = structuredClone(swallowed);
  tiny.system.traits.size.value = "tiny";
  const releveled = relevelActorData(tiny, 12, { sources });
  assert.equal(text(releveled.data, "Swallow Whole"), before, "item unchanged when the rebuild is null");
  const report = releveled.abilities.find((r) => r.name === "Swallow Whole");
  assert.equal(report.status, "kept", "reported as kept at the old level");
  assert.match(report.reason, /tiny/, "with the reason");
}

// A glossary source that is not loaded is reported, not guessed.
{
  const releveled = relevelActorData(structuredClone(actor), 12, {});
  const report = releveled.abilities.find((r) => r.name === "Constrict");
  assert.equal(report.status, "kept");
  assert.match(report.reason, /not loaded/);
}

console.log("relevel-abilities.test.mjs: ok");
