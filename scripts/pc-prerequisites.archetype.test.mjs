// Chronological Free Archetype slot-placement validation without a grant
// graph: trait, level, order, duplicates, and readable prerequisite chains
// against a staged context. No pack data, no provider, no Foundry globals.
// Run: node scripts/pc-prerequisites.archetype.test.mjs
import assert from "node:assert/strict";
import {
  archetypeOfFeat, isArchetypeFeat, stagedActorContext, validateArchetypeSlotPlacement
} from "./pc-prerequisites.mjs";

const warnings = [];
const origWarn = console.warn;
console.warn = (message) => warnings.push(String(message));

function entry(name, { level = 2, traits = ["archetype"], prerequisites = [] } = {}) {
  return {
    name,
    system: {
      level: { value: level },
      traits: { value: traits },
      prerequisites: { value: prerequisites }
    }
  };
}

const slot = (level, candidates = []) => ({ type: "class", level, archetype: true, candidates });
const fill = (name, record) => ({ name, entry: record });
const reasons = (result) => result.dropped.map((record) => record.reason);

// --- isArchetypeFeat: fail-closed trait probe across staged shapes ---
assert.equal(isArchetypeFeat(entry("Dedication")), true, "a full entry carrying the archetype trait qualifies");
assert.equal(isArchetypeFeat({ name: "Dedication", traits: ["archetype"] }), true,
  "an issued candidate record carrying the archetype trait qualifies");
assert.equal(isArchetypeFeat(entry("Class Feat", { traits: ["fighter"] })), false,
  "a same-shape feat without the archetype trait does not qualify");
assert.equal(isArchetypeFeat({}), false, "an unreadable shape is not an archetype feat");
assert.equal(isArchetypeFeat(null), false, "a missing shape is not an archetype feat");

// --- Placement-only mode (null context): trait, level, order, duplicates ---
{
  const dedication = entry("Test Dedication");
  const result = validateArchetypeSlotPlacement([slot(2)], [fill("Test Dedication", dedication)], null);
  assert.deepEqual(result.placed, [0], "a trait/level-fitting dedication is placed without a staged context");
  assert.deepEqual(result.dropped, [], "nothing is rejected on the happy path");
}

{
  // Candidate-list join: an opaque issued ref recovers trait/level evidence
  // from its own slot's candidate list, by ref identity.
  const ref = { packId: "test.feats", _id: "dedication" };
  const candidates = [{ name: "Test Dedication", level: 2, traits: ["archetype"], ref }];
  const result = validateArchetypeSlotPlacement(
    [slot(2, candidates)], [{ name: "Test Dedication", entry: ref }], null);
  assert.deepEqual(result.placed, [0], "an opaque ref joins its slot's candidate list by identity");
}

{
  const ref = { packId: "test.feats", _id: "dedication" };
  const candidates = [{ name: "Test Dedication", level: 2, traits: ["archetype"], ref: { packId: "other", _id: "x" } }];
  const result = validateArchetypeSlotPlacement(
    [slot(2, candidates)], [{ name: "Test Dedication", entry: ref }], null);
  assert.deepEqual(result.placed, [0], "a ref miss falls back to a same-name candidate in the same slot");
}

{
  const strong = entry("Heavy Trick", { level: 4 });
  const result = validateArchetypeSlotPlacement([slot(2)], [fill("Heavy Trick", strong)], null);
  assert.deepEqual(result.placed, [], "a feat above its slot level is not placed");
  assert.ok(reasons(result).some((reason) => reason.includes("exceeds")),
    "an over-level placement names the level mismatch");
}

{
  const plain = entry("Plain Class Feat", { traits: ["fighter"] });
  const result = validateArchetypeSlotPlacement([slot(2)], [fill("Plain Class Feat", plain)], null);
  assert.deepEqual(result.placed, [], "a non-archetype feat never fills an archetype slot");
}

{
  const unreadable = { name: "Mystery Feat" };
  const result = validateArchetypeSlotPlacement([slot(2)], [{ name: "Mystery Feat", entry: unreadable }], null);
  assert.deepEqual(result.placed, [], "evidence without a readable trait fails closed");
}

{
  const dedication = entry("Test Dedication");
  const result = validateArchetypeSlotPlacement(
    [slot(2), slot(4)],
    [fill("Test Dedication", dedication), fill("Test Dedication", dedication)],
    null);
  assert.deepEqual(result.placed, [0], "the first of two identical archetype fills holds its slot");
  assert.ok(reasons(result).some((reason) => reason.includes("earlier archetype slot")),
    "a duplicate archetype fill is rejected, never double-placed");
}

{
  // A fill with no entry is already unresolved upstream and passes through
  // untouched — neither placed nor dropped.
  const dedication = entry("Test Dedication");
  const result = validateArchetypeSlotPlacement(
    [slot(2), slot(4)],
    [fill("Test Dedication", dedication), { name: "Empty Slot", entry: null }],
    null);
  assert.deepEqual(result.placed, [0], "the resolved fill is unaffected by its unresolved neighbor");
  assert.deepEqual(result.dropped, [], "an already-unresolved fill is not re-reported");
}

{
  // Placement-only mode skips prerequisite text: an unmet chain clause that
  // candidate time would have filtered is not re-litigated here.
  const chained = entry("Advanced Trick", { level: 4, prerequisites: [{ value: "Test Dedication" }] });
  const result = validateArchetypeSlotPlacement([slot(4)], [fill("Advanced Trick", chained)], null);
  assert.deepEqual(result.placed, [0], "without a staged context only slot fit is checked");
}

// --- Staged mode: readable chains prove chronologically, unproven closes ---
{
  const dedication = entry("Test Dedication");
  const chained = entry("Advanced Trick", { level: 4, prerequisites: [{ value: "Test Dedication" }] });
  const context = stagedActorContext({ level: 4 });
  const result = validateArchetypeSlotPlacement(
    [slot(2), slot(4)],
    [fill("Test Dedication", dedication), fill("Advanced Trick", chained)],
    context);
  assert.deepEqual(result.placed, [0, 1],
    "a later feat naming its earlier-placed dedication proves its chain with no grant graph");
}

{
  // Reversed order: the chain clause names a feat placed LATER, so it is
  // unproven at its own slot and fails closed while the dedication holds.
  const dedication = entry("Test Dedication");
  const chained = entry("Advanced Trick", { level: 2, prerequisites: [{ value: "Test Dedication" }] });
  const context = stagedActorContext({ level: 4 });
  const result = validateArchetypeSlotPlacement(
    [slot(2), slot(4)],
    [fill("Advanced Trick", chained), fill("Test Dedication", dedication)],
    context);
  assert.deepEqual(result.placed, [1], "an out-of-order chain proves nothing early");
  assert.ok(reasons(result).some((reason) => reason.includes("unproven")),
    "the unproven chain clause is reported, not guessed");
}

{
  // A staged base name also proves: dedication-equivalent context plus a
  // dependent archetype feat placed alone.
  const chained = entry("Advanced Trick", { level: 4, prerequisites: [{ value: "Sneak Attack" }] });
  const rogue = { name: "Rogue", system: { items: {
    sneak: { uuid: "Compendium.pf2e.classfeatures.Item.Sneak Attack", img: "x.webp", name: "Sneak Attack", level: 1 }
  } } };
  const context = stagedActorContext({ level: 4, class: rogue });
  const result = validateArchetypeSlotPlacement([slot(4)], [fill("Advanced Trick", chained)], context);
  assert.deepEqual(result.placed, [0], "a staged class grant proves a name clause in an archetype slot");
}

{
  // Malformed input never throws: it warns and drops.
  const dedication = entry("Test Dedication");
  const badSlot = validateArchetypeSlotPlacement(
    [{ type: "skill", level: 2 }], [fill("Test Dedication", dedication)], null);
  assert.deepEqual(badSlot.placed, [], "a non-archetype slot cannot place");
  const badLevel = validateArchetypeSlotPlacement(
    [{ type: "class", level: 0, archetype: true }], [fill("Test Dedication", dedication)], null);
  assert.deepEqual(badLevel.placed, [], "an unreadable slot level cannot place");
  const divergent = validateArchetypeSlotPlacement(
    [slot(2), slot(4)], [fill("Test Dedication", dedication)], null);
  assert.deepEqual(divergent.placed, [0], "divergent lists validate their overlap only");
  const unusable = validateArchetypeSlotPlacement("slots", [], null);
  assert.deepEqual(unusable, { placed: [], dropped: [] }, "non-list input validates nothing");
}

// --- archetypeOfFeat: prerequisite text names a placed dedication or follow-up ---
{
  const owners = new Map([["envoy-dedication", "envoy-dedication"], ["envoy-trick", "envoy-dedication"]]);
  const named = (...values) => entry("Probe", { prerequisites: values.map((value) => ({ value })) });
  assert.equal(archetypeOfFeat(named("Envoy Dedication"), owners), "envoy-dedication",
    "a clause naming the placed dedication belongs to its archetype");
  assert.equal(archetypeOfFeat(named("Envoy Trick"), owners), "envoy-dedication",
    "a clause naming a placed follow-up reaches the same archetype");
  assert.equal(archetypeOfFeat(named("Trained in Diplomacy"), owners), null,
    "an unrelated clause belongs to no archetype");
  assert.equal(archetypeOfFeat(entry("Probe"), owners), null, "a feat with no prerequisite text belongs to none");
  assert.equal(archetypeOfFeat(named("Envoy Dedication"), null), null, "no placed map proves nothing");
}

// --- Dedication rule: one open dedication until two of its feats are placed ---
const dedicationEntry = (name) => entry(name, { traits: ["archetype", "dedication"] });
const followEntry = (name, level, names) => entry(name, {
  level, prerequisites: names.map((value) => ({ value }))
});

{
  const result = validateArchetypeSlotPlacement(
    [slot(2), slot(4)],
    [fill("First Dedication", dedicationEntry("First Dedication")),
      fill("Second Dedication", dedicationEntry("Second Dedication"))],
    null);
  assert.deepEqual(result.placed, [0], "a second dedication is not placed while the first is open");
  assert.ok(reasons(result).some((reason) => reason.includes("dedication rule")),
    "the open-dedication rejection names the dedication rule");
}

{
  const result = validateArchetypeSlotPlacement(
    [slot(2), slot(4), slot(4), slot(6)],
    [fill("Envoy Dedication", dedicationEntry("Envoy Dedication")),
      fill("Envoy Trick", followEntry("Envoy Trick", 4, ["Envoy Dedication"])),
      fill("Envoy Art", followEntry("Envoy Art", 4, ["Envoy Dedication"])),
      fill("Second Dedication", dedicationEntry("Second Dedication"))],
    null);
  assert.deepEqual(result.placed, [0, 1, 2, 3],
    "a second dedication is placed once two feats of the open archetype are placed");
  assert.deepEqual(result.dropped, [], "nothing is rejected once the first dedication is complete");
}

{
  const result = validateArchetypeSlotPlacement(
    [slot(2), slot(4), slot(6)],
    [fill("Envoy Dedication", dedicationEntry("Envoy Dedication")),
      fill("Envoy Trick", followEntry("Envoy Trick", 4, ["Envoy Dedication"])),
      fill("Second Dedication", dedicationEntry("Second Dedication"))],
    null);
  assert.deepEqual(result.placed, [0, 1], "one follow-up does not complete the dedication");
  assert.deepEqual(result.dropped.map((record) => record.name), ["Second Dedication"],
    "the second dedication is the one rejected");
}

{
  const result = validateArchetypeSlotPlacement(
    [slot(2), slot(4), slot(4), slot(6)],
    [fill("Envoy Dedication", dedicationEntry("Envoy Dedication")),
      fill("Envoy Trick", followEntry("Envoy Trick", 4, ["Envoy Dedication"])),
      fill("Envoy Art", followEntry("Envoy Art", 4, ["Envoy Trick"])),
      fill("Second Dedication", dedicationEntry("Second Dedication"))],
    null);
  assert.deepEqual(result.placed, [0, 1, 2, 3],
    "a follow-up chained through an earlier follow-up counts toward its archetype");
}

{
  const result = validateArchetypeSlotPlacement(
    [slot(2), slot(4), slot(4), slot(6)],
    [fill("Envoy Dedication", dedicationEntry("Envoy Dedication")),
      fill("Envoy Trick", followEntry("Envoy Trick", 4, ["Envoy Dedication"])),
      fill("Lone Feat", followEntry("Lone Feat", 4, ["Some Other Feat"])),
      fill("Second Dedication", dedicationEntry("Second Dedication"))],
    null);
  assert.deepEqual(result.placed, [0, 1, 2],
    "a feat that names no open archetype is still placed");
  assert.deepEqual(result.dropped.map((record) => record.name), ["Second Dedication"],
    "an unrelated feat does not count toward the open dedication");
}

{
  // A candidate record carries no prerequisite text, so its archetype cannot
  // be proven: the follow-up does not count and the second dedication fails closed.
  const candidate = { name: "Candidate Feat", traits: ["archetype"], level: 4 };
  const result = validateArchetypeSlotPlacement(
    [slot(2), slot(4), slot(4), slot(6)],
    [fill("Envoy Dedication", dedicationEntry("Envoy Dedication")),
      fill("Envoy Trick", followEntry("Envoy Trick", 4, ["Envoy Dedication"])),
      fill("Candidate Feat", candidate),
      fill("Second Dedication", dedicationEntry("Second Dedication"))],
    null);
  assert.deepEqual(result.placed, [0, 1, 2], "an unprovable archetype feat is still a placed feat");
  assert.ok(reasons(result).some((reason) => reason.includes("dedication rule")),
    "a second dedication without two provable follow-ups fails closed");
}

{
  const result = validateArchetypeSlotPlacement(
    [slot(2), slot(4)],
    [fill("Envoy Dedication", dedicationEntry("Envoy Dedication")),
      fill("Unrelated Trick", followEntry("Unrelated Trick", 4, ["Some Other Feat"]))],
    null);
  assert.deepEqual(result.placed, [0, 1], "an unrelated non-dedication archetype feat is still accepted");
  assert.deepEqual(result.dropped, [], "an unrelated archetype feat is not rejected by the dedication rule");
}

assert.ok(warnings.length > 0, "every rejection path warns fail-closed");
assert.ok(warnings.every((message) => message.startsWith("simplysf2e |")),
  "placement warnings carry the module prefix");
console.warn = origWarn;

console.log("pc-prerequisites.archetype.test.mjs: Free Archetype slot-placement validation passed");
