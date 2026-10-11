// What's new window. Shape follows WhatsNewApp._prepareContext() (whats-new-app.mjs):
// version plus notes with localized title/body.
import { localize } from "./_shared.mjs";
import { RELEASE_NOTES } from "../../../scripts/whats-new.mjs";

const note = (n) => ({ id: n.id, title: localize(n.title), body: localize(n.body) });

export default [
  {
    id: "whats-new-unseen",
    app: "whats-new",
    context: { version: "0.9.12", notes: RELEASE_NOTES.slice(0, 3).map(note) }
  },
  {
    id: "whats-new-manual-all",
    app: "whats-new",
    context: { version: "0.9.12", notes: RELEASE_NOTES.map(note) }
  }
];
