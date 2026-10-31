// Deterministic adversarial regression coverage for AI JSON/response validation
// and forged candidate references. No network, no Foundry world, no secrets.
import assert from "node:assert/strict";

globalThis.game = {
  settings: { get: () => ({}) },
  packs: new Map([
    ["test.equipment", {
      collection: "test.equipment",
      title: "Test Equipment",
      metadata: { type: "Item" },
      async getIndex() {
        return [{ _id: "longsword", name: "Longsword", type: "weapon", system: { level: { value: 0 }, traits: { value: [] } } }];
      },
      getDocument: async () => null
    }],
    ["test.feats", {
      collection: "test.feats",
      title: "Test Feats",
      metadata: { type: "Item" },
      async getIndex() {
        return [{ _id: "power-attack", name: "Power Attack", type: "feat", system: { level: { value: 1 }, category: "class", traits: { value: [] }, prerequisites: { value: [] } } }];
      },
      getDocument: async () => null
    }],
    ["test.spells", { async getIndex() { return []; } }]
  ]),
  i18n: { localize: (key) => key, format: (key) => key }
};
globalThis.CONFIG = { PF2E: {} };
globalThis.fromUuid = async () => null;
globalThis.foundry = { utils: { randomID: () => "id" } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 50 } };

const originalWarn = console.warn;
const warnings = [];
console.warn = (...args) => warnings.push(args.map(String).join(" "));

const { AIRequestError, parseConceptJSON } = await import("./ai.mjs");
const { taskResponseProblem, normalizeMulticlassPick } = await import("./ai-response-validation.mjs");
const { AI_TASK } = await import("./ai-task-profiles.mjs");
const { encodeFeatCandidateSlots, resolveEncodedFeatPicks } = await import("./ai-candidate-format.mjs");
const { completionManifest, completionSummary, assertComplete } = await import("./completion.mjs");
const { esc, toHtml } = await import("./text.mjs");
const { normalizeConcept, normalizeLoot, resolveConcept, resolveEquipment } = await import("./builder.mjs");
const { resolveFeatPicks } = await import("./pc-builder.mjs");
const { getFeatCandidates, isIssuedCandidate, getCandidateDocument } = await import("./compendium.mjs");

function badJson(input) {
  assert.throws(
    () => parseConceptJSON(input),
    (error) => error instanceof AIRequestError && error.retryable === true
      && error.message === "SIMPLYSF2E.Errors.BadJson",
    `malformed JSON must fail closed: ${JSON.stringify(input)?.slice(0, 80)}`
  );
}

// parseConceptJSON: malformed, truncated, and adversarial text.
badJson(undefined);
badJson(null);
badJson(42);
badJson(true);
badJson([]);
badJson({});
badJson("   ");
badJson("{");
badJson("}");
badJson("[1,2]");
badJson('"just a string"');
badJson('{"name":"Incomplete","traits":["fire"');
badJson('{"name":"Ash","nested":{"foo":1},"traits":["fire"');
badJson("```json\n{\"keywords\":[\"fire\"\n```\n}");
badJson("no object here");
badJson("");
badJson('{"a":"\\x"}');
badJson("{\n  \"name\": \"Ash\",\n  \"traits\": [\"fire\"\n");
badJson('{"name":"Ash","nested":{"foo":1}'); // unclosed root
const protoParsed = parseConceptJSON('{"__proto__":{"polluted":true}}');
assert.ok(protoParsed && typeof protoParsed === "object");
assert.equal(Object.prototype.polluted, undefined, "JSON parsing must not pollute Object.prototype");

const script = "<script>alert(1)</script>";
assert.deepEqual(parseConceptJSON(`{"name":${JSON.stringify(script)}}`), { name: script },
  "HTML/script text must remain literal data, not be interpreted");
assert.equal(esc(script), "&lt;script&gt;alert(1)&lt;/script&gt;",
  "esc must neutralize HTML metacharacters");
assert.equal(toHtml(`${script}\n\nsecond <b>paragraph</b>`),
  `<p>${esc(script)}</p><p>second &lt;b&gt;paragraph&lt;/b&gt;</p>`,
  "toHtml must escape every paragraph");
assert.ok(!toHtml(script).includes("<script>"), "toHtml must not emit raw script tags");

const huge = `${"x".repeat(800)} not json`;
const hugeError = (() => {
  try { parseConceptJSON(huge); throw new Error("expected throw"); }
  catch (error) { return error; }
})();
assert.ok(hugeError instanceof AIRequestError);
assert.equal(hugeError.details.contentLength, huge.length);
assert.ok(hugeError.details.preview.length < huge.length, "diagnostics must not retain the full oversized payload");
assert.ok(hugeError.details.preview.endsWith("…"), "oversized diagnostics must be truncated");

assert.deepEqual(
  parseConceptJSON('Use {fire} then return {"keywords":["fire","control"]}'),
  { keywords: ["fire", "control"] },
  "an invalid closed-brace pair must not block a later complete object"
);
assert.deepEqual(
  parseConceptJSON('{"outer":{"inner":{"k":1}},"traits":["fire"]}'),
  { outer: { inner: { k: 1 } }, traits: ["fire"] },
  "brace counting must handle nested objects"
);
assert.deepEqual(
  parseConceptJSON('{"name":"Ash","desc":"uses } in combat","nested":{"note":"still } ok"}}'),
  { name: "Ash", desc: "uses } in combat", nested: { note: "still } ok" } },
  "braces inside JSON strings are not delimiters"
);

// taskResponseProblem: structural validation and unknown tasks.
assert.equal(taskResponseProblem("not-a-task", {}), "unknown task not-a-task");
assert.equal(taskResponseProblem(undefined, {}), "unknown task undefined");
for (const task of Object.values(AI_TASK)) {
  assert.notEqual(taskResponseProblem(task, {}), null, `${task} must reject an empty object`);
  assert.notEqual(taskResponseProblem(task, null), null, `${task} must reject null`);
  assert.notEqual(taskResponseProblem(task, []), null, `${task} must reject an array root`);
  assert.notEqual(taskResponseProblem(task, "text"), null, `${task} must reject a string root`);
}
const validByTask = {
  [AI_TASK.CREATURE_CONCEPT]: {
    name: "Ash Drake", blurb: "b", description: "d", readAloud: "r", recallKnowledge: "rk", size: "Medium",
    traits: [], languages: [], abilityScales: {}, acScale: "high", hpScale: "high", perceptionScale: "high",
    saveScales: {}, speeds: [], senses: [], skills: [], strikes: [], specialAbilities: [], spellcasting: null,
    focusSpells: [], feats: [], equipment: [], loot: [], resistances: [], weaknesses: [], immunities: []
  },
  [AI_TASK.PC_CONCEPT]: {
    name: "A", ancestry: "Human", heritage: "Versatile", background: "Bounty Hunter", class: "Soldier",
    keyAbility: "str", blurb: "b", backstory: "s", appearance: "a", age: "1", gender: "x", height: "1",
    weight: "1", ethnicity: "e", nationality: "n", personality: "p", alignmentFlavor: "a", likes: "l",
    dislikes: "d", allies: "al", enemies: "en", organizations: "o", languages: [], feats: [], spellcasting: null,
    focusSpells: [], equipment: []
  },
  [AI_TASK.LOOT_DRAFT]: { loot: [] },
  [AI_TASK.SPELL_FOCUS]: { keywords: [] },
  [AI_TASK.SPELL_SELECTION]: { spells: [] },
  [AI_TASK.PC_SPELL_SELECTION]: { spells: [] },
  [AI_TASK.EQUIPMENT_SELECTION]: { equipment: [] },
  [AI_TASK.LOOT_SELECTION]: { loot: [] },
  [AI_TASK.ABILITY_SELECTION]: { abilityIds: [] },
  [AI_TASK.CREATURE_FEAT_SELECTION]: { featIds: [] },
  [AI_TASK.ABC_SELECTION]: { ancestry: "a", heritage: "h", background: "b", class: "c", keyAbility: "str" },
  [AI_TASK.FEAT_SELECTION]: { picks: [] },
  [AI_TASK.CHARACTER_CHOICES]: { picks: [] },
  [AI_TASK.MAGIC_ITEM_CONCEPT]: {
    name: "Charm", description: "d", rarity: "common", usage: "worn", traits: [], bulk: "light",
    invested: false, effects: []
  },
  [AI_TASK.RUNED_ITEM_CONCEPT]: { baseItemName: "Laser Pistol", description: "d" },
  [AI_TASK.ENCOUNTER_DESIGN]: { name: "Ambush", briefs: [] },
  [AI_TASK.RESKIN_FLAVOR]: {
    name: "Renamed", blurb: "b", description: "d", readAloud: "r", recallKnowledge: "rk", renames: []
  },
  [AI_TASK.REROLL_PICK]: { id: "longsword" },
  [AI_TASK.SHOP_CONCEPT]: { name: "Shop", shopkeeper: "K", blurb: "b", description: "d", keywords: [], categories: [] },
  [AI_TASK.SHOP_SELECTION]: { ids: [] },
  [AI_TASK.TREASURE_CONCEPT]: { name: "Hoard", description: "d", keywords: [], categories: [] },
  [AI_TASK.TREASURE_SELECTION]: { ids: [] }
};
for (const [task, value] of Object.entries(validByTask)) {
  assert.equal(taskResponseProblem(task, value), null, `${task} valid shape must pass`);
}
// Wrong types and missing fields are rejected.
assert.match(taskResponseProblem(AI_TASK.EQUIPMENT_SELECTION, { equipment: "x" }), /fields must be arrays/);
assert.match(taskResponseProblem(AI_TASK.MAGIC_ITEM_CONCEPT, { ...validByTask[AI_TASK.MAGIC_ITEM_CONCEPT], bulk: "huge" }), /fields must use offered enum slugs/);
assert.match(taskResponseProblem(AI_TASK.ABC_SELECTION, { ...validByTask[AI_TASK.ABC_SELECTION], ancestry: "" }), /fields must be non-empty strings/);
assert.match(taskResponseProblem(AI_TASK.CREATURE_CONCEPT, { ...validByTask[AI_TASK.CREATURE_CONCEPT], abilityScales: [] }), /fields must be objects/);

// normalizeMulticlassPick rejects unsupported values.
const allowed = new Set(["envoy", "operative"]);
assert.equal(normalizeMulticlassPick(null, allowed), null);
assert.equal(normalizeMulticlassPick(undefined, allowed), null);
assert.equal(normalizeMulticlassPick("  ENVOY  ", allowed), "envoy");
assert.equal(normalizeMulticlassPick("Operative", allowed), "operative");
assert.equal(normalizeMulticlassPick(42, allowed), null);
assert.equal(normalizeMulticlassPick({ slug: "envoy" }, allowed), null);
assert.equal(normalizeMulticlassPick("", allowed), null);
assert.equal(normalizeMulticlassPick("witchwarper", allowed), null);

// Candidate encoding ignores malformed slots and forged references cannot enter a slot.
const encoded = encodeFeatCandidateSlots([
  null,
  { candidates: [{ name: "Alpha", ref: { packId: "sf2e.feats", _id: "alpha" } }, { name: "  ", ref: { packId: "x", _id: "y" } }] },
  { candidates: [{ name: "Alpha", ref: { packId: "sf2e.feats", _id: "alpha" } }] }
]);
assert.deepEqual(encoded.slots[0], { number: 1, type: "feat", level: 0, ids: [] });
assert.deepEqual(encoded.slots[1], { number: 2, type: "feat", level: 0, ids: ["F0"] });
assert.deepEqual(encoded.slots[2], { number: 3, type: "feat", level: 0, ids: ["F0"] });
assert.equal(encoded.catalog[0].candidate.packId, "sf2e.feats");
const forgedPick = resolveEncodedFeatPicks(encoded, [
  { slot: 2, id: "F0" },
  { slot: 2, id: "F0" },          // duplicate slot
  { slot: 9, id: "F0" },          // unknown slot
  { slot: 1, id: "F0" },          // no candidates in slot 1
  { slot: 3, id: "ZZZZ" },        // unknown id
  { slot: "2", id: "f0" },        // invalid slot type
  null,
  { slot: 3 }                     // missing id
]);
assert.deepEqual(forgedPick, [{ slot: 2, name: "Alpha", candidate: { packId: "sf2e.feats", _id: "alpha" } }],
  "only an offered, exact encoded id can resolve");
const emptyEncoded = encodeFeatCandidateSlots("not an array");
assert.deepEqual(emptyEncoded, { catalog: [], slots: [] });

// Forged candidate references must not be treated as issued references.
const forgedRef = { packId: "sf2e.feats", _id: "forged-feat" };
assert.equal(isIssuedCandidate(forgedRef), false);
assert.equal(isIssuedCandidate(forgedRef, ["sf2e.feats"]), false);
assert.equal(await getCandidateDocument(forgedRef), null);
const normalizedForgedLoot = normalizeLoot([{ name: "Forged Relic", candidate: forgedRef }]);
assert.equal(normalizedForgedLoot[0].candidate, forgedRef, "normalizeLoot keeps a shape-valid candidate reference");
assert.equal(isIssuedCandidate(normalizedForgedLoot[0].candidate), false, "a forged candidate is not an issued reference");

// exactContent must drop a forged candidate rather than fuzzy-match it.
const forgedEquipment = await resolveEquipment(
  { level: 1, equipment: [{ name: "Longsword", quantity: 1, value: 0, candidate: forgedRef }] },
  { exactContent: true, skipped: [] }
);
assert.deepEqual(forgedEquipment, [], "a forged equipment candidate is not retained in strict mode");

// Forged references never fill a PC feat slot, even with an untrusted label.
const featSlots = [
  { type: "class", level: 1, archetype: false, candidates: [] }
];
const forgedFeat = await resolveFeatPicks(
  featSlots,
  [{ slot: 1, name: "Totally Real Feat", candidate: forgedRef }],
  { exactContent: true }
);
assert.equal(forgedFeat[0].entry, null, "a forged feat reference cannot fill a slot");

// completionManifest handles malformed/missing manifests without inventing success.
const badManifest = completionManifest({ mode: "npc", concept: null, resolved: null });
assert.equal(badManifest.complete, true, "an empty manifest has no unresolved required rows");
assert.equal(badManifest.unresolved.length, 0);
assert.throws(() => assertComplete({ complete: false, unresolved: [{ category: "feat", name: "X" }] }),
  /Generation is incomplete/);
const summary = completionSummary([null, { records: [{ status: "unresolved" }, { status: "compendium" }] }]);
assert.equal(summary.total, 2);
assert.equal(summary.unresolved, 1);
assert.equal(summary.compendium, 1);

// normalizeConcept must not crash on hostile/non-object input.
const normalized = normalizeConcept("not an object", { level: 1, rarity: "common" });
assert.equal(normalized.level, 1);
assert.ok(Array.isArray(normalized.strikes) && normalized.strikes.length > 0,
  "normalizeConcept supplies a safe default strike for hostile input");
const normalizedLoot = normalizeLoot([{ name: "<script>alert(1)</script>", quantity: "999999", value: -5, candidate: forgedRef }]);
assert.equal(normalizedLoot[0].name, "<script>alert(1)</script>", "loot names remain literal text");
assert.equal(normalizedLoot[0].quantity, 10, "quantity is capped");
assert.equal(normalizedLoot[0].value, 0, "negative values are clamped");
assert.equal(isIssuedCandidate(normalizedLoot[0].candidate), false, "a forged loot candidate is not an issued reference");

console.log("ai-fuzz adversarial regression: all assertions passed");
console.warn = originalWarn;