# UI contract — context the templates now read

> **Template paths (2026-11-14).** `generator.hbs`, `itemforge.hbs`, `shop.hbs` and `treasure.hbs` are now three part templates each: `<window>-status.hbs` (which includes `_statusbar.hbs`), `<window>-brief.hbs` (the form) and `<window>-result.hbs` (progress, error, previews). Where an entry below names the old file, look in the part that holds that region. The parts are listed in `scripts/window-parts.mjs`.

Companion to `docs/ui-plan.md`. The UI branch (`work/T-UI`) changed the templates, CSS and harness fixtures; this file lists every context field the templates now read that the apps do not yet supply, so the integration worker can implement exactly this. **The fixtures in `tools/ui-preview/fixtures/` are the source of truth for shape and example values**; when this file and a fixture disagree, the fixture wins and this file is the bug.

Conventions: the real `_prepareContext()` must return every key listed (null, `false` or `[]` when empty), because the harness treats an absent key as drift. "Supply in" names the existing method that should add the field. Behaviour the JS must add is listed under each item. Removed fields are listed explicitly; everything not mentioned is unchanged.

## Item 3 — Token report collapsed (Generator, Item Forge, Shop, Treasure)

No new context. `tokenReport.{steps, totalText, costText}` from `AppBase._buildTokenReport()` are read as before; the block is a native `<details class="spf-token-report">`, collapsed on every render (no remembered state). Nothing to implement.

## Item 8 — What's new: newest notes open, earlier ones collapsed

Template: `templates/whats-new.hbs`. Supply in: `WhatsNewApp._prepareContext()` (`scripts/whats-new-app.mjs`).

| Field | Type | Meaning | Example (fixture `whats-new-manual-all`) |
| --- | --- | --- | --- |
| `notes` | `{id, title, body}[]` | Changed meaning in the manual view only: the notes of the newest release day. Unchanged in the automatic view (all unseen notes). | the four `2026-11-07-*` notes |
| `manual` | `boolean` (new) | `true` when opened by hand (settings menu, `/sf2e whatsnew`, `api.openWhatsNew`); `false` for the automatic unseen view. Selects the intro: `WhatsNew.IntroAll` when true, `WhatsNew.Intro` (with `version`) when false. Always supplied, never omitted. | `whats-new-manual-all` `true`; `whats-new-unseen` `false` |
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

`encounterPreview.allSkipped` (new, T-BUG-GEN): boolean, `true` when every member's count is 0. Supplied by `#buildEncounterPreviewContext()` as `members.every((m) => !(m.count > 0))`; the template disables Create All when it is true, and `#createEncounterActors` returns early with `SIMPLYSF2E.Generator.NoMembers`. Fixture `generator-encounter-preview`: `false`; `generator-encounter-all-skipped`: `true`.

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

Template: `templates/generator.hbs` (`characterReview`). Supply in: `skillReportContext()` in `scripts/generator-context/pc-preview.mjs`, called where `#characterReview` is built in `generator-app.mjs`.

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

## Item 5 — Item Forge compact kind picker

Template: `templates/itemforge.hbs`. Supply in: `ItemForgeApp._prepareContext()` (`kinds` array, ~l.99 of `scripts/itemforge-app.mjs`).

| Field | Type | Meaning | Example |
| --- | --- | --- | --- |
| `kinds[].short` (new) | i18n key | Compact button label. | `"SIMPLYSF2E.ItemForge.KindAugmentationShort"` ("Augment") |

Unchanged: `value`, `label` (now shown once in the description line under the buttons, and still the source of the selected kind's name), `hint`, `selected`; action `selectKind` with `data-kind`. The selected button keeps `aria-pressed="true"` and gets `aria-describedby="spf-kind-hint"`; every button's tooltip carries its own hint. No JS behaviour change.

Keys: new `SIMPLYSF2E.ItemForge.KindWondrousShort`, `KindWeaponShort`, `KindArmorShort`, `KindAugmentationShort`, `KindCrystalShort` (read through `kinds[].short`, so `i18n-keys.test.mjs` lists them as unused until the app supplies the field).

## Item 4 — Compendium Sources: filter and "Selected only"

Template: `templates/sources.hbs`. Supply in: `SourcesConfigApp._prepareContext()`; behaviour in a new `_onRender()` (`scripts/sources-app.mjs`); pure helper in a new or existing pure module (e.g. `scripts/compendium.mjs` or `scripts/sources-filter.mjs`) with a node test.

| Field | Type | Meaning | Example (fixture) |
| --- | --- | --- | --- |
| `filter` (new) | object | Current filter state of this window (`#filter`, default `{ query: "", selectedOnly: false }`). | — |
| `filter.query` | string | Text in the filter field. | `"spell"` (`sources-filtered`) |
| `filter.selectedOnly` | boolean | "Selected only" ticked. | `true` (`sources-selected-only`) |
| `filter.active` | boolean | `query.trim() !== "" \|\| selectedOnly`; shows the status line. | `true` |
| `filter.shown` / `filter.total` | number | Visible packs / all packs over every category. | `2` / `20` |
| `filter.noMatches` | boolean | `active && shown === 0`; shows the no-match notice. | `true` (`sources-no-match`) |
| `categories[].selectedCount` (new) | number | Checked packs in the category (legend shows "{selected} of {total} selected"). | `1` |
| `categories[].hidden` (new) | boolean | `filter.active` and every pack of the category is hidden. | `false` |
| `categories[].packs[].hidden` (new) | boolean | `filter.active && !packMatches(pack, filter)`. | `true` |

Pure helper (node-tested): `packMatches(pack, { query, selectedOnly })` → `false` when `selectedOnly && !pack.checked`; otherwise `true` when the trimmed, lower-cased query is empty or is a substring of `pack.title`, `pack.package` or `pack.id` (lower-cased). The fixture (`tools/ui-preview/fixtures/dialogs.mjs`) contains the same logic; test at least: empty query, title match, package match, case-insensitivity, selectedOnly with an unchecked pack, selectedOnly plus query.

Behaviour (`_onRender`):
- Filtering is **client side**: on `input` of `[data-source-filter]` and `change` of `[data-source-selected-only]`, store `#filter`, then for every `label.spf-pack` set `hidden` from `packMatches` using the checkbox's **current** `checked` state (DOM, not the saved setting), set each `fieldset[data-source-category]`'s `hidden` when all its rows are hidden, update `[data-source-filter-count]` with `game.i18n.format("SIMPLYSF2E.Sources.FilterStatus", { shown, total })`, toggle `[data-source-filter-status]` and `[data-source-no-match]`. **Never re-render** for a filter change: unsaved ticks stay, focus stays in the field, scroll position stays.
- Hidden rows keep their checkboxes in the form; `#onSubmit` already reads `input[data-category=…]:checked` across hidden rows, so a filtered save keeps unchecked/checked edits outside the filter. Do not change that query.
- "Selected only" re-evaluates only when the filter changes, not on each checkbox click (a row the GM just unticked must not vanish under the pointer).
- On `change` of any pack checkbox, update that category's `[data-source-count]` text (`SIMPLYSF2E.Sources.CategoryCount`, `{selected, total}`).
- `[data-source-filter-clear]` clears both controls, re-applies (all rows visible) and returns focus to the filter field.
- A re-render (Reset) re-applies `#filter` through the context fields above, so the view does not jump back to unfiltered.
- Save/Reset stay in the pinned footer; nothing about them changes.

Keys: new `SIMPLYSF2E.Sources.FilterLabel`, `.FilterPlaceholder`, `.SelectedOnly`, `.FilterStatus`, `.ClearFilter`, `.NoMatches`, `.CategoryCount`.

Shared CSS: `input[type="search"]` now gets the module's console input styling (`styles/simplysf2e.css`).

## Polish nits 2–4

No new context. Nit 2 (Welcome provider note: shared `--spf-text-xs`, up to two balanced lines) and nit 4 (Manage Presets: hairline divider and `--spf-space-lg` gap before Delete) are CSS only. Nit 3 reorders the API-key warning in Generator, Item Forge, Shop and Treasure: message, then the **Authorize for this endpoint** button, then the endpoint as a muted detail line; the box keeps `notification warning spf-provider-warning" role="status"`.

## UI bugs B — Item Forge grade label (T-UIBUG-B)

Template: `templates/itemforge.hbs`. Supply in: `ItemForgeApp.#buildRunedPreviewContext()` (`scripts/itemforge-app.mjs`, `GRADE_LABEL_KEYS`).

| Field | Type | Meaning | Example |
| --- | --- | --- | --- |
| `preview.gradeLabel` (new) | localized string or null | The item's equipment grade. Shown in the statline beside Price as "Grade {label}"; hidden when null (a grade slug with no label). | `"Advanced"` (from `SIMPLYSF2E.ItemForge.GradeAdvanced`) |

Grade labels: `SIMPLYSF2E.ItemForge.Grade{Commercial,Tactical,Advanced,Superior,Elite,Ultimate,Paragon}`, keyed by the `EQUIPMENT_GRADES` slugs in `scripts/runes.mjs`. The label casing follows the published names (`Lock (Commercial)`, runes.mjs:57).
`ItemForge.Grade` is now "Grade"; `ItemForge.RunesHeading` is now "Upgrades" (forge preview heading only). The Upgrades list holds upgrades, or property runes when there are no upgrades.
`ItemForge.ItemGradeUpgradesHeading` is "Grade and upgrades": the bold heading of the created item's description (`scripts/item-builder.mjs`, the "Grade: {label}; Installed Upgrades: …" paragraph). It keeps the old item text, apart from the sentence case.

Treasure (no new context): the footer Reroll and its `reroll` action are removed (`Treasure.Reroll` deleted); the party hint sits inside the Party size field.

## Removed context fields (all items)

- `preview.grade` (Item Forge runed preview; the slug, replaced by `gradeLabel`, UI bugs B).
- `encounterPreview.members[].statline` (item 9).
- Strike attack/damage rows inside `reskinRelevel.rows` (item 7; they move to `reskinRelevel.strikes`).
- `characterReview.skills.warnings` / `.loadoutWarnings` as plain strings (item 1; now `{title, detail}`).

## U2 Shop, Treasure and Item Forge: readiness line (B14, S12)

Templates: `templates/itemforge.hbs`, `shop.hbs`, `treasure.hbs` (the status bar). Supply in: each app's `_prepareContext()` (`scripts/itemforge-app.mjs`, `shop-app.mjs`, `treasure-app.mjs`), the same fields the Generator supplies (`generator-app.mjs` ~l.258-262).

| Field | Type | Meaning | Example |
| --- | --- | --- | --- |
| `sourcesReady` (new) | boolean | Equipment packs are available (`getPacksFor("equipment")`). False renders the warning row, expanded. | `true` |
| `sourcePackCount` (new) | number | Number of equipment packs, for the one-line status. | `3` |
| `sourceMissing` (new) | string | Human-readable missing category when `sourcesReady` is false. | `"Equipment"` |
| `jevSource` (new) | string or null | Jev key source from `jevKeySource()`, as in the Generator. | `"key"` |
| `readinessOpen` (new) | boolean | Open state of the one-line disclosure; kept per window through a `toggle` listener in `_onRender`. | `false` |

Scope note: these windows draw only from equipment packs, so readiness checks the equipment category alone. The Generator checks its creature categories.

## U5 Item Forge: per-kind placeholder

Template: `templates/itemforge.hbs` (the prompt textarea `placeholder`). Supply in: `ItemForgeApp._prepareContext()` (`scripts/itemforge-app.mjs`, `PROMPT_PLACEHOLDER_KEYS`).

| Field | Type | Meaning | Example |
| --- | --- | --- | --- |
| `promptPlaceholder` (new) | localized string | The prompt hint for the selected kind tile: `SIMPLYSF2E.ItemForge.Placeholder.{Wondrous,Weapon,Armor,Augmentation,Crystal}`. Falls back to the generic `SIMPLYSF2E.ItemForge.PromptPlaceholder` for a kind without its own key (not reachable through the kind tiles). | "Describe the weapon's form, its wear, and any feature that sets it apart, such as a scorch mark or a cracked grip." |

The kind tile action re-renders the window (`#onSelectKind`), so the placeholder follows the tile at once. The generic key stays in `lang/en.json` as the fallback.

## U5 setup wiring (W4, W12, W13)

Templates: `templates/welcome.hbs`, `templates/provider-setup.hbs`. Supply in: `WelcomeApp._prepareContext()` (`scripts/welcome-app.mjs`) and `ProviderSetupApp._prepareContext()` (`scripts/provider-setup-app.mjs`).

| Field | Type | Meaning | Example (fixture) |
| --- | --- | --- | --- |
| `sourcesMissing` (new) | boolean | True when the readiness warning is the missing-compendium case (`issue === "sources"`). Renders the "Configure compendium sources" button (`data-action="openSources"`) inside the warning. | `welcome-readiness-warning`: `true`; `welcome-fresh`: `false` |
| `priceErrorField` (new) | `"input"` \| `"output"` \| `null` | The manual price the last validation rejected. Marks that input `aria-invalid="true"` and points its `aria-describedby` at `#spf-price-error`. Reset at the start of each save. | `provider-setup-price-error`: `"input"`; others: `null` |

Not new fields: the saved-key hints (W12) use the existing `hasApiKey` and `hasJevKey` booleans. The footer hint (W11) is static text.

## U4B progress telemetry and Welcome boot sequence

Templates: `templates/_progress.hbs`, `templates/welcome.hbs`. Supply in: `progressView()` (`scripts/progress.mjs`), called by `GeneratorApp`, `ItemForgeApp`, `ShopApp` and `TreasureApp` `_prepareContext()` as `progress: progressView(this._progress)`; `WelcomeApp._prepareContext()` (`scripts/welcome-app.mjs`).

| Field | Type | Meaning | Example (fixture) |
| --- | --- | --- | --- |
| `progress.steps[].startedAt` (new) | number (ms) or null | Clock reading when the step became active (`applyStep`, clock from `createProgress(defs, { now })`, default `Date.now`). Null while pending or when the step was skipped. Not rendered. | `generator-busy-progress`: `77800` on the active step |
| `progress.steps[].elapsedMs` (new) | number (ms) or null | Time from active to done. Null on the active and pending steps and on a step that went straight from pending to done. Not rendered. | `800` |
| `progress.steps[].elapsed` (new) | string | `formatElapsed(elapsedMs)` on a done step ("0.8s", "12s", "1m 05s"); `""` otherwise. Rendered as the step's `.spf-num.spf-step-elapsed` status value. | `generator-busy-progress`: `"0.8 s"`, `"12 s"`, `"1 m 05 s"`, then `""` |
| `progress.totalElapsed` (new) | string | The done steps' `elapsedMs` summed and formatted; `""` before the first step finishes. Supplied for later use; not rendered on the card (the card's other lines are unchanged). | `generator-busy-progress`: `"1 m 18 s"` |

The active step shows `SIMPLYSF2E.Progress.Running` ("running"), not a ticking time: a stream tick only patches the bar and the detail line (`_paintProgress`), and nothing re-renders the card on a timer. A step change also patches in place (`SpfApp._paintStepList` in `scripts/app-base.mjs`), so that method writes the same value (`stepElapsed(step)` or the running label) into `.spf-step-elapsed`. The Welcome connecting list has no timing data (WelcomeApp renders once when the check starts and once when it ends), so its first line shows the same "running" status value and the others stay dots.

## UI revamp slice 3: brief fold and result arrival (2026-11-14)

Generator only. Built by `briefFoldContext(context, { auto, override })` in `scripts/window-parts.mjs`, which the fixtures call too.

| Field | Type | Meaning | Fixture values |
| --- | --- | --- | --- |
| `briefFold.foldable` | boolean | The fold line is rendered: the active mode shows a result (or a run began with one), and the mode is not Reskin. | `false` (`generator-empty-monster`, every Reskin fixture), `true` (`generator-monster-preview`) |
| `briefFold.collapsed` | boolean | The form is folded to its one line. `foldable` and not opened by hand. | `true` (`generator-monster-preview`), `false` (`generator-brief-opened`) |
| `briefFold.hasResult` | boolean | A preview, a completion card or a character review is in the context. Kept by the app as the next run's `auto`. | not read by the template |

- The fold is a class (`spf-brief-collapsed`) on the brief's `<fieldset>` and a `<button data-action="toggleBrief" aria-expanded>`; the fields stay in the form. `toggleBrief` changes classes and the summary text only, never renders, and stores the choice in `#briefOverride` until `#endBusy`.
- Each result card carries `data-result` (`preview`, `encounter`, `character`, `reskin`, `created`, `review`; Forge, Shop and Treasure cards have none and count as `card`). `SpfApp._playResultArrival` reads it after every render of the result part.

## UI revamp slice 4: unmatched picks (2026-11-14)

Generator creature and character previews. Built by `unmatchedRows(lists)` in `scripts/generator-context/rows.mjs`, which the fixtures call too.

| Field | Type | Meaning | Fixture values |
| --- | --- | --- | --- |
| `preview.unmatched.spells` / `.feats` / `.equipment` / `.loot` | row[] | The rows of that list with `found: false` and no `empty` flag, same objects and order as the list itself. Always an array. | two of four non-empty in `generator-monster-preview` |
| `pcPreview.unmatched.feats` / `.spells` / `.equipment` / `.loot` | row[] | The same for a character. An empty feat slot (`empty: true`) is not in it. | `generator-character-multiclass-unplaced` |

- The template lists only `found` rows (and, for a character, `empty` feat slots), then one `<p class="spf-unmatched-line">` per list when its array is non-empty. Creature spells and feats keep their reroll die on that line, with the same `data-kind` and `data-index` as before.
- The lists themselves (`preview.spells` and so on) are unchanged, so the match summary and the completion card count as before.
- The Loot `<ul>` carries `data-section="loot"`; the app flashes it after Reroll loot and the row of a rerolled pick after a pick reroll (`#flashPick`, `#playFlash`).
