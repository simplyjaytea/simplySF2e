// Shop window. Shapes follow ShopApp._prepareContext() and
// #buildPreviewContext() in scripts/shop-app.mjs. Stock rows are real
// sf2e 1.5.1 equipment (foundryvtt/pf2e v14-dev packs/sf2e/equipment):
// name, type, level and price (stored as `sp`, shown as credits).
import { providerContext, PROVIDER_ATTENTION, TOKEN_REPORT, progressAt, localize } from "./_shared.mjs";

const SIZES = [
  { value: "small", count: 8, label: "SIMPLYSF2E.Shop.SizeSmall" },
  { value: "standard", count: 16, label: "SIMPLYSF2E.Shop.SizeStandard" },
  { value: "large", count: 24, label: "SIMPLYSF2E.Shop.SizeLarge" }
];
const RARITIES = ["common", "uncommon", "rare"].map((value) => ({
  value, label: `SIMPLYSF2E.Rarity.${value[0].toUpperCase()}${value.slice(1)}`
}));

const SHOP_STEPS = [
  ["shopConcept", localize("SIMPLYSF2E.Shop.ProgressConcept")],
  ["candidates", localize("SIMPLYSF2E.Shop.ProgressCandidates")],
  ["stock", localize("SIMPLYSF2E.Shop.ProgressStock")],
  ["prices", localize("SIMPLYSF2E.Shop.ProgressPrices")]
];

const PROMPT = "A cramped weapons stall on Absalom Station run by a retired soldier who only sells what she has field-tested.";

export function shopContext(patch = {}) {
  const input = { prompt: "", level: 3, size: "standard", rarity: "common", ...(patch.input ?? {}) };
  const { input: _ignored, ...rest } = patch;
  return {
    input,
    busy: false,
    canCancel: false,
    error: null,
    canReportBug: false,
    progress: null,
    ...providerContext(),
    minLevel: 0,
    maxLevel: 20,
    sizes: SIZES,
    rarities: RARITIES,
    preview: null,
    tokenReport: null,
    showEmptyState: true,
    ...rest
  };
}

const row = (key, name, typeLabel, level, credits, quantity = 1, rarity = null) => ({
  key, name, typeLabel: `SIMPLYSF2E.Shop.Type${typeLabel}`, level, rarity, price: credits.toLocaleString(), quantity
});

const ROWS = [
  row("c-1", "Battery (Commercial)", "Ammo", 0, 10, 3),
  row("c-2", "Battery (Tactical)", "Ammo", 2, 20, 3),
  row("c-3", "Carapace Armor", "Armor", 0, 45),
  row("c-4", "Freebooter Armor", "Armor", 0, 65),
  row("c-5", "Adrenosuppressant Serum (Commercial)", "Consumable", 2, 70, 3),
  row("c-6", "Comm Unit", "Gear", 1, 7),
  row("c-7", "Hacking Toolkit (Tactical)", "Gear", 3, 500),
  row("c-8", "Medkit (Tactical)", "Gear", 3, 500),
  row("c-9", "Antimagic Grenade (Commercial)", "Weapon", 0, 10, 1),
  row("c-10", "Dueling Sword", "Weapon", 0, 10),
  row("c-11", "Laser Pistol", "Weapon", 0, 30),
  row("c-12", "Plasma Doshko", "Weapon", 0, 30),
  row("c-13", "Zero Pistol", "Weapon", 0, 30)
];

const total = ROWS.reduce((sum, r) => sum + Number(r.price.replace(/,/g, "")) * r.quantity, 0);

const preview = (patch = {}) => ({
  concept: {
    name: "Vex's Field-Tested Arms",
    shopkeeper: "Sergeant Ilka Vex, retired, missing two fingers and none of her opinions",
    blurb: "If Vex hasn't fired it, you can't buy it.",
    description: "A shuttered stall wedged between a noodle bar and a recycling chute on Absalom Station's Spike. Every weapon on the rack carries a scorch mark and a handwritten tag with the date Vex last test-fired it.",
    keywords: ["laser", "pistol", "armor", "battery"],
    categories: ["weapons", "armor", "gear", "consumables"]
  },
  level: 3,
  categories: ["weapons", "armor", "gear", "consumables"].map((slug) => `SIMPLYSF2E.Shop.Category${slug[0].toUpperCase()}${slug.slice(1)}`),
  rows: ROWS,
  hasStock: true,
  count: ROWS.length,
  total: total.toLocaleString(),
  dropped: 0,
  ...patch
});

export default [
  { id: "shop-empty", app: "shop", context: shopContext() },
  { id: "shop-empty-attention", app: "shop", context: shopContext({ ...PROVIDER_ATTENTION }) },
  {
    id: "shop-busy",
    app: "shop",
    optionalKeys: ["busyMessage"],
    context: shopContext({
      input: { prompt: PROMPT }, busy: true, canCancel: true, showEmptyState: false,
      progress: progressAt(SHOP_STEPS, 2, { phase: "writing", percent: 61, detail: "Writing…" })
    })
  },
  {
    id: "shop-error",
    app: "shop",
    context: shopContext({
      input: { prompt: PROMPT }, showEmptyState: false, canReportBug: true,
      error: localize("SIMPLYSF2E.Shop.NoCandidates")
    })
  },
  {
    id: "shop-preview",
    app: "shop",
    context: shopContext({
      input: { prompt: PROMPT }, showEmptyState: false, tokenReport: TOKEN_REPORT,
      lastRunCost: "Last run: 2,310 tokens", preview: preview({ dropped: 1 })
    })
  },
  {
    id: "shop-all-removed",
    app: "shop",
    context: shopContext({
      input: { prompt: PROMPT }, showEmptyState: false,
      preview: preview({ rows: [], hasStock: false, count: 0, total: "0" })
    })
  }
];
