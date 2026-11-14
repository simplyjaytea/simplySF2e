// Shop and Treasure create/rollback, progress-start and notification boundaries.
// Same vm-module stubbing as itemforge-app.lifecycle.test.mjs; unlisted imports are no-ops.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { priceToGp as realPriceToGp, unitPriceGp as realUnitPriceGp } from "./compendium.mjs";
import { gpToCredits as realGpToCredits } from "./currency.mjs";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}
const clone = (value) => JSON.parse(JSON.stringify(value));
const notices = [];
let createdName = "Merchant";
let deleteFailure = null;
let verifyFailure = null;
let beginFailure = null;
let generationCalls = 0;
let createCalls = 0;
const CANDIDATE = { id: "item-1", name: "Kit", type: "equipment", level: 1, rarity: "common", quantity: 1 };
const DOC = { name: "Kit", type: "equipment", system: { level: { value: 1 }, price: { value: 1 } } };
let currentDoc = DOC;
let hoardBudget = 680;
let lastHoard = null;
const context = vm.createContext({
  console: { log() {}, debug() {}, warn() {}, error() {} },
  game: { i18n: { localize: (key) => key, format: (key, data) => (data ? `${key}:${JSON.stringify(data)}` : key) }, packs: { get: () => ({}) } },
  ui: { notifications: { info: (...args) => notices.push(["info", ...args]), warn: (...args) => notices.push(["warn", ...args]), error: (...args) => notices.push(["error", ...args]) } },
  foundry: { utils: { deepClone: clone }, applications: { api: { DialogV2: { confirm: async () => true } } } },
  Actor: { create: async () => {
    createCalls++;
    return {
      id: `actor-${createCalls}`, name: createdName,
      delete: async () => { if (deleteFailure) throw deleteFailure; },
      sheet: { render: async () => {} }
    };
  } }
});
class MockSpfApp {
  _elapsedUnits() { return { seconds: "s", minutes: "m" }; }
  _tokenUsage = [];
  _progress = null;
  _formatLastRunCost() { return null; }
  _buildTokenReport() { return null; }
  _recordTokens() {}
  _recordFailure(err, operation, shown) { this.recordedFailure = { err, operation, shown }; }
  _canReportBug() { return false; }
  _onAIProgress() {}
  async render() {}
  _beginProgress() {
    if (beginFailure) { const failure = beginFailure; beginFailure = null; throw failure; }
    this.abort = new AbortController(); return this.abort.signal;
  }
  _throwIfCancelled() {
    if (this.abort?.signal.aborted) throw Object.assign(new Error("cancelled"), { cancelled: true });
  }
  async _setStep() { this._throwIfCancelled(); }
  _cancelGeneration() { this.abort?.abort(); }
  _finishRun() { this.abort = null; }
}
const mocks = {
  MODULE_ID: "simplysf2e", SpfApp: MockSpfApp,
  getProviderRequestConfig: () => ({ provider: {}, connections: [], hasConfiguredApiKey: false, connectionName: "" }),
  getProviderAuthWarningKey: () => null,
  authorizeApiKeyForCurrentBaseUrl: async () => true,
  getPacksFor: () => ["sf2e.equipment"],
  getShopCandidates: async () => [CANDIDATE],
  getCandidateDocument: async () => currentDoc,
  toItemData: () => ({ name: "Kit", type: "equipment", system: {} }),
  priceToGp: realPriceToGp,
  unitPriceGp: realUnitPriceGp,
  gpToCredits: realGpToCredits,
  verifyCreatedActor: () => { if (verifyFailure) throw verifyFailure; },
  moveToGeneratedFolder: async () => {},
  SourcesConfigApp: class {},
  activeParty: () => null,
  // Shop
  generateShopConcept: async () => { generationCalls++; return { concept: {}, usage: { total: 1 } }; },
  selectShopStock: async () => ({ ids: [CANDIDATE.id], usage: { total: 1 } }),
  SHOP_SIZES: { standard: 4 }, SHOP_CATEGORIES: { armor: {} }, SHOP_RARITIES: ["common"],
  SHOP_MIN_LEVEL: 0, SHOP_MAX_LEVEL: 20,
  clampShopLevel: (value, fallback) => Number(value) || fallback,
  normalizeShopConcept: () => ({ categories: ["armor"], keywords: [], name: "Merchant" }),
  shopTypesFor: () => ({ types: ["equipment"] }),
  pickShopStock: () => ({ stock: [CANDIDATE], unknown: [] }),
  shopStockValue: () => 10,
  shopActorData: () => ({ name: "Merchant", type: "npc" }),
  // Treasure
  generateTreasureConcept: async () => { generationCalls++; return { concept: {}, usage: { total: 1 } }; },
  selectTreasureItems: async () => ({ ids: [CANDIDATE.id], usage: { total: 1 } }),
  TREASURE_AMOUNTS: ["encounter"], TREASURE_PICKS: { encounter: 1 }, TREASURE_RARITIES: ["common"],
  TREASURE_MIN_LEVEL: 0, TREASURE_MAX_LEVEL: 20, TREASURE_MIN_PARTY: 1, TREASURE_MAX_PARTY: 8,
  clampTreasureLevel: (value, fallback) => Number(value) || fallback,
  clampPartySize: (value) => Number(value) || 4,
  treasureBudgetCredits: () => hoardBudget,
  creditsEach: () => 170,
  normalizeTreasureConcept: () => ({ categories: ["armor"], keywords: [] }),
  resolveIssuedPicks: (ids, candidates) => ({ issued: candidates }),
  fillHoard: (ids, priced, budget) => {
    lastHoard = { priced, budget };
    return { items: priced, unknown: [], overBudget: [], unpriced: [] };
  },
  hoardLeftover: () => 0,
  splitCurrency: () => [],
  assembleCurrency: () => null,
  treasureActorData: () => ({ name: "Hoard", type: "npc" })
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
      for (const name of imports) this.setExport(name, mocks[name] ?? (() => {}));
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}
const { ShopApp } = await load("./shop-app.mjs");
const { TreasureApp } = await load("./treasure-app.mjs");

function form(controls) {
  return { querySelector: (selector) => {
    const name = selector.match(/name="(\w+)"/)?.[1];
    return name in controls ? { value: controls[name] } : null;
  } };
}
function instance(App, controls) {
  const app = new App();
  app.element = form(controls);
  return app;
}
const shopControls = { prompt: "QA shop", level: "4", size: "standard", rarity: "common" };
const hoardControls = { prompt: "QA hoard", level: "4", partySize: "4", amount: "encounter", rarity: "common" };

for (const [label, App, controls, createdKey, survivorKey] of [
  ["shop", ShopApp, shopControls, "SIMPLYSF2E.Shop.Created", "SIMPLYSF2E.Shop.RollbackSurvivor"],
  ["treasure", TreasureApp, hoardControls, "SIMPLYSF2E.Treasure.Created", "SIMPLYSF2E.Treasure.RollbackSurvivor"]
]) {
  const actions = App.DEFAULT_OPTIONS.actions;
  const create = actions.createShop ?? actions.createTreasure;
  const generate = actions.generate;

  // (a) Create succeeds, verification throws, and the rollback delete fails: the
  // error names the surviving actor and the preview is cleared, so a retry cannot duplicate it.
  let app = instance(App, controls);
  await generate.call(app);
  createdName = "Survivor One";
  verifyFailure = new Error("verify failed");
  deleteFailure = new Error("delete refused");
  createCalls = 0;
  await create.call(app);
  const afterFailure = await app._prepareContext();
  assert.ok(afterFailure.error?.includes(survivorKey), `${label}: error names the survivor`);
  assert.ok(afterFailure.error?.includes("Survivor One"), `${label}: error includes the surviving actor's name`);
  assert.equal(afterFailure.preview, null, `${label}: preview is cleared when the survivor exists`);
  await create.call(app);
  assert.equal(createCalls, 1, `${label}: a retry after a surviving actor does not create a second one`);
  verifyFailure = null;
  deleteFailure = null;

  // (a2) The survivor note is its own sentence: a period is added when the failure lacks one, never doubled.
  for (const [message, lead] of [["manifest did not match", "manifest did not match. "], ["Verify failed.", "Verify failed. "]]) {
    app = instance(App, controls);
    await generate.call(app);
    createdName = "Survivor Two";
    verifyFailure = new Error(message);
    deleteFailure = new Error("delete refused");
    await create.call(app);
    const error = (await app._prepareContext()).error;
    assert.ok(error.startsWith(lead + survivorKey), `${label}: "${message}" is followed by a separate sentence (got ${error})`);
    assert.ok(!error.includes(".."), `${label}: no doubled period`);
    verifyFailure = null;
    deleteFailure = null;
    createdName = "Merchant";
  }

  // (a3) A thrown non-Error (no .message) still gets the survivor note; nothing throws.
  app = instance(App, controls);
  await generate.call(app);
  createdName = "Survivor Three";
  verifyFailure = "plain string failure";
  deleteFailure = new Error("delete refused");
  await create.call(app);
  const plain = (await app._prepareContext()).error;
  assert.ok(plain?.startsWith("plain string failure. ") && plain.includes(survivorKey), `${label}: a plain-string throw keeps the survivor note (got ${plain})`);
  assert.ok(plain.includes("Survivor Three"), `${label}: the survivor name is in the note`);
  verifyFailure = null;
  deleteFailure = null;
  createdName = "Merchant";

  // (a4) A plain-string throw with a successful rollback still shows that string as the error.
  app = instance(App, controls);
  await generate.call(app);
  verifyFailure = "plain string, clean rollback";
  deleteFailure = null;
  await create.call(app);
  const cleanPlain = (await app._prepareContext()).error;
  assert.equal(cleanPlain, "plain string, clean rollback", `${label}: the plain-string message is the error text (got ${cleanPlain})`);
  verifyFailure = null;

  // (b) Starting progress throws once: Generate is not left busy.
  app = instance(App, controls);
  beginFailure = new Error("progress setup failed");
  const before = generationCalls;
  await generate.call(app).catch(() => {});
  await generate.call(app);
  assert.equal(generationCalls, before + 1, `${label}: a failed progress start must not leave Generate stuck busy`);

  // (c) An AI name reaches the notification as an escaped format value.
  app = instance(App, controls);
  createdName = "<b>x</b>";
  await generate.call(app);
  notices.length = 0;
  await create.call(app);
  const created = notices.find(([, key]) => key === createdKey);
  assert.ok(created, `${label}: the created notice is sent`);
  assert.equal(created[2].localize, true, `${label}: key is localized`);
  assert.equal(created[2].escape, true, `${label}: AI names are escaped by the notification`);
  assert.equal(created[2].format.name, "<b>x</b>", `${label}: the raw name is a format value`);
  createdName = "Merchant";
}
// (d) Pack-priced ammo (price.per 10): the shop row and the hoard pick use the unit price.
const packAmmo = { name: "Ammo", type: "ammo", system: { level: { value: 1 }, price: { value: { sp: 5000 }, per: 10 }, quantity: 1 } };
const unpricedPer = { name: "Ammo", type: "ammo", system: { level: { value: 1 }, price: { value: { sp: 5000 } }, quantity: 1 } };
const zeroPer = { name: "Ammo", type: "ammo", system: { level: { value: 1 }, price: { value: { sp: 5000 }, per: 0 }, quantity: 1 } };
const shopPrice = async (doc) => {
  currentDoc = doc;
  const shop = instance(ShopApp, shopControls);
  await ShopApp.DEFAULT_OPTIONS.actions.generate.call(shop);
  return (await shop._prepareContext()).preview.rows[0].price;
};
assert.equal(await shopPrice(packAmmo), "500", "a 10-round pack priced 5,000 sp shows 500 credits per round");
assert.equal(await shopPrice(unpricedPer), (5000).toLocaleString(), "no per: the row price is unchanged");
assert.equal(await shopPrice(zeroPer), (5000).toLocaleString(), "per 0 counts as one: the row price is unchanged");

currentDoc = packAmmo;
hoardBudget = 4000;
const hoard = instance(TreasureApp, hoardControls);
await TreasureApp.DEFAULT_OPTIONS.actions.generate.call(hoard);
assert.equal(lastHoard.budget, 4000, "the hoard budget is the 4000-credit budget");
assert.equal(lastHoard.priced[0].credits, 500, "the hoard prices the ammo pick at its unit price (500 credits)");
hoardBudget = 680;

console.log("shop-treasure.lifecycle.test.mjs: survivor report, progress-start recovery, escaped names and unit pricing passed");
