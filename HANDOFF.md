# HANDOFF.md — live session baton

Read this first, then CLAUDE.md. HISTORY.md is the PF2e-era scaffold narrative; do not treat its v0.3.5.x release baton as simplySF2e state.

## Current session — 2026-09-08 identity rebrand

- Repo: `simplyjaytea/simplySF2e`, scaffolded from simplyPF2e (`dcd47ab` on `main`).
- This slice is **identity and docs only**: module id `simplysf2e`, title SimplySF2e, Foundry system `sf2e`, version `0.1.0`, README stub, package constants/entrypoints renamed. **No SF2e mechanics port.**
- `relationships.systems` is `{ id: "sf2e", type: "system" }` with **no minimum** — public Foundry listing currently shows sf2e **1.5.0**, but this scaffold has not been verified against any SF2e version.
- Entrypoints: `scripts/simplysf2e.mjs`, `styles/simplysf2e.css`. `MODULE_ID`, settings namespace, CSS root class, i18n root `SIMPLYSF2E`, and Foundry flags namespace follow the new id. Runtime app gate checks `game.system.id === "sf2e"`. The PF2e rest hook name is unchanged (mechanics later).
- `.github/workflows/` restored from simplyPF2e (`auto-release.yml`, `pull-request.yml`, `release.yml`); push of workflow files succeeded.
- Local verification on this branch: `node --check` on 117 scripts, JSON parse of `module.json` + `lang/en.json`, **82/82** `scripts/*.test.mjs` passed. Two identity tests (`presets.catalog.test.mjs`, `ui.layout.test.mjs`) were updated so they no longer require the wiped PF2e README / “PF2e choice dialogs” copy.
- Sentinel revise: neutralized `lang/en.json` copy that claimed SF2e system/equipment/glossary packs while `DEFAULT_PACKS` is still `pf2e.*`. No pack ids invented or retargeted.

## Exact next step

PR #1 (`cursor/identity-rebrand-77c0`) is the identity rebrand. **Next parked: SF2e schema discovery** — fetch real `sf2e` system source (do not recall PF2e shapes) and map actor/item/compendium/pack differences before any builder/table/preset port.

## Material limits

- Not play-ready. PF2e-era logic, GM Core tables, Remaster class presets, and pf2e pack assumptions remain in scripts until later slices.
- Live Foundry QA is not in scope for the identity PR.
- HISTORY.md is inherited from the PF2e scaffold; do not rewrite it as SF2e history.
