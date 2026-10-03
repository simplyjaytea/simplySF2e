// Reroll-one-pick grounding rules: same kind, same spell slot, no repeats.
import assert from "node:assert/strict";
import { rerollTarget, rerollPool, applyRerollPick, rerollKeywords } from "./reroll.mjs";

const ref = (id) => ({ packId: "sf2e.spells", _id: id });
const shock = ref("shock");
const concept = {
  name: "Storm Adept", level: 5, traits: ["humanoid", "electricity"],
  spellcasting: {
    tradition: "arcane", maxRank: 3,
    spells: [
      { name: "Electric Arc", candidate: ref("arc"), rank: 0 },
      { name: "Shock", candidate: shock, rank: 2 },
      { name: "Haste", candidate: ref("haste"), rank: 3 }
    ]
  },
  feats: [{ name: "Quick Draw", candidate: { packId: "sf2e.feats", _id: "qd" } }, "Unmatched Feat"],
  specialAbilities: [
    { name: "Grab", candidate: { packId: "sf2e.abilities", _id: "grab" } },
    { name: "Storm Aura", narrative: true, description: "Crackles." },
    { name: "Constrict", glossary: "Constrict" }
  ]
};
const spellCatalog = [
  { id: "S0", name: "Electric Arc", rank: 0, ref: ref("arc") },
  { id: "S1", name: "Light", rank: 0, ref: ref("light") },
  { id: "S2", name: "Shock", rank: 1, ref: ref("shock-copy") },
  { id: "S3", name: "Fear", rank: 1, ref: ref("fear") },
  { id: "S4", name: "Blur", rank: 2, ref: ref("blur") },
  { id: "S5", name: "Fireball", rank: 3, ref: ref("fireball") },
  { id: "S6", name: "Haste", rank: 3, ref: ref("haste-copy") },
  { id: "S7", name: "No Ref", rank: 1 }
];

// Targets: narrative abilities are flavor, everything else (even unmatched) can be swapped.
assert.equal(rerollTarget(concept, "ability", 1), null, "narrative-only abilities are not rerollable");
assert.ok(rerollTarget(concept, "ability", 0));
assert.ok(rerollTarget(concept, "ability", 2), "an unmatched glossary ability can be rerolled into a real one");
assert.equal(rerollTarget(concept, "feat", 1), "Unmatched Feat");
assert.equal(rerollTarget(concept, "spell", 9), null);
assert.equal(rerollTarget(concept, "spell", -1), null);
assert.equal(rerollTarget(concept, "loot", 0), null);
assert.equal(rerollTarget({ ...concept, spellcasting: null }, "spell", 0), null);

// Spell pools keep the slot: cantrip for cantrip, ranked within the slot rank.
assert.deepEqual(rerollPool(spellCatalog, { concept, kind: "spell", index: 0 }).map((c) => c.id), ["S1"]);
assert.deepEqual(rerollPool(spellCatalog, { concept, kind: "spell", index: 1 }).map((c) => c.id), ["S3", "S4"],
  "a rank-2 slot offers rank 1-2 spells not already known, and never a cantrip or a rank-3 spell");
assert.deepEqual(rerollPool(spellCatalog, { concept, kind: "spell", index: 2 }).map((c) => c.id), ["S3", "S4", "S5"]);
assert.deepEqual(
  rerollPool(spellCatalog, { concept, kind: "spell", index: 2, rejected: ["fireball"] }).map((c) => c.id), ["S3", "S4"],
  "names already rerolled away from in this slot are not offered again (case-insensitive)");
assert.deepEqual(rerollPool(spellCatalog, { concept, kind: "spell", index: 1 }).filter((c) => !c.ref), [],
  "entries without an issued reference are never offered");
assert.deepEqual(rerollPool(spellCatalog, { concept, kind: "ability", index: 1 }), [], "no pool for a narrative ability");

const featCatalog = [
  { id: "F0", name: "Quick Draw", ref: { packId: "sf2e.feats", _id: "qd" } },
  { id: "F1", name: "Reactive Shield", ref: { packId: "sf2e.feats", _id: "rs" } },
  { id: "F2", name: "reactive shield", ref: { packId: "sf2e.feats", _id: "rs2" } }
];
assert.deepEqual(rerollPool(featCatalog, { concept, kind: "feat", index: 1 }).map((c) => c.id), ["F1"],
  "feat pools drop current picks and duplicate names");

// Applying a pick replaces only that slot and leaves the input untouched.
const fear = spellCatalog[3];
const next = applyRerollPick(concept, { kind: "spell", index: 1, candidate: fear });
assert.deepEqual(next.spellcasting.spells[1], { name: "Fear", candidate: fear.ref, rank: 2 }, "the replacement keeps the slot rank");
assert.equal(next.spellcasting.spells[0], concept.spellcasting.spells[0], "other picks keep identity");
assert.equal(concept.spellcasting.spells[1].name, "Shock", "the original concept is unchanged");
assert.notEqual(next.spellcasting, concept.spellcasting);

const feat = applyRerollPick(concept, { kind: "feat", index: 1, candidate: featCatalog[1] });
assert.deepEqual(feat.feats[1], { name: "Reactive Shield", candidate: featCatalog[1].ref });
assert.equal(concept.feats[1], "Unmatched Feat");

const knockdown = { id: "A1", name: "Knockdown", ref: { packId: "sf2e.abilities", _id: "kd" } };
const ability = applyRerollPick(concept, { kind: "ability", index: 2, candidate: knockdown });
assert.deepEqual(ability.specialAbilities[2], { name: "Knockdown", candidate: knockdown.ref },
  "a rerolled ability carries no leftover draft glossary or prose");
assert.throws(() => applyRerollPick(concept, { kind: "ability", index: 1, candidate: knockdown }), TypeError);
assert.throws(() => applyRerollPick(concept, { kind: "feat", index: 0, candidate: { name: "X" } }), TypeError,
  "a replacement must carry an issued reference");

assert.deepEqual(rerollKeywords(concept, "ability", 2), ["constrict", "constrict", "humanoid", "electricity"]);
console.log("reroll: ok");
