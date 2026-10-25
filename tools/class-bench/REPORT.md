# Class bench findings

Run of `node tools/class-bench/run.mjs` against **foundryvtt/pf2e `v14-dev` @ `be4ab21be8ffed44385c0038c05d41b61dceb68b`** (2026-10-24, `system.sf2e.json` version **1.6.1**), module at main `957a56c`. Character: Human / Urbanite Human / Athlete, no feat preferences, no equipment. See `README.md` for what the bench does and does not prove.

Pack list from `system.sf2e.json` 1.6.1 (`packs[].name:type`; ids are `sf2e.<name>`): alien-core-bestiary:Actor, guilt-of-the-grave-world-bestiary:Actor, secrets-of-the-swarm-bestiary:Actor, iconics:Actor, paizo-pregens:Actor, standalone-adventure-bestiary:Actor, starfinder-society-bestiary:Actor, rulebook-bestiaries:Actor, tales-from-the-vast-bestiary:Actor, actions:Item, ancestries:Item, **ancestry-features:Item**, backgrounds:Item, classes:Item, class-features:Item, feats:Item, heritages:Item, spells:Item, conditions:Item, bestiary-effects:Item, equipment-effects:Item, other-effects:Item, feat-effects:Item, spell-effects:Item, equipment:Item, deities:Item, macros:Macro, bestiary-ability-glossary-srd:Item, starfinder-society-boons:Item, journals:JournalEntry. (`ancestry-features` is not in `DEFAULT_PACKS`; ancestry grants resolve to it by uuid only.)

## Headline

**80 runs (8 classes × levels 1, 2, 5, 10, 20 × Free Archetype off/on): 41 PASS, 7 WARN, 32 FAIL.**

Every class passes at levels 1 and 2. **No class passes at level 20, and none passes at level 15 or above** (derived: the fourth general-feat slot arrives at 15, see cause 2). The first failing level is 5 (Envoy, Solarian), 10 (Soldier, Mystic, Operative, and every class with Free Archetype on) or 20 (Mechanic, Witchwarper, Technomancer).

| class | FA | L1 | L2 | L5 | L10 | L20 | in `COMPLETE_PC_CLASS_SLUGS`? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Envoy | off | PASS | PASS | FAIL | FAIL | FAIL | yes |
| Envoy | on | PASS | PASS | FAIL | FAIL | FAIL | yes |
| Mechanic | off | PASS | PASS | PASS | PASS | FAIL | **no** |
| Mechanic | on | PASS | PASS | PASS | PASS | FAIL | **no** |
| Mystic | off | PASS | PASS | PASS | FAIL | FAIL | yes |
| Mystic | on | PASS | PASS | PASS | FAIL | FAIL | yes |
| Operative | off | PASS | PASS | PASS | FAIL | FAIL | yes |
| Operative | on | PASS | PASS | PASS | FAIL | FAIL | yes |
| Solarian | off | PASS | PASS | FAIL | FAIL | FAIL | yes |
| Solarian | on | PASS | PASS | FAIL | FAIL | FAIL | yes |
| Soldier | off | PASS | PASS | PASS | FAIL | FAIL | yes |
| Soldier | on | PASS | PASS | PASS | FAIL | FAIL | yes |
| Technomancer | off | WARN(1) | WARN(1) | WARN(1) | WARN(1) | FAIL | **no** |
| Technomancer | on | WARN(1) | WARN(1) | WARN(1) | FAIL | FAIL | **no** |
| Witchwarper | off | PASS | PASS | PASS | PASS | FAIL | yes |
| Witchwarper | on | PASS | PASS | PASS | FAIL | FAIL | yes |

PASS = no throw, every feat slot filled, no warning. WARN(n) = n distinct findings. FAIL = a throw or at least one feat slot with no usable candidate left (a required pick; the completion manifest marks an entry-less feat unresolved and blocks Create).

What the 39 non-PASS runs hit (a run can hit several): 26 unresolved skill slots, 14 unresolved general slots, 12 unresolved Free Archetype slots, 7 caster-without-profile warnings, 4 class-path throws.

**Sensitivity.** The failure set depends on the character's fixed skill training. Same bench with background Bounty Hunter (trains Survival): 50 PASS / 7 WARN / 23 FAIL (skill-slot failures 26 → 14). Android / Biotech Android / Corporate Agent: 56 / 8 / 16. The general-slot failures (14) and the Technomancer warning do not move. Run `--background`, `--ancestry`, `--heritage` to reproduce.

## Root causes

### 1. Skill-feat slots run dry: prerequisite proof only counts fixed training (26 runs, FAIL)

`resolvePCConcept` builds the prerequisite context from the class's and background's fixed `trainedSkills.value` plus the class path's own skill upgrade (`scripts/pc-builder.mjs:293` `initialSkillTraining`, `:304-308`, context built at `:340-347`). The class's free training (`trainedSkills.additional`) and every skill increase are allocated later by `allocateCharacterSkills` (`pc-builder.mjs:1061-1066`, `scripts/pc-skills.mjs:75`), so the feat filter never sees them. Nearly every skill feat is gated on training:

```
feats/skill: Deadlift   "prerequisites": { "value": [ { "value": "trained in Athletics" } ] }
classes/envoy.json:311  "trainedSkills": { "additional": 6, "value": [] }
```

Envoy has no fixed class skills, so with the Athlete background its whole skill-feat pool is the Athletics feats. Slots versus distinct feats offered across them (`results.json` → `pools`): Envoy and Solarian 2 slots / 1 feat at level 5 and 10 / 1 at level 20 (Envoy L10: 5 / 1); Mystic 5 / 2 at level 10; Soldier 5 / 4. Feats are not repeatable, so the slots after the pool is used up stay empty whatever the AI picks. `warn` text: `feat pick "Deadlift" for slot 9 (skill, level 6) did not resolve to an unused feat for this slot` (`pc-builder.mjs:457`), then the first-unused fallback finds nothing.

### 2. General-feat slots: sf2e ships three `general` feats (14 runs, FAIL, every class at 15+)

`buildFeatSlots` makes `general` slots at levels 3, 7, 11, 15, 19 (`scripts/pc-tables.mjs:86-100`, from `generalFeatLevels`) and `getFeatCandidates` filters `system.category === "general"` (`scripts/compendium.mjs:952`). The pack holds exactly three:

```
packs/sf2e/feats/general/level-1/barricade.json:13        "category": "general",
packs/sf2e/feats/general/level-1/augmented-body.json:13   "category": "general",
packs/sf2e/feats/general/level-3/prescient-planner.json:13 "category": "general",
```

Five general slots at level 19 and 20 against three feats: `general-15` and `general-19` come back unresolved in every class (`pools.general` is 5 slots / 3 feats). **Unverified lead for the coordinator:** PF2e's general feat group may also accept `skill`-category feats; if sf2e's does, the module's category filter is stricter than the system. This needs the real `feats/group.ts` source before anyone acts.

### 3. Free Archetype slots: ability prerequisites unreadable and never supplied, dedication chains unreachable (12 runs, FAIL)

Confirmed lead, **two independent defects**:

- `clauseMet` reads only digits-no-sign ability clauses: `scripts/pc-prerequisites.mjs:134` `/^(strength|...|charisma)\s+(\d+)$/i`. sf2e writes them as modifiers. All six multiclass dedications, plus Knight of Golarion, Nanocyte and Sacrificial Shell: `Envoy Dedication <= "Charisma +2"`, `Mechanic Dedication <= "Intelligence +2"`, `Mystic Dedication <= "Wisdom +2"`, `Soldier Dedication <= "Constitution +2"`, `Solarian Dedication <= "Strength +2"`, `Witchwarper Dedication <= "Intelligence +2 or Charisma +2"` (quoted from `packs/sf2e/feats/archetype/multiclass-archetypes/*/…-dedication.json`, e.g. envoy-dedication.json:20-23 `"prerequisites": { "value": [ { "value": "Charisma +2" } ] }`). A bare `Charisma +2` fails the regex, so it is treated as an unreadable name clause and fails closed.
- Even a readable clause could not pass: `stagedActorContext({...})` at `pc-builder.mjs:340-347` is never given `abilities`, so `context.abilities` is `{}` (`pc-prerequisites.mjs:148`, `abilities = {}` default) and `Number.isFinite(undefined)` is false.

Result: no multiclass dedication is ever offered. Archetype slots (one per even level, `pc-tables.mjs:99`) see only dedications with no prerequisites (Augmented, Grenadier, Peacekeeper) or a provable trained skill. Typical pool at level 10: 4 distinct feats for 5 slots (Technomancer, Witchwarper, Envoy), 6 for 5 (Soldier); at level 20, 4 for 10 (Mystic). The `Iomedae's Barrage` that fills a fourth place is a Knight of Golarion archetype feat in `sf2e.feats` (`feats/archetype/knight-of-golarion/iomedaes-barrage.json`).

Also: follow-up archetype feats (which require the dedication taken in an earlier slot) are never offered either, because every slot's context is built before any pick exists (`pc-builder.mjs:340-347` passes no `feats`). The comment above `freeArchetypeNeedsPrerequisiteValidation` in `scripts/pc-support.mjs` says archetype slots are "now covered by the staged-actor evaluator"; `validateArchetypeSlotPlacement` could accumulate earlier picks, but `generator-app.mjs:1323` calls it with a null context after the slots were already filled, so chains are not reachable in practice. `audit-prereqs.mjs` (maximal actor: every skill legendary, every ability 30, every name possessed) counts 12 ability-modifier clauses the parser can never prove (ancestry and class feats; 86 class feats and 217 ancestry feats are unprovable even for that maximal actor, mostly the name-shaped clauses of cause 6).

### 4. Operative level 10 and 20: planned class path becomes invalid when feats are picked (4 runs, FAIL)

`resolvePCConcept` plans the class path before any feat exists (`pc-builder.mjs:299-302`, `planClassPaths(..., excludeFeats = [])`), then `createCharacterActor` stages it with `excludeFeats` holding every picked slot feat (`pc-builder.mjs:731-766`, `:767-772`). `stageClassPaths` rejects the plan when the chosen specialization's level-one skill-feat options are all excluded (`scripts/class-paths.mjs:369-373`):

```
simplysf2e | planned class path "Ghost" is not a valid candidate for "Operative's Specialization"
```

Both the skill slots and Ghost's own bonus feat draw on the same few Deception feats (Ghost: `"path": "system.skills.deception.rank"` upgrade plus `"choices": {"filter": ["item:category:skill","item:level:1"],"itemType":"feat"}`). Direct check with the real functions: `planClassPaths(operative, { excludeFeats: [] })` returns Ghost; excluding five picked skill feats returns Infiltrator instead. This is a rollback-and-throw at Create, not a warning, and it hits whenever enough skill slots (level ~8+) take the specialization's feats; with a different AI pick order it can happen at lower levels. Related to cause 1 (same tiny pool).

### 5. Technomancer: no casting profile, and the fallback uses the wrong casting mode (7 runs, WARN)

`pcSpellcastingProfile` only recognizes `title === "Starfinder Player Core"` rows (`scripts/pc-tables.mjs:139-150`, matcher `:156-163`). Technomancer is published as `"title": "Starfinder Tech Core"` (`packs/sf2e/classes/technomancer.json:163-166`), so the profile is null. `createCharacterActor` then falls back to `const mode = spellProfile?.mode ?? "spontaneous"` (`pc-builder.mjs:810`), but the class's own text says:

```
class-features/technomancer/technomancer-spellcasting.json: "…At 1st level, you can prepare up to two 1st-rank spells and five cantrips each morning from the spells in your spell database. Prepared spells remain available to you until you cast them…"
```

So a Technomancer is built with a spontaneous repertoire entry instead of a prepared one, and the tradition is not derived from any rule (the bench defaulted it to the text's `arcane`). Mystic and Witchwarper profiles are found; their tradition comes from the chosen connection/paradox (`ActiveEffectLike` `flags.system.mystic.tradition`) and is not in the profile. Spell slots and picks for both match the plan at every level; there were no spell shortfalls once lower-rank spells are allowed to be learned heightened (`pc-builder.mjs:838`).

### 6. Class feats keyed to the chosen class path are never offered (information, Mechanic/Technomancer; no FAIL)

Feat prerequisites name the path option in a form that is not the granted feature's name: `critical-explosion.json:20-23` `"value": "mine exocortex"` (also `drone exocortex`, `turret exocortex`: 22 hits), and `"ServoShell programming language"`, `"DPS++ programming language"`, `"Viper programming language"`, `"FORTRUN programming language"` (12 hits). The granted feature is just `class-features/mechanic/drone.json:5 "name": "Drone"`. The path plan is also not passed to `stagedActorContext` (`pc-builder.mjs:340-347` passes no `features`). Those feats are unreachable, leaving the exocortex and programming-language class-feat pools smaller than the rules allow. Same shape for ancestry feats: 153 clauses of the form `"Biotech Android heritage"` against a heritage named `"Biotech Android"` (`heritages/android/biotech-android.json:5`) can never match.

### 7. Mechanic and Technomancer are not in `COMPLETE_PC_CLASS_SLUGS` (information)

`scripts/pc-support.mjs:29-31` lists six classes; `v14-dev` now has eight (mechanic, technomancer added; both ship a level-one `item:tag:` path: `mechanic-exocortex`, `technomancer-programming-language`, so `planClassPaths` works for them as is). In the bench Mechanic passes levels 1 to 10 in both modes and fails only at 20 for causes 1 and 2; Technomancer only fails on cause 5 plus the same feat pools. `SF2E_MULTICLASS_DEDICATIONS` (`pc-support.mjs:47`) also lacks `mechanic` and `technomancer`, though `Mechanic Dedication` and `Technomancer Dedication` exist in the pack.

### 8. Native ChoiceSets the module leaves open (information)

Across all 80 runs the only unanswered ChoiceSet on a built item was `Specialty Crafting` (flag `specialtyCrafting`, a Mechanic level-20 class feat); no class/ABC `system.items` grant carried an open ChoiceSet beyond the staged paths. With the first-candidate picks the bench takes, most feat ChoiceSets never surface; do not read that as proof for AI-chosen feats. Versatile Human's `versatileHeritage` ChoiceSet (`choices.filter`) is left native by design (it showed in an earlier run before the default heritage was changed).

## What is fine

- Class-path planning and staging works for every class at level 1: Envoy From the Front, Mechanic Drone, Mystic Akashic, Operative Ghost, Soldier Action Hero, Technomancer DPS++, Witchwarper Analyst + Core Memories (two tags). Solarian has no `item:tag` path (`{}`), as documented.
- Free Archetype adds the expected archetype slots (even levels) and `featSlotLocation` ids; the failures are the pool sizes in cause 3, not placement.
- Class, ancestry, background and heritage resolve for all eight classes; spellcasting plans for Mystic and Witchwarper are fully populated through level 20 (43 spell items at level 20) with every embedded spell passing the module's own checks.
- Skill allocation never reported a data fault; its `grant-timing` / `unspent-*` notes are ignored because the fake actor has no derived data.

## Stubs that weaken this result

- No Rule Elements run; `doc.system` is raw source (not prepared); the fake `Actor` has Int 0, HP max 1 and ranks only from class and background.
- Native ABC grant expansion is not emulated (only inspected); `CONFIG.PF2E` has only `skills`.
- Feat picks are "first candidate not already taken", not AI picks; spells are the first eligible per rank. Cause 4 in particular depends on pick order; causes 1 to 3 do not (pool smaller than slot count).
- One ABC combination per sweep, no equipment, loot, focus spells or languages, no rarity cap.
- `fromUuid` resolves `Compendium.<scope>.<pack>.Item.<name>` by exact document name when the tail is not an id, as Foundry does for the name-style uuids sf2e class items use (`Compendium.sf2e.class-features.Item.Walking Armory`). This is the one behaviour assumed from core Foundry, which is not public source.
