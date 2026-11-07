// Single-ability reroll runs the same resolve decision as resolveConcept (T-GAPS), and a
// creature holds each glossary ability once. Built through the real normalizeConcept,
// the real candidate shape ({name, ref} from getAbilityCandidates) and a selector stub.
// Run: node scripts/reroll.resolve.test.mjs
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
const warnings = [];
console.warn = (...args) => warnings.push(args.join(" "));

const { normalizeConcept, resolveConcept, createActor, rerollAbilityInto } = await import("./builder.mjs");
const { getAbilityCandidates } = await import("./compendium.mjs");
const { refineCreatureAbilities } = await import("./creature-pipeline.mjs");

const concept = (specialAbilities, size = "lg") => normalizeConcept({
  name: "Test Brute", level: 7, size,
  strikes: [{ name: "Tusk", attackScale: "high", damageScale: "high", damageType: "piercing", traits: [], attackEffects: [] }],
  specialAbilities
}, { level: 7, rarity: "common" });

async function candidateNamed(keyword, name) {
  const found = (await getAbilityCandidates([keyword])).find((c) => c.name === name);
  assert.ok(found?.ref, `getAbilityCandidates offers ${name} as {name, ref}`);
  return found;
}

// 1. A reroll to a fillable Constrict is filled at build, and keeps the slot's DC scale.
{
  const start = concept([{ name: "Shout", description: "A thunderous shout.", abilityDcScale: "moderate" }]);
  const resolved = await resolveConcept(start);
  const pick = await candidateNamed("constrict", "Constrict");
  const out = await rerollAbilityInto(start, resolved, { index: 0, candidate: pick });
  assert.ok(out, "the reroll is applied");
  assert.equal(out.concept.specialAbilities[0].abilityDcScale, "moderate", "the slot's draft DC scale is kept");
  assert.equal(out.resolved.abilities[0].entry, pick.ref, "the reroll resolves to the issued Constrict");
  assert.notEqual(out.resolved.abilities[0].ability.narrative, true, "a filled ability is not narrative");

  let created = null;
  globalThis.Actor = { create: async (data) => { created = data; return data; } };
  await createActor(out.concept, out.resolved, {});
  const item = created.items.find((i) => i.name === "Constrict");
  assert.ok(item, "Constrict is on the built actor");
  assert.match(item.system.description.value, /@Damage\[\(4d6\)\[bludgeoning\]\]/, "filled at build: 4d6 at level 7");
  assert.match(item.system.description.value, /dc:22/, "DC from the slot's moderate scale at level 7");
}

// 2. A reroll to Swallow Whole on a tiny creature is blocked with the reason and falls back as resolve does.
{
  warnings.length = 0;
  const start = concept([{ name: "Shout", description: "A thunderous shout." }], "tiny");
  const resolved = await resolveConcept(start);
  const pick = await candidateNamed("swallow", "Swallow Whole");
  const out = await rerollAbilityInto(start, resolved, { index: 0, candidate: pick });
  assert.ok(out, "a narrative fallback is kept, not dropped");
  assert.equal(out.resolved.abilities[0].entry, null, "no compendium entry is cloned");
  assert.equal(out.resolved.abilities[0].ability.narrative, true, "falls back to narrative as resolve does");
  assert.ok(warnings.some((w) => /cannot be filled for this creature: size tiny has no smaller size/.test(w)), "the reason is logged");
}

// 3. A replacement carries no AI text, so the mechanics drop cannot fire: a blocked fill
// falls back to an empty narrative, and the slot is kept (never silently dropped).
{
  const start = concept([{ name: "Shout", description: "It deals 2d6 damage with a DC 15 save." }], "tiny");
  const resolved = await resolveConcept(start);
  const pick = await candidateNamed("swallow", "Swallow Whole");
  const out = await rerollAbilityInto(start, resolved, { index: 0, candidate: pick });
  assert.ok(out, "the slot is kept");
  assert.equal(out.resolved.abilities[0].ability.narrative, true, "narrative fallback");
  assert.equal(out.resolved.abilities[0].entry, null, "no clone");
}

// 4. Two drafts of one glossary ability: one slot, a warning, and no slot lost to the duplicate.
{
  warnings.length = 0;
  const drafts = [
    { name: "Constrict", glossary: "Constrict", description: "It crushes." },
    { name: "Constrict", glossary: "constrict", description: "It crushes again." },
    { name: "Swallow Whole", glossary: "Swallow Whole", description: "It swallows." },
    { name: "Trample", glossary: "Trample", description: "It tramples." },
    { name: "Engulf", glossary: "Engulf", description: "It engulfs." },
    { name: "Greater Constrict", glossary: "Greater Constrict", description: "It squeezes." },
    { name: "Howl", description: "A long howl." }
  ];
  const creature = concept(drafts);
  assert.deepEqual(creature.specialAbilities.map((a) => a.name),
    ["Constrict", "Swallow Whole", "Trample", "Engulf", "Greater Constrict", "Howl"],
    "the duplicate is dropped before the 6-slot cap, so Howl keeps its slot");
  assert.ok(warnings.some((w) => /duplicate glossary ability "constrict" dropped/.test(w)), "the drop is logged");

  // The real selector shape, through refine: one Constrict pick, attached to the one draft.
  const selector = async ({ candidates, concept: draft }) => {
    const wanted = new Set(draft.specialAbilities.map((a) => a.glossary).filter(Boolean));
    return { abilities: candidates.filter((c) => wanted.has(c.name)).map((c) => ({ name: c.name, candidate: c.ref })), usage: null, timing: null };
  };
  await refineCreatureAbilities(creature, { ai: { selectCreatureAbilities: selector }, labels: {}, onTokens: () => {} });
  const names = creature.specialAbilities.map((a) => a.name);
  assert.equal(names.filter((n) => n === "Constrict").length, 1, "Constrict appears once after refine");
  const constrict = creature.specialAbilities.find((a) => a.name === "Constrict");
  assert.equal(constrict.description, "It crushes.", "the kept draft is the first one");
}

console.log("reroll.resolve: ok");
