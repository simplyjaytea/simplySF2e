// Fast-follow fix for the credits-first prompts (Astra review of p1-prompts):
// the AI now reports "value" in credits, but the custom-item fallback edge and
// the loot/equipment budget math still run in gp. This pins the ÷10 credits→gp
// normalization at the ITEM-CREATION edge — customTreasureItem /
// customEquipmentItem must write {gp: value / 10}, not {gp: value} — so a
// no-match fallback no longer over-prices by 10×. The budget edge
// (equipmentValueGp / resolveLoot resolvedValue) is pinned separately in
// builder.equipmentValueGp.test.mjs and currency.test.mjs (creditsToGp).
// Run: node scripts/builder.creditsFallback.test.mjs

import assert from "node:assert/strict";

// customTreasureItem / customEquipmentItem reach game.i18n.localize only.
globalThis.game = { i18n: { localize: (key) => key } };

const { customTreasureItem, customEquipmentItem } = await import("./builder.mjs");

/* ---- item creation: a credits estimate becomes a gp price, ÷10 ---- */

{
  const treasure = customTreasureItem("Relic", 1, 100);
  assert.equal(treasure.type, "treasure");
  assert.equal(treasure.system.price.value.gp, 10, "100 credits becomes a 10 gp custom treasure, not 100 gp");

  const equipment = customEquipmentItem("Gadget", 1, 100);
  assert.equal(equipment.type, "equipment");
  assert.equal(equipment.system.price.value.gp, 10, "100 credits becomes a 10 gp custom gear item, not 100 gp");
}

/* ---- grounded passes are unaffected ---- */

{
  // A grounded (zeroed) estimate stays 0 gp — never a spurious 10× price.
  const zeroed = customTreasureItem("Ground", 1, 0);
  assert.equal(zeroed.system.price.value.gp, 0, "a zeroed (grounded) value stays 0 gp");

  // Negative / NaN / non-numeric fail closed to 0 gp, same as creditsToGp.
  assert.equal(customTreasureItem("Bad", 1, -5).system.price.value.gp, 0, "a negative value stays 0 gp");
  assert.equal(customEquipmentItem("Bad", 1, NaN).system.price.value.gp, 0, "a NaN value stays 0 gp");
}

console.log("builder.creditsFallback.test.mjs: credits→gp normalization at the item-creation fallback edge passed");
