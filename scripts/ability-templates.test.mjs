// Area Blast template (T-BLAST): AI-shaped concepts go through the real
// normalizeConcept and resolveConcept; the item is built by buildAreaBlast with
// the normalized spec, as createActor does. Expected strings are hand-written
// from the approved rules B1-B5 and the cited tables (GM Core pg. 126/128).
//
// Run: node scripts/ability-templates.test.mjs

import assert from "node:assert/strict";
import { buildAreaBlast, normalizeAreaBlast } from "./ability-templates.mjs";
import { hasPlaceholderValues } from "./ability-fill.mjs";

globalThis.game = { settings: { get: () => ({}) }, packs: new Map() };
const { normalizeConcept, resolveConcept } = await import("./builder.mjs");

// Production path: raw AI concept -> normalizeConcept -> resolveConcept -> build.
async function buildFromRaw(level, ability) {
  const concept = normalizeConcept({ level, specialAbilities: [ability] }, { level, rarity: "common" });
  const resolved = await resolveConcept(concept);
  const { ability: normalized, entry } = resolved.abilities[0];
  assert.equal(entry, null, "a template needs no compendium entry");
  assert.notEqual(normalized.narrative, true, "a template is not narrative");
  if (!normalized.areaBlast) return { normalized, item: null };
  const item = buildAreaBlast(normalized.areaBlast, { level: concept.level, name: normalized.name, flavor: normalized.description });
  return { normalized, item };
}

// B2/B3/B1 with the limited sentence: cone, medium (30 ft), limited, high DC.
const CONE_LIMITED = (level) => ({ name: "Blast", description: "Searing gust.", template: "area-blast", shape: "cone", use: "limited", damageType: "fire" });
{
  const m1 = await buildFromRaw(-1, CONE_LIMITED(-1));
  assert.equal(m1.item.system.description.value,
    "<p>Searing gust. The creature deals @Damage[1d6[fire]|options:area-damage] damage in a @Template[type:cone|distance:30] (@Check[reflex|dc:16|basic|options:area-effect] save). It can't use Blast again for [[/gmr 1d4 #Recharge Blast]]{1d4 rounds}.</p>");
  const m7 = await buildFromRaw(7, CONE_LIMITED(7));
  assert.equal(m7.item.system.description.value,
    "<p>Searing gust. The creature deals @Damage[8d6[fire]|options:area-damage] damage in a @Template[type:cone|distance:30] (@Check[reflex|dc:25|basic|options:area-effect] save). It can't use Blast again for [[/gmr 1d4 #Recharge Blast]]{1d4 rounds}.</p>");
  const m24 = await buildFromRaw(24, CONE_LIMITED(24));
  assert.equal(m24.item.system.description.value,
    "<p>Searing gust. The creature deals @Damage[25d6[fire]|options:area-damage] damage in a @Template[type:cone|distance:30] (@Check[reflex|dc:48|basic|options:area-effect] save). It can't use Blast again for [[/gmr 1d4 #Recharge Blast]]{1d4 rounds}.</p>");
}

// Line, at-will (no recharge sentence), defaults for size, save and DC scale.
{
  const m = await buildFromRaw(7, { name: "Spray", description: "Sour spray.", template: "area-blast", shape: "line", damageType: "acid" });
  assert.deepEqual(m.normalized.areaBlast, { shape: "line", size: "medium", save: "reflex", use: "at-will", damageType: "acid", abilityDcScale: "high" }, "defaults");
  assert.equal(m.item.system.description.value,
    "<p>Sour spray. The creature deals @Damage[4d6[acid]|options:area-damage] damage in a @Template[type:line|distance:30] (@Check[reflex|dc:25|basic|options:area-effect] save).</p>");
  assert.deepEqual([m.item.type, m.item.system.actions.value, m.item.system.category, m.item.system.rules], ["action", 2, "offensive", []]);
}

// Large cone, fortitude, moderate DC, no flavor: flavor omitted, 60 ft.
{
  const m = await buildFromRaw(7, { name: "Frost Gust", template: "area-blast", shape: "cone", size: "large", save: "fortitude", abilityDcScale: "moderate", damageType: "cold" });
  assert.equal(m.item.system.description.value,
    "<p>The creature deals @Damage[4d6[cold]|options:area-damage] damage in a @Template[type:cone|distance:60] (@Check[fortitude|dc:22|basic|options:area-effect] save).</p>");
}

// Small line is 30 ft (B1), large line 60 ft.
{
  const small = await buildFromRaw(7, { name: "Hiss", template: "area-blast", shape: "line", size: "small", damageType: "poison" });
  assert.match(small.item.system.description.value, /@Template\[type:line\|distance:30\]/);
  const large = await buildFromRaw(7, { name: "Hiss", template: "area-blast", shape: "line", size: "large", damageType: "poison" });
  assert.match(large.item.system.description.value, /@Template\[type:line\|distance:60\]/);
}

// Every invalid enum, and a missing damage type, falls back (no spec).
for (const bad of [
  { shape: "burst" }, { size: "huge" }, { save: "fort" }, { use: "always" },
  { damageType: "plasma" }, { damageType: undefined }, { abilityDcScale: "extreme" }
]) {
  const raw = { name: "Blast", description: "Searing gust.", template: "area-blast", shape: "cone", damageType: "fire", ...bad };
  const concept = normalizeConcept({ specialAbilities: [raw] }, { level: 7, rarity: "common" });
  assert.equal(concept.specialAbilities[0].areaBlast, null, `invalid ${JSON.stringify(bad)} falls back`);
}
assert.equal(normalizeAreaBlast({ template: "area-blast", shape: "cone" }), null, "missing damageType falls back");
assert.equal(normalizeAreaBlast({ template: "other", shape: "cone", damageType: "fire" }), null, "not an area blast");

// Flavor that names dice is omitted; the template is still built.
{
  const m = await buildFromRaw(7, { name: "Blast", description: "It deals 2d6 fire damage.", template: "area-blast", shape: "cone", damageType: "fire" });
  assert.match(m.item.system.description.value, /^<p>The creature deals @Damage\[4d6\[fire\]/);
}

// Name is escaped in the description.
{
  const m = await buildFromRaw(7, { name: "<b>Breath</b>", description: "", template: "area-blast", shape: "cone", use: "limited", damageType: "fire" });
  assert.ok(m.item.system.description.value.includes("It can't use &lt;b&gt;Breath&lt;/b&gt; again for [[/gmr 1d4 #Recharge &lt;b&gt;Breath&lt;/b&gt;]]{1d4 rounds}."));
  assert.ok(!m.item.system.description.value.includes("<b>"));
}

// Level outside the tables: build returns null, so createActor falls back.
{
  const spec = normalizeAreaBlast({ template: "area-blast", shape: "cone", damageType: "fire" });
  assert.equal(buildAreaBlast(spec, { level: 25, name: "Blast" }), null, "level 25 is outside the tables");
  assert.equal(buildAreaBlast(spec, { level: -2, name: "Blast" }), null, "level -2 is outside the tables");
}

// No placeholder tokens in any built description.
for (const sample of [CONE_LIMITED(7), { name: "Spray", template: "area-blast", shape: "line", damageType: "acid" }]) {
  const m = await buildFromRaw(7, sample);
  assert.equal(hasPlaceholderValues(m.item), false, "built description has no placeholder");
}

console.log("ability-templates.test.mjs: ok");
