import assert from "node:assert/strict";
import { REMEMBERED_FIELDS, rememberedInput, restoreGeneratorInput } from "./generator-memory.mjs";
import { THREATS } from "./encounter.mjs";
import { TREASURE_AMOUNT_MULTIPLIER } from "./tables.mjs";

const defaults = {
  mode: "monster", prompt: "", level: 1, rarity: "common", adjustment: null,
  allowSpellcasting: true, preset: "", partySize: 4, threat: "moderate",
  treasureAmount: "standard", rarityCap: "unique"
};

// Valid round trip: every remembered field survives, the prompt does not.
const input = {
  ...defaults, mode: "encounter", level: 7, rarity: "rare", adjustment: "elite",
  allowSpellcasting: false, preset: "envoy-scout", partySize: 6, threat: "severe",
  treasureAmount: "generous", rarityCap: "uncommon", prompt: "a secret"
};
const saved = JSON.parse(JSON.stringify(rememberedInput(input)));
assert.deepEqual(Object.keys(rememberedInput(input)), REMEMBERED_FIELDS);
assert.equal("prompt" in saved, false, "the prompt is never remembered");
assert.deepEqual(restoreGeneratorInput(saved, defaults), {
  ...input, prompt: ""
}, "valid round trip restores every remembered field and keeps the default prompt");

// Each invalid field falls back to its default.
const invalid = {
  mode: "bogus", level: "high", rarity: "legendary", adjustment: "hard",
  allowSpellcasting: "yes", preset: "x".repeat(201), partySize: "four",
  threat: "apocalyptic", treasureAmount: "lavish", rarityCap: "mythic"
};
assert.deepEqual(restoreGeneratorInput(invalid, defaults), defaults, "each invalid field keeps its default");
assert.deepEqual(restoreGeneratorInput({ adjustment: null }, { ...defaults, adjustment: "weak" }).adjustment, null,
  "an explicit null adjustment is a valid saved value");
assert.equal(restoreGeneratorInput({ preset: "x".repeat(200) }, defaults).preset.length, 200, "200 characters is allowed");
assert.equal(restoreGeneratorInput({ level: Number.NaN }, defaults).level, 1, "NaN level falls back");
assert.equal(restoreGeneratorInput({ partySize: Number.POSITIVE_INFINITY }, defaults).partySize, 4, "Infinity party size falls back");
assert.equal(restoreGeneratorInput({ allowSpellcasting: 0 }, defaults).allowSpellcasting, true, "non-boolean keeps default");

// Level is clamped per mode, using the restored mode.
assert.equal(restoreGeneratorInput({ mode: "monster", level: -9 }, defaults).level, -1);
assert.equal(restoreGeneratorInput({ mode: "npc", level: 99 }, defaults).level, 24);
assert.equal(restoreGeneratorInput({ mode: "monster", level: 2.6 }, defaults).level, 3, "level is rounded");
assert.equal(restoreGeneratorInput({ mode: "character", level: -1 }, defaults).level, 1, "PC level floor is 1");
assert.equal(restoreGeneratorInput({ mode: "encounter", level: 30 }, defaults).level, 20, "encounter level cap is 20");
assert.equal(restoreGeneratorInput({ mode: "character", level: 24 }, { ...defaults, mode: "character" }).level, 20);
assert.equal(restoreGeneratorInput({ level: 24 }, defaults).level, 24, "monster mode keeps level 24");
assert.equal(restoreGeneratorInput({ mode: "reskin", level: -1 }, defaults).level, 1, "reskin uses the PC-style range");

// Party size is clamped to 1..8.
assert.equal(restoreGeneratorInput({ partySize: 0 }, defaults).partySize, 1);
assert.equal(restoreGeneratorInput({ partySize: 12.4 }, defaults).partySize, 8);

// Enum fields accept every real key.
for (const threat of Object.keys(THREATS)) assert.equal(restoreGeneratorInput({ threat }, defaults).threat, threat);
for (const treasureAmount of Object.keys(TREASURE_AMOUNT_MULTIPLIER)) {
  assert.equal(restoreGeneratorInput({ treasureAmount }, defaults).treasureAmount, treasureAmount);
}

// Prompt is ignored even when present in saved data.
assert.equal(restoreGeneratorInput({ prompt: "saved text" }, defaults).prompt, "");

// Garbage input returns defaults and never throws.
for (const saved of [null, undefined, "monster", 42, true, [], ["npc"]]) {
  const restored = restoreGeneratorInput(saved, defaults);
  assert.deepEqual(restored, defaults, `garbage ${JSON.stringify(saved)} returns defaults`);
  assert.notEqual(restored, defaults, "a copy of the defaults, not the same object");
}

// rememberedInput tolerates missing input.
assert.deepEqual(rememberedInput(null), Object.fromEntries(REMEMBERED_FIELDS.map((f) => [f, undefined])));

console.log("generator-memory tests passed");
