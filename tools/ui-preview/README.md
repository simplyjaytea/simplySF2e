# UI preview harness

Lets an agent (or you) *see* the SimplySF2e windows without a running Foundry world. It renders the real `templates/*.hbs` with Handlebars, links the real `module.json` `styles`, and screenshots each fixture with Playwright's Chromium at 720 px and 460 px.

Dev tooling only. It lives outside `scripts/`, so CI's `node --check` / test loop and the release zip (`lang scripts styles templates`) never see it.

## Run it

```sh
cd tools/ui-preview
npm install        # once; needs the npm registry
npm run shoot      # all fixtures
node shoot.mjs generator-npc   # only fixtures whose id contains the text
```

Output goes to `tools/ui-preview/out/` (gitignored): `<fixture-id>@720.png`, `<fixture-id>@460.png`, and the rendered `.html` next to each. Playwright is preinstalled globally in cloud sessions (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`); the script falls back to the global install when `playwright` is not in this folder.

The command exits non-zero, and lists the problems, when a fixture is out of step with its template:

- a template reads a context key, at any depth (reported as a dotted path), that the fixture does not define. The real builders return every key (null or empty when unset), so this means the fixture drifted and would render a silent blank. Keys the real code genuinely omits go in the fixture's `optionalKeys`. Keys behind a condition no fixture turns on are not exercised, so cover each branch with a fixture;
- a stylesheet, font or other request fails to load (for example `npm install` was skipped);
- a `localize` key is missing from `lang/en.json` (rendered visibly as `⟦KEY⟧`).

It also prints a `note:` line when a window scrolls sideways.

## What is in it

| File | Role |
| --- | --- |
| `render.mjs` | Handlebars environment: `localize` (reads `lang/en.json`, `{name}` hash interpolation, missing key shows `⟦KEY⟧`), `eq`, the `simplysf2e-progress` partial, and the page wrapper (`.application.simplysf2e > .window-header + .window-content`). The module CSS makes `.window-content` the `spf-window` size container, so the `@container spf-window` rules fire exactly as in Foundry. |
| `shoot.mjs` | Serves the repo over local `http`, renders each fixture, screenshots the window element. |
| `harness.css` | Stand-in for Foundry core CSS (dark page, window frame, neutral controls). |
| `fixtures/generator.mjs` | Generator: each of the five modes empty, provider attention, busy with and without progress, error, monster preview, NPC with negative modifiers, encounter, character preview and review, created, reskin empty / dropped / preview. |
| `fixtures/itemforge.mjs` | Item Forge: each kind empty, attention, busy, error, wondrous / no-effects / augmentation / crystal / weapon / armor previews. |
| `fixtures/dialogs.mjs` | Provider setup (saved, fresh, models loaded), Sources (default, no packs), Manage presets (list, empty). |
| `fixtures/_shared.mjs` | Shared builders. Imports the module's pure functions (`normalizeConcept`, `computeStats`, `adjustedStats`, `createProgress`) so numbers are the real ones. |

## Adding or changing a fixture

Fixture context shapes are copied from the real code: `GeneratorApp._prepareContext()` and its `#build*PreviewContext()` helpers, `ItemForgeApp._prepareContext()`, and the other apps' `_prepareContext()`. Read the code, do not guess. When one of those methods changes, update the matching fixture in the same PR. A fixture is `{ id, app, context, optionalKeys?, height? }`; `app` is a key of `APPS` in `render.mjs`.

## Caveats

- **Foundry core CSS is not loaded.** Fonts (the real world uses Signika), base buttons, inputs and scrollbars differ from a live world. Judge layout, wrapping, overflow and colour tokens here, not typography.
- **Full content is shown.** The module caps `.simplysf2e-generator` at `80vh` and scrolls inside it; the harness lifts that so nothing is hidden from review.
- **Font Awesome comes from npm** (`@fortawesome/fontawesome-free`, v6 like Foundry's). A CDN link does not load: the cloud sandbox's TLS proxy is not trusted by the headless browser, and `file://` pages cannot fetch it either.
- **No JavaScript from the module runs**: no hover tooltips (`data-tooltip`), no `_onRender` listeners, no focus management. Open the saved `.html` files in a browser for focus and hover checks.
- **Strike traits** are set directly on the fixture concept, because `normalizeConcept` validates them against the live system's trait list, which does not exist under Node.
- The Foundry-only app modules (`generator-app.mjs` and the others) cannot be imported under Node, which is why fixtures copy the context shapes instead of calling them.
