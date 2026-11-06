// Reskin validation and copy: only prose and the display names of listed
// strikes/abilities change; renamed items keep their original slug because
// pf2e falls back to sluggify(name) when system.slug is null
// (v14-dev item/base/document.ts) and NPC attack effects key off that slug.
// Run: node scripts/reskin.test.mjs

import assert from "node:assert/strict";
import { normalizeReskin, applyReskin, reskinRenameTargets, pf2eSluggify, renameRechargeText } from "./reskin.mjs";
import { buildAreaBlast, normalizeAreaBlast, buildAura, normalizeAura } from "./ability-templates.mjs";

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
