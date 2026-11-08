// Reskin validation and copy: only prose and the display names of listed
// strikes/abilities change; renamed items keep their original slug because
// pf2e falls back to sluggify(name) when system.slug is null
// (v14-dev item/base/document.ts) and NPC attack effects key off that slug.
// Run: node scripts/reskin.test.mjs

import assert from "node:assert/strict";
import { normalizeReskin, applyReskin, reskinRenameTargets, pf2eSluggify, renameRechargeText } from "./reskin.mjs";
import { buildAreaBlast, normalizeAreaBlast, buildAura, normalizeAura } from "./ability-templates.mjs";
import { fillPlaceholderAbility } from "./ability-fill.mjs";
import { escAi } from "./text.mjs";

const source = {
  _id: "src", name: "Cave Bear", type: "npc",
  prototypeToken: { name: "Cave Bear" },
  system: {
    details: { level: { value: 5 }, blurb: "Big bear", publicNotes: "old" },
    attributes: { ac: { value: 21 }, hp: { value: 80, max: 80 } },
    traits: { value: ["animal"], rarity: "common" }
  },
  items: [
    { _id: "jaws", name: "Jaws", type: "melee", system: { slug: null, attackEffects: { value: ["grab"] } } },
    { _id: "grab", name: "Grab", type: "action", system: { slug: "grab" } },
    { _id: "maul", name: "Mauler's Rend", type: "action", system: {} },
    { _id: "sword", name: "Longsword", type: "weapon", system: { slug: "longsword" } },
    { _id: "spell", name: "Fear", type: "spell", system: {} }
  ]
};

assert.deepEqual(reskinRenameTargets(source).map((t) => t.id), ["jaws", "grab", "maul"],
  "only strikes and abilities are renameable");

const warn = console.warn;
console.warn = () => {};
const flavor = normalizeReskin({
  name: "  Hull <b>Ripper</b> ",
  blurb: "Void-touched boarding beast",
  description: "It smells of ozone.\n\nIt hunts in airlocks.",
  readAloud: "Metal screams.",
  recallKnowledge: "It fears magnetic fields.",
  renames: [
    { id: "jaws", name: "Shredder Mandibles" },
    { id: "jaws", name: "Second Try" },
    { id: "sword", name: "Plasma Blade" },
    { id: "ghost", name: "Invented" },
    { id: "grab", name: "Grab" },
    { id: "maul", name: "" },
    { id: "maul", name: "x".repeat(81) }
  ]
}, source);
console.warn = warn;

assert.equal(flavor.name, "Hull Ripper", "tags and spacing are stripped from the name");
assert.deepEqual(flavor.renames, [{ id: "jaws", from: "Jaws", name: "Shredder Mandibles" }],
  "duplicate, non-renameable, unknown, unchanged, empty, and overlong renames are dropped");

const data = applyReskin(source, { ...flavor, renames: [...flavor.renames, { id: "maul", name: "Hull Rend" }, { id: "sword", name: "Nope" }] }, {
  recallSkill: () => "nature", recallDC: () => 20
});
assert.equal(data._id, undefined);
assert.equal(data.name, "Hull Ripper");
assert.equal(data.prototypeToken.name, "Hull Ripper", "the token name follows the actor name");
assert.deepEqual(data.system.attributes, source.system.attributes, "statistics are untouched");
assert.deepEqual(data.system.traits, source.system.traits);
assert.equal(data.items.length, source.items.length);
const byId = Object.fromEntries(data.items.map((item) => [item._id, item]));
assert.equal(byId.jaws.name, "Shredder Mandibles");
assert.equal(byId.jaws.system.slug, "jaws", "a null slug is pinned to the original name's slug");
assert.deepEqual(byId.jaws.system.attackEffects, { value: ["grab"] });
assert.equal(byId.maul.name, "Hull Rend");
assert.equal(byId.maul.system.slug, "maulers-rend");
assert.equal(byId.grab.system.slug, "grab", "an existing slug is kept");
assert.equal(byId.sword.name, "Longsword", "physical items are never renamed");
assert.match(data.system.details.publicNotes, /<blockquote class="spf-read-aloud"><em>Metal screams\.<\/em><\/blockquote>/);
assert.match(data.system.details.publicNotes, /<p>It smells of ozone\.<\/p><p>It hunts in airlocks\.<\/p>/);
assert.match(data.system.details.publicNotes, /@Check\[type:nature\|dc:20\]: It fears magnetic fields\./);
assert.equal(source.name, "Cave Bear", "the source data is not mutated");
assert.equal(source.items[0].name, "Jaws");

const escaped = applyReskin(source, { description: "<script>x</script>", readAloud: "<img src=x>" });
assert.ok(!escaped.system.details.publicNotes.includes("<script>"), "AI prose is escaped");
assert.ok(!escaped.system.details.publicNotes.includes("<img"), "AI read-aloud is escaped");
// The blurb is a plain-text input value that pf2e escapes itself, so escaping
// it here would show "&amp;" on the sheet.
assert.equal(applyReskin(source, { blurb: "Salt & rust" }).system.details.blurb, "Salt & rust");

// Port parity with pf2e sluggify on names Foundry content actually uses.
assert.equal(pf2eSluggify("Mauler's Rend"), "maulers-rend");
assert.equal(pf2eSluggify("Attack of Opportunity"), "attack-of-opportunity");
assert.equal(pf2eSluggify("Ferocity (Constant)"), "ferocity-constant");
assert.equal(pf2eSluggify("AutoFire"), "auto-fire");

console.log("reskin.test.mjs: reskin changes fiction and display names only");

// Renaming a limited area blast keeps its recharge sentence and roll in step (Flame Breath -> Frost Breath).
{
  const spec = normalizeAreaBlast({ template: "area-blast", shape: "cone", use: "limited", damageType: "fire" });
  const blast = { ...buildAreaBlast(spec, { level: 7, name: "Flame Breath", flavor: "" }), _id: "b1" };
  const before = blast.system.description.value;
  const data = applyReskin({ name: "Dragon", type: "npc", items: [blast] }, { renames: [{ id: "b1", name: "Frost Breath" }] });
  const after = data.items[0].system.description.value;
  assert.equal(data.items[0].name, "Frost Breath");
  assert.equal(after, before.split("It can't use Flame Breath again for [[/gmr 1d4 #Recharge Flame Breath]]{1d4 rounds}.").join("It can't use Frost Breath again for [[/gmr 1d4 #Recharge Frost Breath]]{1d4 rounds}."), "only the recharge text changes");
  assert.ok(!after.includes("Flame Breath"), "no stale name");
  assert.equal(renameRechargeText("<p>plain text</p>", "Flame Breath", "Frost Breath"), "<p>plain text</p>", "unrelated text untouched");
}

// Renaming an aura keeps its immunity sentence in step with the new name.
{
  const spec = normalizeAura({ template: "aura", kind: "condition", condition: "sickened" });
  const item = { ...buildAura(spec, { level: 8, name: "Foul Air", flavor: "" }), _id: "a1" };
  const data = applyReskin({ name: "Vapor", type: "npc", items: [item] }, { renames: [{ id: "a1", name: "Foul Gas" }] });
  const text = data.items[0].system.description.value;
  assert.ok(text.includes("temporarily immune to Foul Gas for 1 minute."), "immunity sentence uses the new name");
  assert.ok(!text.includes("Foul Air"), "no stale aura name");
  assert.ok(text.startsWith("<p>30 feet. A creature that enters"), "the rest of the text is unchanged");
}

// A rename whose cleaned name is empty keeps the builders' fallback names in each sentence.
{
  const blast = "It can't use Flame Breath again for [[/gmr 1d4 #Recharge Flame Breath]]{1d4 rounds}.";
  assert.equal(renameRechargeText(blast, "Flame Breath", "[[]]"), "It can't use Area Blast again for [[/gmr 1d4 #Recharge Area Blast]]{1d4 rounds}.", "blast fallback");
  const aura = "temporarily immune to Foul Air for 1 minute.";
  assert.equal(renameRechargeText(aura, "Foul Air", "[[]]"), "temporarily immune to Aura for 1 minute.", "aura fallback");
}

// Trample: a melee Strike renamed by Reskin is renamed inside the module-filled Trample text.
// An unflagged copy (published creature) and a non-melee rename leave the text alone.
{
  const TRAMPLE = "<p>[Size], [Listed Strike], @Check[reflex|dc:|basic]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.Trample]</p>";
  const HOOF = { name: "Hoof", damage: "2d12+6", type: "melee" };
  const TUSK = { name: "Tusk", damage: "1d8+2", type: "melee" };
  const trampleItem = { name: "Trample", type: "action", system: { description: { value: TRAMPLE }, rules: [] } };
  // Production fill for a given melee strike (Hoof has the highest average damage).
  const fillWith = (strike) => fillPlaceholderAbility(trampleItem, { level: 7, size: "lg", strikes: [strike, TUSK] });
  const filled = fillWith(HOOF);
  assert.ok(filled, "trample fills from the melee strikes");
  // Provenance shape as builder.mjs:1797-1802 stamps it (withBuildProvenance is not exported).
  const built = { kind: "glossary-fill", spec: { slug: "trample", abilityDcScale: null, damageType: null }, name: "Trample", source: null };
  const actor = {
    name: "Mammoth", type: "npc",
    items: [
      { _id: "hoof", name: "Hoof", type: "melee", system: { slug: null, attackEffects: { value: [] } } },
      { _id: "tusk", name: "Tusk", type: "melee", system: { slug: null, attackEffects: { value: [] } } },
      { _id: "roar", name: "Roar", type: "action", system: { description: { value: "<p>Loud.</p>" }, rules: [] } },
      // Separate deep copies: a shallow spread would alias system and let the flagged copy's edit leak.
      { ...structuredClone(filled), _id: "tr", flags: { simplysf2e: { built } } },
      { ...structuredClone(filled), _id: "tr-published" }
    ]
  };
  const byId = (data, id) => data.items.find((item) => item._id === id);
  const originalText = filled.system.description.value;

  const renamed = applyReskin(actor, { renames: [{ id: "hoof", name: "Hoof & <Horn>" }] });
  const text = byId(renamed, "tr").system.description.value;
  assert.equal(text, fillWith({ ...HOOF, name: "Hoof & <Horn>" }).system.description.value, "trample names the renamed strike exactly as the production fill would");
  assert.ok(text.includes(escAi("Hoof & <Horn>")), "trample has the escaped new strike name");
  assert.ok(!text.includes(`${escAi("Hoof")}, @Check`), "trample no longer names the old strike");
  assert.equal(byId(renamed, "tr-published").system.description.value, originalText, "unflagged trample is unchanged");

  const roared = applyReskin(actor, { renames: [{ id: "roar", name: "Bellow" }] });
  assert.equal(byId(roared, "tr").system.description.value, originalText, "renaming a non-melee item changes no trample text");
}

// Trample rename edge cases, each with the production fill: chained renames in one Reskin,
// and a short Strike name that is a substring of the check.
{
  const TRAMPLE = "<p>[Size], [Listed Strike], @Check[reflex|dc:|basic]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.Trample]</p>";
  const trampleItem = { name: "Trample", type: "action", system: { description: { value: TRAMPLE }, rules: [] } };
  const built = { kind: "glossary-fill", spec: { slug: "trample", abilityDcScale: null, damageType: null }, name: "Trample", source: null };
  const fillFor = (strikes) => fillPlaceholderAbility(trampleItem, { level: 7, size: "lg", strikes });
  const actorWith = (strikes, filled) => ({
    name: "Mammoth", type: "npc",
    items: [
      ...strikes.map((s) => ({ _id: s.id, name: s.name, type: "melee", system: { slug: null, attackEffects: { value: [] } } })),
      { ...structuredClone(filled), _id: "tr", flags: { simplysf2e: { built } } },
      { ...structuredClone(filled), _id: "tr-published" }
    ]
  });
  const byId = (data, id) => data.items.find((item) => item._id === id);
  const HOOF = { name: "Hoof", damage: "2d12+6", type: "melee" };
  const TUSK = { name: "Tusk", damage: "1d8+2", type: "melee" };

  // (a) Hoof -> Tusk and Tusk -> Horn in one Reskin: the Trample names the Strike that was Hoof, once.
  const hoofFilled = fillFor([HOOF, TUSK]);
  const hoofOriginal = hoofFilled.system.description.value;
  const chainActor = actorWith([{ id: "hoof", ...HOOF }, { id: "tusk", ...TUSK }], hoofFilled);
  const chained = applyReskin(chainActor, { renames: [{ id: "hoof", name: "Tusk" }, { id: "tusk", name: "Horn" }] });
  const chainedText = byId(chained, "tr").system.description.value;
  assert.equal(chainedText, fillFor([{ ...HOOF, name: "Tusk" }, { ...TUSK, name: "Horn" }]).system.description.value,
    "chained renames name the Strike once: Tusk, not Horn");
  assert.ok(chainedText.includes(escAi("Tusk")), "trample names Tusk");
  assert.ok(!chainedText.includes(escAi("Horn")), "trample does not name Horn");
  assert.equal(byId(chained, "tr-published").system.description.value, hoofOriginal, "unflagged trample is unchanged");

  // (b) A melee Strike named "dc" renamed to "Spur": only the Strike slot changes, the check stays intact.
  const DC = { name: "dc", damage: "2d12+6", type: "melee" };
  const dcFilled = fillFor([DC, TUSK]);
  const dcOriginal = dcFilled.system.description.value;
  const check = dcOriginal.match(/@Check\[[^\]]*\]/)[0];
  const dcActor = actorWith([{ id: "dc", ...DC }, { id: "tusk", ...TUSK }], dcFilled);
  const spurred = applyReskin(dcActor, { renames: [{ id: "dc", name: "Spur" }] });
  const spurText = byId(spurred, "tr").system.description.value;
  assert.ok(spurText.includes(check), "the @Check text keeps its dc value");
  assert.equal(spurText, fillFor([{ ...DC, name: "Spur" }, TUSK]).system.description.value, "trample names Spur exactly as a fresh fill");
  assert.equal(spurText, dcOriginal.replace(`, ${escAi("dc")}, @Check[`, `, ${escAi("Spur")}, @Check[`), "only the Strike slot is rewritten");
  assert.equal(byId(spurred, "tr-published").system.description.value, dcOriginal, "unflagged trample is unchanged");
}
