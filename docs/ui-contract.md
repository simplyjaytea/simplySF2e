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

## Item 6 — Generator readiness row (Compendium + Jev merged)

Template: `templates/generator.hbs` (status bar). Supply in: `GeneratorApp._prepareContext()`; behaviour in `GeneratorApp._onRender()`.

| Field | Type | Meaning | Example |
| --- | --- | --- | --- |
| `readinessOpen` (new) | boolean | Whether the GM expanded the readiness row in this window. Default `false`. | `false` (`generator-empty-monster`), `true` (`generator-readiness-open`) |

Behaviour:
- Copy Welcome's `#advancedOpen` pattern (`welcome-app.mjs` ~l.169): a private `#readinessOpen = false`; in `_onRender` add a `toggle` listener on `details[data-readiness]` that stores `event.currentTarget.open` (no re-render). Not persisted beyond the window instance.
- Healthy state (`sourcesReady` true): one row `Compendium ✓ Ready · Jev ✓ On / − Off`, detail rows with the gear buttons inside. Jev off is not a warning (as today).
- Warning state (`sourcesReady` false): the template ignores `readinessOpen` and renders both full rows outside any `<details>`; the missing-content text is now `role="status"` and has a warning icon. No JS needed for that.
- Existing fields `sourcesReady`, `sourcePackCount`, `sourceMissing`, `jevSource` are unchanged. The `configureSources` / `configureProvider` actions keep their names.

Keys: new `SIMPLYSF2E.Generator.CompendiumShort`, `.ReadyShort`, `.JevShort`, `.JevShortOn`, `.JevShortOff`.

## Item 1 — Character review: one caveat, short action titles

Template: `templates/generator.hbs` (`characterReview`). Supply in: `GeneratorApp.#skillReportContext()` and where `#characterReview` is built (~l.1800 of `generator-app.mjs`).

| Field | Type | Meaning | Example (fixture `generator-character-review`) |
| --- | --- | --- | --- |
| `characterReview.actionCount` (new) | number | Rows in the "To review" list: `choices.length + skills.warnings.length + skills.loadoutWarnings.length + (incomplete ? 1 : 0)` (`skills` may be null: count 0 for its lists). | `5` |
| `characterReview.skills.warnings` (changed) | `{title, detail}[]` (was `string[]`) | `title` = `game.i18n.format("SIMPLYSF2E.Skills.<Key>Title", {count})`, `detail` = today's string from `SIMPLYSF2E.Skills.<Key>` (same `warningKeys` map, same `count`). | `{ title: "Assign 1 more trained skill(s)", detail: "1 additional training choices could not be assigned safely." }` |
| `characterReview.skills.loadoutWarnings` (changed) | `{title, detail}[]` (was `string[]`) | `title` = `SIMPLYSF2E.Loadout.<Key>Title`, `detail` = today's `SIMPLYSF2E.Loadout.<Key>` (same code map). | `{ title: "Review one untrained weapon", detail: "An untrained weapon was left stowed." }` |

Unchanged: `actorName`, `incomplete`, `choices[] {itemName, prompt}` (the template now titles each "Choose an option for {itemName}" and shows `localize(prompt)` plus `Generator.ReviewChoiceDetail` as its explanation), `skills.rows`, `skills.automatic`, `skills.budget`.

Behaviour:
- The ui notification after create (`ReviewCreated` vs `Created`) is unchanged.
- Title key for each code: append `Title` to the existing key (`UnspentTraining` -> `UnspentTrainingTitle`, `UntrainedWeapon` -> `UntrainedWeaponTitle`, fallback `NativeDataTitle`). All 9 Skills and 7 Loadout title keys exist in `lang/en.json`.
- Keep `skills.warnings` non-empty whenever today it is non-empty: no warning is dropped or merged.

Keys: new `SIMPLYSF2E.Generator.ReviewActionsHeading`, `.ReviewChoiceTitle`, `.ReviewChoiceDetail`, `.ReviewIncompleteTitle`, `SIMPLYSF2E.Skills.*Title` (9), `SIMPLYSF2E.Loadout.*Title` (7). Deleted: `SIMPLYSF2E.Generator.ReviewHint` (its snapshot sentence duplicated `Skills.Snapshot`; the rest is `ReviewChoiceDetail`) and `SIMPLYSF2E.Loadout.Result` (the "Equipment readiness" heading; loadout warnings are now rows of the To review list).

Harness note: `tools/ui-preview/render.mjs` resolves the one system key a fixture uses, `PF2E.UI.RuleElements.ChoiceSet.Prompt`, from a small stub, since the harness does not load the system's language file.

## Item 7 — Re-level preview grouped by Strike (+ polish nit 1)

Template: `templates/generator.hbs` (`reskinRelevel`). Supply in: `GeneratorApp.#buildRelevelContext()`.

| Field | Type | Meaning | Example (fixture `generator-reskin-relevel`) |
| --- | --- | --- | --- |
| `reskinRelevel.rows` (changed) | `{label, scale, from, to}[]` | Same shape, but **without** the Strike attack and damage rows (keys `strike-<id>` / `damage-<id>` from `relevelActorData`). | AC, Max HP, Perception, Fortitude, spell DC… |
| `reskinRelevel.strikes` (new) | `{name, attack, damage}[]` | One entry per Strike item, in the order its first row appears. `name` = the row's `name` (the item name). `attack` / `damage` = `{scale, from, to}` (scale localized like `rows[].scale`) from the `strike-<id>` / `damage-<id>` row, or `null` when that row is absent (unchanged value). | `{ name: "Rail Pistol", attack: { scale: "Moderate", from: 17, to: 22 }, damage: { scale: "Moderate", from: "2d8+5", to: "2d12+12" } }` |
| `reskinRelevel.hasRows` (new) | boolean | `rows.length > 0 \|\| strikes.length > 0` (Handlebars has no "or"). | `true` |

Behaviour:
- Group by the item id in the row `key` (`strike-<id>`, `damage-<id>`), not by name: two Strikes can share a name.
- `abilities` is unchanged and stays visible (rebuilt and kept-at-old-level lines); only the `Relevel.Unchanged` paragraph moved into a collapsed `<details>` (no state to keep).
- When `changed` is false, still return `hasRows: false, strikes: []` so the shape is stable.
- Nit 1: the Reskin empty hint now reads `Generator.EmptyHintReskinReady` when `reskinSource` is set (template-only; `reskinSource` already exists).

Keys: new `SIMPLYSF2E.Relevel.AttackRow`, `.DamageRow`, `.UnchangedSummary`, `SIMPLYSF2E.Generator.EmptyHintReskinReady`. `Relevel.Damage` and `StatCheck.Strike` stay (still the row labels `relevel.mjs` emits; the app simply stops showing them as labels).

## Item 2 — AI Provider Setup: Cost estimate and Fast picks fold away

Template: `templates/provider-setup.hbs`. Supply in: `ProviderSetupApp._prepareContext()` / `#jevContext()`; behaviour in `#saveSettings()` and `_onRender()` (`scripts/provider-setup-app.mjs`).

| Field | Type | Meaning | Example |
| --- | --- | --- | --- |
| `pricesOpen` (new) | boolean | Render the **Cost estimate** section open. `true` when the last save attempt failed price validation (`#priceError` set) or the GM opened it in this window; else `false`. | `false` (`provider-setup-prices`), `true` (`provider-setup-price-error`) |
| `priceError` (new) | string or `null` | The localized price error (`ProviderSetup.PriceInputInvalid` / `PriceOutputInvalid`) when the section re-renders after a failed save; else `null`. | `"Input price must be empty or a number of 0 or more."` |
| `pricesSummary` (new) | `{input, output}` or `null` | Formatted saved prices for the closed summary (`"$0.27"`; use `"—"` for a blank side). `null` when both are empty (the summary then says "Not set"). | `{ input: "$0.27", output: "$1.10" }` |
| `jevOpen` (new) | boolean | Render **Fast picks** open: `source === "typesafe" \|\| hasJevKey` (the route needs its key/endpoint), or the GM opened it in this window. | `true` (`provider-setup-jev-typesafe`) |

Unchanged: every existing field and every `name=` / `data-action=` (the save path reads the same inputs; closed `<details>` content stays in the form and is still submitted).

Behaviour:
- **Validation error opens its section.** In `#saveSettings()`, when a price is invalid and before `reportValidity()`: set `input.closest("details").open = true` (a closed section cannot show the browser bubble or take focus), then fill and unhide `[data-price-error]` inside it (`textContent` of its `<span>`, `hidden = false`). Clear and hide it again at the start of the next save. No re-render needed; if a re-render does happen, `priceError`/`pricesOpen` keep the state.
- **Route opens Fast picks.** In `syncJevRoute` (`_onRender`), when the source becomes `typesafe`, set `details[data-section='jev'].open = true`. Never close it automatically.
- **Open state survives re-renders** (Welcome `#advancedOpen` pattern): a `toggle` listener on each `details[data-section]` stores `#pricesOpen` / `#jevOpen`; `_prepareContext` ORs them into the fields above.
- Never hide unsaved edits: the folds only collapse visually, inputs keep their values, and a fold that holds a typed-but-unsaved price stays as the GM left it.
- Save buttons and their order are unchanged.

Keys: new `SIMPLYSF2E.ProviderSetup.CostLegend`, `.CostNotSet`, `.CostSummary`, `.FoldNeedsFix`, `.JevKeySavedShort`.
