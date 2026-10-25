// Regression check for cause B (class-bench REPORT.md): resolveFeatPicks fills
// slots in order and never gives a feat back, so a later slot whose candidates
// were all taken stayed empty even when a full assignment existed. The repair
// may move an earlier slot to another of ITS OWN candidates, but never moves an
// AI pick unless that frees an otherwise empty slot.
// Run: node scripts/pc-builder.featMatching.test.mjs
//
// Uses the real resolveFeatPicks and the real getFeatCandidates with stubbed
// Foundry globals, so every candidate carries a locally issued reference.
import assert from "node:assert/strict";

const feats = [
  { _id: "alpha-feat", name: "Alpha Feat", level: 1 },
  { _id: "gamma-feat", name: "Gamma Feat", level: 1 },
  { _id: "beta-feat", name: "Beta Feat", level: 2 }
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
    system: { category: "general", level: { value: f.level }, prerequisites: { value: [] }, traits: { value: [] } }
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

// The real issued candidate list at level 2 (sorted by level, then name).
const pool = await getFeatCandidates({ level: 2, category: "general" });
assert.deepEqual(pool.map((c) => c.name), ["Alpha Feat", "Gamma Feat", "Beta Feat"], "fixture pool");
const offer = (name) => pool.find((c) => c.name === name);

// A slot offering exactly these named feats, in this order.
const slot = (type, level, names) => ({ type, level, archetype: false, candidates: names.map(offer) });
// An AI pick for a 1-based slot, carrying the exact reference offered to that slot.
const aiPick = (featSlots, index, name) => ({
  slot: index + 1, name, candidate: featSlots[index].candidates.find((c) => c.name === name)?.ref
});

const warnings = [];
const origWarn = console.warn;
const captureWarnings = () => { warnings.length = 0; console.warn = (msg) => warnings.push(String(msg)); };
const restoreWarnings = () => { console.warn = origWarn; };
const moved = () => warnings.filter((w) => /moved to|filled with/.test(w));

/* 1. An AI pick that is the only way to fill an empty slot moves, with a warning. */
for (const exactContent of [true, false]) {
  const featSlots = [slot("general", 2, ["Alpha Feat", "Beta Feat"]), slot("general", 1, ["Alpha Feat"])];
  captureWarnings();
  const out = await resolveFeatPicks(featSlots, [aiPick(featSlots, 0, "Alpha Feat")], { exactContent });
  restoreWarnings();
  assert.equal(out[0].name, "Beta Feat", `AI-picked slot moves to its other candidate (exactContent=${exactContent})`);
  assert.equal(out[0].entry, offer("Beta Feat").ref, "moved slot carries that candidate's exact reference");
  assert.equal(out[1].name, "Alpha Feat", "the empty slot gets the freed feat");
  assert.equal(out[1].entry, offer("Alpha Feat").ref, "freed feat is the exact reference offered to the empty slot");
  assert.ok(moved().some((w) => w.includes('slot 1 (general, level 2) moved to "Beta Feat"')),
    "the AI-picked slot that moved is named in a warning");
}

/* 2. A default-filled slot moves to another of its own candidates. */
{
  const featSlots = [slot("general", 2, ["Alpha Feat", "Beta Feat"]), slot("general", 1, ["Alpha Feat"])];
  captureWarnings();
  const out = await resolveFeatPicks(featSlots, [], { exactContent: true });
  restoreWarnings();
  assert.equal(out[0].entry, offer("Beta Feat").ref, "default-filled slot moves off the contested feat");
  assert.equal(out[1].entry, offer("Alpha Feat").ref, "the empty slot takes the freed feat");
  assert.ok(moved().some((w) => w.includes('slot 1 (general, level 2) moved to "Beta Feat"')), "the move warns");
}

/* 3. A default-filled slot moves before an AI-picked slot holding another feat the empty slot could take. */
{
  const featSlots = [
    slot("general", 2, ["Alpha Feat", "Gamma Feat", "Beta Feat"]), // AI picks Alpha
    slot("general", 2, ["Alpha Feat", "Gamma Feat", "Beta Feat"]), // no pick: defaults to Gamma
    slot("general", 1, ["Alpha Feat", "Gamma Feat"])               // empty: Alpha (AI-held) or Gamma (default-held)
  ];
  captureWarnings();
  const out = await resolveFeatPicks(featSlots, [aiPick(featSlots, 0, "Alpha Feat")], { exactContent: true });
  restoreWarnings();
  assert.equal(out[0].entry, offer("Alpha Feat").ref, "the AI pick is kept");
  assert.equal(out[1].entry, offer("Beta Feat").ref, "the default-filled slot moved instead");
  assert.equal(out[2].entry, offer("Gamma Feat").ref, "the empty slot took the freed Gamma Feat");
  assert.equal(moved().filter((w) => w.includes("slot 1 (")).length, 0, "the AI-picked slot was not moved");
}

/* 4. A chain: the AI-picked slot moves only to free an empty slot, through a second slot. */
{
  const featSlots = [
    slot("general", 2, ["Alpha Feat", "Gamma Feat", "Beta Feat"]), // AI picks Alpha, may move to Beta
    slot("general", 1, ["Alpha Feat", "Gamma Feat"]),              // defaults to Gamma
    slot("general", 1, ["Alpha Feat", "Gamma Feat"])               // empty until the chain frees Alpha
  ];
  captureWarnings();
  const out = await resolveFeatPicks(featSlots, [aiPick(featSlots, 0, "Alpha Feat")], { exactContent: true });
  restoreWarnings();
  assert.equal(out[0].entry, offer("Beta Feat").ref, "the AI-picked slot moved to free the chain");
  assert.equal(out[1].entry, offer("Gamma Feat").ref, "the middle slot keeps its default");
  assert.equal(out[2].entry, offer("Alpha Feat").ref, "the last slot takes the freed Alpha Feat");
  assert.ok(moved().some((w) => w.includes("slot 1 (")), "the AI-picked slot's move warns");
}

/* 5. A valid AI pick is never moved when nothing needs it. */
{
  const featSlots = [
    slot("general", 2, ["Alpha Feat", "Beta Feat"]),
    slot("general", 2, ["Alpha Feat", "Beta Feat"]),
    slot("general", 2, [])                          // no candidates: nothing to fill
  ];
  captureWarnings();
  const out = await resolveFeatPicks(featSlots, [aiPick(featSlots, 0, "Alpha Feat")], { exactContent: true });
  restoreWarnings();
  assert.equal(out[0].entry, offer("Alpha Feat").ref, "the valid AI pick stays");
  assert.equal(out[1].entry, offer("Beta Feat").ref, "the next slot takes its own free candidate");
  assert.equal(out[2].entry, null, "a slot with no candidates stays empty");
  assert.equal(moved().length, 0, "nothing is moved when no slot is left empty with a candidate");
}

/* 6. No solution: two slots share one candidate; the second stays empty as before. */
{
  const featSlots = [slot("general", 1, ["Alpha Feat"]), slot("general", 1, ["Alpha Feat"])];
  captureWarnings();
  const out = await resolveFeatPicks(featSlots, [aiPick(featSlots, 0, "Alpha Feat")], { exactContent: true });
  restoreWarnings();
  assert.equal(out[0].entry, offer("Alpha Feat").ref, "the AI pick stays when no other feat exists");
  assert.equal(out[1].entry, null, "the second slot stays empty when no full assignment exists");
  assert.equal(out[1].name, "general feat", "the empty slot keeps its placeholder name");
  assert.equal(moved().length, 0, "no slot moves when no full assignment exists");
}

/* 7. Only exact issued references take part; a forged reference never moves anything. */
{
  const forged = { packId: "sf2e.feats", _id: "alpha-feat" };
  const featSlots = [
    slot("general", 2, ["Alpha Feat", "Gamma Feat", "Beta Feat"]), // AI picks Alpha
    { type: "general", level: 1, archetype: false, candidates: [{ name: "Alpha Feat", ref: forged }] }
  ];
  captureWarnings();
  const out = await resolveFeatPicks(featSlots, [aiPick(featSlots, 0, "Alpha Feat")], { exactContent: true });
  restoreWarnings();
  assert.equal(out[0].entry, offer("Alpha Feat").ref, "the AI pick is not moved for a forged candidate");
  assert.equal(out[1].entry, null, "a forged candidate never fills a slot");
  assert.equal(moved().length, 0, "no slot moves for a forged candidate");
}

console.log("pc-builder feat-matching regression check: all assertions passed");
