# Class bench findings

Run of `node tools/class-bench/run.mjs` against **foundryvtt/pf2e `v14-dev` @ `be4ab21be8ffed44385c0038c05d41b61dceb68b`** (2026-10-24, `system.sf2e.json` version **1.6.1**), module at main `957a56c`. Character: Human / Urbanite Human / Athlete, no feat preferences, no equipment. See `README.md` for what the bench does and does not prove.

Pack list from `system.sf2e.json` 1.6.1 (`packs[].name:type`; ids are `sf2e.<name>`): alien-core-bestiary:Actor, guilt-of-the-grave-world-bestiary:Actor, secrets-of-the-swarm-bestiary:Actor, iconics:Actor, paizo-pregens:Actor, standalone-adventure-bestiary:Actor, starfinder-society-bestiary:Actor, rulebook-bestiaries:Actor, tales-from-the-vast-bestiary:Actor, actions:Item, ancestries:Item, **ancestry-features:Item**, backgrounds:Item, classes:Item, class-features:Item, feats:Item, heritages:Item, spells:Item, conditions:Item, bestiary-effects:Item, equipment-effects:Item, other-effects:Item, feat-effects:Item, spell-effects:Item, equipment:Item, deities:Item, macros:Macro, bestiary-ability-glossary-srd:Item, starfinder-society-boons:Item, journals:JournalEntry. (`ancestry-features` is not in `DEFAULT_PACKS`; ancestry grants resolve to it by uuid only.)

## Headline

**Before -> after (W5, same bench, same pinned source):**

- Before, as published in the first run on pre-C1 `main`: **41 PASS / 7 WARN / 32 FAIL**.
- Before, on this branch's base `1f31d21` (C1 already merged, so the Technomancer caster row exists): **48 PASS / 0 WARN / 32 FAIL**. The 7 WARN are gone because `pcSpellcastingProfile` now finds Technomancer; the 32 FAILs are unchanged.
- After W5 (`pc-builder.mjs` wiring plus wave-1 modules, branch `simplyjaytea/cf-w5`): **78 PASS / 0 WARN / 2 FAIL**. Both FAILs are Mystic at level 20 (Free Archetype off and on); see "Remaining causes".

Every class passes levels 1 to 10 in both Free Archetype modes and every class passes level 20 except Mystic. Level 15 and 19 general slots now fill because general slots also draw from the `skill` category (cause 2, resolved).

Run: `node tools/class-bench/fetch.mjs && node tools/class-bench/run.mjs` (source `be4ab21be8ffed44385c0038c05d41b61dceb68b`, sf2e 1.6.1, Human / Urbanite Human / Athlete).

## Matrix after W5

| class | FA | L1 | L2 | L5 | L10 | L20 | in `COMPLETE_PC_CLASS_SLUGS`? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Envoy | off | PASS | PASS | PASS | PASS | PASS | yes |
| Envoy | on | PASS | PASS | PASS | PASS | PASS | yes |
| Mechanic | off | PASS | PASS | PASS | PASS | PASS | yes |
| Mechanic | on | PASS | PASS | PASS | PASS | PASS | yes |
| Mystic | off | PASS | PASS | PASS | PASS | FAIL | yes |
| Mystic | on | PASS | PASS | PASS | PASS | FAIL | yes |
| Operative | off | PASS | PASS | PASS | PASS | PASS | yes |
| Operative | on | PASS | PASS | PASS | PASS | PASS | yes |
| Solarian | off | PASS | PASS | PASS | PASS | PASS | yes |
| Solarian | on | PASS | PASS | PASS | PASS | PASS | yes |
| Soldier | off | PASS | PASS | PASS | PASS | PASS | yes |
| Soldier | on | PASS | PASS | PASS | PASS | PASS | yes |
| Technomancer | off | PASS | PASS | PASS | PASS | PASS | yes |
| Technomancer | on | PASS | PASS | PASS | PASS | PASS | yes |
| Witchwarper | off | PASS | PASS | PASS | PASS | PASS | yes |
| Witchwarper | on | PASS | PASS | PASS | PASS | PASS | yes |

PASS = no throw, every feat slot filled, no warning-class finding. FAIL = a throw or at least one feat slot with no usable candidate (the completion manifest blocks Create). The bench's `complete?` column is `yes` for all 80 runs.

## What W5 changed

- `resolvePCConcept` (`scripts/pc-builder.mjs`) projects ability modifiers and skill ranks (`projectAttributeModifiers`, `projectSkillRanks`), passes them to every slot's prerequisite context, passes path and heritage names as `features`, widens general slots to `["general","skill"]`, and excludes class-path `reservedFeats` from every slot. Returns `skillPlan` for diagnostics.
- `resolveFeatPicks` accepts `general` slots' `skill` feats in its permissive lookup too.
- Tests: `scripts/pc-builder.wiring.test.mjs` (new) covers general slot with a skill feat, `Charisma +2` offered at +2 and withheld at +1, heritage-keyed feat offered and withheld. `scripts/pc-builder.specializedSkillSet.test.mjs` was updated: its ancestry fixture now has the real `flaws` shape, and it asserts the Sniper's reserved feat (Quiet Move) is never offered to a slot; a second Stealth feat was added so the level-3 Specialized Skill Set slot still has a candidate.
- Bench: no change to `tools/class-bench/*` code was needed; the fake environment already covered the new paths. This document is the only bench file updated.

## Resolved causes (from the first run)

- **1. Skill-feat slots ran dry** (26 FAIL runs before). Prerequisite context now uses projected skill ranks at each slot's level (`scripts/pc-builder.mjs` ~lines 330-345 projection block; `scripts/pc-projection.mjs:178` `projectSkillRanks`). Operative, Soldier, Solarian, Envoy, Witchwarper now fill skill slots at every sampled level except the Mystic L20 pool below.
- **2. General-feat slots, 3 general feats in sf2e** (14 FAIL runs). sf2e 1.6.1 `feats/collection.ts` lists `supported: ["general", "skill"]` for the general group (cited in the brief). `pc-builder.mjs:407` widens the category; the `resolveFeatPicks` filter accepts both. The `general` pool is 3 feats, so the 95 skill feats now supply most general slots.
- **3. Free Archetype prerequisites.** `Charisma +2` style clauses are read by `clauseMet` (`scripts/pc-prerequisites.mjs`, wave-1 W1), and the projected Charisma modifier is supplied via `abilities` (`pc-builder.mjs` `abilities: modsAt(slot.level) ?? {}`). Multiclass dedications with a `Wisdom +2`-style clause (Mystic) appear in the archetype lists. Archetype slots fill at every sampled level except Mystic L20 with Free Archetype on (cause B).
- **4. Operative L10 and L20 class path invalid** (4 FAIL runs). Class-path `reservedFeats` are never excluded from the path's own choice and are excluded from slots (`pc-builder.mjs:~414` `excludeUuids: reservedFeats`; `scripts/class-paths.mjs:377`, wave-1 W3). Operative passes every sampled level in both modes.
- **5. Technomancer caster profile** (7 WARN runs). Resolved by C1 (already on the base): `pc-tables.mjs` Technomancer caster row.
- **6. Path- and heritage-keyed feat prerequisites** ("mine exocortex", "DPS++ programming language", "<X> heritage"). `pc-builder.mjs` passes `features` built from `pathPlan` names and `heritageDoc.name` to `stagedActorContext`, so `nameClauseMet` can prove them. Mechanic and Technomancer feats of these families are offered.
- **7. Mechanic and Technomancer not in `COMPLETE_PC_CLASS_SLUGS`** (information). Resolved by C1 on this base (`scripts/pc-support.mjs` lists eight classes).

## Remaining causes (FAIL)

### A. Mystic L20: general and skill slots outnumber the feats the default training can prove (2 runs, FAIL)

Default Mystic (the class's first key-ability option, Athlete background, no skill priorities) has four trained skills at level 20: Athletics from the background plus three automatic trainings. `allocateCharacterSkills` gives the three class trainings to Medicine, Nature and Religion (wisdom skills), then spends all nine skill increases on them, reaching legendary (`pc-skills.mjs:56`; projection `scripts/pc-projection.mjs:178`).

Fifteen general and skill slots (5 general at 3, 7, 11, 15, 19; 10 skill) then share 13 distinct feats whose `trained in`, `expert in`, `master in` or `legendary in` prerequisites those four skills prove (`pools.general` 5 slots / 13 distinct; `pools.skill` 10 / 10). With 15 slots and 13 feats, no pick order fills every slot, and the module correctly does not duplicate a feat, so the last general and skill slots stay empty. A real player's skill priorities would widen the pool.

Sensitivity (same bench, `--levels 20 --classes mystic`): background Bounty Hunter (trains Survival) gives Mystic off = PASS; Scholar (no skill background) keeps both FAIL. Verified by running the bench; the widening effect of priorities is expected but not measured here.

### B. Mystic L20 Free Archetype (Bounty Hunter variant): greedy fallback can miss a valid assignment (not in the default matrix)

With `--background "Bounty Hunter" --classes mystic --levels 20`, Free Archetype on leaves `archetype-class-20` unresolved even though a valid assignment exists: `Knight of Golarion Dedication` and `Pharmacologist Dedication` appear only in the level-2 and level-4 archetype lists, so slots 2 and 4 must take them, leaving the other eight slots and slot 20 to share nine entries. `resolveFeatPicks` (`scripts/pc-builder.mjs` ~line 477) fills slots in order, first unused candidate, and never reassigns an earlier slot. The fix is an augmenting-path repair in `resolveFeatPicks`; it was not made in W5 because it changes dedupe behaviour and needs its own tests. Follow-up.

## Stubs that weaken this result

- No Rule Elements run; `doc.system` is raw source (not prepared). The projection (`projectAttributeModifiers`, `projectSkillRanks`) is computed from source, not from Foundry's prepared data; the fake `Actor` still has Int 0 and ranks from class and background only.
- Feat picks are "first candidate not already taken", not AI picks; cause A depends on the default training, not on pick order.
- Native grant expansion is not emulated; `CONFIG.PF2E` has only `skills`.
- One ABC combination per sweep, no equipment, loot, focus spells or languages, no rarity cap.
- `fromUuid` resolves `Compendium.<scope>.<pack>.Item.<name>` by exact document name when the tail is not an id, as Foundry does for the name-style uuids sf2e class items use. This is the one behaviour assumed from core Foundry.
