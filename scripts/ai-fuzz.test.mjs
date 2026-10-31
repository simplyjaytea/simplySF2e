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
const unresolvedManifest = completionManifest({ mode: "npc", concept: {}, resolved: { feats: [{ name: "Missing Feat" }] } });
assert.equal(unresolvedManifest.complete, false, "a manifest with an unresolved required row must be incomplete");
assert.equal(unresolvedManifest.unresolved.length, 1);
assert.throws(() => assertComplete(unresolvedManifest), /Generation is incomplete/,
  "assertComplete must reject a manifest with an unresolved required row");
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

// Seeded fuzzing: deterministic grammar-driven adversarial payloads.
const FUZZ_SEED = 0x5f3759df;
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(FUZZ_SEED);
const pick = (list) => list[Math.floor(rand() * list.length)];
const randInt = (n) => Math.floor(rand() * n);
function randomString() {
  const chars = ["a", "Z", "0", " ", "\"", "\\", "\n", "\r", "\t", "é", "😀", "\u0000", "\uD800", "{", "}", "[", "]"];
  let out = "";
  const len = randInt(12) + 1;
  for (let i = 0; i < len; i++) out += pick(chars);
  return out;
}
function randomValue(depth = 0) {
  const choice = randInt(depth > 3 ? 4 : 6);
  if (choice === 0) return randomString();
  if (choice === 1) return randInt(1000) - 500;
  if (choice === 2) return rand() > 0.5;
  if (choice === 3) return null;
  if (choice === 4) return Array.from({ length: randInt(4) }, () => randomValue(depth + 1));
  const obj = {};
  const keys = ["name", "traits", "__proto__", "constructor", "prototype", "nested", randomString()];
  for (let i = 0; i < randInt(4) + 1; i++) obj[pick(keys)] = randomValue(depth + 1);
  return obj;
}
function randomObject() {
  const obj = {};
  for (let i = 0; i < randInt(5) + 1; i++) obj[pick(["keywords", "name", "traits", "nested", "value", "__proto__"])] = randomValue(1);
  return obj;
}
function mutate(text) {
  const ops = randInt(4);
  if (ops === 0) return text;
  if (ops === 1 && text.length) {
    const at = randInt(text.length);
    return text.slice(0, at) + text.slice(at + 1);
  }
  if (ops === 2) {
    const at = randInt(text.length + 1);
    return text.slice(0, at) + pick(["{", "}", "[", "]", "\"", "\\", "x", " "]) + text.slice(at);
  }
  return text;
}
function generateCase() {
  const kind = randInt(10);
  const base = JSON.stringify(randomObject());
  if (kind === 0) return mutate(base);
  if (kind === 1) return base.slice(0, randInt(base.length));
  if (kind === 2) return pick(["```json\n", "", "data: ", "Here is the result: ", "\uFEFF"]) + base + pick(["\n```", "\ntrailing prose", ""]);
  if (kind === 3) {
    const depth = 200 + randInt(20);
    return "[".repeat(depth) + base + "]".repeat(depth);
  }
  if (kind === 4) return `{"name":"${"x".repeat(64 * 1024)}"}`;
  if (kind === 5) return `{"note":"${pick(["unbalanced { inside", "escaped \\\" quote", "emoji 😀", "\u0000 nul"])}"}`;
  if (kind === 6) return `{"__proto__":{"polluted":true},"constructor":{"prototype":{}}}`;
  if (kind === 7) return "{\r\n" + base.slice(1);
  if (kind === 8) return `{${randomString()}}`;
  return base;
}

const FUZZ_CASES = 300;
for (let index = 0; index < FUZZ_CASES; index++) {
  const payload = generateCase();
  const label = `seed=${FUZZ_SEED} case=${index}`;
  let result;
  let outcome = "ok";
  try {
    result = parseConceptJSON(payload);
  } catch (error) {
    outcome = "throw";
    assert.ok(error instanceof AIRequestError, `${label}: threw a non-AIRequestError: ${error?.message}`);
    assert.equal(error.retryable, true, `${label}: thrown error must be retryable`);
  }
  if (outcome === "ok") {
    assert.ok(result !== null && typeof result === "object" && !Array.isArray(result),
      `${label}: parseConceptJSON must return a plain object, got ${Array.isArray(result) ? "array" : typeof result}`);
  }
}

console.log("ai-fuzz adversarial regression: all assertions passed");
console.warn = originalWarn;