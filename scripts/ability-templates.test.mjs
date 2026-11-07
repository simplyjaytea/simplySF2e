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

// Inline syntax in the AI name cannot inject a roll: the recharge roll closes once.
{
  const closed = await buildFromRaw(7, { name: "Blast]]", description: "", template: "area-blast", shape: "cone", use: "limited", damageType: "fire" });
  assert.ok(closed.item.system.description.value.includes("It can't use Blast again for [[/gmr 1d4 #Recharge Blast]]{1d4 rounds}.</p>"));
  assert.equal(closed.item.system.description.value.split("[[").length - 1, 1, "one roll");
  const injected = await buildFromRaw(7, { name: "[[/r 1d20]]", description: "", template: "area-blast", shape: "cone", use: "limited", damageType: "fire" });
  assert.ok(injected.item.system.description.value.includes("It can't use /r 1d20 again for [[/gmr 1d4 #Recharge /r 1d20]]{1d4 rounds}.</p>"));
  assert.equal(injected.item.system.description.value.split("[[").length - 1, 1, "no injected roll");
}

// Flavor is HTML-escaped, never live markup.
{
  const m = await buildFromRaw(7, { name: "Blast", description: "<i>Gust</i>", template: "area-blast", shape: "cone", damageType: "fire" });
  assert.match(m.item.system.description.value, /^<p>&lt;i&gt;Gust&lt;\/i&gt; The creature deals/);
}

// Flavor that carries enricher or roll syntax is omitted.
for (const flavor of ["Gust @Check[reflex|dc:16|basic] save.", "Gust @Template[type:cone|distance:90] here.", "Gust @UUID[x]{hi}."]) {
  const m = await buildFromRaw(7, { name: "Blast", description: flavor, template: "area-blast", shape: "cone", damageType: "fire" });
  assert.match(m.item.system.description.value, /^<p>The creature deals @Damage\[4d6\[fire\]/, `flavor omitted: ${flavor}`);
  assert.ok(!m.item.system.description.value.includes("Gust"), "no flavor text");
}

// A narrative-only ability's text is cleaned of enricher syntax.
{
  const { narrativeAbilityItem } = await import("./builder.mjs");
  const item = narrativeAbilityItem({ name: "Hiss", description: "It hisses @Check[reflex] and [[/r 1d20]] here." });
  const value = item.system.description.value;
  assert.ok(!/@[A-Za-z]+\[/.test(value), "no live enricher");
  assert.ok(!/\[\[/.test(value), "no live roll");
  assert.ok(value.replaceAll("\u200B", "").includes("It hisses @Check[reflex] and [[/r 1d20]] here."), "visible text kept");
}

// A template with a glossary name keeps only the template (glossary cleared at normalize).
{
  const concept = normalizeConcept({ specialAbilities: [{ name: "Stench", glossary: "Stench", description: "", template: "area-blast", shape: "cone", damageType: "fire" }] }, { level: 7, rarity: "common" });
  assert.equal(concept.specialAbilities[0].glossary, null, "a valid template clears the glossary name");
  assert.ok(concept.specialAbilities[0].areaBlast, "the template spec is kept");
}

// refineCreatureAbilities (T-BLAST-FIX2): templates never reach the selector and keep their
// slots; glossary picks get the remaining budget on every path. Inputs are normalized.
{
  const { refineCreatureAbilities } = await import("./creature-pipeline.mjs");
  const names = ["Darkvision", "All-Around Vision", "Aquatic Ambush", "Fast Healing", "Constant Spells", "Change Shape"];
  const pack = {
    async getIndex() { return names.map((name, i) => ({ _id: `g${i}`, name, type: "action", system: { traits: { value: [] }, actionType: { value: "passive" } } })); },
    async getDocument(id) {
      const i = Number(id.slice(1));
      const data = { name: names[i], type: "action", system: { description: { value: "<p>It acts.</p>" }, rules: [] } };
      return { ...data, uuid: `Compendium.test.refine.Item.${id}`, toObject: () => structuredClone(data) };
    }
  };
  const emptyPack = { async getIndex() { return []; }, async getDocument() { return null; } };
  const tmpl = (name) => ({ name, description: "Gust.", template: "area-blast", shape: "cone", damageType: "fire" });
  const glossary = (name) => ({ name, glossary: name, description: "" });
  const pick = (c) => ({ name: c.name, glossary: c.name, candidate: c.ref, description: "", narrative: false, actionType: "passive", actions: null, traits: [], abilityDcScale: null, damageType: null });
  const run = async (raw, { packId = "test.refine-abilities", selector, throws = false }) => {
    globalThis.game = { settings: { get: () => ({ abilities: [packId] }) }, packs: new Map([[packId, packId === "test.refine-abilities" ? pack : emptyPack]]) };
    const concept = normalizeConcept(raw, { level: raw.level, rarity: "common" });
    const ai = {
      selectCreatureAbilities: async (args) => {
        if (throws) throw new Error("selector down");
        return selector(args);
      }
    };
    await refineCreatureAbilities(concept, { ai, labels: {}, onTokens: () => {} });
    return concept.specialAbilities;
  };
  const onlyPicks = async ({ candidates }) => ({ abilities: candidates.slice(0, 6).map(pick), usage: null, timing: null });

  // Six templates: the selector never sees them, and six published picks cannot replace them.
  const six = ["A", "B", "C", "D", "E", "F"].map((letter) => tmpl(`Breath ${letter}`));
  let selectorInput = null;
  const allTemplates = await run({ level: 7, size: "lg", specialAbilities: six }, {
    selector: async (args) => {
      selectorInput = args;
      return onlyPicks(args);
    }
  });
  assert.ok(selectorInput, "the selector ran");
  assert.equal(selectorInput.concept.specialAbilities.length, 0, "the selector concept has no templates");
  assert.ok(selectorInput.candidates.every((c) => !/Breath/.test(c.name)), "no template keyword reaches the candidates");
  assert.equal(allTemplates.length, 6, "six templates survive a full six-pick selection");
  assert.ok(allTemplates.every((a) => a.areaBlast && a.name.startsWith("Breath")), "all six are the templates");

  // Two templates and four glossary drafts: the selector returns six picks, only four are kept.
  const mixed = [tmpl("Breath A"), tmpl("Breath B"), glossary("Darkvision"), glossary("All-Around Vision"), glossary("Aquatic Ambush"), glossary("Fast Healing")];
  const kept = await run({ level: 7, size: "lg", specialAbilities: mixed }, { selector: onlyPicks });
  assert.equal(kept.filter((a) => a.areaBlast).length, 2, "two templates kept");
  assert.equal(kept.filter((a) => !a.areaBlast).length, 4, "glossary picks limited to the remaining four slots");
  assert.equal(kept.length, 6);

  // Catch path: the same budget.
  const caught = await run({ level: 7, size: "lg", specialAbilities: mixed }, { throws: true });
  assert.equal(caught.filter((a) => a.areaBlast).length, 2, "catch path keeps the templates");
  assert.equal(caught.length, 6, "catch path keeps the budget");

  // No candidates: the same budget.
  const none = await run({ level: 7, size: "lg", specialAbilities: [tmpl("Breath A"), tmpl("Breath B"), glossary("Darkvision"), glossary("Fast Healing"), glossary("Change Shape"), glossary("Aquatic Ambush")] }, { packId: "test.empty-abilities" });
  assert.equal(none.filter((a) => a.areaBlast).length, 2, "no-candidates path keeps the templates");
  assert.equal(none.length, 6, "no-candidates path keeps the budget");
}

// buildAreaBlast guard on its own: flavor with enricher syntax is blanked there too.
{
  const spec = normalizeAreaBlast({ template: "area-blast", shape: "cone", damageType: "fire" });
  const item = buildAreaBlast(spec, { level: 7, name: "Blast", flavor: "Gust @Check[reflex|dc:16|basic] save." });
  const value = item.system.description.value;
  const flavorPart = value.split("The creature deals")[0];
  assert.ok(!flavorPart.includes("@"), "no @ from the flavor");
  assert.ok(!value.includes("Gust"), "the flavor text is dropped by the guard");
  assert.match(value, /^<p>The creature deals @Damage\[4d6\[fire\]/);
}

console.log("ability-templates.test.mjs: ok");
