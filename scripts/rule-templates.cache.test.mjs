// The Item Forge passive-effect catalog reloads its rule exemplars from the
// packs after the GM changes sources or a clear runs.
// Run: node scripts/rule-templates.cache.test.mjs
import assert from "node:assert/strict";

let storedSources = {};
const packs = new Map();
packs[Symbol.iterator] = function* () { yield* this.values(); };
globalThis.game = { settings: { get: () => storedSources }, packs };

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// One equipment document with a priced, eligible passive rule (boots-like).
const boots = (id, name) => ({
  _id: id, name, type: "equipment", system: {
    level: { value: 5 }, traits: { rarity: "common", value: ["invested", "magical"] },
    price: { value: { gp: 145 } }, usage: { value: "wornshoes" },
    description: { value: "<p>When worn, the boots grant a +1 item bonus to Acrobatics checks.</p>" },
    rules: [{ key: "FlatModifier", selector: "acrobatics", type: "item", value: 1 }]
  }
});

function fakePack(id, rows) {
  const pack = {
    collection: id,
    metadata: { type: "Item", packageName: "t", label: id },
    title: id,
    indexCalls: 0,
    gate: null,
    async getIndex() {
      pack.indexCalls += 1;
      if (pack.gate) await pack.gate;
      else await tick();
      return rows.map((r) => structuredClone(r));
    }
  };
  packs.set(id, pack);
  return pack;
}

const { clearCompendiumCaches } = await import("./compendium.mjs");
const { getForgeEffectCatalog } = await import("./rule-templates.mjs");

const originalWarn = console.warn;
console.warn = () => {};

try {
  // (a) the catalog is cached per pack between calls.
  const a = fakePack("sf2e.eq-a", [boots("a1", "Boots A")]);
  storedSources = { equipment: ["sf2e.eq-a"] };
  const first = await getForgeEffectCatalog(20, "common");
  assert.ok(first.length > 0, "(a) the fixture yields an eligible effect");
  await getForgeEffectCatalog(20, "common");
  assert.equal(a.indexCalls, 1, "(a) second call served from the cache");

  // (b) clearing the caches makes the next call reload from the pack.
  clearCompendiumCaches();
  await getForgeEffectCatalog(20, "common");
  assert.equal(a.indexCalls, 2, "(b) cleared cache reloads the pack");

  // (c) a changed equipment source is read after a clear.
  const b = fakePack("sf2e.eq-b", [boots("b1", "Boots B")]);
  storedSources = { equipment: ["sf2e.eq-b"] };
  clearCompendiumCaches();
  const second = await getForgeEffectCatalog(20, "common");
  assert.equal(b.indexCalls, 1, "(c) new source pack loaded once");
  assert.equal(a.indexCalls, 2, "(c) old source pack not read again");
  assert.ok(second.some((e) => e.source?.includes?.("Boots B") || JSON.stringify(e).includes("Boots B")),
    "(c) catalog now lists the new source's exemplar");

  // (d) a load in flight during a clear does not repopulate the cache.
  clearCompendiumCaches();
  const c = fakePack("sf2e.eq-c", [boots("c1", "Boots C")]);
  let release;
  c.gate = new Promise((resolve) => { release = resolve; });
  storedSources = { equipment: ["sf2e.eq-c"] };
  const stale = getForgeEffectCatalog(20, "common");
  await tick();
  clearCompendiumCaches();
  release();
  await stale;
  c.gate = null;
  await getForgeEffectCatalog(20, "common");
  assert.equal(c.indexCalls, 2, "(d) stale in-flight load did not repopulate the cache");
} finally {
  console.warn = originalWarn;
}

console.log("rule-templates.cache: ok");
