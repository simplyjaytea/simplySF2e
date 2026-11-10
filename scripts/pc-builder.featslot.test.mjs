// Regression check for R3-PC (replaces the issue #64 item 4a retry): an
// ancestry or class feat slot whose trait-filtered candidate query returns []
// stays EMPTY (JT, 2026-11-10: no approximate fill). The old retry without the
// trait filled it with another ancestry's or class's feat, which the system
// does not check. Archetype slots never loosened either. The real function is
// exercised end to end in pc-builder.ancestryTrait.test.mjs.
// Run: node scripts/pc-builder.featslot.test.mjs
//
// The loop lives in resolvePCConcept (reads compendium globals), so the pure
// slice is copied verbatim below (source of truth — keep in sync).

import assert from "node:assert/strict";

// Stub getFeatCandidates: returns [] for any TRAIT-filtered query, but a real
// candidate for a no-traits query — a loosened retry would wrongly hit it.
async function getFeatCandidates({ level, category, traits = [] }) {
  if (traits.length) return []; // trait query misses
  return [{ name: `${category}-feat`, level }]; // loosened query hits
}

const warnings = [];
const origWarn = console.warn;
console.warn = (msg) => warnings.push(msg);

// --- Copied verbatim from scripts/pc-builder.mjs resolvePCConcept() feat loop ---
async function buildSlots(slots, ancestryTrait, classTrait) {
  const featSlots = [];
  for (const slot of slots) {
    const traits = slot.archetype ? ["archetype"]
      : slot.type === "ancestry" ? [ancestryTrait]
      : slot.type === "class" ? [classTrait] : [];
    let candidates = await getFeatCandidates({
      level: slot.level, category: slot.type, traits, prerequisiteContext: undefined
    });
    if (candidates.length) featSlots.push({ ...slot, candidates });
    else {
      console.warn(`simplysf2e | no feat candidates for a ${slot.type}${slot.archetype ? " (archetype)" : ""} slot at level ${slot.level} — slot remains unresolved`);
      featSlots.push({ ...slot, candidates: [] });
    }
  }
  return featSlots;
}

const slots = [
  { type: "ancestry", level: 1 }, // trait query misses -> stays empty
  { type: "class", level: 2 },    // trait query misses -> stays empty
  { type: "skill", level: 2 },    // no traits -> hits directly
  { type: "class", level: 2, archetype: true } // keeps "archetype" trait -> stays empty, warns
];

const built = await buildSlots(slots, "elf", "fighter");
console.warn = origWarn;

assert.equal(built.length, 4, "all entitlements survive as slots");
assert.deepEqual(built.map((s) => s.type), ["ancestry", "class", "skill", "class"], "all slots keep their types");
assert.deepEqual(built[0].candidates, [], "ancestry slot is not filled by a trait-less retry");
assert.deepEqual(built[1].candidates, [], "class slot is not filled by a trait-less retry");
assert.ok(built[2].candidates.length, "skill slot (no trait filter) still fills");
assert.deepEqual(built[3].candidates, [], "unsupported archetype retains an empty candidate list");
assert.ok(warnings.some((w) => w.includes("(archetype)")), "an empty archetype slot warns");

console.log("pc-builder feat-slot no-retry regression check: all assertions passed");
