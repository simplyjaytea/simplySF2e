// Regression check for issue #64 item 6: after the first purchase pass, if
// more than 25% of the wealth target is still sitting as credits, the PC
// pipeline triggers ONE more generatePCLoot purchase pass. This checks the
// trigger predicate that gates that extra pass.
// The predicate lives in generator-app.mjs #generatePC (heavy Foundry deps, not
// importable). parseCoins / lootValueGp are production helpers.
// Run: node scripts/generator-app.goldshortfall.test.mjs

import assert from "node:assert/strict";
import { parseCoins, lootValueGp } from "./builder.mjs";

function needsExtraPurchasePass(loot, wealthTarget) {
  const coinGp = lootValueGp(loot.filter((l) => parseCoins(l.name)));
  return coinGp > wealthTarget * 0.25;
}

const target = 1000;

const coinHeavy = [
  { name: "Longsword", resolvedValue: 100, quantity: 1 },
  { name: "Credstick", resolvedValue: 0.1, quantity: 9000 }
];
assert.equal(needsExtraPurchasePass(coinHeavy, target), true, "90% credits triggers an extra purchase pass");

const itemHeavy = [
  { name: "+1 striking longsword", resolvedValue: 700, quantity: 1 },
  { name: "Healing Potion (Lesser)", resolvedValue: 12, quantity: 4 },
  { name: "Credstick", resolvedValue: 0.1, quantity: 1500 }
];
assert.equal(needsExtraPurchasePass(itemHeavy, target), false, "15% credits does not trigger another pass");

const atThreshold = [{ name: "Credstick", resolvedValue: 0.1, quantity: 2500 }];
assert.equal(needsExtraPurchasePass(atThreshold, target), false, "exactly 25% is not over the threshold");

const noCoin = [{ name: "Bag of Holding", resolvedValue: 500, quantity: 1 }];
assert.equal(needsExtraPurchasePass(noCoin, target), false, "a coinless haul never triggers an extra pass");

console.log("generator-app gold-shortfall regression check: all assertions passed");
