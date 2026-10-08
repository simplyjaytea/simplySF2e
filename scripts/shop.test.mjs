// Pure Shop generator rules.
// Run: node scripts/shop.test.mjs
import assert from "node:assert/strict";
import {
  SHOP_SIZES, SHOP_STACK, clampShopLevel, shopTypesFor, withinShopRarity, normalizeShopConcept,
  pickShopStock, shopStockValue, shopDescriptionHtml, shopActorData
} from "./shop.mjs";

// Levels clamp to 0-20; junk keeps the fallback.
assert.equal(clampShopLevel(25), 20);
assert.equal(clampShopLevel(-3), 0);
assert.equal(clampShopLevel("7"), 7);
assert.equal(clampShopLevel("abc", 4), 4);

// Category slugs map to real item types; unknown slugs drop, none valid means all.
const weapons = shopTypesFor(["Weapons", "lasers"]);
assert.deepEqual(weapons.categories, ["weapons"]);
assert.deepEqual([...weapons.types].sort(), ["ammo", "weapon"]);
assert.ok(!shopTypesFor(["armor"]).types.has("treasure"), "treasure is never shop stock");
assert.equal(shopTypesFor(["nonsense"]).categories.length, 4, "no valid slug falls back to every category");
assert.equal(shopTypesFor(null).types.size, 7);
assert.ok(!shopTypesFor(["gear"]).types.has("kit"), "kits are not physical, so a merchant cannot hold one");

// Rarity cap.
assert.ok(withinShopRarity("common", "common"));
assert.ok(withinShopRarity(undefined, "common"), "missing rarity counts as common");
assert.ok(!withinShopRarity("uncommon", "common"));
assert.ok(withinShopRarity("uncommon", "rare"));
assert.ok(!withinShopRarity("unique", "rare"));

// Concept: flavor only, trimmed, keywords deduped, categories validated.
const concept = normalizeShopConcept({
  name: "  Vex's   Arms  ", shopkeeper: "Vex, a retired soldier", blurb: "Field-tested only.",
  description: "Para one.\n\nPara <two>.", keywords: ["Laser", "laser", " rifle ", "", 7],
  categories: ["weapons", "potions"], price: 9999
});
assert.equal(concept.name, "Vex's Arms");
assert.deepEqual(concept.keywords, ["laser", "rifle", "7"]);
assert.deepEqual(concept.categories, ["weapons"]);
assert.ok(!("price" in concept), "the AI never sets a number");
assert.equal(normalizeShopConcept(null).name, "Unnamed Shop");

// Picks: issued IDs only, no repeats, capped, module-set quantities.
const candidates = [
  { id: "c-a", name: "Laser Pistol", type: "weapon", level: 1 },
  { id: "c-b", name: "Battery", type: "ammo", level: 0 },
  { id: "c-c", name: "Healing Serum", type: "consumable", level: 1 },
  { id: "c-d", name: "Second Skin", type: "armor", level: 1 }
];
const { stock, unknown } = pickShopStock(
  ["c-a", "c-a", { id: "c-b" }, "c-zzz", "healing serum", "c-d"], candidates, 3
);
assert.deepEqual(stock.map((row) => row.id), ["c-a", "c-b", "c-c"]);
assert.deepEqual(unknown, ["c-zzz"]);
assert.equal(stock[0].quantity, 1);
assert.equal(stock[1].quantity, SHOP_STACK.ammo);
assert.equal(stock[2].quantity, SHOP_STACK.consumable);
assert.equal(pickShopStock("nope", candidates, 5).stock.length, 0);
assert.equal(pickShopStock(["c-a"], candidates, 0).stock.length, 0);
assert.ok(SHOP_SIZES.small < SHOP_SIZES.standard && SHOP_SIZES.standard < SHOP_SIZES.large);

// Stock value.
assert.equal(shopStockValue([{ credits: 100, quantity: 1 }, { credits: 5, quantity: 3 }]), 115);
assert.equal(shopStockValue(null), 0);

// Description escapes AI text.
const html = shopDescriptionHtml({ ...concept, shopkeeper: "<script>x</script>" });
assert.ok(!html.includes("<script>"));
assert.ok(html.includes("&lt;two&gt;"));
assert.ok(shopDescriptionHtml(concept, { shopkeeperLabel: "Ladenbesitzer" }).includes("<strong>Ladenbesitzer:</strong>"));

// Actor data: native loot actor in Merchant mode (v14-dev actor/loot/data.ts).
const items = [{ name: "Laser Pistol", type: "weapon" }];
const data = shopActorData(concept, 30, items);
assert.equal(data.type, "loot");
assert.equal(data.system.lootSheetType, "Merchant");
assert.equal(data.system.details.level.value, 20);
assert.equal(data.items, items);
assert.equal(data.name, "Vex's Arms");

console.log("shop.test.mjs: shop concept, stock picks, pricing and merchant data verified");
