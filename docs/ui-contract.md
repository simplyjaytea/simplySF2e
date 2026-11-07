# UI contract — context the templates now read

Companion to `docs/ui-plan.md`. The UI branch (`work/T-UI`) changed the templates, CSS and harness fixtures; this file lists every context field the templates now read that the apps do not yet supply, so the integration worker can implement exactly this. **The fixtures in `tools/ui-preview/fixtures/` are the source of truth for shape and example values**; when this file and a fixture disagree, the fixture wins and this file is the bug.

Conventions: the real `_prepareContext()` must return every key listed (null, `false` or `[]` when empty), because the harness treats an absent key as drift. "Supply in" names the existing method that should add the field. Behaviour the JS must add is listed under each item. Removed fields are listed explicitly; everything not mentioned is unchanged.

## Item 3 — Token report collapsed (Generator, Item Forge, Shop, Treasure)

No new context. `tokenReport.{steps, totalText, costText}` from `AppBase._buildTokenReport()` are read as before; the block is a native `<details class="spf-token-report">`, collapsed on every render (no remembered state). Nothing to implement.

## Item 8 — What's new: newest notes open, earlier ones collapsed

Template: `templates/whats-new.hbs`. Supply in: `WhatsNewApp._prepareContext()` (`scripts/whats-new-app.mjs`).

| Field | Type | Meaning | Example (fixture `whats-new-manual-all`) |
| --- | --- | --- | --- |
| `notes` | `{id, title, body}[]` | Changed meaning in the manual view only: the notes of the newest release day. Unchanged in the automatic view (all unseen notes). | the four `2026-11-07-*` notes |
| `earlierNotes` | `{id, title, body}[]` (new) | Manual view: the remaining notes of `manualNotes(RELEASE_NOTES)` (still capped at `MANUAL_NOTE_CAP`). Automatic (unseen) view: always `[]`, so it renders exactly as today. | the six older notes |

Behaviour:
- "Newest release day" = the `YYYY-MM-DD` prefix of the first note's `id`; every following note with the same prefix belongs to `notes`. Put this split in a small pure helper in `scripts/whats-new.mjs` (e.g. `splitManualNotes(notes) -> { newest, earlier }`) with a node test; the app maps both lists through `game.i18n.localize` like `notes` today.
- The app must know which view it is in: today `constructor(options, notes)` gets `notes === null` for the manual open. Keep that flag (e.g. `#manual = !Array.isArray(notes)`).
- `#markSeen()` must still mark **all** shown notes (newest and earlier), i.e. keep using `this.#notes`.
- New key `SIMPLYSF2E.WhatsNew.Earlier` ("Earlier changes ({count})"), `count` = `earlierNotes.length`; the template formats it itself.
