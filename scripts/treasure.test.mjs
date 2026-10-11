// Pure Treasure hoard rules.
// Run: node scripts/treasure.test.mjs
import assert from "node:assert/strict";
import {
  TREASURE_AMOUNTS, TREASURE_PICKS, clampTreasureLevel, clampPartySize, treasureBudgetCredits, creditsEach,
  normalizeTreasureConcept, resolveIssuedPicks, fillHoard, hoardLeftover, treasureDescriptionHtml,
  treasureActorData
} from "./treasure.mjs";

// Budgets: TREASURE_BY_LEVEL level 4 total is 850 gp = 8,500 credits; one
// encounter is that / ENCOUNTERS_PER_LEVEL (12.5) = 68 gp = 680 credits.
assert.equal(treasureBudgetCredits(4, "encounter"), 680);
assert.equal(treasureBudgetCredits(4, "level"), 8500);
assert.equal(treasureBudgetCredits(4), 680, "one encounter is the default");
assert.equal(treasureBudgetCredits(99, "level"), treasureBudgetCredits(20, "level"), "levels clamp to 1-20");
assert.deepEqual([...TREASURE_AMOUNTS], ["encounter", "level"], "only two budget choices");
assert.ok(TREASURE_PICKS.encounter < TREASURE_PICKS.level);

// Party size is display only.
assert.equal(creditsEach(680, 4), 170);
assert.equal(creditsEach(680, 0), 680, "party size clamps to at least 1");
assert.equal(clampPartySize(50), 8);
assert.equal(clampTreasureLevel("x", 3), 3);
assert.equal(clampTreasureLevel(0), 1);

// Concept: flavor only.
const concept = normalizeTreasureConcept({
  name: "  Cryo-lab   salvage ", description: "Frozen <b>racks</b>.", keywords: ["Cryo", "cryo", " lab ", ""],
  categories: ["gear", "potions"], price: 9999, ids: ["x"]
});
assert.equal(concept.name, "Cryo-lab salvage");
assert.deepEqual(concept.keywords, ["cryo", "lab"]);
assert.deepEqual(concept.categories, ["gear"]);
assert.ok(!("price" in concept) && !("ids" in concept), "the AI never sets a number or an item");
assert.equal(normalizeTreasureConcept(null).name, "Unnamed Hoard");
assert.equal(normalizeTreasureConcept({ keywords: Array.from({ length: 30 }, (_, i) => `k${i}`) }).keywords.length, 12);
assert.equal(normalizeTreasureConcept({}).categories.length, 4, "no valid slug means every category");

// fillHoard.
const candidates = [
  { id: "a", name: "Comm Unit", credits: 70 },
  { id: "b", name: "Medkit", credits: 500 },
  { id: "c", name: "Laser Pistol", credits: 300 },
  { id: "d", name: "Battery", credits: 20 },
  { id: "e", name: "Mystery", credits: undefined }
];
const filled = fillHoard(["a", "a", "zzz", "b", "laser pistol", { id: "d" }, "e"], candidates, 680);
assert.deepEqual(filled.items.map((row) => row.id), ["a", "b", "d"], "AI order; duplicate and over-budget dropped");
assert.deepEqual(filled.unknown, ["zzz"]);
assert.deepEqual(filled.overBudget, ["Laser Pistol"], "300 does not fit in the 110 left after 70 + 500");
assert.deepEqual(filled.unpriced, ["Mystery"], "an unpriced pick is dropped, not guessed");
assert.equal(filled.leftover, 680 - 70 - 500 - 20);
assert.ok(filled.items.every((row) => row.quantity === 1));
assert.equal(hoardLeftover(680, filled.items), filled.leftover);
assert.equal(hoardLeftover(680, filled.items.slice(1)), 680 - 500 - 20, "removing a row returns its price");
assert.equal(fillHoard(["a"], candidates, 0).items.length, 0);
assert.equal(fillHoard("nope", candidates, 100).leftover, 100);
assert.equal(fillHoard(["a"], candidates, 70).leftover, 0, "an exact fit is allowed");
assert.equal(resolveIssuedPicks(["a", "Medkit"], candidates).issued.length, 2);
assert.equal(resolveIssuedPicks(["x"], [{ id: "p", name: "Dup" }, { id: "q", name: "Dup" }]).issued.length, 0, "ambiguous names are rejected");

// Escaping.
const html = treasureDescriptionHtml({ name: "n", description: "<script>x</script>" });
assert.ok(!html.includes("<script>"));

// Actor data: native loot actor in Loot mode (v14-dev actor/loot/data.ts).
const items = [{ name: "Comm Unit", type: "equipment" }];
const data = treasureActorData(concept, 40, items);
assert.equal(data.type, "loot");
assert.equal(data.system.lootSheetType, "Loot");
assert.equal(data.system.details.level.value, 20);
assert.equal(data.items, items);

console.log("treasure.test.mjs: budgets, hoard filling, concept and loot data verified");
