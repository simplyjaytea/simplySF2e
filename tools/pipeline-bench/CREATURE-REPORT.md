# Creature bench report

One run of `tools/pipeline-bench/creature.mjs` on the sf2e cache pinned at `be4ab21` (`tools/class-bench/cache/SOURCE.txt`). It runs the real `scripts/creature-pipeline.mjs` chain with the AI stubbed (first offered candidate, fixed scale-word concept). No production file was changed to make it pass. Findings are documented below with fix sketches, not fixed.

## Matrix

| kind / level | none | elite | weak |
| --- | --- | --- | --- |
| monster L-1 | PASS | PASS | WARN(1) |
| monster L1 | PASS | PASS | PASS |
| monster L5 | PASS | PASS | PASS |
| monster L12 | PASS | PASS | PASS |
| monster L20 | PASS | PASS | PASS |
| monster L24 | PASS | PASS | PASS |
| npc L-1 | PASS | PASS | WARN(1) |
| npc L1 | PASS | PASS | PASS |
| npc L5 | PASS | PASS | PASS |
| npc L12 | PASS | PASS | PASS |
| npc L20 | PASS | PASS | PASS |
| npc L24 | PASS | PASS | PASS |
| encounter (3 creatures, party L5) | PASS | - | - |

**35 PASS, 2 WARN, 0 FAIL** over 37 runs and 1,009 checks. The encounter is "3 creatures at party level 5", read as `composeEncounter("severe", 4, 5)`: a level-7 boss and two level-3 minions. Both WARN cells are the same advisory (finding 1).

Negative control: a copy of the bench with the expected GM Core row shifted by one level fails every band check (npc L5: `band:ac: 22 vs GM Core 24`), so the PASS column is a real comparison and not a tautology.

## Findings

No run FAILs. Four findings, ranked by how much they matter.

### 1. Weak at level -1 displays level -2 (WARN, advisory)

- Cause: `scripts/builder.mjs:1208-1213`, `adjustedLevel`: `weak` returns `level === 1 ? level - 2 : level - 1` with no floor, so `-1` gives `-2`.
- Impact: preview only. `adjustedStats` (`builder.mjs:1249`) sets the displayed `level`. `concept.level` and `computeStats` are unchanged, and the stored adjustment is still `"weak"`. The bench's stat checks still pass.
- Open question: the comment cites pf2e v14-dev `npc/document.ts prepareBaseData`. That source is not in this repo's cache, so the bench cannot confirm whether pf2e floors Weak at -1.
- Fix sketch (after confirming the rule): if pf2e floors at -1, `return Math.max(T.MIN_LEVEL, level === 1 ? level - 2 : level - 1)` in `adjustedLevel`, then add a bench row that expects the floor. Rule decision for JT.

### 2. Silent scale fallbacks (not in the matrix; probe-confirmed)

- Cause: `scripts/builder.mjs:478` (`hpScale` not in high/moderate/low becomes `"moderate"`), `builder.mjs:443-444` (`spellcasting.dcScale` not in extreme/high/moderate becomes `"high"`). `scale4`/`scale5` (`builder.mjs:280-285`, used at 380, 477 and the perception and save scales) also default without a warning.
- Probe, run against the cache: `normalizeConcept({ hpScale: "extreme", spellcasting: { tradition: "arcane", dcScale: "terrible", spells: [] }, abilityScales: { str: "extreme" } }, { level: 5, rarity: "common" })` returns `hpScale: "moderate"`, `dcScale: "high"`, `str: "extreme"`, and `console.warn` is never called.
- Contrast: the trait and sense filters warn through `filterAllowed` (`builder.mjs:273-278`).
- Why the matrix cannot see it: the stats after the substitution are internally consistent, so every band check passes.
- Fix sketch: at minimum, warn when a scale is outside its set, the way `filterAllowed` does (for example a `console.warn` naming the rejected `hpScale` and the value used instead). Whether to default or drop is a design choice (invariant 5: never guess). Ask JT before changing behaviour.

### 3. Extreme ability modifiers below level 1 use the High column (documented, not a bug)

- Cause: `scripts/tables.mjs:26` ("Extreme is unavailable below level 1 (falls back to high)") and the default fallbacks in `lookup` (`tables.mjs:227`).
- The bench checks this as the fallback column: monster `str: "extreme"` at L-1 is compared with the High row and passes. Recorded so a reader does not mistake it for a band failure.

### 4. Trait validation is not exercised by the bench (bench-only)

- Cause: `CONFIG.PF2E.npcAttackTraits` and `CONFIG.PF2E.creatureTraits` are not in the class-bench Foundry fake. Without `npcAttackTraits`, the empty fallback (`builder.mjs:67-70`) drops every strike trait with a WARN. Without `creatureTraits`, the creature-trait check is skipped (`builder.mjs:455`).
- Seen once: a fixture with `agile` on a strike produced `dropped invalid NPC attack traits: agile` in every NPC run. The fixture now has no traits on that strike, so the matrix is clean.
- Fix for the bench: fake the two CONFIG maps from the system's own config once it is cited. They are not in the packs, so do not invent them.

## Refactor check (Part 1)

- `scripts/creature-pipeline.mjs` (new, pure) holds `generateCreature`, `generateEncounter`, `refineSpells`, `refineCreatureAbilities`, `refineCreatureFeats`, `refineEquipment`, `refineLoot`. It reports through `onStep`, `onProgress`, `onTokens` and one `AbortSignal`, and takes AI functions through `ai` (defaults to the real `ai.mjs` exports).
- `GeneratorApp` keeps progress, token display, render and create. Its `#refineSpells`, `#refineEquipment` and `#refineLoot` now delegate, because the PC and loot-reroll paths call them. `#refineCreatureAbilities` and `#refineCreatureFeats` were removed (only the creature chain used them).
- Test changes, each needed because the vm harnesses load `generator-app.mjs` by name and cannot see the new module:
  - `generator-app.multiclass`, `.review`, `.lootReroll`: also link `creature-pipeline.mjs` from the same mocks.
  - `generator-app.creatureFeats`: loads `creature-pipeline.mjs` and calls the exported function.
  - `ai.pcSpells`, `ui.layout`: source-text assertions for the moved spell, manifest and progress wiring point at the new file.
- Not covered by the tests and needing a live Foundry check: the progress step list for NPC and encounter runs, Cancel mid-run, Create after a preview, per-member progress in encounter mode, and token-row labels.

## What the bench does not cover

- The stub takes the first candidate only. Focus spells, spell-gem loot (scroll candidates), and Elite/Weak on encounter members are not reached.
- `createActor` (art, token, sheet) and Rule Element behaviour are outside the pipeline and are not run.
- Stats are checked against the table row for the level and scale, not against the GM Core page numbers. The numbers are cited in `tables.mjs` comments.
- Only the `Item` packs are fetched. The bestiary `Actor` packs (for art) are not needed here.

## Verification

- `node tools/pipeline-bench/creature.mjs`: 0 FAIL, exit 0.
- `for f in scripts/*.test.mjs; do node "$f"; done`: no FAIL.
- `bash tools/release-check.sh --no-ui`: passes (143 tests, syntax, manifests, references, QA rows, whitespace).
- `node tools/ui-preview/shoot.mjs`: passes (72 fixtures at both widths).
