# HANDOFF.md — live session baton

Read this first, then CLAUDE.md. HISTORY.md is the PF2e-era scaffold narrative; do not treat its v0.3.5.x release baton as simplySF2e state.

## Current session — 2026-09-08 Phase A working foundations

- Repo: `simplyjaytea/simplySF2e`. Started from `origin/main` tip `2d038b3` (PR #1 identity rebrand merged). Published GitHub release **v0.0.1**.
- This slice retargets pack defaults and Standard presets to cited SF2e 1.5.0 collection ids, empties complete-only, documents the rest hook residual, and updates README/`module.json` honesty. **No SF2e document field shapes invented.**
- Source pin: `foundryvtt/pf2e` **v14-dev** `system.sf2e.json` version **1.5.0**. Classes under `packs/sf2e/classes/`: envoy, mystic, operative, solarian, soldier, witchwarper.
- `module.json` source version is **0.0.2** (auto-release last-segment bump from v0.0.1). Compatibility minimum **14.361** / verified **14.367**; system relationship minimum **1.5.0**.
- Complete-only: `COMPLETE_PC_CLASS_SLUGS` is empty. All six classes grant a mandatory level-1 path (Leadership Style, Connection, Specialization, Solar Manifestations, Fighting Style, Paradox). None proven to share the existing `item:tag:` staging path.
- Rest: v14-dev `rest-for-the-night.ts` still calls `Hooks.callAll("pf2e.restForTheNight", actor)`. Module keeps that exact string. No `sf2e.restForTheNight` cited.
- Generator chrome is retokenized to cited SF2e navy/cyan (`src/styles/sf2e/index.scss`); no system sheet art. Focus rings and `prefers-reduced-motion` are unchanged.
- Coins: `OFFICIAL_COIN_PACK` is `sf2e.equipment`. Cited gold-piece document ids still miss in SF2e packs; credits/UPB (`credstick.json` / `upb.json`) are Phase B.

## Exact next step

**Phase B for Lexicon:** cite SF2e Building Creatures / wealth / currency (credits, UPB) and class-feature grant shapes from `packs/sf2e/` before rewriting tables, strike catalogs, or complete-only staging. Do not copy PF2e field paths and rename.

## Material limits

- Not play-ready. GM Core tables, rune systems, feat graphs, and PC casting profiles remain PF2e-era.
- Live Foundry QA is not in scope for Phase A.
- HISTORY.md is inherited from the PF2e scaffold; do not rewrite it as SF2e history.
