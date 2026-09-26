# HANDOFF.md — live session baton

Read this first, then CLAUDE.md. HISTORY.md is the PF2e-era scaffold narrative; do not treat its v0.3.5.x release baton as simplySF2e state.

## Current session — 2026-09-26 Operative Staging & SF2e Caster Tables

- Repo: `simplyjaytea/simplySF2e`. Started from `origin/main` tip `2af1658` (PR #5 Chrome S / published **v0.0.5**). Branch: `cursor/operative-and-casters`.
- **Operative Unlocked:** Operative added to `COMPLETE_PC_CLASS_SLUGS` (`pc-support.mjs`). All six standard SF2e classes (Envoy, Mystic, Operative, Solarian, Soldier, Witchwarper) are now complete-only.
- **Operative Specialization Staging:** `stageClassPaths` in `class-paths.mjs` closes level-1 specialization skill-feat ChoiceSets (`item:category:skill`, `item:level:1`) bounded to candidates proved by the specialization's unpredicated ActiveEffectLike skill upgrade. Sniper's `class:operative`-gated `bonusFeat` ChoiceSet is closed with exact compendium source options (`Keep Them in Your Sights`, `Scope Sight`).
- **Specialized Skill Set Slot Constraint:** `planClassPaths` plans level-1 class paths before feat slots are planned, merging granted skills into `provenSkills`. For Operatives with `Specialized Skill Set` (level 3 feature in `classDoc.system.items`), skill feat slots at levels 3, 7, and 15 are strictly constrained via `prerequisiteContext.allowedSkillFeats: [operativeSkill]` to the specialization's trained skill (Ghost -> deception, Infiltrator -> computers, Skirmisher -> acrobatics, Sniper -> stealth, Striker -> athletics). Level 2 skill slot remains an ordinary unrestricted skill slot.
- **Generator Choice Wiring & Exact-Content Preservation:** `generator-app.mjs` wires choice selection before `selectFeats` when needed, preserves `resolved.pathPlan` across `exactContent` re-resolves, and passes `resolved.pathPlan` into `stageClassPaths` to guarantee zero divergence without mutating `concept`.
- **Exclusion Gating:** `pc-builder.mjs` aggregates already-granted / planned feat UUIDs and names into `excludeFeats` for `stageClassPaths`, strictly gating on a resolved `entry` (so ungrounded draft feats with `entry: null` are never excluded, and strict refs `{packId, _id}` are handled).
- **SF2e Caster Profiles:** Mystic and Witchwarper profiles added to `pc-tables.mjs` under publication title `"Starfinder Player Core"` (`remaster: true`). Tables verified against v14-dev `journals/classes.json`: 3 base slots per rank, 5 cantrips, 10th-rank slot + 2 repertoire picks at levels 19-20. Witchwarper casting attribute uses `ability: null` to inherit the player's chosen key attribute (Cha or Int).
- **Presets & Localization:** `lang/en.json` and `presets.catalog.test.mjs` updated to reflect that all six published Starfinder 2e classes are complete-only.
- **Test Coverage:** Full test suite runs 85 tests (all passing, 0 failing). Added regression tests:
  - `scripts/pc-builder.specializedSkillSet.test.mjs`: proves level-3 Sniper slot accepts Stealth feats and rejects background Athletics feats.
  - `scripts/pc-builder.stageClassPaths-exclude.test.mjs`: proves observable exclusion of background duplicates and strict refs `{packId, _id}`, non-duplicate presence, and `entry: null` safety.

## Exact next step

Live Foundry QA of all six complete-only classes: Envoy, Mystic, Operative, Solarian, Soldier, Witchwarper (path dialogs, grants, spell entries, and specialization skill feat embedding). SF2e Building Creatures numbers and Item Forge live verification stay parked.

## Material limits

- Alpha, not a finished product. Building Creatures / Treasure by Level numbers in `tables.mjs` remain inherited PF2e-compatible benchmarks pending cited Starfinder 2e numbers.
- Item Forge rune assembly is still PF2e-era.
- Live Foundry QA is not in this environment.
- HISTORY.md is inherited from the PF2e scaffold; do not rewrite it as SF2e history.
