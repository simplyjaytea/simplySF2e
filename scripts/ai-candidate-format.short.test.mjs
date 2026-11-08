// Per-request short candidate ids (P2): the model sees E1, E2, ... never the opaque
// c-<base64 pack+doc> id, and every answer decodes back to the exact issued candidate
// or to null. Uses the real level-5 NPC equipment list from the class-bench cache when it
// has been fetched (node tools/class-bench/fetch.mjs); otherwise a production-shaped
// list built with the real candidateId(), so CI without the cache still runs every assert.
// Run: node scripts/ai-candidate-format.short.test.mjs
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCandidateEncoder, decodeCandidatePick, encodeCandidates } from "./ai-candidate-format.mjs";
import { candidateId, isIssuedCandidate } from "./compendium.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, "..", "tools", "class-bench", "cache");

let candidates;
let source;
try {
  await access(join(CACHE, "SOURCE.txt"));
  const { loadPacks, installFoundry } = await import(pathToFileURL(join(HERE, "..", "tools", "class-bench", "env.mjs")).href);
  const { packs } = await loadPacks(CACHE);
  installFoundry({ packs, state: { freeArchetype: false } });
  const { getEquipmentCandidates } = await import("./compendium.mjs");
  // The same call refineEquipment makes for a level-5 NPC with a rifle and a pike in the draft.
  candidates = await getEquipmentCandidates(5, ["assault rifle", "battering pike", "rifle", "pike", "assault", "battering"]);
  source = "class-bench cache";
} catch {
  const types = ["weapon", "equipment", "consumable"];
  candidates = Array.from({ length: 70 }, (_, index) => {
    const entry = { packId: "sf2e.equipment", _id: `item${String(index).padStart(12, "0")}` };
    return { id: candidateId(entry), ref: { ...entry }, name: `Published Item Number ${index}`, type: types[index % 3], level: index % 6 };
  });
  source = "synthetic production-shaped list";
}
assert.ok(candidates.length >= 20, `a real-size candidate list (${source}, ${candidates.length} items)`);
assert.ok(candidates.every((candidate) => /^c-[A-Za-z0-9+/]+$/.test(candidate.id)), "production candidates carry the opaque c- id");

// The request text selectEquipment builds, once with the old ids and once with the short ones.
const catalogText = (list) => {
  const byType = new Map();
  for (const c of list) {
    if (!byType.has(c.type)) byType.set(c.type, []);
    byType.get(c.type).push(`${c.id} | ${c.name}${c.level > 0 ? ` (L${c.level})` : ""}`);
  }
  return [...byType.entries()].map(([type, names]) => `${type}: ${names.join("; ")}`).join("\n");
};
const encoded = encodeCandidates(candidates, { prefix: "E" });
const oldText = catalogText(candidates);
const newText = catalogText(encoded.candidates);

// 1. Nothing opaque reaches the model: no c- id and no pack prefix.
assert.doesNotMatch(newText, /c-[A-Za-z0-9+/]{8,}/, "no c- base64 id in the request text");
assert.doesNotMatch(newText, /sf2e\.|pf2e\.|c2YyZS5|cGYyZS5/, "no pack id and no base64 pack prefix in the request text");
assert.match(newText, /\bE1 \| /, "the first candidate is E1");
assert.match(oldText, /c-[A-Za-z0-9+/]{8,}/, "(control) the old encoding does carry the opaque ids");

// 2. Size: the encoded catalog is under half of the old encoding.
console.log(`catalog (${source}, ${candidates.length} candidates): old ${oldText.length} chars, short ${newText.length} chars (${Math.round(100 * newText.length / oldText.length)}%)`);
assert.ok(newText.length < oldText.length * 0.5, `encoded catalog ${newText.length} must be under 50% of ${oldText.length}`);

// 3. Round trip: every shown id decodes to the exact issued candidate, reference identity kept.
const seen = new Set();
for (const [index, shown] of encoded.candidates.entries()) {
  assert.equal(shown.id, `E${index + 1}`, "ids run E1, E2, ... in list order");
  assert.ok(!seen.has(shown.id), "every short id is unique");
  seen.add(shown.id);
  const back = encoded.decode(shown.id);
  assert.equal(back, candidates[index], "decode returns the issued candidate");
  assert.equal(back.ref, candidates[index].ref, "the issued reference object is unchanged");
  assert.equal(shown.ref, candidates[index].ref, "the shown copy shares the issued reference");
  assert.equal(shown.name, candidates[index].name);
  assert.equal(encoded.original(shown), candidates[index], "a shown copy maps back to its original");
  assert.equal(decodeCandidatePick(shown.id.toLowerCase(), encoded.map), candidates[index], "decode ignores case and padding");
  assert.equal(decodeCandidatePick(` ${shown.id} `, encoded.map), candidates[index]);
}

// 4. Anything the model was not shown decodes to null: unknown, forged, the real c- id, junk.
const first = candidates[0];
for (const bad of [
  "E0", `E${candidates.length + 1}`, "E999", "invented", "", "   ", null, undefined, {}, [], 7,
  first.id,                                  // the real opaque id typed back
  `${first.id}x`, "c-ZmFrZQ", "c-" + btoa("sf2e.equipment\u0000forged").replaceAll("=", ""),
  "F1", "A1"                                 // another family's id
]) {
  assert.equal(encoded.decode(bad), null, `decode(${JSON.stringify(bad)}) fails closed`);
  assert.equal(decodeCandidatePick(bad, encoded.map), null);
}
assert.equal(decodeCandidatePick("E1", null), null, "no map, no decode");
assert.equal(decodeCandidatePick("E1", new Map()), null, "an empty map decodes nothing");
assert.equal(decodeCandidatePick("E1", { get: () => first }), null, "only a real Map is trusted");

// 5. The issued-reference guard still applies to what a decode returns.
const issuedList = candidates.filter((candidate) => isIssuedCandidate(candidate.ref));
if (issuedList.length) {
  for (const shown of encoded.candidates.slice(0, 5)) assert.ok(isIssuedCandidate(encoded.decode(shown.id).ref), "decoded refs are issued references");
}
assert.ok(!isIssuedCandidate({ packId: first.ref.packId, _id: first.ref._id }), "a hand-built {packId,_id} is still not an issued reference");

// 6. One encoder across lists: the counter runs on, a repeated candidate keeps its id, id-less ones stay id-less.
{
  const encoder = createCandidateEncoder("S");
  const a = { id: "c-AAAA", name: "A", ref: { packId: "p", _id: "a" } };
  const b = { id: "c-BBBB", name: "B", ref: { packId: "p", _id: "b" } };
  const named = { name: "No id" };
  const [a1, b1, n1] = encoder.encode([a, b, named]);
  const [b2, a2] = encoder.encode([b, a]);
  assert.deepEqual([a1.id, b1.id], ["S1", "S2"]);
  assert.equal(n1, named, "a candidate without an id is passed through untouched (name-only legacy path)");
  assert.deepEqual([b2.id, a2.id], ["S2", "S1"], "the same candidate keeps its short id in a second list");
  const c = { id: "c-CCCC", name: "C", ref: { packId: "p", _id: "c" } };
  assert.equal(encoder.encode([c])[0].id, "S3", "the counter runs on across lists");
  assert.equal(encoder.decode("s3"), c);
  assert.equal(encoder.decode("S4"), null);
}

console.log("ai-candidate-format.short.test.mjs: short ids, decode and fail-closed paths passed");
