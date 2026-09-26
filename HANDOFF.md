# HANDOFF.md — live session baton

Read this first, then CLAUDE.md. HISTORY.md is the PF2e-era scaffold narrative; do not treat its v0.3.5.x release baton as simplySF2e state.

## Last session — 2026-09-26 Neon Drift UI overhaul (shipped)

- Released as **v0.0.8** (merge `b398a8c`, pushed straight to `main` at the user's explicit request, no PR). Auto Release run #9 succeeded. PR #7 (sci-fi HUD theme) had published v0.0.7 earlier the same day.
- Commits in the release:
  1. `c210b2c` — Neon Drift baseline: one `spf-mode-*` class per generator mode, shared `.spf-statusbar`, `.spf-statgrid`, neon/amber/per-mode tokens.
  2. `e9c34a0` — CSS consolidation: override blocks folded into single declarations; app-only rules split into `styles/apps/{generator,itemforge,provider-setup,manage-presets,sources}.css`; `module.json` `styles` lists all six; `ui.layout.test.mjs` concatenates every manifest style.
  3. `b3aa509` — layout overhaul:
     - Narrow-window rules moved from viewport `@media (max-width: 520px)` to `@container spf-window` on `.application.simplysf2e .window-content`. The old media queries never fired for a narrow Foundry window inside a wide browser. A test pins this.
     - Generator: auto-fit mode switch (2x2 when narrow), wrapping generate row and status strip, chip readouts in preview headers, shared statblock header on the created and character-review cards, primary "Open character" on the review card.
     - Item Forge: stronger selected-kind tile, left-aligned row labels.
     - Provider setup: Endpoint and API key legend cards (new lang keys `ProviderSetup.EndpointLegend`, `ProviderSetup.CredentialsLegend`); presets no longer dimmed by opacity.
     - Manage presets and Sources: selection/focus rails, full preset name in `title`, dashed empty-category state.
     - Contrast: primary label now >= 4.52:1 (was 2.49:1); attention glyph 5.5:1. Cited SF2e tokens unchanged.
- Verified before release: all `scripts/*.test.mjs` pass; an offline Chromium harness rendered the live templates in 21 states at 360px and native width; contract parity (data-action, name, id, data-*, localize keys, no new triple-stash or inline style) held against `e9c34a0`. The harness was deleted afterward.
- Cleanup done: merged feature branch deleted locally and on GitHub; working tree clean. README and CLAUDE.md no longer pin a release number (every docs merge would make it stale).
- Orca: run `run_7ea15efef7c3` is abandoned. Dispatch `ctx_6df25771df28` was left retained; `ctx_8370d5747230` reported `release_unknown` (process exit unconfirmed). Check Orca if either still holds a terminal.

## Exact next step

1. Live Foundry QA of the v0.0.8 UI on the user's VPS: open all five windows (generator in each mode, item forge, provider setup, manage presets, sources), then resize each to about 360px. Confirm the `@container` narrow rules fire and Foundry's own `.form-group`/button styles do not override the layout.
2. Live QA of all six complete-only classes (Envoy, Mystic, Operative, Solarian, Soldier, Witchwarper): path dialogs, grants, spell entries, specialization skill feat embedding.
3. Parked: cited SF2e Building Creatures numbers; Item Forge live verification.

## Material limits

- Alpha, not a finished product. Building Creatures / Treasure by Level numbers in `tables.mjs` remain inherited PF2e-compatible benchmarks pending cited Starfinder 2e numbers.
- Encounter preview still labels the treasure budget `gp`.
- Item Forge rune assembly is still PF2e-era.
- Live Foundry QA is not in this environment.
- HISTORY.md is inherited from the PF2e scaffold; do not rewrite it as SF2e history.
