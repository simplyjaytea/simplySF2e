// Currency loot must clone cited SF2e credstick/UPB templates (the same
// JSON addCurrency uses), never the custom-treasure fallback and never
// invented sf2e gold-piece UUIDs. Gold-piece language maps onto credits
// through DENOMINATION_RATES. Run: node scripts/builder.coins.test.mjs

import assert from "node:assert/strict";
import { priceToGp } from "./compendium.mjs";
import {
  parseCoins, currencyQuantity, isCoinageDocument, isCurrencyDocument,
  assembleCurrency, resolveCurrencyTemplate, CREDSTICK_SOURCE, UPB_SOURCE,
  CREDIT_UNIT_GP, DENOMINATION_RATES, gpToCredits
} from "./currency.mjs";

globalThis.game = {
  settings: { get: () => undefined },
  i18n: { localize: (key) => key },
  packs: { get: (id) => (id === "sf2e.equipment" ? { getIndex: async () => [], getDocument: async () => null } : undefined) }
};

const {
  normalizeLoot, resolveLoot, buildLootItems, applyTreasureBudget
} = await import("./builder.mjs");

/* ---------------------------------------------------------------------- *
 * Cited templates match v14-dev inventory JSON, not invented field shapes
 * ---------------------------------------------------------------------- */

assert.equal(CREDSTICK_SOURCE._id, "penfpVFkOqZYpmkU");
assert.equal(CREDSTICK_SOURCE.name, "Credstick");
assert.equal(CREDSTICK_SOURCE.type, "treasure");
assert.equal(CREDSTICK_SOURCE.system.category, "credstick");
assert.equal(CREDSTICK_SOURCE.system.slug, "credstick");
assert.equal(CREDSTICK_SOURCE.system.price.value.sp, 1);
assert.equal(UPB_SOURCE._id, "ALqTYbYspMMrJIDs");
assert.equal(UPB_SOURCE.name, "UPB");
assert.equal(UPB_SOURCE.system.slug, "upb");
assert.equal(UPB_SOURCE.system.category, "material");
assert.equal(UPB_SOURCE.system.price.value.sp, 1);
assert.deepEqual(DENOMINATION_RATES, {
  cp: 1, sp: 10, gp: 100, pp: 1000, credits: 10, upb: 10
});
assert.equal(CREDIT_UNIT_GP, 0.1);

assert.equal(priceToGp({ sp: 10 }), 1, "persisted credstick sp path is 0.1 gp per credit");
assert.equal(priceToGp({ credits: 10 }), 1, "prepared credits field uses the same rate as sp");
assert.equal(priceToGp({ credits: 10, sp: 10 }), 1, "do not double-count credits merged into sp");
assert.equal(priceToGp({ upb: 10 }), 1);

/* ---------------------------------------------------------------------- *
 * parseCoins: SF2e names + leftover gold-piece language; unknown fail closed
 * ---------------------------------------------------------------------- */

{
  assert.deepEqual(parseCoins("Credits"), { name: "Credstick", unit: "credits", sourceUnit: "credits", count: null });
  assert.deepEqual(parseCoins("350 credits"), { name: "Credstick", unit: "credits", sourceUnit: "credits", count: 350 });
  assert.equal(parseCoins("Credstick").name, "Credstick");
  assert.equal(parseCoins("UPB").name, "UPB");
  assert.equal(parseCoins("UPB").unit, "upb");
  assert.equal(parseCoins("20 UPBs").count, 20);
  assert.equal(parseCoins("universal polymer base").name, "UPB");

  assert.equal(parseCoins("Gold Coins").name, "Credstick");
  assert.equal(parseCoins("20 gp").count, 200, "1 gp = 10 credits");
assert.equal(gpToCredits(15), 150, "Table 10-10 level-1 lump sum surfaces as 150 credits");
assert.equal(gpToCredits(0), 0);
assert.equal(gpToCredits(0.1), 1, "one credit (0.1 gp) does not round to zero");
  assert.equal(parseCoins("5 sp").count, 5, "1 sp = 1 credit");
  assert.equal(parseCoins("pp").name, "Credstick");
  assert.deepEqual(
    normalizeLoot([{ name: "Gold Coins", quantity: 35, value: 1 }]),
    [{ name: "Credstick", quantity: 350, value: 0.1 }],
    "normalizeLoot converts leftover gold-piece lines onto Credstick"
  );
  assert.deepEqual(
    normalizeLoot([{ name: "Credits", quantity: 35, value: 0.1 }]),
    [{ name: "Credstick", quantity: 35, value: 0.1 }]
  );

  assert.equal(parseCoins("Electrum Coins"), null, "unknown denomination is not currency");
  assert.equal(parseCoins("adamantine pieces"), null, "non-SF2e metal is not currency");
  assert.equal(parseCoins("Bag of Gold"), null, "incidental gold in a name is not a coin line");
  assert.equal(parseCoins("Scroll of Fear"), null);
  assert.equal(currencyQuantity(parseCoins("Credits"), 12), 12);
}

assert.equal(isCoinageDocument({ type: "treasure", system: { category: "coin", price: { value: { gp: 1 } } } }), true);
assert.equal(isCoinageDocument({ type: "treasure", system: { stackGroup: "coins", price: { value: { gp: 1 } } } }), true);
assert.equal(isCurrencyDocument(CREDSTICK_SOURCE), true, "credstick category is currency");
assert.equal(isCurrencyDocument(UPB_SOURCE), true, "upb slug is currency");
assert.equal(isCurrencyDocument({ type: "treasure", system: { price: { value: { gp: 12 } } } }), false);

/* ---------------------------------------------------------------------- *
 * resolveLoot + exactContent uses bundled templates, not pack gold pieces
 * ---------------------------------------------------------------------- */

{
  const resolved = await resolveLoot({
    level: 1,
    loot: normalizeLoot([
      { name: "Gold Coins", quantity: 35, value: 1 },
      { name: "Mysterious Relic", quantity: 1, value: 12 }
    ])
  }, { exactContent: true });
  assert.equal(resolved.length, 2);
  assert.equal(resolved[0].name, "Credstick");
  assert.equal(resolved[0].quantity, 350);
  assert.equal(resolved[0].entry?.currency, "credits");
  assert.equal(resolved[0].resolvedValue, 0.1);
  assert.equal(resolved[1].entry, null, "named loot still cannot fuzzy-match under exactContent");
}

{
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  const resolved = await resolveLoot({
    level: 1,
    loot: [{ name: "Electrum Coins", quantity: 4, value: 2 }]
  }, { exactContent: true });
  console.warn = original;
  assert.equal(resolved.length, 1, "unknown denomination stays on the generic loot path");
  assert.equal(resolved[0].name, "Electrum Coins");
  assert.equal(resolved[0].entry, null);
  assert.equal(warnings.length, 0, "unknown denomination is not a coin drop; parseCoins already rejected it");
}

/* ---------------------------------------------------------------------- *
 * buildLootItems: credits/UPB clone cited templates, never custom treasure
 * ---------------------------------------------------------------------- */

{
  const resolved = await resolveLoot({
    level: 1,
    loot: normalizeLoot([
      { name: "Credits", quantity: 35, value: 0.1 },
      { name: "UPB", quantity: 8, value: 0.1 }
    ])
  }, { exactContent: true });
  const items = await buildLootItems(resolved);
  assert.equal(items.length, 2);
  assert.equal(items[0].name, "Credstick");
  assert.equal(items[0].type, "treasure");
  assert.equal(items[0].system.category, "credstick");
  assert.equal(items[0].system.quantity, 1, "addCurrency locks credstick quantity to 1");
  assert.equal(items[0].system.price.value.sp, 35, "credits count lives on price.value.sp");
  assert.equal(items[0]._id, undefined, "cloned templates drop the source _id");
  assert.equal(items[1].name, "UPB");
  assert.equal(items[1].system.slug, "upb");
  assert.equal(items[1].system.quantity, 8);
  for (const item of items) {
    assert.equal(item.system.description?.value?.includes("CustomItem"), false,
      "currency loot must not carry the custom-treasure label");
  }
}

{
  const items = await buildLootItems([
    { name: "Credstick", quantity: 12, value: 0.1, entry: null }
  ]);
  assert.equal(items[0].system.category, "credstick");
  assert.equal(items[0].system.price.value.sp, 12, "bundled credstick does not need a pack entry");
}

{
  const items = await buildLootItems([
    { name: "Credstick", quantity: 8, value: 0.1, entry: { currency: "credits" } },
    { name: "Unmatched Gem", quantity: 1, value: 15, entry: null }
  ]);
  assert.equal(items[0].system.category, "credstick");
  assert.equal(items[0].system.price.value.sp, 8);
  assert.equal(items[1].type, "treasure");
  assert.equal(items[1].system.category, undefined, "non-currency unmatched loot may still be custom treasure");
  assert.match(items[1].system.description.value, /CustomItem/);
}

/* The reject-on-null-entry test above only fires if assembleCurrency itself
 * fails. Probe that path by asking for an unknown unit. */
assert.equal(assembleCurrency("gp", 10), null, "classic coin units are not assembled as sf2e gold pieces");
assert.equal(resolveCurrencyTemplate("Gold Pieces"), null);

/* ---------------------------------------------------------------------- *
 * applyTreasureBudget pads/trims Credstick, not Gold Pieces
 * ---------------------------------------------------------------------- */

{
  const loot = [
    { name: "Potion of Healing (Minor)", quantity: 1, resolvedValue: 4, entry: {} }
  ];
  const padded = await applyTreasureBudget(loot, 50);
  const credits = padded.find((line) => line.name === "Credstick");
  assert.ok(credits, "budget shortfall creates a Credstick line");
  assert.equal(credits.entry?.currency, "credits");
  assert.equal(credits.quantity, 460, "46 gp gap becomes 460 credits at 0.1 gp each");
  const items = await buildLootItems(padded.filter((line) => line.name === "Credstick"));
  assert.equal(items[0].system.category, "credstick");
  assert.equal(items[0].system.price.value.sp, 460);
}

{
  const loot = [
    { name: "Credstick", quantity: 100, resolvedValue: 0.1, entry: { currency: "credits" } }
  ];
  const padded = await applyTreasureBudget(structuredClone(loot), 50);
  assert.equal(padded[0].quantity, 500, "an existing credit line is increased to close the gap");
  const trimmed = await applyTreasureBudget(structuredClone(loot), 4);
  assert.equal(trimmed[0].quantity, 40, "over-budget credit lines shrink");
}

console.log("builder.coins.test.mjs: credits/UPB templates, gold-to-credit mapping, and budget padding passed");
