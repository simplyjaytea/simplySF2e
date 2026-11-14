// Spell themes drafted with the concept replace the separate focus request, and the
// ancestry and heritage catalogs carry the link the heritage narrowing matches on.
// Runs the real refineSpells and the real compendium getters over fake packs.
// Run: node scripts/creature-pipeline.spellThemes.test.mjs
import assert from "node:assert/strict";

const spell = (id, name, rank, traits = []) => ({
  _id: id, name, type: "spell",
  system: { level: { value: rank }, traits: { value: traits, traditions: ["arcane"], rarity: "common" } }
});
const PACKS = {
  "sf2e.spells": [
    spell("s1", "Ignition", 1, ["cantrip", "fire"]), spell("s2", "Breathe Fire", 1, ["fire"]),
    spell("s3", "Mist", 2, ["water"]), spell("s4", "Fireball", 3, ["fire"])
  ],
  "sf2e.ancestries": [
    { _id: "vesk", name: "Vesk", type: "ancestry", system: { traits: { value: ["vesk"], rarity: "common" } } }
  ],
  "sf2e.heritages": [
    { _id: "h1", name: "Briskwander Vesk", type: "heritage",
      system: { ancestry: { name: "Vesk", slug: "vesk", uuid: "Compendium.sf2e.ancestries.Item.vesk" }, traits: { value: [], rarity: "common" } } },
    { _id: "h2", name: "Borai", type: "heritage", system: { ancestry: null, traits: { value: [], rarity: "common" } } }
  ]
};
const indexFields = [];
const pack = (id) => ({
  collection: id,
  metadata: { id, type: "Item", packageName: "sf2e" },
  async getIndex({ fields = [] } = {}) { indexFields.push(...fields); return PACKS[id]; },
  async getDocument(docId) { return PACKS[id].find((doc) => doc._id === docId) ?? null; }
});
const packs = Object.keys(PACKS).map(pack);
globalThis.game = {
  packs: Object.assign(packs, { get: (id) => packs.find((p) => p.collection === id) }),
  settings: { get: (_module, key) => (key === "sourcePacks" ? {} : undefined) },
  i18n: { localize: (key) => key, format: (key) => key }
};
globalThis.Hooks = { on() {}, once() {}, callAll() {} };

const { refineSpells } = await import("./creature-pipeline.mjs");
const { getAncestryCandidates, getHeritageCandidates } = await import("./compendium.mjs");
const { heritagesForDraftAncestry } = await import("./ai.mjs");

const conceptWith = (keywords) => ({
  name: "Ember Adept", level: 5, blurb: "", description: "", traits: [], focusSpells: [],
  spellcasting: { tradition: "arcane", dcScale: "high", maxRank: 3, spells: [], ...(keywords ? { keywords } : {}) }
});
const run = async (keywords) => {
  const calls = { focus: 0, select: 0, offered: null, usage: [] };
  const concept = conceptWith(keywords);
  await refineSpells(concept, {
    labels: { spellFocus: "focus", spells: "spells" },
    onTokens: (_usage, { label }) => calls.usage.push(label),
    ai: {
      chooseSpellFocus: async () => { calls.focus += 1; return { keywords: ["water"], usage: { total: 1 } }; },
      selectSpells: async ({ candidates }) => {
        calls.select += 1;
        calls.offered = candidates.map((c) => c.name);
        return { spells: candidates.slice(0, 1).map((c) => ({ name: c.name, candidate: c.ref, rank: c.rank })), focusSpells: [], usage: { total: 1 } };
      }
    }
  });
  return { calls, concept };
};

// Themes on the draft: no focus request, and the themes rank the spell list.
const themed = await run(["fire"]);
assert.equal(themed.calls.focus, 0, "a draft with spell themes costs no focus request");
assert.equal(themed.calls.select, 1);
assert.deepEqual(themed.calls.usage, ["spells"], "no focus row in the token report either");
assert.ok(themed.calls.offered.includes("Fireball"), "the real spell list is still offered");
assert.equal(themed.concept.spellcasting.spells.length, 1);

// No themes (an older or non-compliant draft): the focus request still runs once.
for (const keywords of [undefined, []]) {
  const plain = await run(keywords);
  assert.equal(plain.calls.focus, 1, "a draft without themes falls back to the focus request");
  assert.equal(plain.calls.select, 1);
  assert.deepEqual(plain.calls.usage, ["focus", "spells"]);
}

// The catalogs carry the ancestry link, and the index asks Foundry for it.
const ancestries = await getAncestryCandidates("uncommon");
const heritages = await getHeritageCandidates("uncommon");
assert.ok(indexFields.includes("system.ancestry.uuid"), "the pack index requests the heritage's ancestry link");
assert.equal(ancestries[0].uuid, "Compendium.sf2e.ancestries.Item.vesk");
assert.deepEqual(heritages.map((h) => [h.name, h.ancestryUuid ?? null]),
  [["Borai", null], ["Briskwander Vesk", "Compendium.sf2e.ancestries.Item.vesk"]]);
assert.ok(!("ancestryUuid" in heritages[0]), "a versatile heritage has no link key");
const narrowed = heritagesForDraftAncestry("Vesk", ancestries, heritages);
assert.equal(narrowed.ancestry, ancestries[0], "the real catalog shapes narrow end to end");
assert.equal(narrowed.heritages.length, 2);

console.log("creature-pipeline.spellThemes.test.mjs: drafted spell themes skip the focus request; ancestry links indexed");
