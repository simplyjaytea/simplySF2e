# HANDOFF.md — live session baton

Read this first, then CLAUDE.md. HISTORY.md is the PF2e-era scaffold narrative; do not treat its v0.3.5.x release baton as simplySF2e state.

## Last session — 2026-10-01 repo cleanup

- Confirmed the 2026-09-30 wave (SF2e equipment grades, GM Core table citations, UI-shell tests, Elite/Weak, NPC archetype presets, `/sf2e` chat command, reskin helper, augmentation/crystal forge kinds, multiclass dedication map) is on `main` as `1084fa3`. It was a local merge pushed to `main`, not a merged PR, so it had no PR review.
- Wiring audit: Elite/Weak (generator selector → `computeStats`/`createActor`) and the chat command (`chatMessage` hook → `GeneratorApp.setInput`) are wired end to end. `reskinActor()` (`builder.mjs`) and `SF2E_MULTICLASS_DEDICATIONS` / `getMulticlassDedicationSlug` (`pc-support.mjs`) are exported and tested, but **nothing calls them**. The docs now call them helpers.
- Docs synced: CLAUDE.md Files table (added `simplysf2e`, `ai-response-validation`, `art`, `macro-templates`, `provider-setup-app`; fixed stale `tables`/`runes`/`class-paths` rows), glossary, current state and roadmap. README status/limitations updated to match.
- Moved the SimplyPF2e v0.3.5.63 audit to `docs/archive/pf2e/` (HISTORY.md link updated).
- Deleted the remote branches already merged into `main`: `cursor/free-archetype-archetype-slot-validation`, `cursor/table-cites`, `integrate/wave-p0-p4`.
- 99/99 test suites pass.

## Next

1. Live Foundry QA on the VPS:
   - Item Forge weapon/armor: equipment grade renders on the sheet, upgrades show under subitems, credit price reflects grade deltas.
   - Creature generation with the GM Core stats, including Elite/Weak.
   - `/sf2e` chat command prefill; Manage Presets and Sources dialogs.
2. Decide whether to wire `reskinActor()` (needs a UI entry point) and multiclass dedications (needs a PC-pipeline feat slot) or remove them.
3. Independent review of `68c7124`, since it reached `main` without one (schema-dependent: equipment grades/subitems).

## Material limits

- Live Foundry QA is not in this environment.
- HISTORY.md is inherited from the PF2e scaffold; do not rewrite it as SF2e history.
