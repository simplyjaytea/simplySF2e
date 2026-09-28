// Numeric edges in currency.mjs conversions plus the assembleCurrency()
// fail-closed contract: zero/negative/NaN/fractional inputs and unknown
// units must yield 0 or null, not NaN or an invented coin document.
// (Extreme magnitudes can still overflow to Infinity — pre-existing
// behavior, out of scope here.) Run: node scripts/currency.test.mjs

import assert from "node:assert/strict";
import { gpToCredits, toCredits, assembleCurrency, CREDSTICK_SOURCE, UPB_SOURCE } from "./currency.mjs";

/* ---------------------------------------------------------------------- *
 * gpToCredits(): non-positive and non-numeric gp never becomes credits
 * ---------------------------------------------------------------------- */

assert.equal(gpToCredits(0), 0, "zero gp is zero credits");
assert.equal(gpToCredits(-3), 0, "negative gp is zero credits");
assert.equal(gpToCredits(NaN), 0, "NaN gp is zero credits, not NaN");
assert.equal(gpToCredits("abc"), 0, "non-numeric gp is zero credits");
assert.equal(gpToCredits(undefined), 0, "missing gp is zero credits");
assert.equal(gpToCredits(0.05), 1, "a sub-credit amount rounds up to one credit, not zero");
assert.equal(gpToCredits(0.1), 1, "one credit of gp stays one credit");
assert.equal(gpToCredits(1.5), 15, "fractional gp converts at 10 credits per gp");
assert.equal(gpToCredits(15), 150, "Table 10-10 level-1 lump sum surfaces as 150 credits");

/* ---------------------------------------------------------------------- *
 * toCredits(): counts round before converting; unknown units fail closed
 * ---------------------------------------------------------------------- */

assert.equal(toCredits("gp", 0), 0, "a zero count is zero credits");
assert.equal(toCredits("gp", -5), 0, "a negative count is zero credits");
assert.equal(toCredits("gp", NaN), 0, "a NaN count is zero credits");
assert.equal(toCredits("credits", 0), 0, "passthrough units still reject zero");
assert.equal(toCredits("gp", 1.4), 10, "counts round to whole coins before converting");
assert.equal(toCredits("gp", 1.5), 20, "a .5 count rounds up before converting");
assert.equal(toCredits("gp", "3"), 30, "string counts convert like numbers");
assert.equal(toCredits("credits", 5), 5, "credits pass through untouched");
assert.equal(toCredits("upb", 3), 3, "UPB passes through untouched");
assert.equal(toCredits("bogus", 5), 0, "an unknown source unit is zero credits, not NaN");

/* ---------------------------------------------------------------------- *
 * assembleCurrency(): fail closed on bad quantity, bad unit, or bad shape
 * ---------------------------------------------------------------------- */

assert.equal(assembleCurrency("credits", 0), null, "zero quantity assembles nothing");
assert.equal(assembleCurrency("credits", -4), null, "negative quantity assembles nothing");
assert.equal(assembleCurrency("upb", NaN), null, "NaN quantity assembles nothing");
assert.equal(assembleCurrency("gp", 10), null, "classic coin units are never assembled");
assert.equal(assembleCurrency("bogus", 5), null, "unknown units assemble nothing");

{
  const credstick = assembleCurrency("credits", 2.4);
  assert.equal(credstick.system.price.value.sp, 2, "fractional quantities round to whole credits");
  assert.equal(credstick.system.quantity, 1, "credstick quantity stays locked to 1");
  assert.equal(credstick._id, undefined, "cloned templates drop the source _id");
  assert.equal(credstick.system.category, "credstick");
}

{
  const upb = assembleCurrency("upb", 3);
  assert.equal(upb.system.quantity, 3, "UPB stacks carry the count on quantity");
  assert.equal(upb.system.slug, "upb");
}

{
  const capped = assembleCurrency("credits", 1e9);
  assert.equal(capped.system.price.value.sp, 100000, "quantities cap instead of overflowing");
}

{
  // Bad template shapes fail closed (guards at assembleCurrency): mutate in
  // memory, assert null, restore in finally so later suites are unaffected.
  const credType = CREDSTICK_SOURCE.type;
  const credCat = CREDSTICK_SOURCE.system?.category;
  const upbType = UPB_SOURCE.type;
  const upbSlug = UPB_SOURCE.system?.slug;
  try {
    CREDSTICK_SOURCE.type = "weapon";
    assert.equal(assembleCurrency("credits", 5), null, "wrong credstick template type assembles nothing");
    CREDSTICK_SOURCE.type = "treasure";
    CREDSTICK_SOURCE.system.category = "goods";
    assert.equal(assembleCurrency("credits", 5), null, "wrong credstick category assembles nothing");
    UPB_SOURCE.type = "weapon";
    assert.equal(assembleCurrency("upb", 5), null, "wrong UPB template type assembles nothing");
    UPB_SOURCE.type = "treasure";
    UPB_SOURCE.system.slug = "scrap";
    assert.equal(assembleCurrency("upb", 5), null, "wrong UPB slug assembles nothing");
  } finally {
    CREDSTICK_SOURCE.type = credType;
    CREDSTICK_SOURCE.system.category = credCat;
    UPB_SOURCE.type = upbType;
    UPB_SOURCE.system.slug = upbSlug;
  }
  assert.notEqual(assembleCurrency("credits", 5), null, "restored credstick template assembles again");
  assert.notEqual(assembleCurrency("upb", 5), null, "restored UPB template assembles again");
}

console.log("currency.test.mjs: conversion edges and assembleCurrency fail-closed behavior passed");
