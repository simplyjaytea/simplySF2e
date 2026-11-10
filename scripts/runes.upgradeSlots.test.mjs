// Pins how the Item Forge decides a base's upgrade slots. sf2e 1.7.0 publishes no
// capacity: no field, no "upgrade" trait, no system-side limit. So the number is
// the module default (weapon 1, armor 0) and the equipment entries carry no
// description to parse. This test fails if a description read or a prose parser
// comes back without a cited rule.
// Run: node scripts/runes.upgradeSlots.test.mjs

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultUpgradeSlots, getBaseItemCandidates } from "./runes.mjs";
import { getAllEquipmentEntries } from "./compendium.mjs";

assert.equal(defaultUpgradeSlots("weapon"), 1);
assert.equal(defaultUpgradeSlots("armor"), 0);
assert.equal(defaultUpgradeSlots(), 1, "kind defaults to weapon");

/* ---------------- index boundary ---------------- */

const previousGame = globalThis.game;
let requestedFields = [];
const indexEntries = [
  // Description text must not change capacity.
  { name: "Prose Rifle", type: "weapon", system: { level: { value: 0 }, description: { value: "<p>Upgrade Slots 3</p>" } } },
  { name: "Prose Suit", type: "armor", system: { level: { value: 0 }, description: { value: "<p>Upgrade Slots 2, one upgrade slot</p>" } } }
];
globalThis.game = {
  settings: { get: () => ({}) },
  packs: new Map([["sf2e.equipment", { getIndex: async ({ fields }) => { requestedFields = fields; return indexEntries; } }]])
};
try {
  const entries = await getAllEquipmentEntries();
  assert.ok(entries.length === 2);
  for (const e of entries) assert.ok(!("description" in e), `entry "${e.name}" carries no description`);
  assert.ok(!requestedFields.some((f) => f.includes("description")), "the index never requests a description");
  assert.deepEqual((await getBaseItemCandidates("weapon", 20)).map((c) => c.upgradeSlots), [1]);
  assert.deepEqual((await getBaseItemCandidates("armor", 20)).map((c) => c.upgradeSlots), [0]);
} finally {
  if (previousGame === undefined) delete globalThis.game;
  else globalThis.game = previousGame;
}

/* ---------------- real data (runs only when the class-bench cache exists) ---------------- */

const cache = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tools", "class-bench", "cache", "equipment");
const cacheDir = fs.existsSync(cache) ? cache : "/root/simplySF2e/tools/class-bench/cache/equipment";
if (!fs.existsSync(cacheDir)) {
  console.log("skip: class-bench cache not present, real-data capacity check not run");
} else {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  let bases = 0;
  const generic = [];
  for (const f of walk(cacheDir).filter((x) => x.endsWith(".json"))) {
    const doc = JSON.parse(fs.readFileSync(f, "utf8"));
    if (doc.type !== "weapon" && doc.type !== "armor") continue;
    bases++;
    const sys = doc.system ?? {};
    assert.ok(!Object.keys(sys).some((k) => /slot|capacity/i.test(k)), `${doc.name}: a capacity field appeared in system data`);
    assert.ok(!(sys.traits?.value ?? []).some((t) => /^upgrade/.test(t)), `${doc.name}: an upgrade trait appeared`);
    const text = String(sys.description?.value ?? "").replace(/<[^>]+>/g, " ");
    if (/upgrade\s+slots?\s*[:\-]?\s*\d+|\d+\s+upgrade\s+slots?/i.test(text)) generic.push(doc.name);
  }
  assert.ok(bases > 300, `scanned ${bases} base weapons and armor`);
  assert.deepEqual(generic, [], "no base states a digit capacity in text; if one does, a cited per-item rule is now possible");
  console.log(`real-data check: ${bases} weapons and armor, no capacity field, trait or digit phrase`);
}

console.log("upgrade slot default check: all assertions passed");
