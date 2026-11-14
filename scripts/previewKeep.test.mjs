// Shop, Treasure and Item Forge: "Generate another" keeps the previous preview until
// the new run has produced a replacement. A failed or cancelled run leaves the previous
// preview, its token usage and what Create would write exactly as they were; a
// successful run replaces them; with no previous preview a failure leaves the empty
// state plus the error. Same vm-module stubbing as shop-treasure.lifecycle.test.mjs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}
const clone = (value) => JSON.parse(JSON.stringify(value));
let mode = "ok"; // ok | fail | cancel : what the AI concept call does
let nextName = "First";
let nextTokens = 100;
const created = [];
const AI_ERR = () => mode === "cancel"
  ? Object.assign(new Error("cancelled"), { cancelled: true })
  : new Error("provider down");
const concept = () => {
  if (mode !== "ok") throw AI_ERR();
  return { concept: { name: nextName }, usage: { total: nextTokens } };
};
const CAND = { id: "item-1", name: "Kit", type: "equipment", level: 1, rarity: "common", quantity: 1 };
const DOC = { name: "Kit", type: "equipment", system: { level: { value: 1 }, price: { value: 1 } } };

const context = vm.createContext({
  console: { log() {}, debug() {}, warn() {}, error() {} },
  game: { i18n: { localize: (key) => key, format: (key) => key }, packs: { get: () => ({}) } },
  ui: { notifications: { info() {}, warn() {}, error() {} } },
  foundry: { utils: { deepClone: clone }, applications: { api: { DialogV2: { confirm: async () => true } } } },
  Actor: { create: async (data) => { created.push(clone(data)); return { id: "a", name: data.name, delete: async () => {}, sheet: { render: async () => {} } }; } },
  Item: { create: async (data) => { created.push(clone(data)); return { id: "i", name: data.name, sheet: { render: async () => {} } }; } }
});
class MockSpfApp {
  _elapsedUnits() { return { seconds: "s", minutes: "m" }; }
  _tokenUsage = [];
  _progress = null;
  _formatLastRunCost() { return null; }
  _buildTokenReport() { return this._tokenUsage.length ? this._tokenUsage.map((e) => e.usage.total) : null; }
  _recordTokens(label, usage) { this._tokenUsage.push({ label, usage }); }
  _recordFailure() {}
  _canReportBug() { return false; }
  _onAIProgress() {}
  async render() {}
  _beginProgress() { this.abort = new AbortController(); return this.abort.signal; }
  _throwIfCancelled() {}
  async _setStep() {}
  _finishRun() { this.abort = null; }
}
const mocks = {
  MODULE_ID: "simplysf2e", SpfApp: MockSpfApp,
  getProviderRequestConfig: () => ({ provider: {}, connections: [], hasConfiguredApiKey: false, connectionName: "" }),
  getProviderAuthWarningKey: () => null,
  getPacksFor: () => ["sf2e.equipment"],
  describeMissingSources: () => "", jevKeySource: () => null,
  progressView: () => null,
  gpToCredits: (gp) => gp * 10,
  unitPriceGp: () => 1,
  getShopCandidates: async () => [CAND],
  getCandidateDocument: async () => DOC,
  toItemData: () => ({ name: "Kit", type: "equipment", system: {} }),
  verifyCreatedActor: () => {}, moveToGeneratedFolder: async () => {},
  // Shop
  generateShopConcept: async () => concept(),
  selectShopStock: async () => ({ ids: [CAND.id], usage: { total: 1 } }),
  SHOP_SIZES: { standard: 4 }, SHOP_CATEGORIES: { armor: {} }, SHOP_RARITIES: ["common"],
  SHOP_MIN_LEVEL: 0, SHOP_MAX_LEVEL: 20,
  clampShopLevel: (value, fallback) => Number(value) || fallback,
  normalizeShopConcept: (raw) => ({ categories: ["armor"], keywords: [], name: raw.name }),
  shopTypesFor: () => ({ types: ["equipment"] }),
  pickShopStock: () => ({ stock: [CAND], unknown: [] }),
  shopStockValue: () => 10,
  shopActorData: (c, level) => ({ name: c.name, level, type: "npc" }),
  // Treasure
  generateTreasureConcept: async () => concept(),
  selectTreasureItems: async () => ({ ids: [CAND.id], usage: { total: 1 } }),
  TREASURE_AMOUNTS: ["encounter"], TREASURE_PICKS: { encounter: 1 }, TREASURE_RARITIES: ["common"],
  TREASURE_MIN_LEVEL: 0, TREASURE_MAX_LEVEL: 20, TREASURE_MIN_PARTY: 1, TREASURE_MAX_PARTY: 8,
  clampTreasureLevel: (value, fallback) => Number(value) || fallback,
  clampPartySize: (value) => Number(value) || 4,
  treasureBudgetCredits: () => 680, creditsEach: () => 170,
  normalizeTreasureConcept: (raw) => ({ categories: ["armor"], keywords: [], name: raw.name }),
  resolveIssuedPicks: (ids, candidates) => ({ issued: candidates }),
  fillHoard: (ids, priced) => ({ items: priced, unknown: [], overBudget: [], unpriced: [] }),
  hoardLeftover: () => 0, splitCurrency: () => [], assembleCurrency: () => null,
  treasureActorData: (c, level) => ({ name: c.name, level, type: "npc" }),
  // Item Forge
  RUNED_ITEM_KINDS: new Set(["weapon", "armor"]),
  CONCEPT_ITEM_KINDS: new Set(["wondrous", "augmentation", "crystal"]),
  KIND_USAGE: {}, MIN_ITEM_LEVEL: 0, MAX_ITEM_LEVEL: 20,
  EFFECT_KINDS: ["itemBonus"], getForgeEffectCatalog: async () => [{ kind: "itemBonus" }],
  getUsageOptions: async () => ["worn"],
  generateMagicItemConcept: async () => concept(),
  normalizeMagicItemConcept: (raw, opts) => ({ name: raw.name, level: 4, rarity: "common", traits: [], effects: [], bulk: 0, activation: null, kind: opts.kind }),
  priceForLevel: async () => 100,
  describeEffect: () => "", describeActivation: () => "",
  buildMagicItemData: async (c) => ({ name: c.name, kind: c.kind }),
  getBaseItemCandidates: async () => [{ id: "b" }], getPropertyRuneCandidates: async () => [],
  getFundamentalRuneTiers: async () => ({ potencyTiers: [], secondaryTiers: [] }),
  getGradeTiers: async () => ({ grades: [] }),
  generateRunedItemConcept: async () => concept(),
  normalizeRunedItemConcept: (raw) => ({ name: raw.name, description: "", upgrades: [], propertyRunes: [] }),
  buildRunedItem: async (c) => ({
    itemData: { name: c.name, system: { traits: { rarity: "common", value: [] } } },
    preview: { level: 3, priceGp: 5, upgrades: [] }
  }),
  createActivationMacro: async () => {}
};
const names = (source) => [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)];
async function load(file) {
  const source = await readFile(new URL(file, import.meta.url), "utf8");
  const module = new vm.SourceTextModule(source, { context });
  await module.link((specifier) => {
    const imports = names(source)
      .filter((match) => match[2] === specifier)
      .flatMap((match) => match[1].split(",").map((name) => name.trim()).filter(Boolean));
    return new vm.SyntheticModule(imports, function () {
      for (const name of imports) this.setExport(name, mocks[name] ?? (() => null));
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}
const { ShopApp } = await load("./shop-app.mjs");
const { TreasureApp } = await load("./treasure-app.mjs");
const { ItemForgeApp } = await load("./itemforge-app.mjs");

const lookup = (controls) => ({ querySelector: (selector) => {
  const name = selector.match(/name="(\w+)"/)?.[1];
  return name in controls ? { value: controls[name] } : null;
} });
const windows = [
  { label: "shop", App: ShopApp, create: "createShop",
    controls: { prompt: "QA", level: "4", size: "standard", rarity: "common" } },
  { label: "treasure", App: TreasureApp, create: "createTreasure",
    controls: { prompt: "QA", level: "4", partySize: "4", amount: "encounter", rarity: "common" } },
  { label: "item forge (plain item)", App: ItemForgeApp, create: "createItem",
    controls: { prompt: "QA", level: "4", rarity: "common", kind: "wondrous" } },
  { label: "item forge (graded weapon)", App: ItemForgeApp, create: "createItem",
    controls: { prompt: "QA", level: "4", rarity: "common", kind: "weapon" } }
];

for (const { label, App, create, controls } of windows) {
  const actions = App.DEFAULT_OPTIONS.actions;
  const open = () => { const app = new App(); app.element = lookup(controls); return app; };
  const view = async (app) => {
    const ctx = await app._prepareContext();
    return JSON.stringify({ preview: ctx.preview, tokens: ctx.tokenReport, empty: ctx.showEmptyState });
  };
  const createdName = async (app) => {
    created.length = 0;
    await actions[create].call(app);
    return created.map((data) => data.name);
  };

  // With no previous preview, a failure leaves the empty state plus the error.
  mode = "fail";
  let app = open();
  await actions.generate.call(app);
  let ctx = await app._prepareContext();
  assert.equal(ctx.preview, null, `${label}: no preview after a first failed run`);
  assert.equal(ctx.error, "provider down", `${label}: the error is shown`);
  assert.equal(ctx.tokenReport, null, `${label}: no token report after a first failed run`);
  assert.equal(ctx.showEmptyState, false, `${label}: error replaces the empty hint as before`);

  // A first good run, then fail and cancel leave it untouched.
  mode = "ok"; nextName = "First"; nextTokens = 100;
  app = open();
  await actions.generate.call(app);
  const first = await view(app);
  assert.ok(JSON.parse(first).preview, `${label}: first run made a preview`);
  assert.deepEqual(JSON.parse(first).tokens.slice(0, 1), [100], `${label}: first run token usage`);
  for (const failure of ["fail", "cancel"]) {
    mode = failure;
    nextTokens = 999;
    await actions.generate.call(app);
    ctx = await app._prepareContext();
    assert.equal(JSON.stringify({ preview: ctx.preview, tokens: ctx.tokenReport, empty: ctx.showEmptyState }), first,
      `${label}: a ${failure} run restores the previous preview and token usage`);
    assert.ok(ctx.error, `${label}: the ${failure} message is shown above the restored preview`);
    assert.equal(ctx.busy, false, `${label}: not left busy after ${failure}`);
    assert.deepEqual(await createdName(app), ["First"], `${label}: Create after a ${failure} run writes the previous preview`);
    // Create consumed the draft; rebuild it for the next iteration.
    mode = "ok"; nextName = "First"; nextTokens = 100;
    await actions.generate.call(app);
    assert.equal(await view(app), first, `${label}: rebuilt first preview is identical`);
  }

  // A successful run replaces preview and token usage.
  mode = "ok"; nextName = "Second"; nextTokens = 200;
  await actions.generate.call(app);
  const second = await view(app);
  assert.notEqual(second, first, `${label}: a successful run replaces the preview`);
  assert.equal(JSON.parse(second).tokens[0], 200, `${label}: token usage is the new run's`);
  assert.equal((await app._prepareContext()).error, null, `${label}: success clears the error`);
  assert.deepEqual(await createdName(app), ["Second"], `${label}: Create writes the new preview`);
}

// Item Forge: a failed run of the OTHER pipeline keeps the previous kind, so the
// preview and Create still read the previous pipeline's data.
{
  const actions = ItemForgeApp.DEFAULT_OPTIONS.actions;
  const controls = { prompt: "QA", level: "4", rarity: "common", kind: "wondrous" };
  const app = new ItemForgeApp();
  app.element = lookup(controls);
  mode = "ok"; nextName = "Charm"; nextTokens = 50;
  await actions.generate.call(app);
  controls.kind = "weapon";
  mode = "fail";
  await actions.generate.call(app);
  const ctx = await app._prepareContext();
  assert.equal(ctx.preview?.concept?.name, "Charm", "item forge: a failed weapon run keeps the wondrous preview");
  created.length = 0;
  await actions.createItem.call(app);
  assert.deepEqual(created.map((data) => [data.name, data.kind]), [["Charm", "wondrous"]], "item forge: Create builds the kept wondrous item");
}

// Source guard: the pre-run clear is gone from every window.
for (const file of ["shop-app.mjs", "treasure-app.mjs", "itemforge-app.mjs"]) {
  const source = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
  assert.ok(!/this\._tokenUsage = \[\];\s*(this\.#kind = [^\n]*\n\s*)?this\.#clearPreview\(\);/.test(source),
    `${file}: no clear before the run`);
}
console.log("previewKeep.test.mjs: failed and cancelled runs keep the previous preview in shop, treasure and item forge (both paths)");
