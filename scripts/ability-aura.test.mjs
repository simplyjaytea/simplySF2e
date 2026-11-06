// Aura template (T-AURA) through the production path: AI-shaped concept ->
// normalizeConcept -> refineCreatureAbilities (selector stub with the real
// {name, candidate} shape) -> resolveConcept -> buildModuleTemplate (what createActor
// calls). Expected strings are hand-written from A1-A7 and the cited tables.
// Run: node scripts/ability-aura.test.mjs

import assert from "node:assert/strict";

const PACK = "sf2e.bestiary-ability-glossary-srd";
const docs = {
  darkvision: { _id: "darkvision", name: "Darkvision", type: "action", system: { slug: "darkvision", description: { value: "<p>@Localize[PF2E.NPC.Abilities.Glossary.Darkvision]</p>" }, rules: [] } },
  allaround: { _id: "allaround", name: "All-Around Vision", type: "action", system: { slug: "all-around-vision", description: { value: "<p>@Localize[PF2E.NPC.Abilities.Glossary.AllAroundVision]</p>" }, rules: [] } },
  fastheal: { _id: "fastheal", name: "Fast Healing", type: "action", system: { slug: "fast-healing", description: { value: "<p>@Localize[PF2E.NPC.Abilities.Glossary.FastHealing]</p>" }, rules: [] } }
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
console.warn = (...args) => warnings.push(args.map(String).join(" "));

const { normalizeConcept, resolveConcept } = await import("./builder.mjs");
const { refineCreatureAbilities } = await import("./creature-pipeline.mjs");
const { buildModuleTemplate, buildAura, normalizeAura } = await import("./ability-templates.mjs");

// The selector stub returns exactly the shape selectCreatureAbilities returns: {name, candidate}.
// It picks only glossary names the draft asked for (as the model does from the catalog).
const selector = async ({ candidates, concept }) => {
  const wanted = new Set(concept.specialAbilities.map((a) => a.glossary).filter(Boolean));
  return {
    abilities: candidates.filter((c) => wanted.has(c.name)).map((c) => ({ name: c.name, ...(c.ref ? { candidate: c.ref } : {}) })).slice(0, 6),
    usage: null, timing: null
  };
};

// Production path to the built template (the same call createActor makes).
async function built(draft, level = 7, size = "lg") {
  const concept = normalizeConcept({ name: "Test Creature", level, size, strikes: [], specialAbilities: draft }, { level, rarity: "common" });
  await refineCreatureAbilities(concept, { ai: { selectCreatureAbilities: selector }, labels: {}, onTokens: () => {} });
  const resolved = await resolveConcept(concept);
  return resolved.abilities.map(({ ability, entry }) => ({
    ability, entry,
    item: buildModuleTemplate(ability, { level: concept.level })
  }));
}
const aura = (over) => ({ name: "Foul Air", description: "", template: "aura", kind: "condition", condition: "sickened", ...over });
const onlyOne = async (draft, level) => {
  const out = await built([draft], level);
  assert.equal(out.length, 1, "one ability resolves");
  return out[0];
};

// Condition kind, sickened, medium (30 ft), default moderate DC, fortitude, at several levels.
// DC from SPELL_DC moderate: -1 -> 13, 7 -> 22, 8 -> 23, 14 -> 31, 24 -> 45. Value: 1, 1, 2, 3, 3.
{
  const cases = [
    [-1, "<p>30 feet. A creature that enters or begins its turn in the aura must attempt a @Check[fortitude|dc:13] save. On a failure, it becomes sickened 1. A creature that succeeds is temporarily immune to Foul Air for 1 minute.</p>"],
    [7, "<p>30 feet. A creature that enters or begins its turn in the aura must attempt a @Check[fortitude|dc:22] save. On a failure, it becomes sickened 1. A creature that succeeds is temporarily immune to Foul Air for 1 minute.</p>"],
    [8, "<p>30 feet. A creature that enters or begins its turn in the aura must attempt a @Check[fortitude|dc:23] save. On a failure, it becomes sickened 2. A creature that succeeds is temporarily immune to Foul Air for 1 minute.</p>"],
    [14, "<p>30 feet. A creature that enters or begins its turn in the aura must attempt a @Check[fortitude|dc:31] save. On a failure, it becomes sickened 3. A creature that succeeds is temporarily immune to Foul Air for 1 minute.</p>"],
    [24, "<p>30 feet. A creature that enters or begins its turn in the aura must attempt a @Check[fortitude|dc:45] save. On a failure, it becomes sickened 3. A creature that succeeds is temporarily immune to Foul Air for 1 minute.</p>"]
  ];
  for (const [level, expected] of cases) {
    const r = await onlyOne(aura({}), level);
    assert.ok(r.item, `sickened aura builds at level ${level}`);
    assert.equal(r.item.system.description.value, expected, `sickened aura at level ${level}`);
    assert.equal(r.entry, null, "a template needs no compendium entry");
    assert.notEqual(r.ability.narrative, true, "a template is not narrative");
    assert.equal(r.item.system.rules[0].radius, 30, `rule radius equals the text (level ${level})`);
    assert.deepEqual(r.item.system.rules, [{ key: "Aura", radius: 30 }], "only the Aura key and radius");
  }
}

// Frightened is capped at 2: at level 20 the value is 2 (not 3), moderate DC 39, will save.
{
  const r = await onlyOne(aura({ condition: "frightened" }), 20);
  assert.equal(r.item.system.description.value,
    "<p>30 feet. A creature that enters or begins its turn in the aura must attempt a @Check[will|dc:39] save. On a failure, it becomes frightened 2. A creature that succeeds is temporarily immune to Foul Air for 1 minute.</p>");
}

// Damage kind, fire, medium (10 ft), default fortitude save and moderate DC; dice from max(level - 2, -1).
{
  const expect = {
    1: "<p>10 feet. A creature that enters or begins its turn in the aura takes @Damage[1d4[fire]] damage (@Check[fortitude|dc:14|basic] save).</p>",
    7: "<p>10 feet. A creature that enters or begins its turn in the aura takes @Damage[2d10[fire]] damage (@Check[fortitude|dc:22|basic] save).</p>",
    24: "<p>10 feet. A creature that enters or begins its turn in the aura takes @Damage[8d8[fire]] damage (@Check[fortitude|dc:45|basic] save).</p>"
  };
  for (const [level, text] of Object.entries(expect)) {
    const r = await onlyOne({ name: "Hot Air", description: "", template: "aura", kind: "damage", damageType: "fire" }, Number(level));
    assert.equal(r.item.system.description.value, text, `damage aura at level ${level}`);
    assert.equal(r.item.system.rules[0].radius, 10, "damage aura medium radius 10");
    assert.deepEqual(r.item.system.traits.value, ["aura"], "trait aura only");
    assert.deepEqual([r.item.type, r.item.system.actionType.value, r.item.system.actions.value, r.item.system.category], ["action", "passive", null, "defensive"]);
  }
}

// Radius per size (A1): condition 10/30/90, damage 5/10/30; the rule matches the text.
for (const [kind, extra, sizes] of [
  ["condition", { condition: "sickened" }, { small: 10, medium: 30, large: 90 }],
  ["damage", { damageType: "cold" }, { small: 5, medium: 10, large: 30 }]
]) {
  for (const [size, radius] of Object.entries(sizes)) {
    const r = await onlyOne({ name: "Ring", description: "", template: "aura", kind, size, ...extra }, 7);
    assert.equal(r.item.system.rules[0].radius, radius, `${kind} ${size} radius ${radius}`);
    assert.match(r.item.system.description.value, new RegExp(`^<p>${radius} feet\\.`), `${kind} ${size} text matches radius`);
  }
}

// Fail closed: invalid enums, a missing condition, a missing damage type fall back to narrative.
for (const bad of [
  { kind: "burst" }, { kind: undefined }, { condition: "burning" }, { condition: undefined },
  { size: "huge" }, { abilityDcScale: "extreme" }
]) {
  const r = await onlyOne(aura(bad), 7);
  assert.equal(r.item, null, `invalid ${JSON.stringify(bad)} is not built`);
  assert.equal(r.ability.narrative, true, `invalid ${JSON.stringify(bad)} falls back to narrative`);
}
{
  const r = await onlyOne({ name: "Hot Air", description: "", template: "aura", kind: "damage" }, 7);
  assert.equal(r.item, null, "damage aura without a damage type is not built");
  assert.equal(r.ability.narrative, true, "and falls back to narrative");
}
assert.equal(normalizeAura({ template: "aura", kind: "damage", damageType: "psychic" }), null, "unknown damage type falls back");

// Hostile name and flavor are made inert (name plain-stripped, HTML escaped; flavor blanked or escaped).
{
  const r = await onlyOne(aura({ name: "<b>Gas</b> [[/r 1d20]]", description: "@Check[reflex] Gust" }), 7);
  const value = r.item.system.description.value;
  assert.ok(!value.includes("<b>") && !value.includes("[["), "no live HTML or roll");
  assert.ok(!value.includes("Gust"), "flavor with enricher syntax is blanked");
  const flavored = await onlyOne(aura({ description: "<i>Sour</i>" }), 7);
  assert.match(flavored.item.system.description.value, /^<p>30 feet\. &lt;i&gt;Sour&lt;\/i&gt; A creature/, "plain flavor escaped");
}

// Level outside the tables: build returns null (fallback in createActor).
{
  const spec = normalizeAura({ template: "aura", kind: "condition", condition: "sickened" });
  assert.equal(buildAura(spec, { level: 25, name: "X" }), null, "level 25 is outside the tables");
}

// Six-slot reservation: 2 auras + 1 blast + 3 glossary drafts, selector returns 6 picks -> 3 templates + 3 picks.
{
  const draft = [
    aura({ name: "Aura One" }),
    aura({ name: "Aura Two", condition: "clumsy" }),
    { name: "Breath", description: "Breath.", template: "area-blast", shape: "cone", damageType: "fire" },
    { name: "Darkvision", glossary: "Darkvision", description: "" },
    { name: "All-Around Vision", glossary: "All-Around Vision", description: "" },
    { name: "Fast Healing", glossary: "Fast Healing", description: "" }
  ];
  const out = await built(draft, 7);
  assert.equal(out.length, 6, "six abilities in total");
  assert.equal(out.filter((o) => o.item && o.ability.aura).length, 2, "both auras kept");
  assert.equal(out.filter((o) => o.item && o.ability.areaBlast).length, 1, "the blast kept");
  assert.equal(out.filter((o) => o.entry).length, 3, "the glossary picks fill the remaining three slots");
}

console.log("ability-aura.test.mjs: ok");
