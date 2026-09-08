// SF2e tech/analog items use published grades, not PF2e +1 striking prefixes.
// Cited: v14-dev Migration942EquipmentGrade. Run: node scripts/runes.sf2ePrefix.test.mjs
import assert from "node:assert/strict";
import { parseRunes, hasRunes, dropUncitedRunePrefix } from "./runes.mjs";

assert.equal(dropUncitedRunePrefix("Laser Pistol").dropped, false);
assert.equal(dropUncitedRunePrefix("Laser Pistol").name, "Laser Pistol");
assert.equal(hasRunes(dropUncitedRunePrefix("Laser Pistol").runes), false);

assert.equal(dropUncitedRunePrefix("Stun Stick (Advanced)").dropped, false,
  "a published grade parenthetical is not a fundamental-rune prefix");
assert.equal(dropUncitedRunePrefix("Climbing Kit (Commercial)").name, "Climbing Kit (Commercial)");

const stripped = dropUncitedRunePrefix("+1 striking laser pistol");
assert.equal(stripped.dropped, true);
assert.equal(stripped.name, "laser pistol");
assert.equal(hasRunes(stripped.runes), false, "the uncited prefix must not be reapplied as system.runes");
assert.equal(parseRunes("+1 striking laser pistol").potency, 1,
  "parseRunes still sees the prefix; dropUncitedRunePrefix is what fails closed");

console.log("runes.sf2ePrefix.test.mjs: unpublished rune prefixes drop; published grades stay");
