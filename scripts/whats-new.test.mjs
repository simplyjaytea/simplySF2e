import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RELEASE_NOTES, unseenNotes, firstRunSeenIds, initialSeenIds, markSeen, manualNotes, shouldAutoOpenWhatsNew, whatsNewView } from "./whats-new.mjs";

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
  assert.equal(n.body, undefined, `${n.id}: notes use bullets, not a body paragraph`);
}

// Bullets: 2 to 5 per note, every key present in lang, plain one-sentence text.
const lang = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));
const langText = (key) => key.split(".").reduce((o, k) => o?.[k], lang);
for (const n of RELEASE_NOTES) {
  assert.equal(typeof langText(n.title), "string", `${n.id}: title key missing in lang`);
  assert.ok(Array.isArray(n.bullets), `${n.id}: bullets must be an array`);
  assert.ok(n.bullets.length >= 2 && n.bullets.length <= 5, `${n.id}: needs 2 to 5 bullets, has ${n.bullets.length}`);
  assert.equal(new Set(n.bullets).size, n.bullets.length, `${n.id}: duplicate bullet key`);
  for (const key of n.bullets) {
    assert.match(key, /^SIMPLYSF2E\.WhatsNew\.Note\.[A-Za-z]+\.B\d$/);
    const text = langText(key);
    assert.equal(typeof text, "string", `${n.id}: bullet key ${key} missing in lang`);
    assert.ok(!/[\u2014\u2013]/.test(text), `${key}: no em or en dash`);
    assert.ok(!/\(s\)/.test(text), `${key}: no "(s)"`);
    assert.ok(!/<|>|\{\{/.test(text), `${key}: no HTML or template markup`);
    assert.ok(!/\b(simply|just|seamlessly|powerful)\b/i.test(text.replace(/SimplySF2e/g, "")), `${key}: filler word`);
    const words = text.split(/\s+/).length;
    assert.ok(words >= 6 && words <= 16, `${key}: ${words} words`);
  }
}
// The old per-note .Body keys are gone from lang.
for (const [name, note] of Object.entries(lang.SIMPLYSF2E.WhatsNew.Note)) {
  assert.equal(note.Body, undefined, `${name}: leftover Body key`);
}
// The theme note stays short: it says what changed on screen.
assert.ok(RELEASE_NOTES.find((n) => n.id === "2026-11-08-theme-system").bullets.length <= 3);

// Ids already shipped are stored in GM browsers; none may be renamed or dropped.
const SHIPPED_IDS = [
  "2026-11-09-hunt-fixes", "2026-11-08-progress-telemetry", "2026-11-08-theme-system",
  "2026-11-08-setup-wiring", "2026-11-08-copy-sweep", "2026-11-08-shell-consistency",
  "2026-11-08-run-guards", "2026-11-08-one-credstick", "2026-11-08-reskin-trample",
  "2026-11-08-ui-polish", "2026-11-07-run-deadline", "2026-11-07-run-cost",
  "2026-11-07-relevel-abilities", "2026-11-07-aura", "2026-11-06-one-screen-welcome",
  "2026-11-05-area-blast", "2026-11-05-blank-abilities", "2026-11-05-clearer-errors",
  "2026-10-31-run-budget", "2026-10-31-provider-retry", "2026-10-25-multiclass",
  "2026-10-25-class-fixes", "2026-10-25-tech-core", "2026-10-25-ui-refresh",
  "2026-10-25-creature-art", "2026-10-11-whats-new", "2026-10-11-faster-encounters",
  "2026-10-11-treasure", "2026-10-11-relevel"
];
for (const id of SHIPPED_IDS) assert.ok(ids.includes(id), `shipped note id ${id} was removed or renamed`);
assert.equal(RELEASE_NOTES[0].id, "2026-11-10-review-fixes");
assert.ok(RELEASE_NOTES[0].bullets.length <= 5);
// Never stored: a new install starts with everything seen; a GM already set
// up (welcome not opening) is upgrading and sees every note once.
assert.deepEqual(initialSeenIds(notes, { welcomeOpening: true }), firstRunSeenIds(notes));
assert.deepEqual(initialSeenIds(notes, { welcomeOpening: false }), []);
assert.equal(unseenNotes(notes, initialSeenIds(notes)).length, notes.length);

// The window's view (WhatsNewApp itself needs Foundry globals, so its constructor and
// showManual() both call this pure helper, and the helper is what is tested here).
{
  const auto = whatsNewView([{ id: "x" }]);
  assert.deepEqual(auto, { manual: false, notes: [{ id: "x" }] }, "an array is the automatic view");
  assert.deepEqual(whatsNewView([]), { manual: false, notes: [] }, "an empty unseen list stays automatic");
  const manual = whatsNewView(null);
  assert.equal(manual.manual, true, "no array is the manual view");
  assert.deepEqual(manual.notes, manualNotes(RELEASE_NOTES), "the manual view holds the capped newest notes");
  assert.deepEqual(whatsNewView(undefined), manual, "omitted notes are a manual open");
  // showManual() after an automatic open yields the same view as a fresh manual open.
  assert.deepEqual(whatsNewView(null), whatsNewView(undefined));
  assert.notDeepEqual(auto.notes, manual.notes, "the two views differ, so a reused window must switch");
}

console.log("whats-new tests passed");
