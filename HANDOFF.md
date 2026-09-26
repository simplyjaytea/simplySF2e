# HANDOFF.md — live session baton

Read this first, then CLAUDE.md. HISTORY.md is the PF2e-era scaffold narrative; do not treat its v0.3.5.x release baton as simplySF2e state.

## Last session — 2026-09-26 tables-cite + Free Archetype wave (merged to main at explicit user request)

- Orca runs `run_2bb8541d81b3` (investigation) and `run_59e5cb012a20` (build) fully settled, zero reclaimable. Workers: tables-cite investigation, itemforge-verify, roadmap-scope, free-archetype-build, next-plan, free-archetype-review (independent, ACCEPT with 2 nits, 1 fixed).
- `cursor/table-cites` (comment-only, 85/85 pass): `tables.mjs` headers now cite verified SF2e sources — LEVEL_DC + rarity (DCs by Level `pBS3DUjlzVuFgapv` pg 53, `dc.ts`), TREASURE L1-20 totals x10 credits (Treasure `Dae8LHdXZuBv06Jk` pg 59/61), identificationDC mapping (`oEyx39yADr2OjfTz` pg 54), Moderate 80 XP input; nine stat arrays stay PF2e-only (57-page bounded search, no system source); 1000-XP premise UNVERIFIED; multipliers labeled design choice. Jev verify 4/4 auto, Jev review composite 0.90.
- `cursor/free-archetype-archetype-slot-validation` (86/86 pass): staged `validateArchetypeSlotPlacement` + `isArchetypeFeat` in `pc-prerequisites.mjs`; level-2-plus pre-provider hard stop retired for post-resolution checks; gate/review tests updated with coordinator approval; reviewer nit fixed (even-parity message). Dead `FreeArchetypeUnsupported` lang key left in place (test asserts its absence).
- Item Forge: 14 forge tests pass; gap list + 7-step VPS checklist recorded in session transcript.
- Roadmap: Jev decide picked free-archetype-validation first (confidence 1.0); built this session.
- Merged to `main` + pushed at the user's explicit request (auto-publishes a release; same exception as v0.0.8, not the norm).

## Exact next step

1. Confirm the release published (GitHub Releases / Auto Release run) and smoke-check the installed manifest.
2. Live Foundry QA on the VPS: v0.0.8 UI five windows at ~360px; six complete-only classes; new Free Archetype L2+ generation; Item Forge 7-step checklist.
3. Follow-up: remove dead `FreeArchetypeUnsupported` lang key; relabel encounter preview treasure `gp` to credits via `gpToCredits`.

## Material limits

- Alpha, not a finished product. Building Creatures / Treasure by Level numbers in `tables.mjs` remain inherited PF2e-compatible benchmarks pending cited Starfinder 2e numbers.
- Encounter preview still labels the treasure budget `gp`.
- Item Forge rune assembly is still PF2e-era.
- Live Foundry QA is not in this environment.
- HISTORY.md is inherited from the PF2e scaffold; do not rewrite it as SF2e history.
