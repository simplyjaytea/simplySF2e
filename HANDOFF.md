# HANDOFF.md — live session baton

Read this first, then CLAUDE.md. HISTORY.md is the PF2e-era scaffold narrative; do not treat its v0.3.5.x release baton as simplySF2e state.

## Current session — 2026-09-26 Neon Drift UI overhaul

- Repo: `simplyjaytea/simplySF2e`. Branch: `cursor/neon-drift-ui-overhaul`, cut from `main` at `1df0817` (PR #7 merged). Not pushed; no PR yet.
- Commits on the branch:
  1. `c210b2c` — Neon Drift baseline: one `spf-mode-*` class per generator mode, shared `.spf-statusbar`, `.spf-statgrid`, neon/amber/per-mode tokens.
  2. `e9c34a0` — CSS consolidation: Sci-fi HUD and Neon Drift override blocks folded into single declarations; app-only rules split into `styles/apps/{generator,itemforge,provider-setup,manage-presets,sources}.css`; `module.json` `styles` lists all six; `ui.layout.test.mjs` concatenates every manifest style. No intended visual change.
  3. UI overhaul commit (this session's last) — see below.
- UI overhaul:
  - Narrow-window rules moved from viewport `@media (max-width: 520px)` to `@container spf-window` on `.application.simplysf2e .window-content`. The old media queries never fired for a narrow Foundry window inside a wide browser. Test pins this.
  - Generator: mode switch is an auto-fit grid (2x2 when narrow instead of clipping "PLAYER CHARACTER"); generate row wraps; statusbar rows wrap (compendium detail no longer overlaps its label); preview headers use chip readouts (level, grounded count, XP budget, treasure budget — still labelled `gp` by the existing template); created and character-review cards get the same statblock header; review card gets a primary "Open character"; tighter preview paragraph rhythm and spacing on grounding glyphs.
  - Item forge: selected kind tile has a neon rail + icon; row labels left-aligned; narrow tiles drop the fixed height.
  - Provider setup: Endpoint and API key grouped into legend cards (new lang keys `ProviderSetup.EndpointLegend`, `ProviderSetup.CredentialsLegend`); unselected provider presets no longer dimmed by opacity.
  - Manage presets: row hover/focus rail, full name in `title`, primary no longer wraps.
  - Sources: checked packs carry an accent rail, keyboard focus ring on rows, dashed empty-category state, mono package label.
  - Contrast: primary button gradient darkened (label >= 4.52:1, was 2.49:1 at the top stop); attention glyph lifted to 5.5:1 on the strip. Cited tokens unchanged.
- Orchestration: an Orca run (`run_7ea15efef7c3`) produced commit 2 via a Claude worker, then the user asked to stop using workers. T1 dispatch `ctx_6df25771df28` is retained; T2 dispatch `ctx_8370d5747230` (codex) was stopped, and its release returned `release_unknown` twice ("process could not be confirmed stopped"). Tasks T3–T6 in that run were never dispatched; the work was done directly in this session.

## Verification done

- All `scripts/*.test.mjs` pass; `node --check scripts/ui.layout.test.mjs`; `lang/en.json` and `module.json` parse.
- Offline harness (outside repo) at `%TEMP%\sf2e-ui-overhaul`: `render.mjs` renders the live templates with 21 fixture states, `shoot.mjs <label>` takes Chromium screenshots at 360px and the native window width, `csscheck.mjs` parses every manifest stylesheet, and `parity.mjs <ref>` diffs data-action/name/id/data-* sets, localize keys, triple-stash, and inline styles against a git ref. Shots: `shots/baseline` (before) and `shots/final` (after). Parity vs `e9c34a0`: OK.
- The harness uses stub Foundry chrome and Font Awesome Free (`fa-sword` is Pro-only, so it renders blank in the harness; Foundry bundles Pro).

## Exact next step

1. Push `cursor/neon-drift-ui-overhaul` and open a PR. The user must approve any authenticated GitHub write, and `gh` hangs on this machine.
2. Live Foundry QA of all five windows at the default width and after resizing to about 360px. This confirms the `@container` narrow rules fire inside real ApplicationV2 windows and that Foundry's own `.form-group` and button styles do not override the new layout.
3. Carried over: live QA of all six complete-only classes (Envoy, Mystic, Operative, Solarian, Soldier, Witchwarper). SF2e Building Creatures numbers and Item Forge live verification stay parked.

## Material limits

- Alpha, not a finished product. Building Creatures / Treasure by Level numbers in `tables.mjs` remain inherited PF2e-compatible benchmarks pending cited Starfinder 2e numbers.
- Item Forge rune assembly is still PF2e-era.
- Live Foundry QA is not in this environment.
- HISTORY.md is inherited from the PF2e scaffold; do not rewrite it as SF2e history.
