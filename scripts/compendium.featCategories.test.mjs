// Feat candidate categories and exclusions: a general slot takes general or
// skill feats, excluded uuids/names never reach the catalog, caps stay unchanged.
// Run: node scripts/compendium.featCategories.test.mjs
import assert from "node:assert/strict";

const feat = (_id, name, level, category) => ({
  _id,
  name,
  type: "feat",
  system: { level: { value: level }, category, traits: { value: [] } }
});

const namedFeats = [
  feat("gen1", "General Alpha", 1, "general"),
  feat("gen2", "General Epsilon", 2, "general"),
  feat("skl1", "Skill Beta", 1, "skill"),
  feat("cls1", "Class Gamma", 1, "class"),
  feat("anc1", "Ancestry Delta", 1, "ancestry")
];
const bulkFeats = [];
for (let i = 0; i < 40; i++) bulkFeats.push(feat(`bg${i}`, `Bulk General ${String(i).padStart(2, "0")}`, (i % 5) + 1, "general"));
for (let i = 0; i < 30; i++) bulkFeats.push(feat(`bs${i}`, `Bulk Skill ${String(i).padStart(2, "0")}`, (i % 5) + 1, "skill"));

const packs = new Map([
  ["test.feats", { async getIndex() { return namedFeats.map((entry) => structuredClone(entry)); } }],
  ["test.bulk", { async getIndex() { return bulkFeats.map((entry) => structuredClone(entry)); } }]
]);
let featPacks = ["test.feats"];
globalThis.game = {
  settings: { get: () => ({ feats: featPacks }) },
  packs
};

const { FEAT_CANDIDATE_LIMIT, FEAT_CANDIDATES_PER_LEVEL, getFeatCandidates } = await import("./compendium.mjs");
const names = (candidates) => candidates.map((candidate) => candidate.name);

/* A string category keeps its exact pre-existing meaning: only that category. */
const general = await getFeatCandidates({ level: 5, category: "general" });
assert.deepEqual(names(general), ["General Alpha", "General Epsilon"],
  "a string category must offer only feats of that category");
assert.deepEqual(names(await getFeatCandidates({ level: 5, category: ["general"] })), names(general),
  "a one-element array must match the string category exactly");

/* A general slot legally holds general or skill feats (sf2e collection.ts:100-103). */
const generalSlot = await getFeatCandidates({ level: 5, category: ["general", "skill"] });
assert.deepEqual(names(generalSlot), ["General Alpha", "Skill Beta", "General Epsilon"],
  "an array category must offer every listed category, sorted by level then name");
assert.ok(!names(generalSlot).some((name) => name.startsWith("Class") || name.startsWith("Ancestry")),
  "class and ancestry feats must stay out of a general/skill slot");
assert.deepEqual(names(await getFeatCandidates({ level: 5, category: [] })), [],
  "an empty category array matches nothing (fail closed)");

/* excludeUuids drops an entry by compendium uuid, leaving its siblings. */
const byUuid = await getFeatCandidates({
  level: 5, category: ["general", "skill"], excludeUuids: ["Compendium.test.feats.Item.gen1"]
});
assert.deepEqual(names(byUuid), ["Skill Beta", "General Epsilon"],
  "a uuid in excludeUuids must drop exactly that feat");

/* excludeUuids also drops an entry by slugified name. */
const byName = await getFeatCandidates({ level: 5, category: ["general", "skill"], excludeUuids: ["skill-beta"] });
assert.deepEqual(names(byName), ["General Alpha", "General Epsilon"],
  "a slugified name in excludeUuids must drop that feat");

/* Unset or empty exclusions change nothing. */
assert.deepEqual(names(await getFeatCandidates({ level: 5, category: ["general", "skill"], excludeUuids: [] })),
  names(generalSlot), "an empty exclusion list must match the default");

/* Caps and ordering are unchanged: a broad bulk catalog stays within the hard
 * ceiling and the per-level sample size, for both string and array categories. */
assert.equal(FEAT_CANDIDATE_LIMIT, 16, "feat candidate ceiling must stay 16");
assert.equal(FEAT_CANDIDATES_PER_LEVEL, 8, "feat candidates per level must stay 8");
featPacks = ["test.bulk"];
for (const category of ["general", ["general", "skill"]]) {
  const capped = await getFeatCandidates({ level: 5, category });
  assert.ok(capped.length <= FEAT_CANDIDATE_LIMIT, "feat candidate list must obey the hard cap");
  const perLevel = new Map();
  for (const candidate of capped) perLevel.set(candidate.level, (perLevel.get(candidate.level) ?? 0) + 1);
  for (const [level, count] of perLevel) {
    assert.ok(count <= FEAT_CANDIDATES_PER_LEVEL, `level ${level} must offer at most ${FEAT_CANDIDATES_PER_LEVEL} feats`);
  }
  const ordered = [...capped].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  assert.deepEqual(names(capped), names(ordered), "feat candidates must stay sorted by level then name");
}

console.log("compendium.featCategories.test.mjs: feat category and exclusion assertions passed");
