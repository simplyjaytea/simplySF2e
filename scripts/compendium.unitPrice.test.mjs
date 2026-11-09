// unitPriceGp: a pack price (system.price.per) is divided by its count, as
// v14-dev Coins.fromPrice does (coins.ts:144-145). Run: node scripts/compendium.unitPrice.test.mjs
import assert from "node:assert/strict";
import { unitPriceGp } from "./compendium.mjs";

const doc = (price) => ({ system: { price: { value: { sp: 5000 }, ...price } } });

assert.equal(unitPriceGp(doc({ per: 10 })), 50, "a 10-round pack priced 5,000 sp is 50 gp per round");
assert.equal(unitPriceGp(doc({})), 500, "no per: the whole price is the unit price");
assert.equal(unitPriceGp(doc({ per: 0 })), 500, "per 0 counts as one");
assert.equal(unitPriceGp(doc({ per: "abc" })), 500, "a non-numeric per counts as one");
assert.equal(unitPriceGp(doc({ per: -4 })), 500, "a negative per counts as one");
assert.equal(unitPriceGp({ system: {} }), 0, "a missing price is zero gp");
assert.equal(unitPriceGp(null), 0, "a missing document is zero gp");

console.log("compendium.unitPrice.test.mjs: per-unit gp assertions passed");
