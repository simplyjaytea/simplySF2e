// An issued candidate ref carries only {packId, _id}. resolveConcept must read
// the spell's real rank/traits from its index entry (cantrip stays rank 0, a
// higher-ranked spell clamps up), and a spell gem whose rank template is not
// installed is dropped at resolve (the same decision buildLootItems makes).
// Run: node scripts/builder.issuedSpellRefs.test.mjs
import assert from "node:assert/strict";

const spellIndex = [
  { _id: "ray", name: "Ray of Frost", type: "spell", system: { level: { value: 1 }, traits: { value: ["cantrip", "cold"], traditions: ["arcane"] } } },
  { _id: "fireball", name: "Fireball", type: "spell", system: { level: { value: 3 }, traits: { value: ["fire"], traditions: ["arcane"] } } }
];
const spellDocs = new Map(spellIndex.map((e) => [e._id, { ...e, uuid: `Compendium.test.spells.Item.${e._id}` }]));
globalThis.game = {
  settings: { get: () => ({ equipment: ["test.equipment"], spells: ["test.spells"], feats: [] }) },
  i18n: { localize: (k) => k },
  packs: new Map([
    ["test.spells", { async getIndex() { return spellIndex; }, async getDocument(id) { return spellDocs.get(id); } }],
    ["test.equipment", { async getIndex() { return []; }, async getDocument() { return null; } }]
  ])
};
const warnings = [];
console.warn = (m) => warnings.push(String(m));

const { normalizeConcept, resolveConcept, resolveLoot } = await import("./builder.mjs");
const { getSpellCandidates, getScrollSpellCandidates } = await import("./compendium.mjs");

const issued = await getSpellCandidates("arcane", 3);
const ray = issued.find((c) => c.name === "Ray of Frost").ref;
const fireball = issued.find((c) => c.name === "Fireball").ref;
assert.equal(ray.system, undefined, "fixture: an issued ref has no system");

const concept = normalizeConcept({
  level: 5,
  spellcasting: { tradition: "arcane", spells: [{ name: "Ray of Frost", rank: 0 }, { name: "Fireball", rank: 1 }] }
}, { level: 5, rarity: "common" });
concept.spellcasting.spells[0].candidate = ray;
concept.spellcasting.spells[1].candidate = fireball;
const resolved = await resolveConcept(concept, { exactContent: true });
assert.equal(resolved.spells[0].spell.rank, 0, "an issued cantrip keeps rank 0");
assert.equal(resolved.spells[0].entry, ray, "the stored entry stays the issued ref");
assert.equal(resolved.spells[1].spell.rank, 3, "a rank-1 assignment clamps up to the spell's real rank");
assert.equal(resolved.spells[1].entry, fireball, "the stored entry stays the issued ref");

// Spell gem with no rank template: unresolved at resolve, no throw at build time.
const scrollRef = (await getScrollSpellCandidates(10)).find((c) => c.name === "Fireball")?.ref;
assert.ok(scrollRef, "fixture: scroll candidate issued");
const skipped = [];
const loot = await resolveLoot({
  level: 5, loot: [{ name: "Spell Gem of Fireball (Rank 3)", quantity: 1, value: 0, scrollCandidate: scrollRef }]
}, { exactContent: true, skipped });
assert.deepEqual(loot, [], "a gem with no rank template is dropped at resolve");
assert.deepEqual(skipped, [{ category: "loot", name: "Spell Gem of Fireball (Rank 3)", quantity: 1 }]);
assert.ok(warnings.some((w) => /no rank 3 spell gem template/.test(w)), "the drop is warned");

console.log("builder.issuedSpellRefs.test.mjs: issued spell refs resolve from their index entry");
