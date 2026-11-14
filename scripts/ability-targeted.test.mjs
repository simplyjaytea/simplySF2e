// Targeted-action template, action cost on narrative abilities, and the Recall
// Knowledge note (JT, 2026-11-14). Creatures are built through the production path
// (normalizeConcept -> refineCreatureAbilities -> resolveConcept -> createActor, with
// Actor.create stubbed). Expected strings are hand-written from rules G1-G7 in
// ability-templates.mjs and the cited tables: SPELL_DC (GM Core pg. 126), AREA_DAMAGE
// unlimited (pg. 128), LEVEL_DC (pg. 53) and pf2e v14-dev dc.ts / recall-knowledge.ts.
//
// Run: node scripts/ability-targeted.test.mjs

import assert from "node:assert/strict";

globalThis.game = { settings: { get: () => ({}) }, packs: new Map(), i18n: { localize: (k) => k, format: (k) => k } };
globalThis.CONFIG = { PF2E: { damageTypes: {}, npcAttackTraits: {}, attackEffects: {} } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 20 } };
globalThis.foundry = { utils: { randomID: () => "id" } };
const warnings = [];
console.warn = (...args) => warnings.push(args.join(" "));

const { normalizeConcept, resolveConcept, createActor, npcPublicNotes, narrativeAbilityItem } = await import("./builder.mjs");
const { relevelActorData } = await import("./relevel.mjs");
const { refineCreatureAbilities } = await import("./creature-pipeline.mjs");
const { normalizeTargeted, buildTargeted, costAction, TARGETED_COSTS } = await import("./ability-templates.mjs");
const { completionManifest } = await import("./completion.mjs");
const T = await import("./tables.mjs");
const { recallKnowledgeNote } = await import("./reskin.mjs");

const selector = async () => ({ abilities: [], usage: null, timing: null });

async function buildCreature(level, draft, extra = {}) {
  const concept = normalizeConcept({
    name: "Test Stalker", level, size: "med", traits: ["beast"],
    strikes: [{ name: "Claw", attackScale: "high", damageScale: "high", damageType: "slashing", traits: [], attackEffects: [] }],
    specialAbilities: draft, ...extra
  }, { level, rarity: "common" });
  await refineCreatureAbilities(concept, { ai: { selectCreatureAbilities: selector }, labels: {}, onTokens: () => {} });
  const resolved = await resolveConcept(concept);
  let created = null;
  globalThis.Actor = { create: async (data) => { created = data; return data; } };
  await createActor(concept, resolved, {});
  return { actor: created, concept, resolved };
}
const byName = (actor, name) => actor.items.find((item) => item.name === name);
const text = (actor, name) => byName(actor, name).system.description.value;

/* ---- 1. Targeted template: damage, condition, both; cost, range, traits ---- */
const draft = [
  // One action, ranged (medium default), fire, default save reflex, default DC moderate.
  { name: "Ember Spit", description: "It hawks a burning glob.", template: "targeted", cost: "one", damageType: "fire" },
  // Two actions, within reach, condition only: save defaults to the condition's (will), high DC.
  { name: "Dread Gaze", description: "", template: "targeted", cost: "two", size: "small", condition: "frightened", abilityDcScale: "high" },
  // Reaction, long range, damage and a timed condition, explicit fortitude.
  { name: "Numbing Lash", description: "Trigger A creature moves away.", template: "targeted", cost: "reaction", size: "large", save: "fortitude", damageType: "bludgeoning", condition: "clumsy" }
];
const { actor, concept, resolved } = await buildCreature(7, draft);

// Level 7: SPELL_DC moderate 22, high 25. AREA_DAMAGE unlimited: level 7 = 4d6, level 5 = 2d10.
assert.equal(text(actor, "Ember Spit"),
  "<p>It hawks a burning glob. The creature targets one creature within 30 feet. The target takes @Damage[2d10[fire]] damage (@Check[reflex|dc:22|basic] save).</p>",
  "one action: damage two levels lower (G4), moderate DC, 30 feet");
assert.equal(text(actor, "Dread Gaze"),
  "<p>The creature targets one creature within its reach. The target must attempt a @Check[will|dc:25] save. On a failure, it becomes frightened 1.</p>",
  "condition only: the condition's own save, no duration for frightened");
assert.equal(text(actor, "Numbing Lash"),
  "<p>Trigger A creature moves away. The creature targets one creature within 60 feet. The target takes @Damage[2d10[bludgeoning]] damage (@Check[fortitude|dc:22|basic] save). On a failed save, the target also becomes clumsy 1 for 1 round.</p>",
  "reaction: lighter damage, one save, timed condition");

const shape = (name) => {
  const item = byName(actor, name);
  return [item.type, item.system.actionType.value, item.system.actions.value, item.system.category, item.system.traits.value, item.img, item.system.rules];
};
assert.deepEqual(shape("Ember Spit"), ["action", "action", 1, "offensive", ["fire"], "systems/sf2e/icons/actions/OneAction.webp", []]);
assert.deepEqual(shape("Dread Gaze"), ["action", "action", 2, "offensive", ["emotion", "fear", "mental"], "systems/sf2e/icons/actions/TwoActions.webp", []]);
assert.deepEqual(shape("Numbing Lash"), ["action", "reaction", null, "offensive", [], "systems/sf2e/icons/actions/Reaction.webp", []],
  "a physical damage type is not a trait");
for (const name of ["Ember Spit", "Dread Gaze", "Numbing Lash"]) {
  assert.equal(byName(actor, name).flags.simplysf2e.built.kind, "targeted", `${name}: provenance for re-level`);
  assert.ok(!actor.items.some((item) => item.name === `Narrative: ${name}`), `${name}: not also a narrative item`);
}
// The preview and the completion card treat it like the other templates.
assert.ok(resolved.abilities.every(({ ability, entry }) => ability.targeted && entry === null && ability.narrative !== true));
assert.equal(completionManifest("npc", concept, resolved).records.filter((r) => r.category === "ability" && r.blocking).length, 0,
  "a targeted action never blocks Create");

// Two and three actions use the creature's level (G4); the value scales with level (A4).
{
  const two = buildTargeted(normalizeTargeted({ template: "targeted", cost: "two", damageType: "acid", condition: "sickened" }), { level: 7, name: "Bile" });
  assert.equal(two.system.description.value,
    "<p>The creature targets one creature within 30 feet. The target takes @Damage[4d6[acid]] damage (@Check[fortitude|dc:22|basic] save). On a failed save, the target also becomes sickened 1.</p>");
  const high = buildTargeted(normalizeTargeted({ template: "targeted", cost: "three", condition: "sickened" }), { level: 14, name: "Bile" });
  assert.match(high.system.description.value, /@Check\[fortitude\|dc:31\] save\. On a failure, it becomes sickened 3\.<\/p>$/, "level 14: moderate DC 31, sickened 3");
  assert.equal(high.system.actions.value, 3);
  assert.equal(high.img, "systems/sf2e/icons/actions/ThreeActions.webp");
  // Lowest levels: the lighter step clamps at the table's first row (level -1 = 1d4).
  const low = buildTargeted(normalizeTargeted({ template: "targeted", cost: "free", damageType: "cold" }), { level: 0, name: "Chill" });
  assert.match(low.system.description.value, /@Damage\[1d4\[cold\]\]/);
  assert.equal(low.system.actionType.value, "free");
}

/* ---- 2. Fail closed: an invalid spec is narrative, never a half-built mechanic ---- */
for (const bad of [
  { cost: "passive", damageType: "fire" },          // a targeted action is never passive
  { cost: "one" },                                   // neither damage nor condition
  { cost: "one", damageType: "laser" },
  { cost: "one", condition: "dead" },
  { cost: "one", damageType: "fire", save: "luck" },
  { cost: "one", damageType: "fire", size: "vast" },
  { cost: "one", damageType: "fire", abilityDcScale: "extreme" },
  { cost: 2, damageType: "fire" },                   // a number is not a cost word
  { damageType: "fire" }
]) assert.equal(normalizeTargeted({ template: "targeted", ...bad }), null, JSON.stringify(bad));
assert.equal(normalizeTargeted({ template: "aura", cost: "one", damageType: "fire" }), null, "only template targeted");
assert.equal(buildTargeted(normalizeTargeted({ template: "targeted", cost: "one", damageType: "fire" }), { level: 30 }), null, "level outside the tables");
assert.equal(costAction("constructor"), null, "an inherited key is not a cost");
assert.deepEqual(TARGETED_COSTS, ["one", "two", "three", "reaction", "free"]);
{
  const { actor: fallback } = await buildCreature(7, [
    { name: "Odd Trick", description: "It does something strange.", template: "targeted", cost: "two" }
  ]);
  const item = byName(fallback, "Narrative: Odd Trick");
  assert.ok(item, "an invalid targeted spec stays a narrative ability");
  assert.ok(!/@Check|@Damage/.test(item.system.description.value), "no module mechanics on it");
  assert.equal(item.system.actions.value, 2, "and it still shows its action cost");
}
// AI flavor with enricher syntax is blanked, and the name carries none.
{
  const item = buildTargeted(normalizeTargeted({ template: "targeted", cost: "one", damageType: "fire" }),
    { level: 7, name: "@Check[will] Burn", flavor: "Roll [[/r 99d99]] now." });
  assert.equal(item.system.description.value.match(/@Check|@Damage|\[\[/g).length, 2, "only the module's own damage and save are live");
  assert.ok(!/[@\[\]]/.test(item.name), "plain name");
}

/* ---- 3. Narrative abilities carry their action cost ---- */
{
  const { actor: narrative } = await buildCreature(5, [
    { name: "Pounce", description: "It springs onto prey from above.", cost: "two" },
    { name: "Recoil", description: "Trigger It is hit. It skitters back.", cost: "reaction" },
    { name: "Slip Free", description: "It twists out of a hold.", cost: "free" },
    { name: "Hive Sense", description: "It knows where its kin are.", cost: "passive" },
    { name: "Old Habit", description: "No cost word at all." },
    { name: "Bad Cost", description: "The cost is not a word.", cost: 3 }
  ]);
  const cost = (name) => {
    const item = byName(narrative, `Narrative: ${name}`);
    return [item.system.actionType.value, item.system.actions.value, item.img];
  };
  assert.deepEqual(cost("Pounce"), ["action", 2, "systems/sf2e/icons/actions/TwoActions.webp"]);
  assert.deepEqual(cost("Recoil"), ["reaction", null, "systems/sf2e/icons/actions/Reaction.webp"]);
  assert.deepEqual(cost("Slip Free"), ["free", null, "systems/sf2e/icons/actions/FreeAction.webp"]);
  assert.deepEqual(cost("Hive Sense"), ["passive", null, "systems/sf2e/icons/actions/Passive.webp"]);
  assert.deepEqual(cost("Old Habit"), ["passive", null, "systems/sf2e/icons/actions/Passive.webp"], "no cost: passive, as before");
  assert.deepEqual(cost("Bad Cost"), ["passive", null, "systems/sf2e/icons/actions/Passive.webp"], "a number is ignored");
  assert.match(byName(narrative, "Narrative: Pounce").system.description.value, /no module-authored mechanics/, "still labelled narrative");
  // A concept stored before the cost word keeps its actionType/actions.
  assert.deepEqual(narrativeAbilityItem({ name: "Legacy", description: "x", actionType: "action", actions: 3 }).system.actions, { value: 3 });
  assert.deepEqual(narrativeAbilityItem({ name: "Legacy", description: "x", actionType: "action", actions: null }).system.actions, { value: 1 });
}

/* ---- 4. Re-level rebuilds a targeted action at the new level ---- */
{
  const releveled = relevelActorData(structuredClone(actor), 12, {});
  // Level 12: SPELL_DC moderate 29, high 32; AREA_DAMAGE unlimited level 10 = 6d6; values 2.
  assert.equal(text(releveled.data, "Ember Spit"),
    "<p>It hawks a burning glob. The creature targets one creature within 30 feet. The target takes @Damage[6d6[fire]] damage (@Check[reflex|dc:29|basic] save).</p>");
  assert.equal(text(releveled.data, "Dread Gaze"),
    "<p>The creature targets one creature within its reach. The target must attempt a @Check[will|dc:32] save. On a failure, it becomes frightened 2.</p>");
  assert.match(text(releveled.data, "Numbing Lash"), /clumsy 2 for 1 round\.<\/p>$/);
  assert.deepEqual(releveled.abilities.map((a) => [a.kind, a.status]), [["targeted", "rebuilt"], ["targeted", "rebuilt"], ["targeted", "rebuilt"]]);
  assert.equal(byName(releveled.data, "Dread Gaze").system.actions.value, 2, "cost unchanged");
}

/* ---- 5. Recall Knowledge: DC by level, rarity and Elite/Weak, with Lore DCs ---- */
// dc.ts dcByLevel, copied from the fetched v14-dev source (levels -1 to 25).
const DC_BY_LEVEL = [13, 14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 38, 39, 40, 42, 44, 46, 48, 50];
const RARITY = { common: 0, uncommon: 2, rare: 5, unique: 10 };
const noteFor = (level, rarity, adjustment = null) => npcPublicNotes(normalizeConcept(
  { name: "X", level, traits: ["beast"], recallKnowledge: "It fears fire.", adjustment },
  { level, rarity }
));
for (let level = -1; level <= 24; level++) {
  for (const [rarity, plus] of Object.entries(RARITY)) {
    const dc = DC_BY_LEVEL[level + 1] + plus;
    assert.equal(T.identificationDC(level, rarity), dc, `level ${level} ${rarity}`);
    const note = noteFor(level, rarity);
    assert.ok(note.includes(`<strong>Arcana</strong> @Check[type:arcana|dc:${dc}] or <strong>Nature</strong> @Check[type:nature|dc:${dc}]: It fears fire.`),
      `note DC at level ${level} ${rarity}: ${note}`);
    assert.ok(note.includes(`<p><em>Applicable Lore DC ${dc - 2}; specific Lore DC ${dc - 5}.</em></p>`), `lore DCs at level ${level} ${rarity}`);
  }
}
assert.equal(T.identificationDC("7", "rare"), 28, "a level stored as a string still scales");
assert.deepEqual(T.loreIdentificationDCs(23), { unspecific: 21, specific: 18 });
// The note with no identifying trait still shows the scaled DC and the Lore DCs.
assert.equal(recallKnowledgeNote([], 23, "Odd."),
  "<h3>Recall Knowledge</h3><p><strong>DC 23</strong>: Odd.</p><p><em>Applicable Lore DC 21; specific Lore DC 18.</em></p>");
// Elite and Weak move the DC with the adjusted level, as the NPC sheet does.
{
  const adjusted = (level, adjustment) => {
    const concept = normalizeConcept({ name: "X", level, traits: ["beast"], recallKnowledge: "y" }, { level, rarity: "common" });
    return npcPublicNotes({ ...concept, adjustment });
  };
  assert.ok(adjusted(7, "elite").includes("dc:24]"), "elite 7 reads as level 8");
  assert.ok(adjusted(7, "weak").includes("dc:22]"), "weak 7 reads as level 6");
  assert.ok(adjusted(24, "elite").includes("dc:50]"), "elite 24 reads as level 25");
  assert.ok(adjusted(-1, "weak").includes("dc:14]"), "weak -1 reads as level -2: dc.ts falls back to 14, as the sheet shows");
}

/* ---- 6. The prompt offers the new enum words, and no number for the cost ---- */
{
  let system = "";
  globalThis.fetch = async (_url, init) => {
    system = JSON.parse(init.body).messages[0].content;
    throw new Error("stop after capture");
  };
  globalThis.game.settings.get = (_m, key) => ({ apiBaseUrl: "https://api.example.test/v1", apiKey: "k", model: "m" })[key] ?? {};
  const { generateConcept } = await import("./ai.mjs");
  await generateConcept({ prompt: "a stalker", level: 4, rarity: "common", allowSpellcasting: false }).catch(() => {});
  if (system) {
    assert.ok(system.includes('"cost": "one"|"two"|"three"|"reaction"|"free"|"passive"'), "cost enum");
    assert.ok(system.includes('"template": "area-blast"|"aura"|"targeted"|null'), "targeted template");
    assert.ok(system.includes("set template to targeted"), "guidance line");
  }
  assert.ok(system, "the creature prompt was captured");
}

console.log("ability-targeted.test.mjs: ok");
