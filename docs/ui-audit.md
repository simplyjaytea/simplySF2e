# UI audit (step U3)

Audit of the five SimplySF2e windows (Generator, Item Forge, Provider Setup, Compendium Sources, Manage Presets) plus the shared kit. Written for step U3 of [next-steps.md](next-steps.md). It changes no code. U5a and U5b fix the `bug` rows; the coordinator turns the `design` rows into cards for JT, and U6 builds only the ones JT approves.

State audited: `main` at U2 (PR #25, signed modifiers and localized AC/HP/DC/Per, so the old "+-2" sign bug is fixed and is not a finding here).

## How this was measured

- **Screenshots.** `cd tools/ui-preview && npm install && npm run shoot`: 40 fixtures at 720 px and 460 px, written to `tools/ui-preview/out/<fixture>@<width>.png` (gitignored; rerun to reproduce). The harness exited clean (no fixture drift, no `⟦KEY⟧`, no failed request, no horizontal-scroll note).
- **Extra checks, run on the harness's rendered HTML** (throwaway scripts, not committed):
  - **Contrast.** For every text node and icon in 15 fixtures (16 renders), computed the foreground colour (with ancestor opacity applied) against the background pixel sampled from a screenshot taken with all text hidden. Thresholds: 4.5:1 text, 3:1 large text and icons (WCAG 1.4.3 / 1.4.11). Disabled controls are exempt under WCAG and not counted.
  - **Focus.** Focused each control the way the keyboard does (Shift+Tab then Tab, so `:focus-visible` applies) and screenshotted it.
  - **Width.** Forced the window to 340 px (the module's `min-width`) and 400 px on 9 fixtures; tested for horizontal overflow.
  - **Long names.** Injected a 73-character unbroken name into 14 name slots at 460 px.
- **Code paths** read for busy, cancel, Enter, Escape, error and empty behavior: `generator-app.mjs`, `itemforge-app.mjs`, `app-base.mjs`, `provider-setup-app.mjs`, `sources-app.mjs`, `manage-presets-app.mjs`, all six templates and all six stylesheets.
- **Not verifiable here:** the harness loads no Foundry core CSS, no module JS (no tooltips, no `_onRender` listeners) and no real fonts. Rows that depend on those say **needs live check** and belong in JT's G11 pass.

Severity: **blocker** (cannot complete the task), **major** (a real user is blocked, misled or loses money or data in a common path), **minor** (looks or reads wrong, workaround obvious). No blockers were found.

## Summary

| Area | Rows | bug | design | major |
| --- | ---: | ---: | ---: | ---: |
| Shared kit | 7 | 7 | 0 | 1 |
| Generator | 18 | 12 | 6 | 2 |
| Item Forge | 7 | 3 | 4 | 0 |
| Provider Setup | 5 | 2 | 3 | 0 |
| Compendium Sources | 4 | 1 | 3 | 0 |
| Manage Presets | 3 | 2 | 1 | 0 |
| **Total** | 44 | 27 | 17 | 3 |

Highest value first: **K1** (keyboard focus is invisible on every primary button), **G1b** (closing a window mid-run does not stop a paid AI run, needs a live check), **G7** (the over-budget warning is 2.35:1 red text), **K2** (no live region on the progress card).

## Shared kit (`styles/simplysf2e.css`, `templates/_progress.hbs`, all templates)

Owner: **U5a** (it owns the shared files). U5b sends any shared-kit change it needs through the coordinator.

| id | screen/state | finding | evidence | severity | kind |
| --- | --- | --- | --- | --- | --- |
| K1 | Every window, keyboard focus on the primary button (Generate, Create, Save & Test, Save, New Preset) | The focus ring is drawn but clipped away. `.spf-primary` has a notched `clip-path`; the 2 px outline sits outside the border box, so nothing is visible. Computed style says `outline: solid 2px rgb(158,218,230)`, pixels show none. Secondary buttons and icon buttons are fine. Same clipping applies to the statusbar, connection bank and cards, which carry no focusable chrome today but will clip anything focused at their edge. | `simplysf2e.css:200` (`clip-path` on `button.spf-primary`) and `:230` (focus rule); focus screenshots `generator-empty-monster@720` Generate vs Preview Plan | major | bug |
| K2 | Progress card while generating (`_progress.hbs`, shared by Generator and Item Forge) | The normal branch has no `role="status"` / `aria-live`; only the "Creating the actor…" fallback has one. Step changes, the percent and the "Writing… ≈ 640 tokens" detail are painted by `_paintProgress` (`app-base.mjs`) with no announcement. Step state (done / active / pending) is carried by icon and colour only, with no text. The progress bar itself is exposed (`role="progressbar"`). | `_progress.hbs:2-25` vs `:27`; `app-base.mjs` `_paintStepList` / `_paintProgress` | minor | bug |
| K3 | Fallback branch of `_progress.hbs` ("Creating the actor…") | Shows the model as `({{model}})` in parentheses with no spinner; the progress branch shows it bare (`:18` vs `:29`). Reads as two different components. | `generator-busy-no-progress@460` vs `generator-busy-progress@460`; `_progress.hbs:18,29` | minor | bug |
| K4 | Success green `--spf-success` (#3a7b59) on navy, used for every "found in compendium" check and the "provider ready" check | 2.36–2.95:1, below the 3:1 non-text minimum. The check icon is the only success cue next to a name. | `simplysf2e.css:27`; `generator.css:386` (`.spf-match`); measured on `generator-monster-preview@720` | minor | bug |
| K5 | Input, select and textarea borders on cards | `--spf-border` is 2.49:1 against the card surface (3.06:1 against the window background), under the 3:1 needed to see a control's boundary. The fill is the same navy, so the border is the only edge. | `simplysf2e.css:32` (token), `:286-292` (input rule); computed from the tokens | minor | bug |
| K6 | `<summary>` "Advanced options" with keyboard focus | The shared focus rule covers `button, input, select, textarea` only. The summary falls back to the browser's default `auto` ring (computed `outline: auto 1px rgb(16,16,16)`), which does not match the cyan ring elsewhere and is weak on navy. | `simplysf2e.css:230`; `generator.css` `.spf-advanced summary`; focus screenshot `generator-empty-monster@720` (summary) | minor | bug |
| K7 | Screen readers, every template | 59 `<i>` icons in `generator.hbs`, 6 carry `aria-hidden`; none in `provider-setup.hbs` (0 of 9). Decorative glyphs next to a text label can be read out as private-use characters. The "found / not found" check and exclamation icons are the only text-less state markers and expose their meaning through `title=` on an `<i>`, which assistive tech does not reliably read (14 `title=` vs 34 `data-tooltip`; the two also look different on hover). | counts from `grep -c` over `templates/*.hbs`; `generator.hbs:372,384,396,408,508-519,535,554,566,578` | minor | bug |

## Generator

Owner: **U5a** for `bug`. Fixtures: `generator-*`.

| id | screen/state | finding | evidence | severity | kind |
| --- | --- | --- | --- | --- | --- |
| G1a | Provider strip, compendium row, when packs are missing | Message reads "Required compendium content is unavailable: spells,feats." The array is passed straight to `localize`, so it prints with a bare comma and raw category ids (`bestiaryActors`). The pre-flight toast joins with ", " but also uses the raw ids; the Sources window shows proper labels. | `generator-empty-attention@460`; `generator-app.mjs:163` (`sourceMissing: sources?.missing`) vs `#assertGenerationReady` (`.join(", ")`); `compendium.mjs:96` | minor | bug |
| G1b | Window closed (X or Esc) while a run is in flight | Nothing aborts the run. Only the **Cancel generation** button calls `_cancelGeneration()`; no `close` hook exists in `generator-app.mjs`, `itemforge-app.mjs` or `app-base.mjs` (grep for `close` finds none). Tokens keep being spent, a **Generate** run can still create the actor after the window is gone, and a finished preview is dropped silently. **Needs live check** (what Foundry does on `render()` of a closed app). | `app-base.mjs` `_cancelGeneration` (only caller: the `cancelGeneration` action); no `_onClose` / `_preClose` | major | design |
| G2 | Reskin mode, nothing dropped yet | Empty-state copy is the shared "describe a concept above and press Generate", which is wrong here (nothing to describe; a creature must be dropped first). | `generator-reskin-empty@460`; `lang/en.json:168`; `generator.hbs:289-291` | minor | bug |
| G3 | Mode switch at 460 px and 340 px | Five segments wrap 3 + 2 at 460 (2 + 2 + 1 at 340) and "Player Character" breaks onto two lines. Known from the prototype; still present. No overflow. | `generator-empty-monster@460`; narrow run at 340 | minor | design |
| G4 | Encounter and Character modes at 460 px | The primary button label wraps to two lines ("GENERATE / ENCOUNTER", "GENERATE / CHARACTER") because `.spf-generate-row` gives it `flex: 1 1 14rem` next to the Preview Plan button. Monster/NPC labels fit on one line. | `generator-encounter-preview@460`, `generator-character-preview@460` | minor | design |
| G5 | Encounter mode, "Party level" label (720 and 460) | The label wraps to "Party / level" because `.spf-level-primary .form-group` is `flex: 0 1 12rem`. Single "Level" does not. | `generator-empty-encounter@720`; `generator.css` `.spf-level-primary` | minor | bug |
| G6 | Encounter preview, member set to ×0 | "Skipped" is shown only by `opacity: .45` on the whole card; no text says skipped and the +/- buttons stay live. Text drops to 2.8–3.9:1. Screen readers get no state. | `generator-encounter-preview@460`; `generator.hbs:456`; `generator.css:496`; contrast run | minor | bug |
| G7 | Encounter preview header, over budget ("135 / 120 XP", treasure over budget) | The warning is `--spf-danger` text on the navy chip: 2.35:1, the lowest text contrast in the app, on the one number the GM scans. | `generator-encounter-preview@720`; `generator.css:500`; `generator.hbs:451-452` | major | bug |
| G8 | Monster/character preview, spells and feats that did not resolve (`.spf-dropped`) | Whole row at `opacity: .65` plus strike-through; the red exclamation icon is 1.75:1 and the "(rank 1)" text 4.34:1. The text alternative is only the `title` on the icon (K7). | `generator-monster-preview@460`; `generator.css:417-424`; contrast run | minor | bug |
| G9 | Character preview, ancestry / heritage / background / class not found | The not-found glyph is white. In spell and feat lists the same glyph is red, but that colour comes from `.spf-dropped i`, which these four rows lack, so "not found" looks like an info icon. | `generator-character-preview@460` (Heritage row); `generator.hbs:508-520`; `generator.css:422` | minor | bug |
| G10 | While generating, the whole input card | The busy state dims the fieldset to `opacity: .58`. Non-control text inside it falls just under AA: legend 4.14, "Advanced options" 4.38, "Preset" 4.42:1. (Disabled buttons are exempt.) | `generator-busy-progress@720`; `generator.css:7` | minor | bug |
| G11 | Preview card, **Discard** | One click discards a preview that cost tokens (and an encounter whose member counts the GM edited). No confirm, no undo. Primary and Discard sit side by side. | `generator.hbs:440,490,605,650`; `generator-app.mjs` `#onDiscard` | minor | design |
| G12 | "Generation complete" card | Copy says "Created 1 actor(s): …" (hard-coded plural). The form above still says "Generate Monster" while the card offers "Generate Another", two entry points for the same action. | `generator-created@460`; `lang/en.json:138` | minor | bug |
| G13 | Character review card | The same long "These features had no recorded choice after creation…" text appears as a warning and again as the prompt of every list item. | `generator-character-review@460`; `lang/en.json:148`; `generator.hbs:676-686` | minor | design |
| G14 | Hard-coded English in the template | `(avg …)`, `XP`, `credits` are literals. Only `en.json` exists, so nothing is visible today. | `generator.hbs:338,451,452` | minor | bug |
| G15 | Long names in the provider strip and the Reskin drop zone | The connection / model names and the Reskin source name truncate with an ellipsis and have no full-name tooltip; the strip's `data-tooltip` carries only the base URL. At 460 with a last-run line the model shows as "anthropic/claud…". Long names in titles, strikes, ability names and encounter members wrap with no overflow. | `generator-monster-preview@460`; `generator.hbs:3,88`; `generator.css:.spf-reskin-source strong`; long-name run | minor | bug |
| G16 | Compendium-found ability name (`.spf-found`) | Coloured `var(--color-text-hyperlink)`, a Foundry core variable the module does not define; contrast on the navy card cannot be measured here. **Needs live check.** | `generator.css:377`; `generator.hbs:351` | minor | bug |
| G17 | Keyboard: Enter, Escape, Ctrl+Enter | The root is `tag: "form"` with no `form.handler`, so Enter in the Level or Party inputs does nothing visible and there is no keyboard shortcut to run Generate. Escape closes the window even while busy (see G1b). **Needs live check.** | `generator-app.mjs` `DEFAULT_OPTIONS` (no `form`) | minor | design |

## Item Forge

Owner: **U5b** for `bug`. Fixtures: `itemforge-*`.

| id | screen/state | finding | evidence | severity | kind |
| --- | --- | --- | --- | --- | --- |
| F1 | Activation line, wondrous / augmentation / crystal previews | `{{{preview.activation}}}` prints raw HTML. **No injection today:** I traced every branch of `describeActivation` (`item-builder.mjs:667`). The only free text is `effectName`, escaped at normalize time (`:558`, `esc(...slice(0, 80))`); `damageType`, `saveType`, `conditionSlug` and `duration` come from whitelists, dice and DC are module-computed. The safety depends on a cross-file rule ("escape at normalize") that a future parameter, or a concept restored from saved data that skips `normalizeActivation`, would silently break. Hardening: keep the raw name in `params`, escape in the two HTML sinks (`item-builder.mjs:793` description and the macro), render with `{{ }}`. | `itemforge.hbs:161`; `item-builder.mjs:558,667,793`; U1's flag | minor | bug |
| F2 | Wondrous preview price | Shows `2,150 gp` while weapon, armor, augmentation and crystal previews show credits (`1,350 credits`). Deliberate in code (the persisted price is gp-denominated, `item-builder.mjs:754-763`), but a GM in an SF2e world reads two currencies in one window. `gpToCredits` exists (`currency.mjs:59`); this is a display change only. | `itemforge-wondrous-preview@460` vs `itemforge-weapon-preview@460`; `itemforge-app.mjs:128` vs `:164-167` | minor | design |
| F3 | Row under the Generate button | The Compendium Sources shortcut is a gear styled as the Generator's dice button (class `spf-random-button`), while the status strip above carries a second, identical gear for provider settings. Two same-looking icons with different meanings. In the Generator the sources gear sits in its own labelled strip row. | `itemforge-empty-wondrous@460`; `itemforge.hbs:25,86` | minor | design |
| F4 | Primary button label | Switches to "Regenerate" once a preview exists; the Generator never relabels its button. | `itemforge.hbs:84` vs `generator.hbs:244` | minor | design |
| F5 | Kind picker at 460 px | Five full tiles stack to about 330 px (the last one alone on its row) before the prompt box, so the form, Generate and the preview are far down in the default window. | `itemforge-empty-wondrous@460` | minor | design |
| F6 | Level / Rarity row | Labels sit at different heights (the stepper is shorter than the select) at 460, and at 720 Rarity floats at the far right edge, about 220 px from Level. | `itemforge-empty-wondrous@460`, `@720`; `simplysf2e.css` `.spf-row` | minor | bug |
| F7 | Selected kind tile | The selected icon is neon on the tile fill: 2.88:1, under the 3:1 icon minimum (the rail and border also mark selection, so this is borderline). | `itemforge.css:57`; `itemforge-wondrous-preview@720` | minor | bug |

## Provider Setup

Owner: **U5b** for `bug` (after J1b, which edits this template). Fixtures: `provider-setup-*`.

| id | screen/state | finding | evidence | severity | kind |
| --- | --- | --- | --- | --- | --- |
| P1 | **Save & Authorize** with a non-HTTP base URL (for example `ftp://x`) | `saveSettings` throws a plain `Error` for the scheme, but `#onSubmit` is `try/finally` with no `catch`, so no notification appears and only the console shows it. `type="url"` and `required` stop empty and malformed input, not other schemes. `#onSaveAndTest` and `#onLoadModels` do notify. **Needs live check.** | `provider-setup-app.mjs:266-274` vs `#onSaveAndTest` | minor | bug |
| P2 | Footer, Enter key | Enter submits the form, which runs **Save & Authorize**, the unstyled button. The visual primary is **Save & Test**. | `provider-setup.hbs:77-82`; `provider-setup-saved@720` | minor | design |
| P3 | **Cancel** after Load Models or after switching, creating or deleting a connection | Those actions write settings immediately (`#onLoadModels` calls `saveSettings`; the connection actions call the settings API). Cancel only closes the window, so the label promises an undo it cannot give. | `provider-setup-app.mjs` `#onLoadModels`, `#switchConnection`, `#onCreateConnection`; `provider-setup.hbs:83` | minor | design |
| P4 | Endpoint card | The Ollama / LM Studio CORS paragraph is shown for every provider, including OpenRouter, adding three lines of unrelated text. | `provider-setup-saved@720`; `provider-setup.hbs:37` | minor | design |
| P5 | Hints | Four hints use class `hint`, two use `spf-hint`; each is styled separately. Same look today, two sources of truth. | `provider-setup.hbs:2,19,42,54,63`; `provider-setup.css:20` | minor | bug |

## Compendium Sources

Owner: **U5b**. Fixtures: `sources-*`.

| id | screen/state | finding | evidence | severity | kind |
| --- | --- | --- | --- | --- | --- |
| S1 | **Reset to defaults** | Writes the empty selection immediately and re-renders, with no confirmation, discarding any unsaved checkbox edits, while **Save** is explicit. The two buttons sit side by side. | `sources-app.mjs:80-84`; `sources.hbs:25` | minor | design |
| S2 | Window with 10 categories | About 1,700 px tall at 460 px and long at the default 560×640; **Save** and **Reset** are the last thing in the scroll, so a GM scrolls to the end to save. | `sources-default@460`; `sources.css` `.simplysf2e-sources` | minor | design |
| S3 | No compendium packs found | The same "No compendium packs … found" box repeats ten times and **Save** stays enabled with nothing to save. | `sources-no-packs@460` | minor | design |
| S4 | Pack rows with long titles at 460 px | The `nowrap` source id (`.spf-pack-source`) takes about 190 px, squeezing the title to four short lines, and unchecked rows lose the background so the two columns look misaligned. | `sources-default@460`; `sources.css:62` | minor | bug |

`sources.hbs` has no icon-only control, so the plan's worry about missing `aria-label` does not apply there.

## Manage Presets

Owner: **U5b**. Fixtures: `manage-presets-*`.

| id | screen/state | finding | evidence | severity | kind |
| --- | --- | --- | --- | --- | --- |
| M1 | Empty list | "No custom presets yet. Save one from the generator window." The generator has no save control any more; the **New Preset** button is on this same window. | `manage-presets-empty@460`; `lang/en.json:221` | minor | bug |
| M2 | Every row | Edit, Duplicate, Export and Delete carry the same accessible name on every row ("Edit preset" ×N), with no row context. | `manage-presets.hbs:8-17` | minor | bug |
| M3 | Row buttons | Delete is an icon identical in style to Edit/Duplicate/Export and sits next to them. A confirm dialog exists (`confirmDeletePreset`), so the risk is low; a destructive cue is missing. | `manage-presets-list@460`; `manage-presets-app.mjs:74` | minor | design |

## Checked, no finding

- **Overflow and wrapping.** No horizontal scroll at 340, 400, 460 or 720 on 9 fixtures; 73-character unbroken names wrapped or truncated cleanly in 14 slots.
- **Icon-only buttons.** Every one in the Generator, Item Forge, Provider Setup and Manage Presets has an `aria-label`.
- **Raw `⟦KEY⟧`.** None; the harness exits clean. U4 also guards literal keys.
- **Destructive confirmations.** Deleting a preset and deleting a connection both confirm.
- **Focus ring on non-primary controls.** Secondary, icon, textarea, kind tile, provider preset and the mode switch (keyboard arrows) all show the cyan ring. Only the primary button (K1) and the summary (K6) do not.
- **Contrast that passes.** `--spf-text-muted` on every card and surface (4.5:1 or better), placeholder text (6.1:1), the primary button label across its gradient, the focus ring colour (9.7:1), per-mode accents (5.8–10.7:1).
- **Generator states.** Busy disables every control except Cancel; Cancel appears only while a run is cancellable and disables itself while cancelling; the error banner uses `role="alert"`; the generator's own 80vh inner scroll behaves.
- **Item Forge states.** The unavailable-effects note, provider error and "flavor-only" warning render with correct roles; busy disables the kind tiles and Generate and offers Cancel; no overflow down to 340 px.

## Suggested clusters for the JT cards (U6)

The `design` rows group naturally; the coordinator can put each to JT as one card with a recommendation.

1. **Narrow-window labels** (G3, G4, F5, F6): mode switch wrapping, button label wrapping, Forge kind picker height.
2. **Forge consistency** (F2, F3, F4): price currency, the two gear icons, Generate vs Regenerate.
3. **Run safety** (G1b, G11, G17): what closing a busy window does, confirm on Discard, a keyboard shortcut to generate.
4. **Provider Setup flow** (P2, P3, P4): Enter target, Cancel wording, local-server hint.
5. **Sources** (S1, S2, S3): Reset confirm, sticky Save, one "nothing found" message.
6. **Wording** (G13, M3): duplicate review text, destructive cue.

## Appendix: contrast measurements

Foreground against sampled background, large-text threshold applied where the text is 24 px or 18.66 px bold. Only failures are listed; everything else on the 15 fixtures passed.

| element | ratio | threshold |
| --- | ---: | ---: |
| `.spf-over-budget` chip, "135 / 120 XP" | 2.35 | 4.5 |
| Skipped encounter member: tag / stats / name | 2.79 / 3.48 / 3.93 | 4.5 |
| "found" check icon (`.spf-match`) | 2.36–2.95 | 3 |
| Dropped-row exclamation icon | 1.75 | 3 |
| Dropped-row "(rank 1)" text | 4.34 | 4.5 |
| Busy dim: legend / Advanced / Preset label | 4.14 / 4.38 / 4.42 | 4.5 |
| Selected kind icon (`fa-ring`, neon) | 2.88 | 3 |
| Input border vs card (`--spf-border`) | 2.49 | 3 |
