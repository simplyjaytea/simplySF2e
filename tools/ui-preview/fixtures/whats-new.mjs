// What's new window. Shape follows WhatsNewApp._prepareContext() (whats-new-app.mjs):
// version, notes and earlierNotes, each note with localized title/body.
// Contract (docs/ui-contract.md): the automatic unseen view passes its notes and
// an empty earlierNotes; the manual view (manualNotes(), capped) puts the notes
// of the newest release date (id prefix YYYY-MM-DD) in notes, the rest in earlierNotes.
import { localize } from "./_shared.mjs";
import { RELEASE_NOTES, manualNotes } from "../../../scripts/whats-new.mjs";

const note = (n) => ({ id: n.id, title: localize(n.title), body: localize(n.body) });
const day = (n) => n.id.slice(0, 10);
const manual = manualNotes(RELEASE_NOTES);
const newest = manual.filter((n) => day(n) === day(manual[0]));
const earlier = manual.slice(newest.length);

export default [
  {
    id: "whats-new-unseen",
    app: "whats-new",
    context: { version: "0.9.12", notes: RELEASE_NOTES.slice(0, 3).map(note), earlierNotes: [] }
  },
  {
    id: "whats-new-manual-all",
    app: "whats-new",
    context: { version: "0.9.12", notes: newest.map(note), earlierNotes: earlier.map(note) }
  },
  {
    id: "whats-new-manual-earlier-open",
    app: "whats-new",
    open: [".spf-whats-new-earlier"],
    context: { version: "0.9.12", notes: newest.map(note), earlierNotes: earlier.map(note) }
  }
];
