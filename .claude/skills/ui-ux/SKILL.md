---
name: ui-ux
description: Design and build UI/UX changes for the simplySF2e Foundry VTT module windows (Generator, Item Forge, Shop, Treasure, Provider Setup, Sources, Manage Presets, Welcome, What's new). Use for any task that changes templates/*.hbs, styles/**/*.css, tools/ui-preview fixtures, GM-visible layout or wording. Loaded by the Opus UI designer subagent and by anyone reviewing a UI diff.
---

# simplySF2e UI/UX

The module's windows are Foundry ApplicationV2 apps rendered from Handlebars templates with plain CSS. There is no build step and no component framework. You change `templates/<app>.hbs`, `styles/simplysf2e.css` (shared tokens and controls), `styles/apps/<app>.css` (one window), `lang/en.json` (every string), and `tools/ui-preview/fixtures/*.mjs` (the harness states). You look at the result in the screenshot harness, never by guessing.

Read first: `references/anti-slop-checklist.md` in this folder (what generic AI-made UI looks like here and the check that catches it; `references/quick-reference.md` is the long form). Then `PLAYBOOK.md` §3, §4 "UI changes" and §8; `docs/ui-plan.md` "Rules for every item" (the items themselves shipped in v0.1.15); `tools/ui-preview/README.md`. When the task adds context fields the app JS does not yet supply, document them in `docs/ui-contract.md` using its table format so the wiring worker can implement exactly that.

## Hard rules

1. **Narrow layouts use `@container spf-window` on `.window-content`, never viewport `@media`.** The harness renders 720 px and 460 px; both must read cleanly, and a 360 px tall short window must keep every control reachable by scrolling.
2. **Tokens, not literals.** Colours, spacing and type sizes come from the `--spf-*` custom properties in `styles/simplysf2e.css`. Add a token there if one is missing; do not write a hex value or a px size in an app stylesheet.
3. **Never hide an active warning, a validation error, unsaved edits, a kept-at-old-level re-level line, or the run cost.** Collapsible sections are native `<details>/<summary>`; a section holding an error or a required choice renders open.
4. **Strings only through `lang/en.json`** under the window's existing prefix, rendered with `{{localize}}`. Delete keys you made unused and let `scripts/i18n-keys.test.mjs` prove it. Runtime-built key families (`PLAYBOOK.md` §4) look unused and are live: grep before deleting.
5. **AI text stays escaped.** Anything from the model reaches the template through `esc`/`toHtml`/`escAi` in `scripts/text.mjs`; never add a triple-stash `{{{ }}}` over AI text.
6. **No behaviour change beyond the task.** Template logic is display only; app behaviour lives in `scripts/*-app.mjs` and belongs to the wiring worker.
7. **Accessibility is part of done:** keyboard reachable controls, labels on inputs, a non-colour cue for selected state, `<abbr title>` or visually hidden text when a heading is shortened at narrow width.
8. **Icons:** Font Awesome 6 Free names. Foundry ships Pro, so a Pro-only icon renders blank in the harness but fine in a world; note it in the report.

## Workflow

1. `cd` into the worktree the coordinator gave you (`/root/sf2e-wt/<ID>`). Never touch `/root/simplySF2e`.
2. Baseline: `cd tools/ui-preview && npm install && npm install --no-save playwright@1.64.1 && node shoot.mjs` from the worktree. Exit 0 and PNGs in `tools/ui-preview/out/` before you change anything.
3. Read the template, its app CSS, the shared CSS and the fixture that covers the state you are changing. Fixture context shapes are copied from the real `_prepareContext()` in `scripts/<app>-app.mjs`; read the code, do not guess.
4. Make the change. One commit per item or nit so a reviewer can bisect and JT can drop one.
5. Fixtures: update or add a fixture for every state you changed and every new conditional branch. A fixture is `{ id, app, context, optionalKeys?, height?, open? }`; `open` lists `<details>` selectors to expand for a second screenshot.
6. Run the harness again: `node shoot.mjs <id-fragment>` while iterating, the full run before committing. It must exit 0 with no `note:` about sideways scroll. Open the PNGs at `@720`, `@460` and `@460-short` and look at them; the Read tool renders PNGs.
7. Verify: `node --check` on any touched `.mjs`; the all-tests loop in `PLAYBOOK.md` §4; `node scripts/i18n-keys.test.mjs`; `git diff --check`.
8. Run `references/anti-slop-checklist.md` sections 1 to 6 on every changed PNG and string. Report to `/root/sf2e-wt/reports/<ID>.md`: branch, SHA, files, each fixture id you looked at and what changed in it, the checklist lines you could not verify, new `lang/en.json` keys, any context field the app must now supply (also written to `docs/ui-contract.md`), anything you could not verify. Reply only `DONE <ID>`.

## Tool window parts

Generator, Item Forge, Shop and Treasure are three template parts each: `status` (the shared strip), `brief` (the form, root `<fieldset>`), `result` (progress, error, previews, empty state). `scripts/window-parts.mjs` lists them. Each part template has exactly one root element; the status and result roots are `.spf-part` wrappers that take no box (`display: contents`), so their children lay out as children of `.spf-window-body`. A new `<details>` in a brief or result needs a `data-fold="name"`, or it closes on every re-render. The body element and its classes (mode, busy) are created in JavaScript, not in a template.

## Console layout and motion

The tool windows open at a fixed height (`CONSOLE_HEIGHT`) and scroll inside the body. The form's run row and a result card's footer are pinned to the bottom edge (`position: sticky`), so keep the one primary action in those two places. `.window-content` carries two container names: query `spf-window` for "how wide is the space this layout has" (in a window 900 px or wider each pane is its own `spf-window`), and `spf-frame` only for rules about the whole window (the one-line status, the two panes). The Generator's form folds to one line once a result shows (`briefFoldContext` in `scripts/window-parts.mjs`); anything the GM must always see (a warning, a required choice) goes outside `.spf-brief-body` or in a mode that never folds.

Motion that plays once uses the tokens `--spf-motion-fast`, `--spf-motion`, `--spf-ease-out` and `--spf-rise`, animates only `transform` and `opacity`, is started by a class the app adds (never by a rule that matches on every render, or it replays on each click) and is switched off in the file's reduced-motion block. Nothing waits for an animation. No staggered lists, no idle loops. "Flash" (`.spf-flash`, `--spf-motion-flash`) marks the one row a reroll replaced; it is an overlay that fades, so the row never changes size.

Result cards: a creature leads with the six-cell stat strip (`.spf-member-stats.spf-stat-strip`, the encounter member's grid); section headings are the shared `.spf-preview h3`; picks with no compendium match go on one `.spf-unmatched-line` under their list (`unmatchedRows`), never struck through.

## Harness caveats to remember

- No Foundry core CSS: judge layout, wrapping, overflow and tokens, not typography (the world uses Signika).
- No module JavaScript runs: tooltips, `_onRender` listeners and focus management are invisible; open the saved `.html` in a browser for hover and focus checks.
- The harness shows each window at its full content height so nothing is hidden; the `-short` render squeezes it to 360 px, which is where the pinned action bars show. It freezes animation and adds no app classes, so arrive and unfold are never in a PNG.
- A template key missing from a fixture fails the run on purpose: the real builders return every key, so a missing key means a silent blank in a world.
- Playwright must be pinned (`playwright@1.64.1`); `npm install` without `--no-save` drops it, and `tools/release-check.sh` does exactly that. Reinstall and run `node shoot.mjs` directly if release-check reports `Cannot find module 'playwright'`.

## Where things are

| Window | Template | CSS | Fixtures | App JS |
| --- | --- | --- | --- | --- |
| Generator (5 modes, previews, Reskin, re-level) | `templates/generator-status.hbs`, `-brief.hbs`, `-result.hbs` | `styles/apps/generator.css` | `fixtures/generator.mjs` | `scripts/generator-app.mjs` |
| Item Forge | `templates/itemforge-status.hbs`, `-brief.hbs`, `-result.hbs` | `styles/apps/itemforge.css` | `fixtures/itemforge.mjs` | `scripts/itemforge-app.mjs` |
| Shop / Treasure | `templates/shop-*.hbs`, `templates/treasure-*.hbs` (status, brief, result) | `styles/apps/shop.css`, `styles/apps/treasure.css` | `fixtures/shop.mjs`, `fixtures/treasure.mjs` | `scripts/shop-app.mjs`, `scripts/treasure-app.mjs` |
| Provider Setup, Sources, Manage Presets | `templates/provider-setup.hbs`, `templates/sources.hbs`, `templates/manage-presets.hbs` | `styles/apps/<same>.css` | `fixtures/dialogs.mjs` | `scripts/<same>-app.mjs` |
| Welcome, What's new | `templates/welcome.hbs`, `templates/whats-new.hbs` | `styles/apps/welcome.css`, `styles/apps/whats-new.css` | `fixtures/welcome.mjs`, `fixtures/whats-new.mjs` | `scripts/welcome-app.mjs`, `scripts/whats-new-app.mjs` |
| Shared shell (connection switch, token report, progress bar) | `templates/_statusbar.hbs`, `templates/_progress.hbs` | `styles/simplysf2e.css` | `fixtures/_shared.mjs` | `scripts/app-base.mjs` |

Fixture paths are under `tools/ui-preview/`.
