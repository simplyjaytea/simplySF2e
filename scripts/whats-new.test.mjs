import assert from "node:assert/strict";
import { RELEASE_NOTES, unseenNotes, firstRunSeenIds, markSeen, manualNotes, shouldAutoOpenWhatsNew } from "./whats-new.mjs";

const notes = [{ id: "c" }, { id: "b" }, { id: "a" }];

// unseen filtering keeps order
assert.deepEqual(unseenNotes(notes, ["b"]).map((n) => n.id), ["c", "a"]);
assert.deepEqual(unseenNotes(notes, null).map((n) => n.id), ["c", "b", "a"]);
assert.deepEqual(unseenNotes(notes, ["a", "b", "c"]), []);

// first run marks everything seen, so nothing is unseen and nothing opens
const first = firstRunSeenIds(notes);
assert.deepEqual(first, ["c", "b", "a"]);
assert.equal(unseenNotes(notes, first).length, 0);
assert.equal(shouldAutoOpenWhatsNew({ isGM: true, systemId: "sf2e", disabled: false, seenIds: null, unseenCount: 3, welcomeOpening: false }), false);

const base = { isGM: true, systemId: "sf2e", disabled: false, seenIds: ["a"], unseenCount: 2, welcomeOpening: false };
assert.equal(shouldAutoOpenWhatsNew(base), true);
assert.equal(shouldAutoOpenWhatsNew({ ...base, disabled: true }), false);
assert.equal(shouldAutoOpenWhatsNew({ ...base, isGM: false }), false);
assert.equal(shouldAutoOpenWhatsNew({ ...base, systemId: "pf2e" }), false);
assert.equal(shouldAutoOpenWhatsNew({ ...base, welcomeOpening: true }), false);
assert.equal(shouldAutoOpenWhatsNew({ ...base, unseenCount: 0 }), false);
assert.equal(shouldAutoOpenWhatsNew(), false);

// markSeen merges without duplicates
assert.deepEqual(markSeen(["a", "x"], [{ id: "a" }, { id: "b" }]), ["a", "x", "b"]);
assert.deepEqual(markSeen(null, [{ id: "a" }]), ["a"]);

// manual cap
const many = Array.from({ length: 14 }, (_, i) => ({ id: `n${i}` }));
assert.equal(manualNotes(many).length, 10);
assert.equal(manualNotes(many)[0].id, "n0");

// real notes: unique ids, i18n keys present
const ids = RELEASE_NOTES.map((n) => n.id);
assert.equal(new Set(ids).size, ids.length, "RELEASE_NOTES ids must be unique");
for (const n of RELEASE_NOTES) {
  assert.match(n.id, /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
  assert.match(n.title, /^SIMPLYSF2E\.WhatsNew\.Note\./);
  assert.match(n.body, /^SIMPLYSF2E\.WhatsNew\.Note\./);
}
console.log("whats-new tests passed");
