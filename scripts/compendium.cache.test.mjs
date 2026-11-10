// Compendium caches share in-flight loads, drop failed loads, and clear when
// the pack sources or pack content change.
// Run: node scripts/compendium.cache.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let storedSources = {};
// Foundry's pack collection iterates its values.
const packs = new Map();
packs[Symbol.iterator] = function* () { yield* this.values(); };
globalThis.game = { settings: { get: () => storedSources }, packs };

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakePack(id, rows, { type = "Item" } = {}) {
  const pack = {
    collection: id,
    metadata: { type, packageName: "t", label: id },
    title: id,
    indexCalls: 0,
    docCalls: 0,
    docInFlight: 0,
    maxDocInFlight: 0,
    failIndex: 0,
    gate: null,
    docs: new Map(),
    async getIndex() {
      pack.indexCalls += 1;
      if (pack.gate) await pack.gate;
      else await tick();
      if (pack.failIndex > 0) { pack.failIndex -= 1; throw new Error("index boom"); }
      return rows.map((r) => ({ ...r }));
    },
    async getDocument(docId) {
      pack.docCalls += 1;
      pack.docInFlight += 1;
      pack.maxDocInFlight = Math.max(pack.maxDocInFlight, pack.docInFlight);
      await tick();
      pack.docInFlight -= 1;
      return { _id: docId, system: { description: { value: "<p>Clean text.</p>" } } };
    }
  };
  packs.set(id, pack);
  return pack;
}

const equipRow = (n, name, gp) => ({ _id: `e${n}`, name, type: "equipment", system: { level: { value: n }, price: { value: { gp } }, traits: { value: ["magical"] }, usage: { value: "worn" } } });

const compendium = await import("./compendium.mjs");
const { clearCompendiumCaches, clearCachesForChangedDocument, detectAvailablePacks, getAllEquipmentEntries,
  getAbilityCandidates, getPacksFor, registerCompendiumCache } = compendium;
const builder = await import("./item-builder.mjs");

const originalWarn = console.warn;
const warnings = [];
console.warn = (...a) => warnings.push(a.join(" "));

try {
  // (a) five parallel callers on a cold cache: one pack.getIndex.
  const eq = fakePack("sf2e.equipment-srd", [equipRow(1, "Alpha", 10), equipRow(2, "Beta", 20)]);
  fakePack("other.items", [equipRow(3, "Gamma", 30)]);
  await Promise.all([1, 2, 3, 4, 5].map(() => detectAvailablePacks()));
  assert.equal(eq.indexCalls, 1, "(a) one getIndex for 5 parallel detect calls");
  const eq2 = fakePack("sf2e.eq2", [equipRow(1, "A", 1)]);
  storedSources = { equipment: ["sf2e.eq2"] };
  await Promise.all([1, 2, 3, 4, 5].map(() => getAllEquipmentEntries()));
  assert.equal(eq2.indexCalls, 1, "(a) one getIndex for 5 parallel equipment-entry calls");

  // (b) a rejected index load is retried.
  clearCompendiumCaches();
  packs.clear();
  const flaky = fakePack("sf2e.flaky", [{ _id: "x", name: "X", type: "action" }]);
  flaky.failIndex = 1;
  await assert.rejects(detectAvailablePacks(), /index boom/, "(b) first scan rejects");
  const retried = await detectAvailablePacks();
  assert.equal(flaky.indexCalls, 2, "(b) failed load retried on the next call");
  assert.ok(retried.abilities.some((p) => p.id === "sf2e.flaky"));

  // (c) clear reloads; equipment list follows a changed sourcePacks.
  packs.clear();
  const pa = fakePack("pack.a", [equipRow(1, "Alpha", 10)]);
  const pb = fakePack("pack.b", [equipRow(2, "Beta", 20)]);
  clearCompendiumCaches();
  storedSources = { equipment: ["pack.a"] };
  assert.deepEqual((await getAllEquipmentEntries()).map((e) => e.name), ["Alpha"]);
  storedSources = { equipment: ["pack.b"] };
  assert.deepEqual((await getAllEquipmentEntries()).map((e) => e.name), ["Alpha"], "stale until cleared");
  clearCompendiumCaches();
  assert.deepEqual((await getAllEquipmentEntries()).map((e) => e.name), ["Beta"], "(c) new sources after clear");
  assert.equal(pa.indexCalls, 1);
  assert.equal(pb.indexCalls, 1);
  await detectAvailablePacks();
  const before = pa.indexCalls;
  clearCompendiumCaches();
  await detectAvailablePacks();
  assert.equal(pa.indexCalls, before + 1, "(c) index reloaded after clear");

  // warnings show again after a clear
  warnings.length = 0;
  storedSources = { equipment: ["module.gone", "pack.a"] };
  getPacksFor("equipment");
  getPacksFor("equipment");
  clearCompendiumCaches();
  getPacksFor("equipment");
  assert.equal(warnings.filter((w) => /module\.gone/.test(w)).length, 2, "(c) warn-once set reset by clear");

  // pack-document hook helper: only packs already read, never world documents
  clearCompendiumCaches();
  storedSources = { equipment: ["pack.a"] };
  await getAllEquipmentEntries();
  const callsA = pa.indexCalls;
  clearCachesForChangedDocument({ pack: null });
  clearCachesForChangedDocument({});
  clearCachesForChangedDocument({ pack: "never.read" });
  await getAllEquipmentEntries();
  assert.equal(pa.indexCalls, callsA, "world / unread-pack documents do not clear");
  clearCachesForChangedDocument({ pack: "pack.a" });
  await getAllEquipmentEntries();
  assert.equal(pa.indexCalls, callsA + 1, "changed document in a read pack clears");

  // (d) a load in flight when the cache is cleared does not repopulate it.
  packs.clear();
  clearCompendiumCaches();
  const slow = fakePack("pack.slow", [equipRow(1, "Slow", 5)]);
  let release;
  slow.gate = new Promise((resolve) => { release = resolve; });
  storedSources = { equipment: ["pack.slow"] };
  const stale = getAllEquipmentEntries();
  await tick();
  clearCompendiumCaches();
  release();
  await stale;
  slow.gate = null;
  await getAllEquipmentEntries();
  assert.equal(slow.indexCalls, 2, "(d) stale in-flight load did not repopulate the cache");

  // (e) placeholder loads: shared between parallel calls, bounded fan-out.
  packs.clear();
  clearCompendiumCaches();
  const rows = Array.from({ length: 40 }, (_, i) => ({ _id: `a${i}`, name: `Ability ${i}`, type: "action", system: { traits: { value: [] }, actionType: { value: "passive" } } }));
  const abil = fakePack("sf2e.abilities", rows);
  storedSources = { abilities: ["sf2e.abilities"] };
  const [r1, r2] = await Promise.all([getAbilityCandidates(["x"]), getAbilityCandidates(["y"])]);
  assert.equal(abil.indexCalls, 1, "(e) one index load for both callers");
  assert.equal(abil.docCalls, 40, "(e) each document fetched once");
  assert.ok(abil.maxDocInFlight <= 8, `(e) at most 8 in flight, saw ${abil.maxDocInFlight}`);
  assert.ok(abil.maxDocInFlight > 1, "(e) pool still loads in parallel");
  assert.equal(r1.length, 40);
  assert.deepEqual(r1.map((c) => c.name).sort(), r2.map((c) => c.name).sort(), "(e) same candidates");
  await getAbilityCandidates([]);
  assert.equal(abil.docCalls, 40, "(e) cached afterwards");

  // (e2) a placeholder load in flight during a clear is not cached.
  clearCompendiumCaches();
  const callsBefore = abil.docCalls;
  const inFlight = compendium.placeholderState({ ...rows[0], packId: "sf2e.abilities" });
  clearCompendiumCaches();
  assert.equal(await inFlight, "clean");
  await compendium.placeholderState({ ...rows[0], packId: "sf2e.abilities" });
  assert.equal(abil.docCalls, callsBefore + 2, "(e2) stale placeholder load did not repopulate the cache");

  // (f) item-builder price samples: reload after clear, retry after a rejected scan.
  packs.clear();
  clearCompendiumCaches();
  const priced = fakePack("sf2e.priced", Array.from({ length: 6 }, (_, i) => equipRow(3, `Item ${i}`, 10 * (i + 1))));
  storedSources = { equipment: ["sf2e.priced"] };
  // getEquipmentIndex swallows index errors into [], so fail the scan itself via getPacksFor.
  const realGet = game.settings.get;
  let boom = true;
  game.settings.get = () => { if (boom) { boom = false; throw new Error("settings boom"); } return storedSources; };
  await assert.rejects(builder.priceForLevel(3), /settings boom/, "(f) first scan rejects");
  game.settings.get = realGet;
  const price = await builder.priceForLevel(3);
  assert.ok(price > 0, "(f) rejected scan retried");
  assert.equal(priced.indexCalls, 1);
  await builder.priceForLevel(3);
  assert.equal(priced.indexCalls, 1, "(f) cached");
  clearCompendiumCaches();
  await builder.priceForLevel(3);
  assert.equal(priced.indexCalls, 2, "(f) price samples reload after a clear");

  // registered resets run, and are tolerated when not a function
  let ran = 0;
  registerCompendiumCache(() => { ran += 1; });
  registerCompendiumCache(null);
  clearCompendiumCaches();
  assert.equal(ran, 1);
} finally {
  console.warn = originalWarn;
}

// Source scan: onChange on sourcePacks, pack hooks in the entry point.
const settingsSrc = readFileSync(new URL("./settings.mjs", import.meta.url), "utf8");
const regAt = settingsSrc.indexOf("SETTINGS.sourcePacks, {");
assert.ok(regAt > 0);
const regBlock = settingsSrc.slice(regAt, settingsSrc.indexOf("});", regAt));
assert.match(regBlock, /onChange:\s*\(\)\s*=>\s*Hooks\.callAll\("simplysf2e\.sourcePacksChanged"\)/, "sourcePacks registers an onChange");
const entrySrc = readFileSync(new URL("./simplysf2e.mjs", import.meta.url), "utf8");
assert.match(entrySrc, /Hooks\.on\("simplysf2e\.sourcePacksChanged",\s*\(\)\s*=>\s*clearCompendiumCaches\(\)\)/);
for (const name of ["createItem", "updateItem", "deleteItem", "createActor", "updateActor", "deleteActor"]) {
  assert.ok(entrySrc.includes(`"${name}"`), `entry point registers ${name}`);
}
assert.match(entrySrc, /Hooks\.on\(name,\s*\(doc\)\s*=>\s*clearCachesForChangedDocument\(doc\)\)/);

console.log("compendium.cache: ok");
