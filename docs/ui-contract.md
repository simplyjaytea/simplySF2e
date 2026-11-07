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

## Item 9 — Encounter preview: member stat grid, labelled budget chips

Template: `templates/generator.hbs` (`encounterPreview`). Supply in: `GeneratorApp.#buildEncounterPreviewContext()`.

| Field | Type | Meaning | Example (fixture `generator-encounter-preview`) |
| --- | --- | --- | --- |
| `members[].stats` (new) | object | Raw display values; the template adds every label. | see below |
| `members[].stats.ac` | number | `stats.ac` | `24` |
| `members[].stats.hp` | number | `stats.hp` | `119` |
| `members[].stats.perception` | string | `signed(stats.perception)` | `"+14"` |
| `members[].stats.fort` / `.ref` / `.will` | string | `signed(stats.saves.fortitude / reflex / will)` | `"+17"`, `"+14"`, `"+11"` |
| `members[].stats.strike` | `{name, bonus, damage}` or `null` | first strike: `strike.name`, `signed(strike.bonus)`, `strike.damage` | `{ name: "Gravity Maul", bonus: "+17", damage: "2d8+9" }` |
| `members[].stats.spellDC` | number or `null` | `stats.spellDC ?? null` | `24` |

Removed: `members[].statline` (the template no longer reads it; delete the string build and the `t()` helper if nothing else uses it). All other `encounterPreview` fields (`spent`, `budget`, `overBudget`, `treasure*`, `count`, `skipped`, `role`, `level`, `blurb`, `index`) are unchanged.

Keys: new `SIMPLYSF2E.Generator.CreditsLabel`, `SIMPLYSF2E.Preview.ACFull`, `.HPFull`, `.FortFull`, `.RefFull` (template only). Deleted `SIMPLYSF2E.Generator.CreditsUnit` (no longer used anywhere).

## Item 10 — Shop and Treasure tables in narrow windows

No new context. The Shop row's existing `typeLabel` is rendered twice (Type cell and a secondary line under the name); CSS shows one or the other by container width. New keys used by the templates only: `SIMPLYSF2E.Shop.ColLevelShort`, `SIMPLYSF2E.Shop.ColQtyFull`, `SIMPLYSF2E.Treasure.ColLevelShort`. Nothing to implement.
