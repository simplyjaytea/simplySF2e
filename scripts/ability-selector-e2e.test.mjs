// FIX-C end to end: the real getAbilityCandidates, a selector stub returning the real
// {name, candidate} shape, then the real refineCreatureAbilities -> resolveConcept ->
// createActor. Glossary texts are copied from sf2e 52dfeee (bestiary-ability-glossary-srd).
// Run: node scripts/ability-selector-e2e.test.mjs

import assert from "node:assert/strict";

const PACK = "sf2e.bestiary-ability-glossary-srd";
const CONSTRICT = "<p>@Damage[(0)[bludgeoning]], @Check[fortitude|dc:|basic]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.Constrict]</p>";
const STENCH = "<p>0 feet. @Check[fortitude|dc:|options:area-effect,inflicts:sickened,inflicts:slowed]</p><hr /><p>@Localize[PF2E.NPC.Abilities.Glossary.Stench]</p>";
const STENCH_RULES = [{"key": "Aura", "radius": 0, "slug": "stench", "traits": ["olfactory"]}];
const DARKVISION = "<p>@Localize[PF2E.NPC.Abilities.Glossary.Darkvision]</p>";
const CURSED = "<p>@Damage[(0)[fire]] and @Check[reflex|dc:|basic]</p>";
const docs = {
  constrict: { _id: "constrict", name: "Constrict", type: "action", system: { slug: "constrict", description: { value: CONSTRICT }, rules: [] } },
  stench: { _id: "stench", name: "Stench", type: "action", system: { slug: "stench", description: { value: STENCH }, rules: STENCH_RULES } },
  darkvision: { _id: "darkvision", name: "Darkvision", type: "action", system: { slug: "darkvision", description: { value: DARKVISION }, rules: [] } },
  cursed: { _id: "cursed", name: "Cursed Bite", type: "action", system: { slug: "cursed-bite", description: { value: CURSED }, rules: [] } }
};
const pack = {
  async getIndex() {
    return Object.values(docs).map(({ _id, name, type, system }) => ({ _id, name, type, system: { slug: system.slug, traits: { value: [] }, actionType: { value: "action" } } }));
  },
  async getDocument(id) {
    const d = docs[id];
    if (!d) return null;
    return { ...d, uuid: `Compendium.${PACK}.Item.${id}`, toObject: () => structuredClone(d) };
  }
};
globalThis.game = { settings: { get: () => ({}) }, packs: new Map([[PACK, pack]]), i18n: { localize: (k) => k, format: (k) => k } };
globalThis.CONFIG = { PF2E: { damageTypes: {}, npcAttackTraits: {}, attackEffects: {} } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 20 } };
globalThis.foundry = { utils: { randomID: () => "id" } };
const warnings = [];
console.warn = (...args) => warnings.push(args.map(String).join(" "));

const { normalizeConcept, resolveConcept, createActor } = await import("./builder.mjs");
const { refineCreatureAbilities } = await import("./creature-pipeline.mjs");
const { getAbilityCandidates } = await import("./compendium.mjs");

// The selector stub returns exactly the shape selectCreatureAbilities returns: { name, candidate }.
const selector = async ({ candidates }) => ({
  abilities: candidates
    .filter((c) => ["Constrict", "Stench"].includes(c.name))
    .map((c) => ({ name: c.name, ...(c.ref ? { candidate: c.ref } : {}) })),
  usage: null,
  timing: null
});

// The catalog: fillable blanks are offered, a non-fillable blank is not.
const catalog = await getAbilityCandidates(["constrict", "stench", "darkvision", "cursed"]);
assert.ok(catalog.some((c) => c.name === "Constrict"), "Constrict is offered");
assert.ok(catalog.some((c) => c.name === "Stench"), "Stench is offered");
assert.ok(!catalog.some((c) => c.name === "Cursed Bite"), "a non-fillable blank stays excluded");

async function build(draft) {
  const raw = {
    name: "Test Brute",
    level: 7,
    size: "lg",
    strikes: [{ name: "Tusk", attackScale: "high", damageScale: "high", damageType: "piercing", traits: [], attackEffects: [] }],
    specialAbilities: draft
  };
  const concept = normalizeConcept(raw, { level: 7, rarity: "common" });
  await refineCreatureAbilities(concept, { ai: { selectCreatureAbilities: selector }, labels: {}, onTokens: () => {} });
  const resolved = await resolveConcept(concept);
  let created = null;
  globalThis.Actor = { create: async (data) => { created = data; return data; } };
  await createActor(concept, resolved, {});
  return { resolved: resolved.abilities, items: created.items.filter((item) => item.type === "action") };
}

// Constrict with abilityDcScale moderate (DC 22), Stench at its default (DC 22, 30 feet).
{
  const run = await build([
    { name: "Constrict", glossary: "Constrict", description: "It crushes its prey.", abilityDcScale: "moderate" },
    { name: "Stench", glossary: "Stench", description: "A rank odor rolls out." }
  ]);
  const constrict = run.items.find((item) => item.name === "Constrict");
  assert.ok(constrict, "Constrict is built from the published glossary item (not an empty narrative)");
  assert.match(constrict.system.description.value, /@Damage\[\(4d6\)\[bludgeoning\]\]/, "Constrict damage filled for level 7");
  assert.match(constrict.system.description.value, /dc:22/, "Constrict DC follows the AI's moderate scale");
  const stench = run.items.find((item) => item.name === "Stench");
  assert.ok(stench, "Stench is built");
  assert.match(stench.system.description.value, /^<p>30 feet\./, "Stench distance filled");
  assert.equal(stench.system.rules[0].radius, 30, "Stench aura radius 30");
  const pick = run.resolved.find((a) => a.ability.name === "Constrict").ability;
  assert.equal(pick.description, "It crushes its prey.", "the draft description survives the selector pick");
  assert.ok(!run.items.some((item) => item.name === "Cursed Bite"), "the non-fillable blank is not built");
  assert.ok(!run.resolved.some((a) => a.ability.name === "Constrict" && a.ability.narrative === true), "Constrict is not a narrative fallback");
}

// Constrict without an AI scale: the default (high, DC 25).
{
  const run = await build([{ name: "Constrict", glossary: "Constrict", description: "It crushes its prey." }]);
  const constrict = run.items.find((item) => item.name === "Constrict");
  assert.match(constrict.system.description.value, /dc:25/, "Constrict defaults to high (DC 25)");
}

// Collision: a draft named Constrict whose glossary is Stench must not feed Constrict's pick.
// Stench's own pick takes that draft (its glossary matches), so Constrict uses its default.
{
  const run = await build([
    { name: "Constrict", glossary: "Stench", description: "Stench draft text", abilityDcScale: "moderate" },
    { name: "Stench", glossary: "Stench", description: "x" }
  ]);
  const constrictPick = run.resolved.find((a) => a.ability.name === "Constrict").ability;
  assert.notEqual(constrictPick.description, "Stench draft text", "Constrict does not take another ability's description");
  assert.equal(constrictPick.abilityDcScale, null, "Constrict does not take another ability's DC scale");
  const constrict = run.items.find((item) => item.name === "Constrict");
  assert.match(constrict.system.description.value, /dc:25/, "Constrict keeps its default DC (high)");
  const stenchPick = run.resolved.find((a) => a.ability.name === "Stench").ability;
  assert.equal(stenchPick.description, "Stench draft text", "Stench takes its own draft by glossary");
  assert.equal(stenchPick.abilityDcScale, "moderate", "Stench takes its own DC scale");
}

// Duplicate glossary drafts: the first matching draft applies, deterministically.
{
  const run = await build([
    { name: "Constrict", glossary: "Constrict", description: "first draft", abilityDcScale: "moderate" },
    { name: "Constrict", glossary: "Constrict", description: "second draft", abilityDcScale: "high" }
  ]);
  const pick = run.resolved.find((a) => a.ability.name === "Constrict").ability;
  assert.equal(pick.description, "first draft", "the first matching draft is used");
  assert.equal(pick.abilityDcScale, "moderate", "its DC scale is used");
}

console.log("ability-selector-e2e.test.mjs: ok");
