// Pure folder lookup: matches by module flag, type and parent. No Foundry globals.
// Run: node scripts/folders.test.mjs
import assert from "node:assert/strict";
import { findFolder } from "./folders.mjs";

const folders = [
  { id: "a", name: "Renamed by GM", type: "Actor", folder: null, flags: { simplysf2e: { kind: "root" } } },
  { id: "b", name: "Creatures", type: "Actor", folder: "a", flags: { simplysf2e: { kind: "creature" } } },
  { id: "c", name: "NPCs", type: "Actor", folder: { id: "a" }, flags: { simplysf2e: { kind: "npc" } } },
  { id: "d", name: "Journal root", type: "JournalEntry", folder: null, flags: { simplysf2e: { kind: "root" } } },
  { id: "e", name: "Creatures", type: "Actor", folder: null, flags: {} }
];

// Matches by flag, so a renamed folder is still found.
assert.equal(findFolder(folders, { type: "Actor", kind: "root", parentId: null })?.id, "a");

// Respects type.
assert.equal(findFolder(folders, { type: "JournalEntry", kind: "root", parentId: null })?.id, "d");
assert.equal(findFolder(folders, { type: "JournalEntry", kind: "creature", parentId: "a" }), null);

// Respects parent, with folder as an id string or as an {id} object.
assert.equal(findFolder(folders, { type: "Actor", kind: "creature", parentId: "a" })?.id, "b");
assert.equal(findFolder(folders, { type: "Actor", kind: "npc", parentId: "a" })?.id, "c");
assert.equal(findFolder(folders, { type: "Actor", kind: "creature", parentId: null }), null);

// Name alone never matches, and nothing matching returns null.
assert.equal(findFolder(folders, { type: "Actor", kind: "shop", parentId: "a" }), null);
assert.equal(findFolder([], { type: "Actor", kind: "root", parentId: null }), null);
assert.equal(findFolder(folders, { type: "Actor", kind: "root", parentId: "a" }), null);

console.log("folders.test.mjs: flag/type/parent folder lookup assertions passed");
