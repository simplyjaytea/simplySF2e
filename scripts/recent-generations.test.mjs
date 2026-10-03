// Pure Recent previews list helpers.
// Run: node scripts/recent-generations.test.mjs
import assert from "node:assert/strict";
import {
  RECENT_LIMIT, findRecent, forgetRecent, previewModeOf, previewNameOf, rememberRecent
} from "./recent-generations.mjs";

const entry = (id, mode = "monster") => ({ id, mode, name: id, state: {} });

// Newest first, same id replaced in place at the front, capped.
let list = [];
for (let i = 1; i <= RECENT_LIMIT + 2; i++) list = rememberRecent(list, entry(`e${i}`));
assert.equal(list.length, RECENT_LIMIT);
assert.equal(list[0].id, `e${RECENT_LIMIT + 2}`);
assert.equal(list.at(-1).id, "e3", "the oldest entries drop off");
const before = list;
list = rememberRecent(list, { ...entry("e5"), name: "renamed" });
assert.equal(list[0].name, "renamed");
assert.equal(list.filter((item) => item.id === "e5").length, 1, "no duplicate ids");
assert.notEqual(list, before, "returns a new array");
assert.equal(before.length, RECENT_LIMIT, "input list unchanged");

// Invalid entries never land.
assert.equal(rememberRecent(list, { id: "x", mode: "item" }).length, list.length);
assert.equal(rememberRecent(list, { mode: "monster" }).length, list.length);

assert.equal(findRecent(list, "e5").name, "renamed");
assert.equal(findRecent(list, "nope"), null);
assert.equal(forgetRecent(list, "e5").length, list.length - 1);
assert.deepEqual(forgetRecent(null, "e5"), []);

// Mode detection follows which preview exists and the mode it was made in.
assert.equal(previewModeOf(null), null);
assert.equal(previewModeOf({}), null);
assert.equal(previewModeOf({ concept: {} }, "monster"), "monster");
assert.equal(previewModeOf({ concept: {} }, "npc"), "npc");
assert.equal(previewModeOf({ encounter: {} }, "encounter"), "encounter");
assert.equal(previewModeOf({ pcConcept: {} }, "character"), "character");
assert.equal(previewModeOf({ reskinFlavor: {}, reskinSource: {} }, "reskin"), "reskin");
assert.equal(previewModeOf({ reskinFlavor: {}, concept: {} }, "monster"), "monster",
  "a leftover reskin draft does not hijack a creature preview");
assert.equal(previewModeOf({ reskinFlavor: {} }, null), "reskin");

assert.equal(previewNameOf({ concept: { name: " Drone " } }, "monster"), "Drone");
assert.equal(previewNameOf({ encounter: { name: "Ambush" } }, "encounter"), "Ambush");
assert.equal(previewNameOf({ pcConcept: { name: "Kess" } }, "character"), "Kess");
assert.equal(previewNameOf({ reskinFlavor: {}, reskinSource: { name: "Warlord" } }, "reskin"), "Warlord");
assert.equal(previewNameOf({ concept: {} }, "monster"), "");

console.log("recent-generations.test.mjs: passed");
