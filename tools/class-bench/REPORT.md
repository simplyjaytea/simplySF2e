# Class bench findings

Run of `node tools/class-bench/run.mjs` against **foundryvtt/pf2e `v14-dev` @ `be4ab21be8ffed44385c0038c05d41b61dceb68b`** (2026-10-24, `system.sf2e.json` version **1.6.1**), module at main `957a56c`. Character: Human / Urbanite Human / Athlete, no feat preferences, no equipment. See `README.md` for what the bench does and does not prove.

Pack list from `system.sf2e.json` 1.6.1 (`packs[].name:type`; ids are `sf2e.<name>`): alien-core-bestiary:Actor, guilt-of-the-grave-world-bestiary:Actor, secrets-of-the-swarm-bestiary:Actor, iconics:Actor, paizo-pregens:Actor, standalone-adventure-bestiary:Actor, starfinder-society-bestiary:Actor, rulebook-bestiaries:Actor, tales-from-the-vast-bestiary:Actor, actions:Item, ancestries:Item, **ancestry-features:Item**, backgrounds:Item, classes:Item, class-features:Item, feats:Item, heritages:Item, spells:Item, conditions:Item, bestiary-effects:Item, equipment-effects:Item, other-effects:Item, feat-effects:Item, spell-effects:Item, equipment:Item, deities:Item, macros:Macro, bestiary-ability-glossary-srd:Item, starfinder-society-boons:Item, journals:JournalEntry. (`ancestry-features` is not in `DEFAULT_PACKS`; ancestry grants resolve to it by uuid only.)

## Headline

**Default matrix after R1: 55 PASS / 25 WARN / 0 FAIL.** R1 (dedication-rule-aware feat picking, see "What R1 changed") stops every Free Archetype build from being blocked by a rejected dedication: 24 of 24 runs that had a rejected row (Create blocked) now have none. R4 (below) offers follow-ups in later archetype slots: 13 of those 24 runs now fill them. The other 11 still leave one archetype slot empty, because the per-level candidate sample drops the open dedication's follow-up (cause D, below). A clean HEAD (`b21a96d`) run on the same cache also gives 55 PASS / 25 WARN, so the 78 / 2 figure in the history below is not reproduced from this HEAD.

**Before R1 (W7 run):** 78 PASS / 2 WARN / 0 FAIL. The two WARNs were the same Mystic L20 pair (cause A, below). W7 changed what an empty feat slot means: a slot with no legal feat left is created empty and the GM is warned, so it no longer blocks Create and no longer counts as FAIL. Mystic L20 shows WARN(3) without Free Archetype and WARN(7) with it; each count includes the empty-slot finding plus the repair and greedy-pick findings listed in the breakdown. The W6 change that matters is cause B: Mystic L20 with Free Archetype on and the Bounty Hunter background fills its slot chain (WARN(4), see "Resolved causes" 8).

**History (same bench, same pinned source):**

- First run on pre-C1 `main`: **41 PASS / 7 WARN / 32 FAIL**.
- On the base `1f31d21` (C1 merged, Technomancer caster row exists): **48 PASS / 0 WARN / 32 FAIL**.
- After W5 (`pc-builder.mjs` wiring plus wave-1 modules): **78 PASS / 0 WARN / 2 FAIL**.
- After W6 (cause B repair in `resolveFeatPicks`): **78 PASS / 0 WARN / 2 FAIL** on the default matrix. Bounty Hunter Mystic L20, Free Archetype on: FAIL -> WARN(4).
- After W7 (empty feat slots warn instead of block): **78 PASS / 2 WARN / 0 FAIL** on the default matrix. The same two Mystic L20 runs are now WARN(3) and WARN(7).
- After F1 and F4 (`projection-mismatch` is fake-actor noise, filtered in `run.mjs`): **78 PASS / 2 WARN / 0 FAIL**, unchanged. With the filter reverted the same code reads **28 PASS / 52 WARN**: the fake actor's native ranks come only from `trainedSkills.value`, so the projected-rank check fires on most runs.

Every class passes levels 1 to 10 in both Free Archetype modes and every class passes level 20 except Mystic. Level 15 and 19 general slots now fill because general slots also draw from the `skill` category (cause 2, resolved).

Run: `node tools/class-bench/fetch.mjs && node tools/class-bench/run.mjs` (source `be4ab21be8ffed44385c0038c05d41b61dceb68b`, sf2e 1.6.1, Human / Urbanite Human / Athlete).

## What R1 changed (dedication rule in feat picking)

**Cause C, found by this bench.** Each archetype slot was resolved on its own, so a later archetype slot could take a second dedication before the first archetype had two follow-ups. generator-app's `validateArchetypeSlotPlacement` then dropped that row as `placement: "rejected"`, and a rejected row blocked Create (`completion.mjs`). On clean HEAD this hit 24 of the 40 Free Archetype runs, every one at level 5 or above.

What changed (all in `scripts/pc-builder.mjs` `resolveFeatPicks` and `repairUnfilledFeatSlots`, plus the shared helpers below):

- **Shared rule.** `scripts/pc-prerequisites.mjs` exports `createDedicationRuleState`, `dedicationRuleBlock` and `recordDedicationRulePlacement`. `validateArchetypeSlotPlacement` runs on the same helpers, so the rule is written once and its drop messages are unchanged. Archetype membership still comes from `archetypeOfFeat`, which reads candidate prerequisite text.
- **Walk.** Archetype slots are walked in order with that state. An AI pick (or default) that the rule forbids is skipped. While an open dedication needs follow-ups, that dedication's follow-ups are tried first. An archetype slot with no legal feat is left empty (`entry: null`), not marked rejected.
- **Warnings.** One `console.warn` per skipped pick, emitted when the slot's outcome is known: `... skipped: dedication rule: ...; took "<feat>"` or `...; no legal feat left, slot left empty`.
- **Repair.** `repairUnfilledFeatSlots` keeps an augmenting move only when the archetype slots, replayed in slot order, still pass the rule (`archetypeSequenceLegal`). Disabling that check fails the test's scenario 2 and scenario 5, so the check is load-bearing.
- **Tests.** `scripts/pc-builder.dedicationPicking.test.mjs` (new): two dedications in a row take a follow-up; no legal candidate leaves the slot empty, not rejected; a completed dedication (two follow-ups) allows the next one; the default prefers the open archetype's follow-up; repair never gives a blocked dedication to an empty slot. Scenario 1 fails against clean HEAD.

### Result

Default matrix, Free Archetype on, before (clean HEAD `b21a96d`) and after R1. Each cell is the run's finding count:

| class | L5 before | L5 after | L10 before | L10 after | L20 before | L20 after |
| --- | --- | --- | --- | --- | --- | --- |
| Envoy | WARN(2) | WARN(2) | WARN(5) | WARN(5) | WARN(9) | WARN(10) |
| Mechanic | WARN(2) | WARN(2) | WARN(5) | WARN(5) | WARN(10) | WARN(10) |
| Mystic | WARN(2) | WARN(2) | WARN(5) | WARN(5) | WARN(15) | WARN(12) |
| Operative | WARN(2) | WARN(2) | WARN(5) | WARN(5) | WARN(10) | WARN(10) |
| Solarian | WARN(2) | WARN(2) | WARN(5) | WARN(5) | WARN(10) | WARN(10) |
| Soldier | WARN(2) | WARN(2) | WARN(5) | WARN(5) | WARN(10) | WARN(10) |
| Technomancer | WARN(2) | WARN(2) | WARN(5) | WARN(5) | WARN(10) | WARN(10) |
| Witchwarper | WARN(2) | WARN(2) | WARN(5) | WARN(5) | WARN(9) | WARN(10) |

Free Archetype-off cells are unchanged (Mystic L20 off stays WARN(3), the W7 empty-slot finding). Counts move because each skipped pick adds a warning line and a rejected row no longer does. The L5 and L10 counts are the same before and after; at L20 they change by one to three.

Run-level effect, from `results.json`:

| | clean HEAD | after R1 |
| --- | --- | --- |
| Free Archetype runs with a rejected row (Create blocked) | 24 | 0 |
| Free Archetype runs with an unresolved archetype slot (the same 24 runs; blocking on clean HEAD, empty and non-blocking after) | 24 | 24 |
| Free Archetype runs at L5 or above with a rule skip | 0 | 24 (108 skip lines in total) |
| `validateArchetypeSlotPlacement` drops in the bench | 24 runs | 0 runs |

The 24 Free Archetype runs at L5+ are the 8 classes times L5, L10 and L20.

### Multiclass (`--multiclass`, Free Archetype on)

All eight REPORT rows (`--levels 2,6,10`) run PASS with the second class's dedication pinned, as before. Witchwarper with Envoy was checked directly: `multiclass` reads `envoy: Envoy Dedication` at each level.

### Remaining WARNs and what they mean

- **Empty archetype slot, 24 runs (all FA L5+).** Cause D, below. The slot is created empty and the GM is warned. It no longer blocks Create.
- **`skipped: dedication rule` lines, 108 across 24 runs.** One per skipped pick, as required. These are not failures. They are the only lines that still contain "dedication rule", so the "no dedication rule WARNs" target is not met literally. Each one names the pick and says whether a substitute was taken.
- **`took "Iomedae's Barrage"` substitutes.** Its sf2e 1.6.1 record (`tools/class-bench/cache/feats/archetype/knight-of-golarion/iomedaes-barrage.json`) has the archetype trait and no prerequisite text, so it is legal under the rule as written and cannot be attributed to an archetype. Whether an unattributed archetype feat should count as a substitute in an open archetype slot is a rules question for JT.
- **`feat pick "<X>" ... did not resolve`, a few runs.** The bench picks the first unused candidate per slot without the rule, so a later bench pick can collide with an earlier substitute. The walk then falls back, as it always has.

### Cause D: later archetype slots never see follow-ups (context fixed by R4; the candidate cap remains)

`resolvePCConcept` (`scripts/pc-builder.mjs`, feat-slot build around `prerequisiteContext`) builds every slot's candidate list before any pick. Its prerequisite context names only the staged ABC, path features and the multiclass pin, so the dedication placed in an earlier archetype slot is not in it. A follow-up's prerequisite text names that dedication, so it is never offered to a later slot. The candidate list for archetype slot 4 in the Soldier L5 run holds 8 dedications and no follow-up (`results.json`, `slots`).

Result: after the first dedication, a Free Archetype build has no legal follow-up to place, and later archetype slots go empty even though the game has legal feats there. R1 makes that outcome honest and non-blocking; it does not make the slots fill. R4 threads the earlier archetype offers into later slots' candidate-time context (see "What R4 changed"). What remains is the cap: `limitFeatCandidates` keeps 8 feats per level, evenly spaced by name, so an open dedication's follow-up can fall outside the sample even when it is provable (Mystic L5: `Augmentation Surgeon`, level 4, is in the pool and is not sampled). Raising the cap is a ceiling change (PLAYBOOK §8), so it needs a decision from JT. Options: a bounded reserve of follow-ups per offered dedication, or a larger archetype cap for Free Archetype only.

## What R4 changed (cause D: follow-ups in later archetype slots)

- **Candidate time.** `resolvePCConcept` (`scripts/pc-builder.mjs`) records the slugs of every archetype candidate offered to an earlier archetype slot, dedications and follow-ups alike, the pinned dedication included. A later archetype slot's prerequisite context adds those names to the staged facts, so a follow-up that names an offered dedication is offered. Other slots keep the pinned dedication, as before. Abilities, skills and features are unchanged, and the candidate cap (`FEAT_CANDIDATE_LIMIT` 16, `FEAT_CANDIDATES_PER_LEVEL` 8) is unchanged.
- **Pick time.** `resolveFeatPicks` checks each archetype pick's prerequisite text (`archetypeBlock`) against the slot's staged facts plus the archetype feats accepted in earlier archetype slots, after the dedication rule. A refused pick warns once (`skipped: prerequisites not met ...; took "<feat>"`) and the next legal candidate is used. The repair replay (`archetypeSequenceLegal`) applies the same check.
- **Helper.** `scripts/pc-prerequisites.mjs` exports `evidencePrerequisitesMet(evidence, context)`: `featPrerequisitesMet` for a full entry or an issued candidate record.
- **Tests.** `scripts/pc-builder.archetypeFollowUps.test.mjs` (new). Level 6: the level-2 dedication is taken, and the follow-ups at levels 4 and 6 are offered and accepted with no warning. A follow-up of a dedication that was offered but not taken is offered at level 4, refused at pick time, and replaced by the next legal candidate. On clean HEAD the test fails at the candidate-time assertion. With the pick-time check disabled it fails at the refusal assertion.

### Default bench (be4ab21, same cache, clean HEAD vs R4)

| | clean HEAD | after R4 |
| --- | --- | --- |
| Free Archetype L5+ runs with an unresolved archetype slot | 24 | 11 |
| `dedication rule` skip lines in those runs | 108 | 51 |
| `prerequisites not met` skip lines (new) | 0 | 38, in 9 runs |
| Matrix cells, PASS / WARN | 48 / 32 | 48 / 32 |

Per-cell finding counts move by one either way, because each skip line is a finding: L5 and L10 WARN counts fall for some classes and rise for others. No run throws, and no cell is FAIL.

The HEAD figure is 48 / 32 on this cache. The "55 PASS / 25 WARN" headline above was not reproduced on this cache (same SHA, `be4ab21`), so the figure may come from a different cache state.

The 11 runs still unresolved (Mechanic L10/L20, Mystic L5/L10/L20, Operative L10/L20, Solarian L10/L20, Technomancer L10/L20) all fail the same way. The bench's first-candidate picks take an Augmented Dedication at level 2, and its follow-up `Augmentation Surgeon` (level 4) is sampled out of the level-4 bucket. See cause D for the decision needed.

### Multiclass (`--multiclass`, levels 2, 6, 10): clean HEAD vs R4

| pair | clean HEAD | after R4 | note |
| --- | --- | --- | --- |
| Witchwarper + Envoy | 3 PASS | 3 PASS | |
| Technomancer + Mechanic | 3 WARN | 3 WARN | same spell-database WARNs; R4 adds one dedication-rule skip that still fills its slot |
| Mechanic + Technomancer | 3 PASS | 2 PASS, 1 WARN | `Advanced Technomancy` (level 6, needs `Basic Technomancy`) refused, `Firmware Enhancement` taken |
| Envoy + Witchwarper | 3 PASS | 3 PASS | |
| Envoy + Mystic | 3 PASS | 3 PASS | |
| Envoy + Operative | 3 PASS | 2 PASS, 1 WARN | `Operative Exploit` (level 8, needs `Specialized Operative`, which Envoy does not hold) refused; `AbadarCorp Rep Dedication` taken |
| Envoy + Solarian | 3 PASS | 2 PASS, 1 WARN | level-10 dedication-rule skip; slot still filled |
| Envoy + Soldier | 3 PASS | 3 PASS | |

The two HEAD PASSes that now warn accepted a follow-up whose prerequisite was never taken. The bench validator (`run.mjs`, `validateArchetypeSlotPlacement(..., null)`) passes no staged context, so it never proves follow-up prerequisites. `generator-app` passes one, and would have rejected those picks (not run here). The R4 WARNs are the same picks refused at pick time. Two pre-existing issues are visible in these runs and are not fixed here. First, the class-slot fallback (no trait filter) can default to an archetype feat (`According to My Calculations`, Envoy + Operative). Second, the bench picks the first candidate, so it sometimes produces a dedication the open rule refuses.

## Matrix after F4 (same results as W7; the two Mystic L20 runs are WARN, not FAIL)

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

## Path coverage (`--path`, Operative specializations)

The default matrix takes the first class-path candidate, which for Operative is Ghost. `run.mjs --path <Name>` makes the path choice select that option instead, and fails the run (FAIL) if the plan does not select it. Other classes' paths are not covered by this section.

Measured against the same source (`be4ab21`, sf2e 1.6.1), Athlete background, Human / Urbanite Human:

| specialization (trained skill) | command | FA off | FA on |
| --- | --- | --- | --- |
| Striker (Athletics), Athlete background | `--path Striker --levels 1,5,10,20` | FAIL at every level: `--path "Striker" was not selected (plan: Ghost)` | same |
| Striker (Athletics), Clansworn background | `--path Striker --levels 1,5,10,20 --background Clansworn` | L1 PASS, L5 WARN(2), L10 WARN(2), L20 WARN(2) | same as off |
| Ghost (Deception) | `--path Ghost --levels 5` | PASS | PASS |
| Infiltrator (Computers) | `--path Infiltrator --levels 5` | PASS | PASS |
| Skirmisher (Acrobatics) | `--path Skirmisher --levels 5` | PASS | PASS |
| Sniper (Stealth) | `--path Sniper --levels 5,10,20` | WARN(2) at L5, L10, L20 | WARN(2) at L5, L10, L20 |

Athlete grants Deadlift (`system.items`, `Compendium.sf2e.feats.Item.Deadlift`). After F1 the path reserves Deadlift, so Striker is unselectable with the Athlete background (FAIL above). The Striker rows therefore use Clansworn (trains Athletics; its `system.items` grants Hefty Hauler, not Deadlift). Striker's empty slots are the same with either background.

The other rows were rerun after F1 with the Athlete background and match the table. Of the paths measured here, Striker (Clansworn) and Sniper are non-PASS, and Striker (Athlete) FAILs.

**Empty slots, both WARN (empty feat slot, not FAIL, as W7 intends):**

- Striker (Clansworn background): `skill-3` at L5; `skill-3`, `skill-7` at L10; `skill-3`, `skill-7`, `skill-15` at L20.
- Sniper: `skill-3` at L5; `skill-3`, `skill-7` at L10; `skill-3`, `skill-7`, `skill-15` at L20.

**Known data limit (confirmed, not a code fix):** `pc-builder.mjs` restricts the Specialized Skill Set slots (levels 3, 7, 15, when the class has that feature) to feats that prove the specialization's trained skill (`allowedSkillFeats`). In the cache, each such skill has exactly one skill feat at level 15 or below, and the path reserves it through its own level-one skill feat (`reservedFeatUuids`, `class-paths.mjs`):

- Athletics: Deadlift (level 1, `trained in Athletics`), reserved by Striker.
- Stealth: Without a Trace (level 1, `trained in Deception, Stealth, or Underworld Lore`), reserved by Sniper.

No other skill-category feat at level 15 or below names Athletics or Stealth, so the restricted slots have no candidate. The module does not borrow a feat for another skill; the slot stays empty. Ghost, Infiltrator and Skirmisher are not restricted this way: their skills have several unreserved skill feats at levels 1 to 3, so they pass.

**Claim scope:** "every class builds cleanly" is measured on each class's default path (Ghost for Operative), in the default matrix (80 runs: 78 PASS, 2 WARN, 0 FAIL), plus the path coverage above. Other specializations of other classes are not measured. The prerequisite change (legacy score form removed from `pc-prerequisites.mjs`) left the default matrix unchanged, and its result is the same 78 PASS / 2 WARN.

## Multiclass coverage (`--multiclass`, Free Archetype on)

`run.mjs --multiclass <class>` sets `concept.multiclass` and runs Free Archetype on only. The second class's dedication is pinned to the first archetype slot (level 2); the bench reports `not pinned` when the dedication is not provable. Each dedication needs a main class that proves its attribute at level 2. Where no other class keys that attribute, `--abilities <key>` supplies the free-boost preference, as the AI's `abilityPriorities` would. Measured against the same source (`be4ab21`, sf2e 1.6.1), Human / Urbanite Human / Athlete, levels 2, 6 and 10.

| dedication (prerequisite) | main class (key) | command | L2 | L6 | L10 |
| --- | --- | --- | --- | --- | --- |
| Envoy (Charisma +2) | Witchwarper (cha) | `--classes witchwarper --multiclass envoy --levels 2,6,10` | PASS, pinned | PASS, pinned | PASS, pinned |
| Mechanic (Intelligence +2) | Technomancer (int) | `--classes technomancer --multiclass mechanic --levels 2,6,10` | PASS, pinned | PASS, pinned | PASS, pinned |
| Technomancer (Intelligence +2) | Mechanic (int) | `--classes mechanic --multiclass technomancer --levels 2,6,10` | PASS, pinned | PASS, pinned | PASS, pinned |
| Witchwarper (Intelligence or Charisma +2) | Envoy (cha) | `--classes envoy --multiclass witchwarper --levels 2,6,10` | PASS, pinned | PASS, pinned | PASS, pinned |
| Mystic (Wisdom +2) | Envoy (cha) | `--classes envoy --multiclass mystic --abilities wis --levels 2,6,10` | PASS, pinned | PASS, pinned | PASS, pinned |
| Operative (Dexterity +2) | Envoy (cha) | `--classes envoy --multiclass operative --abilities dex --levels 2,6,10` | PASS, pinned | PASS, pinned | PASS, pinned |
| Solarian (Strength +2) | Envoy (cha) | `--classes envoy --multiclass solarian --abilities str --levels 2,6,10` | PASS, pinned | PASS, pinned | PASS, pinned |
| Soldier (Constitution +2) | Envoy (cha) | `--classes envoy --multiclass soldier --abilities con --levels 2,6,10` | PASS, pinned | PASS, pinned | PASS, pinned |

All 24 runs pin and PASS: no empty feat slot and no warning. Witchwarper (Envoy) at L10 shows the chain the placement rule needs: the level-2 Envoy Dedication, then the level-4 follow-up Basic Leadership (listed first in its slot), two more archetype feats, and a second dedication (AbadarCorp Rep Dedication) accepted only after two follow-ups.

**Default matrix at HEAD, not a change from this work.** On a clean HEAD worktree, the default `run.mjs` reads **55 PASS / 25 WARN**, the same as with this branch. The 25 WARNs are `dedication rule` drops (sometimes with `empty archetype-class feat slot`). The bench's first-candidate picks take the dedications first, because they sort first at level 2, so consecutive dedications are dropped. The model's real picks could also stack dedications without a pin, so this is a real gap, not only a bench artifact. The headline (78 PASS / 2 WARN) predates the dedication rule and is out of date; this section does not rewrite it.

## Stubs that weaken this result

- No Rule Elements run; `doc.system` is raw source (not prepared). The projection (`projectAttributeModifiers`, `projectSkillRanks`) is computed from source, not from Foundry's prepared data; the fake `Actor` still has Int 0 and ranks from class and background only.
- Feat picks are "first candidate not already taken", not AI picks; cause A depends on the default training, not on pick order.
- Native grant expansion is not emulated; `CONFIG.PF2E` has only `skills`.
- One ABC combination per sweep, no equipment, loot, focus spells or languages, no rarity cap.
- `fromUuid` resolves `Compendium.<scope>.<pack>.Item.<name>` by exact document name when the tail is not an id, as Foundry does for the name-style uuids sf2e class items use. This is the one behaviour assumed from core Foundry.
- Bench feat picks are greedy: when every candidate of a slot is already picked, the bench sends `candidates[0]` (a duplicate). That produces the `did not resolve` warning in the Bounty Hunter runs; the repair then fills the slot. Real AI picks need not do this.
- Final actor skill ranks are not reported. The fake Actor's `clone` and `update` merge with `Math.max`, so `system.skills` over-reports ranks (it shows, for example, Acrobatics and Arcana legendary under a wisdom-first default). The projection (`skillPlan`) is the source for skill claims.
