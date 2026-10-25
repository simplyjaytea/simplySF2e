# Class bench findings

Run of `node tools/class-bench/run.mjs` against **foundryvtt/pf2e `v14-dev` @ `be4ab21be8ffed44385c0038c05d41b61dceb68b`** (2026-10-24, `system.sf2e.json` version **1.6.1**), module at main `957a56c`. Character: Human / Urbanite Human / Athlete, no feat preferences, no equipment. See `README.md` for what the bench does and does not prove.

Pack list from `system.sf2e.json` 1.6.1 (`packs[].name:type`; ids are `sf2e.<name>`): alien-core-bestiary:Actor, guilt-of-the-grave-world-bestiary:Actor, secrets-of-the-swarm-bestiary:Actor, iconics:Actor, paizo-pregens:Actor, standalone-adventure-bestiary:Actor, starfinder-society-bestiary:Actor, rulebook-bestiaries:Actor, tales-from-the-vast-bestiary:Actor, actions:Item, ancestries:Item, **ancestry-features:Item**, backgrounds:Item, classes:Item, class-features:Item, feats:Item, heritages:Item, spells:Item, conditions:Item, bestiary-effects:Item, equipment-effects:Item, other-effects:Item, feat-effects:Item, spell-effects:Item, equipment:Item, deities:Item, macros:Macro, bestiary-ability-glossary-srd:Item, starfinder-society-boons:Item, journals:JournalEntry. (`ancestry-features` is not in `DEFAULT_PACKS`; ancestry grants resolve to it by uuid only.)

## Headline

**Default matrix after W7: 78 PASS / 2 WARN / 0 FAIL.** The two WARNs are the same Mystic L20 pair (cause A, below). W7 changed what an empty feat slot means: a slot with no legal feat left is created empty and the GM is warned, so it no longer blocks Create and no longer counts as FAIL. Mystic L20 shows WARN(3) without Free Archetype and WARN(7) with it; each count includes the empty-slot finding plus the repair and greedy-pick findings listed in the breakdown. The W6 change that matters is cause B: Mystic L20 with Free Archetype on and the Bounty Hunter background fills its slot chain (WARN(4), see "Resolved causes" 8).

**History (same bench, same pinned source):**

- First run on pre-C1 `main`: **41 PASS / 7 WARN / 32 FAIL**.
- On the base `1f31d21` (C1 merged, Technomancer caster row exists): **48 PASS / 0 WARN / 32 FAIL**.
- After W5 (`pc-builder.mjs` wiring plus wave-1 modules): **78 PASS / 0 WARN / 2 FAIL**.
- After W6 (cause B repair in `resolveFeatPicks`): **78 PASS / 0 WARN / 2 FAIL** on the default matrix. Bounty Hunter Mystic L20, Free Archetype on: FAIL -> WARN(4).
- After W7 (empty feat slots warn instead of block): **78 PASS / 2 WARN / 0 FAIL** on the default matrix. The same two Mystic L20 runs are now WARN(3) and WARN(7).

Every class passes levels 1 to 10 in both Free Archetype modes and every class passes level 20 except Mystic. Level 15 and 19 general slots now fill because general slots also draw from the `skill` category (cause 2, resolved).

Run: `node tools/class-bench/fetch.mjs && node tools/class-bench/run.mjs` (source `be4ab21be8ffed44385c0038c05d41b61dceb68b`, sf2e 1.6.1, Human / Urbanite Human / Athlete).

## Matrix after W7 (feat picks identical to W6; the two Mystic L20 runs are WARN, not FAIL)

| class | FA | L1 | L2 | L5 | L10 | L20 | in `COMPLETE_PC_CLASS_SLUGS`? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Envoy | off | PASS | PASS | PASS | PASS | PASS | yes |
| Envoy | on | PASS | PASS | PASS | PASS | PASS | yes |
| Mechanic | off | PASS | PASS | PASS | PASS | PASS | yes |
| Mechanic | on | PASS | PASS | PASS | PASS | PASS | yes |
| Mystic | off | PASS | PASS | PASS | PASS | WARN(3) | yes |
| Mystic | on | PASS | PASS | PASS | PASS | WARN(7) | yes |
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

PASS = no throw, every feat slot filled, no warning-class finding. WARN(n) = n findings; an empty feat slot (no legal feat left) is one of them. FAIL = a throw at any stage. The bench's `complete?` column is `yes` for all 80 runs, because completion no longer blocks on an empty feat slot.

## What W7 changed

- `completion.mjs` (`completionManifest`): in character mode a feat with a null `entry` is a non-required line with status `empty` (`<type> feat (level N): no legal feat available`), so `assertComplete` passes. NPC and monster feats still block. `completionSummary` counts `empty`.
- `generator-app.mjs`: the PC preview shows an empty slot with an info icon and "empty, no legal feat available" (not the missing-match icon), adds a warning line naming the slots, and leaves empty slots out of the found/total summary. After a verified create, the completion card gets a "Feat slots left empty" row, and the GM whisper, which already carries manual notes, adds the slot list (`SIMPLYSF2E.PC.EmptyFeatSlots`). It is not sent when verification fails.
- Lang keys: `SIMPLYSF2E.PC.EmptyFeatSlots`, `SIMPLYSF2E.Generator.CompletionEmpty`, `SIMPLYSF2E.Preview.EmptyFeatSlot`.
- Bench: `classify` in `run.mjs` makes an empty feat slot a WARN finding; a throw is still FAIL. The Mystic L20 variants with priorities, measured after W7: six priorities WARN(2) / WARN(6); Survival in the top four WARN(3) / WARN(7); six priorities with Bounty Hunter PASS / WARN(4).
- Tests: `completion.test.mjs` (empty character slot non-blocking, NPC slot still blocks, summary counts); `generator-app.review.test.mjs` (preview rows, whisper after commit, no whisper after failed verify, lang key).

## What W5 changed

- `resolvePCConcept` (`scripts/pc-builder.mjs`) projects ability modifiers and skill ranks (`projectAttributeModifiers`, `projectSkillRanks`), passes them to every slot's prerequisite context, passes path and heritage names as `features`, widens general slots to `["general","skill"]`, and excludes class-path `reservedFeats` from every slot. Returns `skillPlan` for diagnostics.
- `resolveFeatPicks` accepts `general` slots' `skill` feats in its permissive lookup too.
- Tests: `scripts/pc-builder.wiring.test.mjs` (new) covers general slot with a skill feat, `Charisma +2` offered at +2 and withheld at +1, heritage-keyed feat offered and withheld. `scripts/pc-builder.specializedSkillSet.test.mjs` was updated: its ancestry fixture now has the real `flaws` shape, and it asserts the Sniper's reserved feat (Quiet Move) is never offered to a slot; a second Stealth feat was added so the level-3 Specialized Skill Set slot still has a candidate.
- Bench: no change to `tools/class-bench/*` code was needed; the fake environment already covered the new paths. This document is the only bench file updated.

## What W6 changed

- `resolveFeatPicks` (`scripts/pc-builder.mjs`) keeps its pass unchanged and ends with `repairUnfilledFeatSlots`: Kuhn augmenting paths over slots and feats (keyed by slugified name). Exact issued references only, and only among a slot's own candidates. Default-filled slots move before AI-picked ones; an AI pick moves only to fill an empty slot. Each moved or newly filled slot warns. Signature unchanged.
- Tests: `scripts/pc-builder.featMatching.test.mjs` (new) imports the real `resolveFeatPicks` and the real `getFeatCandidates`; seven scenarios. With the repair call disabled, the first scenario fails.
- Bench: `--priorities` sets `concept.skillPriorities` as the AI does; each run records the projected `skillPlan` in `results.json`.

## Resolved causes (from the first run)

- **1. Skill-feat slots ran dry** (26 FAIL runs before). Prerequisite context now uses projected skill ranks at each slot's level (`scripts/pc-builder.mjs` ~lines 330-345 projection block; `scripts/pc-projection.mjs:178` `projectSkillRanks`). Operative, Soldier, Solarian, Envoy, Witchwarper now fill skill slots at every sampled level except the Mystic L20 pool below.
- **2. General-feat slots, 3 general feats in sf2e** (14 FAIL runs). sf2e 1.6.1 `feats/collection.ts` lists `supported: ["general", "skill"]` for the general group (cited in the brief). `pc-builder.mjs:407` widens the category; the `resolveFeatPicks` filter accepts both. The `general` pool is 3 feats, so the 95 skill feats now supply most general slots.
- **3. Free Archetype prerequisites.** `Charisma +2` style clauses are read by `clauseMet` (`scripts/pc-prerequisites.mjs`, wave-1 W1), and the projected Charisma modifier is supplied via `abilities` (`pc-builder.mjs` `abilities: modsAt(slot.level) ?? {}`). Multiclass dedications with a `Wisdom +2`-style clause (Mystic) appear in the archetype lists. Archetype slots fill at every sampled level except Mystic L20 with Free Archetype on (cause B).
- **4. Operative L10 and L20 class path invalid** (4 FAIL runs). Class-path `reservedFeats` are never excluded from the path's own choice and are excluded from slots (`pc-builder.mjs:~414` `excludeUuids: reservedFeats`; `scripts/class-paths.mjs:377`, wave-1 W3). Operative passes every sampled level in both modes.
- **5. Technomancer caster profile** (7 WARN runs). Resolved by C1 (already on the base): `pc-tables.mjs` Technomancer caster row.
- **6. Path- and heritage-keyed feat prerequisites** ("mine exocortex", "DPS++ programming language", "<X> heritage"). `pc-builder.mjs` passes `features` built from `pathPlan` names and `heritageDoc.name` to `stagedActorContext`, so `nameClauseMet` can prove them. Mechanic and Technomancer feats of these families are offered.
- **7. Mechanic and Technomancer not in `COMPLETE_PC_CLASS_SLUGS`** (information). Resolved by C1 on this base (`scripts/pc-support.mjs` lists eight classes).

- **8. Cause B, greedy feat slots** (Mystic L20, Bounty Hunter background, Free Archetype on: `archetype-class-20` unresolved). `resolveFeatPicks` now runs `repairUnfilledFeatSlots` (`scripts/pc-builder.mjs`) after its unchanged pass. An empty slot may take a feat held by an earlier slot if that slot moves to another of its own issued candidates (Kuhn's augmenting path over slots x feats, keyed by slugified name). A default-filled slot moves first; an AI-picked slot moves only when no path through default-filled slots fills the empty slot. Each moved or newly filled slot warns. Before: `FAIL unresolved archetype-class feat slot`. After: `WARN(4)`, with `archetype-class-20` taking Augmented Dedication from `archetype-class-4`, which takes Knight of Golarion Dedication from `archetype-class-2`, which moves to the free Grenadier Dedication (a three-slot chain; the bench's greedy duplicate pick starts it). Test: `scripts/pc-builder.featMatching.test.mjs` (seven scenarios, including the no-solution case and a forged reference that never moves).

## Remaining causes (WARN: empty feat slots, not blocking)

### A. Mystic L20: 15 general and skill slots share 13 provable feats (empty slots, WARN in the default matrix and with realistic priorities)

Mystic at level 20 has 15 general and skill slots: 10 skill (levels 2 to 20) and 5 general (3, 7, 11, 15, 19). Their candidate lists come from the staged prerequisite context at each slot's level. The distinct union across all 15 slots is **13** (10 skill feats plus 3 general-only feats). The per-level and total candidate caps are not the limit: with `FEAT_CANDIDATE_LIMIT` and `FEAT_CANDIDATES_PER_LEVEL` raised in a scratch copy, the union is still 13. With 15 slots and 13 feats no pick order fills all 15 (a feat is never duplicated), so two slots stay empty. The augmenting repair (cause B) cannot help: it moves slots among their own candidates and cannot create feats.

Outcome with realistic skill priorities (`--priorities`, the AI's `concept.skillPriorities`):

| Mystic L20 | priorities | background | FA off | FA on | unresolved (FA off) |
| --- | --- | --- | --- | --- | --- |
| default (no priorities) | none | Athlete | WARN(3) | WARN(7) | general-19, skill-20 |
| A: six priorities | athletics, medicine, nature, religion, occultism, diplomacy | Athlete | WARN(2) | WARN(6) | skill-18, skill-20 |
| A, Survival in the top four | athletics, survival, medicine, nature, religion, occultism | Athlete | WARN(3) | WARN(7) | not recorded |
| A with the Bounty Hunter background | six priorities | Bounty Hunter | PASS | WARN(4) | none |

Before W7 the first three rows were FAIL (the empty slots blocked Create). The FA-off and FA-on columns are the bench re-run after W7; the Bounty Hunter row is unchanged from W6.

**Why A leaves slots empty (counted from the module's own projection, `skillPlan` in `results.json`):**

- Trained skills at L20 under the six priorities: **4** (athletics from the Athlete background; medicine, nature and religion from the three Mystic class trainings, which follow the priorities). Occultism and diplomacy (priorities 5 and 6) are never trained, so no feat that needs them is provable.
- The nine skill increases (L3 to L19) go to the top three priorities after training (athletics, medicine, nature, each to legendary). Religion stays at trained rank. The priorities change which skills are trained and which reach legendary, but not how many class trainings or increases there are.
- Provable feats: the 13 above. 15 slots, 13 feats: two slots empty, as observed.
- The count of trained skills alone does not decide it. Compare: Survival in the top four (Athlete) leaves Nature at trained, so the Nature-gated feats (Amplify Glitch needs legendary, Predator's Eye master, Primal Sabotage expert) drop out: 12 provable, so more slots stay empty. The Bounty Hunter background trains Survival and gives Underworld Lore instead of religion, while Nature still reaches legendary: 16 provable, PASS with Free Archetype off and WARN(4) with it on.

Allocation policy was not changed (it is a design choice for JT). W7 accepts the empty slots (owner decision, 2026-10-25): the Athlete Mystic at L20 is created with them empty and the GM is warned. To fill them instead, the options are the increase policy (spread increases beyond the top three priorities), the class-training policy, or a different background.

## Stubs that weaken this result

- No Rule Elements run; `doc.system` is raw source (not prepared). The projection (`projectAttributeModifiers`, `projectSkillRanks`) is computed from source, not from Foundry's prepared data; the fake `Actor` still has Int 0 and ranks from class and background only.
- Feat picks are "first candidate not already taken", not AI picks; cause A depends on the default training, not on pick order.
- Native grant expansion is not emulated; `CONFIG.PF2E` has only `skills`.
- One ABC combination per sweep, no equipment, loot, focus spells or languages, no rarity cap.
- `fromUuid` resolves `Compendium.<scope>.<pack>.Item.<name>` by exact document name when the tail is not an id, as Foundry does for the name-style uuids sf2e class items use. This is the one behaviour assumed from core Foundry.
- Bench feat picks are greedy: when every candidate of a slot is already picked, the bench sends `candidates[0]` (a duplicate). That produces the `did not resolve` warning in the Bounty Hunter runs; the repair then fills the slot. Real AI picks need not do this.
- Final actor skill ranks are not reported. The fake Actor's `clone` and `update` merge with `Math.max`, so `system.skills` over-reports ranks (it shows, for example, Acrobatics and Arcana legendary under a wisdom-first default). The projection (`skillPlan`) is the source for skill claims.
