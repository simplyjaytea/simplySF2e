// R3-PC: ancestry feat slots use the ancestry DOCUMENT's own trait, an ancestry
// or class slot with no trait-matching feat stays empty (no wrong-ancestry
// fill), and the fallback heritage prefers the ancestry's own heritage over a
// versatile one.
//
// Real evidence (pinned sf2e 1.7.0 pack, tools/class-bench/cache): Ysoki's
// `system.traits.value` is ["humanoid","ratfolk"] and its 29 ancestry feats
// carry "ratfolk" (none carry "ysoki"); G'folian's is
// ["amphibious","beast","gfolian"] while slugify("G'folian") is "g-folian".
// Heritage link shape: `system.ancestry = { name, slug, uuid }`, null when versatile.
//
// Part A reads that cache when it exists (gitignored, absent in CI) and skips
// with a note otherwise. Parts B-E always run, on the real resolvePCConcept
// with stubbed Foundry globals.
// Run: node scripts/pc-builder.ancestryTrait.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docs = new Map();
const doc = (pack, id, name, type, system) => {
  const uuid = `Compendium.${pack}.Item.${id}`;
  const d = { pack, uuid, _id: id, name, type, system: structuredClone(system),
    toObject: () => ({ _id: id, name, type, system: structuredClone(system) }) };
  docs.set(uuid, d);
  docs.set(id, d);
  return d;
};

const ancestrySystem = (traits) => ({
  traits: { rarity: "common", value: traits },
  boosts: { 0: { value: [] }, 1: { value: [] } }, flaws: { 0: { value: [] } },
  additionalLanguages: {}, languages: { value: [] }
});
const ysoki = doc("sf2e.ancestries", "ysoki", "Ysoki", "ancestry", ancestrySystem(["humanoid", "ratfolk"]));
const gfolian = doc("sf2e.ancestries", "gfolian", "G'folian", "ancestry", ancestrySystem(["amphibious", "beast", "gfolian"]));
doc("sf2e.ancestries", "elf", "Elf", "ancestry", ancestrySystem(["elf", "humanoid"]));
// An ancestry with no feats of its own in this fixture pack.
doc("sf2e.ancestries", "zorb", "Zorb", "ancestry", ancestrySystem(["humanoid", "zorb"]));
// An ancestry with no heritage of its own in this fixture pack.
doc("sf2e.ancestries", "loner", "Loner", "ancestry", ancestrySystem(["humanoid", "loner"]));
doc("sf2e.backgrounds", "athlete", "Athlete", "background", { boosts: {}, trainedSkills: { value: ["athletics"] }, items: {} });
doc("sf2e.classes", "opclass", "Operative", "class", {
  slug: "operative", keyAbility: { value: ["dex"] }, trainedSkills: { value: [], additional: 3 },
  skillFeatLevels: { value: [] }, classFeatLevels: { value: [1] }, ancestryFeatLevels: { value: [1] }, generalFeatLevels: { value: [] },
  items: {}
});

const link = (a) => ({ name: a.name, slug: a._id, uuid: a.uuid });
// "Aardvark Versatile" sorts before every own heritage, so a name-sorted walk that
// accepts a null link would pick it first.
doc("sf2e.heritages", "aardvark", "Aardvark Versatile", "heritage", { ancestry: null, traits: { value: [], rarity: "common" } });
doc("sf2e.heritages", "ysoki-her", "Ysoki Warren", "heritage", { ancestry: link(ysoki), traits: { value: [], rarity: "common" } });
doc("sf2e.heritages", "gfolian-her", "Marsh G'folian", "heritage", { ancestry: link(gfolian), traits: { value: [], rarity: "common" } });

const feat = (_id, name, level, category, traits) => ({
  _id, name, type: "feat",
  system: { category, level: { value: level }, traits: { value: traits }, prerequisites: { value: [] } }
});
const featEntries = [
  feat("ratfolk-trick", "Ratfolk Trick", 1, "ancestry", ["ratfolk"]),
  feat("gfolian-trick", "Gfolian Trick", 1, "ancestry", ["gfolian"]),
  feat("elf-trick", "Elf Trick", 1, "ancestry", ["elf"]),
  feat("operative-tactic", "Operative Tactic", 1, "class", ["operative"]),
  feat("soldier-tactic", "Soldier Tactic", 1, "class", ["soldier"])
];

const makePack = (collection, title, entries) => ({
  collection, title, metadata: { type: "Item" },
  async getIndex() { return entries; },
  getDocument: async (id) => docs.get(id) ?? docs.get(`Compendium.${collection}.Item.${id}`) ?? null
});
const only = (pack, type) => [...docs.values()].filter((d, i, a) => d.pack === pack && a.indexOf(d) === i)
  .map((d) => ({ _id: d._id, name: d.name, type, system: d.system }));
const packs = new Map([
  ["sf2e.ancestries", makePack("sf2e.ancestries", "Ancestries", only("sf2e.ancestries", "ancestry"))],
  ["sf2e.backgrounds", makePack("sf2e.backgrounds", "Backgrounds", only("sf2e.backgrounds", "background"))],
  ["sf2e.classes", makePack("sf2e.classes", "Classes", only("sf2e.classes", "class"))],
  ["sf2e.heritages", makePack("sf2e.heritages", "Heritages", only("sf2e.heritages", "heritage"))],
  ["sf2e.feats", makePack("sf2e.feats", "Feats", featEntries)]
]);
packs[Symbol.iterator] = function* () { yield* this.values(); };

globalThis.game = {
  packs,
  settings: { get: (_module, key) => (key === "freeArchetype" ? false : {}) },
  i18n: { localize: (k) => k }
};
globalThis.CONFIG = { PF2E: {} };
globalThis.fromUuid = async (id) => docs.get(id) ?? null;
globalThis.foundry = { utils: { randomID: (() => { let id = 0; return () => `id-${++id}`; })() } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 50 } };

const { resolvePCConcept, ancestryFeatTraits } = await import("./pc-builder.mjs");
const { emptyFeatSlots } = await import("./generator-context/rows.mjs");

const warnings = [];
const origWarn = console.warn;
const quiet = () => { warnings.length = 0; console.warn = (m) => warnings.push(String(m)); };
const loud = () => { console.warn = origWarn; };

/* A. Every ancestry in the pinned pack (cache present only). */
{
  const cache = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../tools/class-bench/cache");
  if (!fs.existsSync(path.join(cache, "ancestries")) || !fs.existsSync(path.join(cache, "feats"))) {
    console.log("pc-builder.ancestryTrait: class-bench cache absent, skipping the all-ancestries data check");
  } else {
    const readAll = (dir) => fs.readdirSync(path.join(cache, dir), { recursive: true })
      .filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(cache, dir, f), "utf8")));
    const ancestryFeatTraitCount = new Map();
    for (const f of readAll("feats").filter((x) => x.system?.category === "ancestry")) {
      for (const t of f.system.traits.value) ancestryFeatTraitCount.set(t, (ancestryFeatTraitCount.get(t) ?? 0) + 1);
    }
    const ancestries = readAll("ancestries");
    assert.ok(ancestries.length >= 60, "the cache holds the 60 ancestries");
    const docCount = new Map();
    for (const a of ancestries) for (const t of a.system.traits.value) docCount.set(t, (docCount.get(t) ?? 0) + 1);
    for (const a of ancestries) {
      const traits = ancestryFeatTraits(a);
      const withFeats = traits.filter((t) => ancestryFeatTraitCount.has(t));
      assert.ok(withFeats.length >= 1, `${a.name}: derived ${JSON.stringify(traits)} matches at least one ancestry feat`);
      assert.ok(traits.every((t) => docCount.get(t) === 1),
        `${a.name}: derived ${JSON.stringify(traits)} is not shared with another ancestry`);
    }
    console.log(`pc-builder.ancestryTrait: ${ancestries.length} ancestries checked against the cache`);
  }
}

/* B. Fixed derivations, always run. */
assert.deepEqual(ancestryFeatTraits(ysoki), ["ratfolk"], "Ysoki -> ratfolk (not its name slug)");
assert.deepEqual(ancestryFeatTraits(gfolian), ["gfolian"], "G'folian -> gfolian (not g-folian)");
assert.deepEqual(ancestryFeatTraits(docs.get("elf")), ["elf"], "an ordinary ancestry -> its own trait");
assert.deepEqual(ancestryFeatTraits({ name: "Ysoki" }), [], "no traits on the document -> nothing provable, never the name");
assert.deepEqual(ancestryFeatTraits(null), []);

const base = { name: "T", level: 1, keyAbility: "dex", background: "Athlete", class: "Operative",
  feats: [], equipment: [], loot: [], spellcasting: null, focusSpells: [] };
const slotOf = (resolved, type) => resolved.featSlots.find((s) => s.type === type);
const names = (slot) => slot.candidates.map((c) => c.name);

/* C. Ysoki and G'folian get their own feats; the class slot keeps its own class. */
{
  quiet();
  const y = await resolvePCConcept({ ...base, ancestry: "Ysoki" });
  const g = await resolvePCConcept({ ...base, ancestry: "G'folian" });
  loud();
  assert.deepEqual(names(slotOf(y, "ancestry")), ["Ratfolk Trick"], "Ysoki ancestry slot offers only ratfolk feats");
  assert.deepEqual(names(slotOf(g, "ancestry")), ["Gfolian Trick"], "G'folian ancestry slot offers only gfolian feats");
  assert.deepEqual(names(slotOf(y, "class")), ["Operative Tactic"], "class slot offers only operative feats");
}

/* D. No trait-matching feat: the slot stays empty, no other ancestry's feat, GM line input is set. */
{
  quiet();
  const z = await resolvePCConcept({ ...base, ancestry: "Zorb" });
  loud();
  const slot = slotOf(z, "ancestry");
  assert.deepEqual(slot.candidates, [], "Zorb has no feat of its own, so the slot stays empty");
  assert.ok(warnings.some((w) => w.startsWith("simplysf2e | ") && w.includes("ancestry feat with trait zorb")),
    "the empty ancestry slot warns with the module prefix and the trait");
  assert.deepEqual(names(slotOf(z, "class")), ["Operative Tactic"], "the class slot is unaffected");
  const { resolveFeatPicks } = await import("./pc-builder.mjs");
  quiet();
  const rows = await resolveFeatPicks(z.featSlots, [{ slot: 1, name: "Elf Trick" }, { slot: 2, name: "Ratfolk Trick" }], { exactContent: true });
  loud();
  const row = rows.find((r) => r.type === "ancestry");
  assert.equal(row.entry, null, "an AI pick of another ancestry's feat does not fill the empty slot");
  assert.deepEqual(emptyFeatSlots({ feats: rows }), ["ancestry 1"], "the empty slot reaches the review-panel line");
}

/* E. Fallback heritage: the ancestry's own heritage, not the name-first versatile one. */
{
  quiet();
  const y = await resolvePCConcept({ ...base, ancestry: "Ysoki", heritage: "Qqqq Unmatched" });
  const g = await resolvePCConcept({ ...base, ancestry: "G'folian", heritage: "Qqqq Unmatched" });
  const l = await resolvePCConcept({ ...base, ancestry: "Loner", heritage: "Qqqq Unmatched" });
  loud();
  assert.equal(y.heritageDoc?.name, "Ysoki Warren", "Ysoki falls back to its own heritage");
  assert.equal(g.heritageDoc?.name, "Marsh G'folian", "G'folian falls back to its own heritage");
  assert.equal(l.heritageDoc?.name, "Aardvark Versatile", "an ancestry with no heritage of its own still gets a versatile one");
}

console.log("pc-builder ancestry-trait / empty-slot / fallback-heritage checks: all assertions passed");
