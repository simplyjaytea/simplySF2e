// FIX-B: fill the blank values of the seven held-back glossary abilities.
// Fixtures are the exact sf2e 52dfeee glossary texts (tools/class-bench/cache,
// bestiary-ability-glossary-srd). Expected heads are hand-written from the
// cited tables: SPELL_DC and AREA_DAMAGE / AREA_DAMAGE_AVERAGE (GM Core pg. 126/128):
//   level -1: SPELL moderate 13, high 16; AREA unlimited 1d4, average 2
//   level  7: SPELL moderate 22, high 25; AREA unlimited 4d6, average 15
//   level 24: SPELL moderate 45, high 48; AREA unlimited 11d6, average 39
// Constants: frightful distance 90, stench distance 30 (approved).
//
// Run: node scripts/ability-fill.test.mjs

import assert from "node:assert/strict";
import { fillBlocker, fillPlaceholderAbility, FILLABLE_ABILITIES, hasPlaceholderValues, isFillableEntry } from "./ability-fill.mjs";

const CONSTRICT = "<p>@Damage[(0)[bludgeoning]], @Check[fortitude|dc:|basic]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.Constrict]</p>";
const GREATER_CONSTRICT = "<p>@Damage[(0)[bludgeoning]], @Check[fortitude|dc:|basic|options:inflicts:unconscious]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.GreaterConstrict]</p>";
const SWALLOW_WHOLE = "<p>[Listed Size], @Damage[(0)[bludgeoning]], Rupture [0]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.SwallowWhole]</p>";
const ENGULF = "<p>@Check[reflex|dc:|options:damaging-effect,inflicts:grabbed,inflicts:slowed], @Damage[(0)[damageType]] damage, [[/act escape dc=0]], Rupture [0]</p><hr /><p>@Localize[PF2E.NPC.Abilities.Glossary.Engulf]</p>";
const TRAMPLE = "<p>[Size], [Listed Strike], @Check[reflex|dc:|basic]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.Trample]</p>";
const FRIGHTFUL_PRESENCE = "<p>0 feet. @Check[will|dc:|options:area-effect,inflicts:frightened]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.FrightfulPresence]</p>";
const STENCH = "<p>0 feet. @Check[fortitude|dc:|options:area-effect,inflicts:sickened,inflicts:slowed]</p><hr /><p>@Localize[PF2E.NPC.Abilities.Glossary.Stench]</p>";

const STENCH_RULES = [{"key": "Aura", "radius": 0, "slug": "stench", "traits": ["olfactory"]}];
const FRIGHTFUL_RULES = [{"key": "Aura", "radius": 0, "slug": "frightful-presence", "traits": ["emotion", "fear", "mental"]}];

const item = (name, desc, rules = []) => ({ name, type: "action", system: { description: { value: desc }, rules: structuredClone(rules) } });
const TUSK = { name: "Tusk", damage: "2d12+6", type: "melee" };
const CLAW = { name: "Claw", damage: "1d4+3", type: "melee" };
const HEAD = (value) => value.split("<hr")[0].trimEnd();
const TAIL = (value) => value.includes("<hr") ? value.slice(value.indexOf("<hr")) : "";

// The seven slugs, and the placeholder check that gates the fill.
assert.deepEqual(Object.keys(FILLABLE_ABILITIES).sort(), ["constrict", "engulf", "frightful-presence", "greater-constrict", "stench", "swallow-whole", "trample"]);
assert.equal(isFillableEntry({ name: "Greater Constrict", system: {} }), true, "slug from the name");
assert.equal(isFillableEntry({ name: "Cursed Bite", system: { slug: "cursed-bite" } }), false, "other abilities are not filled");

// Level -1, creature size med: default scales (high for constrict/trample, moderate for the rest).
{
  const med = { level: -1, size: "med", strikes: [TUSK, CLAW] };
  const f = fillPlaceholderAbility(item("Constrict", CONSTRICT), med);
  assert.equal(HEAD(f.system.description.value), "<p>@Damage[(1d4)[bludgeoning]], @Check[fortitude|dc:16|basic]</p>");
  const g2 = fillPlaceholderAbility(item("Greater Constrict", GREATER_CONSTRICT), med);
  assert.equal(HEAD(g2.system.description.value), "<p>@Damage[(1d4)[bludgeoning]], @Check[fortitude|dc:16|basic|options:inflicts:unconscious]</p>");
  const sw = fillPlaceholderAbility(item("Swallow Whole", SWALLOW_WHOLE), med);
  assert.equal(HEAD(sw.system.description.value), "<p>Small, @Damage[(1d4)[bludgeoning]], Rupture 2</p>");
  const en = fillPlaceholderAbility(item("Engulf", ENGULF), med);
  assert.equal(HEAD(en.system.description.value), "<p>@Check[reflex|dc:13|options:damaging-effect,inflicts:grabbed,inflicts:slowed], @Damage[(1d4)[bludgeoning]] damage, [[/act escape dc=13]], Rupture 2</p>");
  const tr = fillPlaceholderAbility(item("Trample", TRAMPLE), med);
  assert.equal(HEAD(tr.system.description.value), "<p>Small or smaller, Tusk, @Check[reflex|dc:16|basic]</p>");
  const fp = fillPlaceholderAbility(item("Frightful Presence", FRIGHTFUL_PRESENCE, FRIGHTFUL_RULES), med);
  assert.equal(HEAD(fp.system.description.value), "<p>90 feet. @Check[will|dc:13|options:area-effect,inflicts:frightened]</p>");
  assert.equal(fp.system.rules[0].radius, 90, "frightful aura radius 90");
  const st = fillPlaceholderAbility(item("Stench", STENCH, STENCH_RULES), med);
  assert.equal(HEAD(st.system.description.value), "<p>30 feet. @Check[fortitude|dc:13|options:area-effect,inflicts:sickened,inflicts:slowed]</p>");
  assert.equal(st.system.rules[0].radius, 30, "stench aura radius 30");
}

// Level 7, creature size lg: AI overrides for DC scale and damage type, default otherwise.
{
  const lg = { level: 7, size: "lg", strikes: [CLAW, TUSK] };
  const c = fillPlaceholderAbility(item("Constrict", CONSTRICT), lg);
  assert.equal(HEAD(c.system.description.value), "<p>@Damage[(4d6)[bludgeoning]], @Check[fortitude|dc:25|basic]</p>");
  const gc = fillPlaceholderAbility(item("Greater Constrict", GREATER_CONSTRICT), { ...lg, damageType: "fire" });
  assert.equal(HEAD(gc.system.description.value), "<p>@Damage[(4d6)[fire]], @Check[fortitude|dc:25|basic|options:inflicts:unconscious]</p>", "greater constrict takes a valid AI type");
  const sw = fillPlaceholderAbility(item("Swallow Whole", SWALLOW_WHOLE), lg);
  assert.equal(HEAD(sw.system.description.value), "<p>Medium, @Damage[(4d6)[bludgeoning]], Rupture 15</p>");
  const en = fillPlaceholderAbility(item("Engulf", ENGULF), { ...lg, abilityDcScale: "moderate", damageType: "acid" });
  assert.equal(HEAD(en.system.description.value), "<p>@Check[reflex|dc:22|options:damaging-effect,inflicts:grabbed,inflicts:slowed], @Damage[(4d6)[acid]] damage, [[/act escape dc=22]], Rupture 15</p>", "engulf takes the AI type; escape DC equals the DC");
  const tr = fillPlaceholderAbility(item("Trample", TRAMPLE), lg);
  assert.equal(HEAD(tr.system.description.value), "<p>Medium or smaller, Tusk, @Check[reflex|dc:25|basic]</p>", "strike = highest average melee strike");
  const fp = fillPlaceholderAbility(item("Frightful Presence", FRIGHTFUL_PRESENCE, FRIGHTFUL_RULES), { ...lg, abilityDcScale: "high" });
  assert.equal(HEAD(fp.system.description.value), "<p>90 feet. @Check[will|dc:25|options:area-effect,inflicts:frightened]</p>", "AI abilityDcScale overrides the default");
  const st = fillPlaceholderAbility(item("Stench", STENCH, STENCH_RULES), lg);
  assert.equal(HEAD(st.system.description.value), "<p>30 feet. @Check[fortitude|dc:22|options:area-effect,inflicts:sickened,inflicts:slowed]</p>");
}

// Level 24, creature size huge: invalid AI values are ignored (defaults used).
{
  const huge = { level: 24, size: "huge", strikes: [TUSK], abilityDcScale: "extreme", damageType: "plasma" };
  const c = fillPlaceholderAbility(item("Constrict", CONSTRICT), huge);
  assert.equal(HEAD(c.system.description.value), "<p>@Damage[(11d6)[bludgeoning]], @Check[fortitude|dc:48|basic]</p>", "extreme abilityDcScale and plasma ignored");
  const en = fillPlaceholderAbility(item("Engulf", ENGULF), huge);
  assert.equal(HEAD(en.system.description.value), "<p>@Check[reflex|dc:45|options:damaging-effect,inflicts:grabbed,inflicts:slowed], @Damage[(11d6)[bludgeoning]] damage, [[/act escape dc=45]], Rupture 39</p>");
  const sw = fillPlaceholderAbility(item("Swallow Whole", SWALLOW_WHOLE), huge);
  assert.equal(HEAD(sw.system.description.value), "<p>Large, @Damage[(11d6)[bludgeoning]], Rupture 39</p>");
  const tr = fillPlaceholderAbility(item("Trample", TRAMPLE), huge);
  assert.equal(HEAD(tr.system.description.value), "<p>Large or smaller, Tusk, @Check[reflex|dc:48|basic]</p>");
  const st = fillPlaceholderAbility(item("Stench", STENCH, STENCH_RULES), huge);
  assert.equal(HEAD(st.system.description.value), "<p>30 feet. @Check[fortitude|dc:45|options:area-effect,inflicts:sickened,inflicts:slowed]</p>");
}

// Published text outside the placeholder tokens is kept byte for byte.
{
  const out = fillPlaceholderAbility(item("Swallow Whole", SWALLOW_WHOLE), { level: 7, size: "lg", strikes: [] });
  assert.equal(TAIL(out.system.description.value), TAIL(SWALLOW_WHOLE), "the localized tail is unchanged");
}

// Fail closed.
assert.equal(fillPlaceholderAbility(item("Swallow Whole", SWALLOW_WHOLE), { level: 7, size: "tiny", strikes: [] }), null, "tiny cannot take a smaller size");
assert.equal(fillPlaceholderAbility(item("Trample", TRAMPLE), { level: 7, size: "med", strikes: [] }), null, "no melee strike for trample");
assert.equal(fillPlaceholderAbility(item("Trample", TRAMPLE), { level: 7, size: "med", strikes: [{ name: "Ray", damage: "2d6", type: "ranged" }] }), null, "ranged strikes do not count");
assert.equal(HEAD(fillPlaceholderAbility(item("Trample", TRAMPLE), { level: 7, size: "sm", strikes: [TUSK] }).system.description.value), "<p>Tiny or smaller, Tusk, @Check[reflex|dc:25|basic]</p>", "small takes Tiny or smaller");
assert.equal(fillPlaceholderAbility(item("Trample", TRAMPLE), { level: 7, size: "bogus", strikes: [TUSK] }), null, "unknown size");
assert.equal(fillPlaceholderAbility(item("Trample", TRAMPLE), { level: 30, size: "lg", strikes: [TUSK] }), null, "level out of range");
assert.equal(fillPlaceholderAbility(item("Cursed Bite", SWALLOW_WHOLE), { level: 7, size: "lg", strikes: [] }), null, "slug decides, not the text");
assert.equal(fillPlaceholderAbility(item("Stench", STENCH, []), { level: 7, size: "lg", strikes: [] }), null, "stench without its aura rule is not filled");

// Input is not mutated.
{
  const input = item("Stench", STENCH, STENCH_RULES);
  const before = structuredClone(input);
  fillPlaceholderAbility(input, { level: 7, size: "lg", strikes: [] });
  assert.deepEqual(input, before, "input unchanged");
}

// Output passes the placeholder check for every fillable ability.
for (const [name, desc, rules] of [["Constrict", CONSTRICT, []], ["Greater Constrict", GREATER_CONSTRICT, []], ["Swallow Whole", SWALLOW_WHOLE, []], ["Engulf", ENGULF, []], ["Trample", TRAMPLE, []], ["Frightful Presence", FRIGHTFUL_PRESENCE, FRIGHTFUL_RULES], ["Stench", STENCH, STENCH_RULES]]) {
  for (const level of [-1, 7, 24]) {
    const out = fillPlaceholderAbility(item(name, desc, rules), { level, size: "lg", strikes: [TUSK] });
    assert.ok(out, `${name} fills at level ${level}`);
    assert.equal(hasPlaceholderValues(out), false, `${name} at level ${level} has no placeholders`);
  }
}

// Post-check: a stray placeholder outside the expected tokens fails closed.
assert.equal(fillPlaceholderAbility(item("Swallow Whole", SWALLOW_WHOLE + "<p>[0]</p>"), { level: 7, size: "lg", strikes: [] }), null, "stray placeholder fails closed");

// fillBlocker: the same checks resolveConcept applies before a pick is kept.
assert.equal(fillBlocker(item("Swallow Whole", SWALLOW_WHOLE), { level: 7, size: "tiny" }), "size tiny has no smaller size");
assert.equal(fillBlocker(item("Trample", TRAMPLE), { level: 7, size: "lg", strikes: [{ name: "Ray", damage: "2d6", type: "ranged" }] }), "no melee Strike");
assert.equal(fillBlocker(item("Trample", TRAMPLE), { level: 25, size: "lg", strikes: [TUSK] }), "level 25 is outside the tables");
assert.equal(fillBlocker(item("Engulf", ENGULF), { level: -2, size: "med" }), "level -2 is outside the tables");
assert.equal(fillBlocker(item("Engulf", ENGULF), { level: 7, size: "tiny" }), null, "engulf needs no size");
assert.equal(fillBlocker(item("Trample", TRAMPLE), { level: 7, size: "lg", strikes: [TUSK] }), null, "fillable");
assert.equal(fillBlocker(item("Cursed Bite", SWALLOW_WHOLE), { level: 7, size: "lg" }), "not a fillable ability");

// resolveConcept: an unfillable pick is caught before the preview, with a warning.
{
  const docs = {
    "swallow-whole": { name: "Swallow Whole", text: SWALLOW_WHOLE },
    trample: { name: "Trample", text: TRAMPLE }
  };
  const pack = {
    async getIndex() {
      return Object.entries(docs).map(([id, d]) => ({ _id: id, name: d.name, type: "action", system: { traits: { value: [] }, actionType: { value: "passive" } } }));
    },
    async getDocument(id) {
      const d = docs[id];
      if (!d) return null;
      const data = { name: d.name, type: "action", system: { description: { value: d.text }, rules: [] } };
      return { ...data, uuid: `Compendium.sf2e.bestiary-ability-glossary-srd.Item.${id}`, toObject: () => structuredClone(data) };
    }
  };
  globalThis.game = { settings: { get: () => ({}) }, packs: new Map([["sf2e.bestiary-ability-glossary-srd", pack]]) };
  const { resolveConcept, normalizeConcept } = await import("./builder.mjs");
  const warnings = [];
  const original = console.warn;
  console.warn = (message) => warnings.push(String(message));
  try {
    const tiny = normalizeConcept({ level: 7, size: "tiny", specialAbilities: [{ name: "Swallow Whole", glossary: "Swallow Whole", description: "It swallows the foe whole." }] }, { level: 7, rarity: "common" });
    const tinyResolved = await resolveConcept(tiny);
    assert.equal(tinyResolved.abilities[0].entry, null, "tiny creature: the swallow pick is not resolved");
    assert.equal(tinyResolved.abilities[0].ability.narrative, true, "its thematic text stays narrative-only");
    assert.ok(warnings.some((w) => /"Swallow Whole" cannot be filled for this creature: size tiny has no smaller size/.test(w)), "the unfillable pick is named");

    const large = normalizeConcept({ level: 7, size: "lg", specialAbilities: [{ name: "Swallow Whole", glossary: "Swallow Whole", description: "It swallows the foe whole." }] }, { level: 7, rarity: "common" });
    const largeResolved = await resolveConcept(large);
    assert.ok(largeResolved.abilities[0].entry, "a fillable pick stays resolved for the build to fill");
    assert.equal(warnings.length, 1, "no warning for a fillable pick");

    const ranged = normalizeConcept({ level: 7, size: "lg", strikes: [{ name: "Ray", type: "ranged", damage: "2d6", damageType: "fire", range: 30 }], specialAbilities: [{ name: "Trample", glossary: "Trample", description: "It tramples." }] }, { level: 7, rarity: "common" });
    const rangedResolved = await resolveConcept(ranged);
    assert.equal(rangedResolved.abilities[0].entry, null, "trample with only ranged strikes is not resolved");
    assert.ok(warnings.some((w) => /"Trample" cannot be filled for this creature: no melee Strike/.test(w)), "the trample pick is named");
  } finally {
    console.warn = original;
  }
}

console.log("ability-fill.test.mjs: ok");
