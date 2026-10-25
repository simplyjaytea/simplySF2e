// Dedication rule in resolveFeatPicks (sf2e-1.6.1 journals/archetypes.json: "Once
// you take a dedication feat, you can't select a different dedication feat until
// you complete your dedication by taking two other feats from your current
// archetype."). An archetype slot whose pick breaks the rule is skipped, not
// filled, and the repair never moves a slot into a state the rule forbids.
// Run: node scripts/pc-builder.dedicationPicking.test.mjs
//
// Uses the real resolveFeatPicks, the real getFeatCandidates and the real
// validateArchetypeSlotPlacement with stubbed Foundry globals.
import assert from "node:assert/strict";

const feats = [
  { _id: "alpha-dedication", name: "Alpha Dedication", level: 2, traits: ["archetype", "dedication"], prereqs: [] },
  { _id: "beta-dedication", name: "Beta Dedication", level: 2, traits: ["archetype", "dedication"], prereqs: [] },
  { _id: "alpha-one", name: "Alpha One", level: 2, traits: ["archetype"], prereqs: ["Alpha Dedication"] },
  { _id: "alpha-two", name: "Alpha Two", level: 4, traits: ["archetype"], prereqs: ["Alpha Dedication"] },
  { _id: "beta-one", name: "Beta One", level: 4, traits: ["archetype"], prereqs: ["Beta Dedication"] }
];
const makePack = (collection, title, indexEntries) => ({
  collection,
  title,
  metadata: { type: "Item" },
  async getIndex() {
    return indexEntries;
  },
  getDocument: async () => null
});
const packs = new Map([
  ["sf2e.feats", makePack("sf2e.feats", "Feats", feats.map((f) => ({
    _id: f._id, name: f.name, type: "feat",
    system: {
      category: "class",
      level: { value: f.level },
      traits: { value: f.traits },
      prerequisites: { value: f.prereqs.map((value) => ({ value })) }
    }
  })))]
]);
packs[Symbol.iterator] = function* () { yield* this.values(); };

globalThis.game = { packs, settings: { get: () => ({}) }, i18n: { localize: (k) => k } };
globalThis.CONFIG = { PF2E: {} };
globalThis.fromUuid = async () => null;
globalThis.foundry = { utils: { randomID: () => "id" } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 50 } };

const { resolveFeatPicks } = await import("./pc-builder.mjs");
const { getFeatCandidates } = await import("./compendium.mjs");
const { validateArchetypeSlotPlacement } = await import("./pc-prerequisites.mjs");

// The real issued archetype candidate list at level 8 (sorted by level, then name).
const pool = await getFeatCandidates({ level: 8, category: "class", traits: ["archetype"] });
assert.deepEqual(
  pool.map((c) => c.name).sort(),
  feats.map((f) => f.name).sort(),
  "fixture pool"
);
const offer = (name) => pool.find((c) => c.name === name);

// An archetype class slot offering exactly these named feats, in this order.
const slot = (level, names) => ({ type: "class", level, archetype: true, candidates: names.map(offer) });
// An AI pick for a 1-based slot, carrying the exact reference offered to that slot.
const aiPick = (featSlots, index, name) => ({
  slot: index + 1, name, candidate: featSlots[index].candidates.find((c) => c.name === name)?.ref
});

const warnings = [];
const origWarn = console.warn;
const captureWarnings = () => { warnings.length = 0; console.warn = (msg) => warnings.push(String(msg)); };
const restoreWarnings = () => { console.warn = origWarn; };
const skipped = () => warnings.filter((w) => /skipped: dedication rule/.test(w));
const moved = () => warnings.filter((w) => /moved to|filled with/.test(w));

// The Free Archetype placement check (generator-app's safety net) must find nothing to reject.
const assertNothingRejected = (featSlots, out, label) => {
  captureWarnings();
  const { dropped } = validateArchetypeSlotPlacement(featSlots, out, null);
  restoreWarnings();
  assert.deepEqual(dropped, [], `${label}: validateArchetypeSlotPlacement rejects nothing`);
};

/* 1. The AI picks two dedications in a row: the second slot takes the open archetype's follow-up. */
{
  const featSlots = [
    slot(2, ["Alpha Dedication", "Beta Dedication"]),
    slot(4, ["Beta Dedication", "Beta One", "Alpha Two"])
  ];
  captureWarnings();
  const out = await resolveFeatPicks(featSlots, [
    aiPick(featSlots, 0, "Alpha Dedication"),
    aiPick(featSlots, 1, "Beta Dedication")
  ], { exactContent: true });
  restoreWarnings();
  assert.equal(out[0].entry, offer("Alpha Dedication").ref, "the first dedication is kept");
  assert.equal(out[1].name, "Alpha Two", "the second slot takes a follow-up of the open dedication, not Beta One");
  assert.equal(out[1].entry, offer("Alpha Two").ref, "the follow-up carries its exact issued reference");
  assert.equal(skipped().length, 1, "the illegal dedication pick warns once");
  assert.ok(skipped()[0].includes('"Beta Dedication" for slot 2'), "the warning names the skipped pick and slot");
  assertNothingRejected(featSlots, out, "two dedications in a row");
}

/* 2. No legal candidate: the slot is left empty (entry null), not rejected. */
{
  const featSlots = [slot(2, ["Alpha Dedication"]), slot(4, ["Beta Dedication"])];
  captureWarnings();
  const out = await resolveFeatPicks(featSlots, [
    aiPick(featSlots, 0, "Alpha Dedication"),
    aiPick(featSlots, 1, "Beta Dedication")
  ], { exactContent: true });
  restoreWarnings();
  assert.equal(out[1].entry, null, "the slot with no legal feat stays empty");
  assert.equal(out[1].placement, undefined, "an empty slot is not marked rejected");
  assert.equal(out[1].name, "class feat", "the empty slot keeps its placeholder name");
  assert.equal(skipped().length, 1, "the skipped pick warns once");
  assert.ok(skipped()[0].includes("no legal feat left, slot left empty"), "the same warning says the slot is empty");
  assertNothingRejected(featSlots, out, "no legal candidate");
}

/* 3. A dedication is legal again once its archetype has two follow-ups placed. */
{
  const featSlots = [
    slot(2, ["Alpha Dedication"]),
    slot(4, ["Alpha One", "Alpha Two"]),
    slot(4, ["Alpha One", "Alpha Two"]),
    slot(6, ["Beta Dedication"])
  ];
  captureWarnings();
  const out = await resolveFeatPicks(featSlots, [
    aiPick(featSlots, 0, "Alpha Dedication"),
    aiPick(featSlots, 1, "Alpha One"),
    aiPick(featSlots, 2, "Alpha Two"),
    aiPick(featSlots, 3, "Beta Dedication")
  ], { exactContent: true });
  restoreWarnings();
  assert.deepEqual(out.map((row) => row.name), ["Alpha Dedication", "Alpha One", "Alpha Two", "Beta Dedication"],
    "two follow-ups complete the dedication, so the next dedication is kept");
  assert.equal(skipped().length, 0, "no pick is skipped");
  assertNothingRejected(featSlots, out, "completed dedication");
}

/* 4. With no AI pick, the default follows the open archetype's follow-up, not the list order. */
{
  const featSlots = [
    slot(2, ["Alpha Dedication"]),
    slot(4, ["Beta Dedication", "Beta One", "Alpha Two"])
  ];
  captureWarnings();
  const out = await resolveFeatPicks(featSlots, [], { exactContent: true });
  restoreWarnings();
  assert.equal(out[0].name, "Alpha Dedication", "the first slot defaults to its first candidate");
  assert.equal(out[1].name, "Alpha Two", "the default for a later slot is the open archetype's follow-up");
  assert.equal(skipped().length, 0, "the default never needs a skip");
  assertNothingRejected(featSlots, out, "default picks");
}

/* 5. Repair never moves a slot into a state the dedication rule forbids. */
{
  // Slot 2 can only get Alpha Dedication, which slot 1 holds. The augmenting
  // path would move slot 1 to Beta Dedication and give slot 2 Alpha Dedication,
  // a second dedication while Beta has no follow-ups: forbidden. Slot 2 stays empty.
  const featSlots = [
    slot(2, ["Alpha Dedication", "Beta Dedication"]),
    slot(4, ["Alpha Dedication"])
  ];
  captureWarnings();
  const out = await resolveFeatPicks(featSlots, [], { exactContent: true });
  restoreWarnings();
  assert.equal(out[0].name, "Alpha Dedication", "the first slot keeps its dedication");
  assert.equal(out[0].entry, offer("Alpha Dedication").ref, "the first slot keeps its exact reference");
  assert.equal(out[1].entry, null, "the second slot stays empty rather than take a second dedication");
  assert.equal(moved().length, 0, "no slot is moved in a way the rule forbids");
  assertNothingRejected(featSlots, out, "repair refusal");
}

console.log("pc-builder dedication-picking check: all assertions passed");
