# Pipeline bench

Offline diagnostics that run **production** module code against the real sf2e JSON. They report findings; they fix nothing and change no production file. The packs come from `tools/class-bench/`: run `node tools/class-bench/fetch.mjs` once to fill its gitignored cache, and both benches read it.

## Item Forge bench (`forge.mjs`)

```
node tools/pipeline-bench/forge.mjs                       # every variant x levels 1,3,5,8,13,18 x common, uncommon
node tools/pipeline-bench/forge.mjs --only weapon-top-grade,armor-top-grade --levels 13
node tools/pipeline-bench/forge.mjs --verbose             # prints each non-PASS case's messages
```

Node 22+. No install step, no Foundry, under a second.

### What it runs

- The real forge functions from `scripts/`: `normalizeMagicItemConcept`, `buildMagicItemData`, `priceForLevel`, `getUsageOptions` and `createActivationMacro` (`item-builder.mjs`, `macro-templates.mjs`); `getForgeEffectCatalog` (`rule-templates.mjs`); `getBaseItemCandidates`, `getPropertyRuneCandidates`, `getGradeTiers`, `getFundamentalRuneTiers`, `normalizeRunedItemConcept` and `buildRunedItem` (`item-builder.mjs`, `runes.mjs`).
- The orchestration of `itemforge-app.mjs` (`#generateWondrous`, `#generateRuned`, `#onCreateItem`) is repeated in `forge.mjs`, in the same call order. Those methods are private to the app class, so they cannot be imported. If that orchestration changes, update `runMagic` and `runRuned` to match.
- Fakes only for Foundry globals: `Item.create`, `Macro.create`, `Folder.create`, item `getFlag`/`update`, `game.i18n.format`, `game.folders`. The pack and settings fakes come from `tools/class-bench/env.mjs`.

### The AI stub

The stub picks the first valid offered candidate: first base, first grade, the first upgrades that fit, first catalog effect per kind. Activation parameters are fixed enums. The stub never emits a number, and each case checks that (a number in the stub is a bench bug). The `-top-grade` variants take the last base and the top grade instead, so high grades are exercised too.

### Variants (`VARIANTS` in `forge.mjs`)

| id | Kind | What it exercises |
| --- | --- | --- |
| `wondrous-passive` | wondrous | Two passive effects, cloned from `sf2e.equipment` rules |
| `wondrous-1day-damage` / `-condition` / `-heal` / `-selfbuff` | wondrous | Each 1/day activation template, with its companion macro |
| `augmentation` | augmentation | Biotech, one passive effect when offered |
| `crystal` | Solarian crystal | Usage `other`, one passive effect when offered |
| `weapon-graded` | weapon | First base and first grade, up to two installed upgrades |
| `weapon-top-grade` | weapon | Last base and top grade, up to two installed upgrades |
| `weapon-published-grade` | weapon | First base that is itself published at a non-commercial grade, at the first grade |
| `weapon-projectile` | weapon | Projectile base with the projectile-only upgrade (n/a at level 1) |
| `weapon-projectile-misfit` | weapon | Negative control: the projectile upgrade on a non-projectile base must be dropped with a warning |
| `armor-graded` | armor | First base and first grade, one installed upgrade offered |
| `armor-top-grade` | armor | Last base and top grade, one installed upgrade offered |

### What each case asserts

- **No throw** at any stage (the stage is named on failure).
- **Passive rules are clones:** each `system.rules[i]` is canonical-JSON equal to a rule of the `sf2e.equipment` item named by `exemplar.sourceUuid`, the source level is at most the GM level, and the source rarity is at most the requested rarity. A rule with investment needs an invested worn item.
- **Activation:** `flags.simplysf2e.forge.uses` and `system.frequency` are 1/day; the macro body compiles (`AsyncFunction`); the item name reaches the macro escaped (`&lt;img`, never `<img`); the description has an `@UUID[Macro.` link; a self-buff's embedded `RULES` are clones of real rules.
- **Escaping:** raw AI markup (`<b>`) in the description becomes `&lt;b&gt;`.
- **Price and level:** price is `priceForLevel`; `system.level` equals the GM level.
- **Augmentation and crystal:** one category trait on augmentations; usages `implanted` and `other`.
- **Runed items:** the grade is a grade on some `sf2e.equipment` item, offered at this level and no higher than the level; legacy runes are zeroed; each installed upgrade's usage is an offered usage and fits the base group (`propertyRuneFitsBase`); each upgrade's level is at most the GM level; the item name keeps the base name and carries at most one grade label; a copied `system.price`/`system.level` equals the base's (the system recomputes both from them, `physical/document.ts`); no base named for a non-commercial grade is offered; a base published above commercial keeps its published grade, or is refused when it would come out above the GM level.
- **Warnings:** every `console.warn` is kept as a WARN, except the misfit control's drop message, which must appear. An upgrade skipped by the slot cap (`no free upgrade slot`) is a WARN, listed as "skipped and surfaced", because the requested upgrade is not installed. A kept published grade (`is published at … kept`) is an expected notice, not a WARN, and must appear whenever it applies.

Status is `FAIL` for any failed assertion, `WARN` for a forge warning or a silent drop, `PASS` otherwise, and `n/a` when nothing can be tested at that level.

### Output

The matrix goes to stdout and to `tools/class-bench/cache/forge-matrix.md`. Per-case detail (rules, upgrades, macro size) is in `tools/class-bench/cache/forge-results.json`. The exit code is 1 if any case FAILs. `FORGE-REPORT.md` is the hand-written analysis of one run and is not regenerated. Rerun the bench after a fix and compare the matrix.

### What it does not prove

- No live Foundry. No Rule Element ever runs, nothing is prepared, and no derived stat, price or level comes from the system. `system.price`/`system.level` are the values the module writes, not the system's recomputation.
- `CONFIG.PF2E.equipmentTraits` is not faked, so the trait-validation branch of `normalizeMagicItemConcept` is never reached.
- No macro is executed. The macro check is compile plus string checks on the escaped name and the embedded rules.
- No upgrade slot counts come from the packs: they are not in the item JSON, and the forge's own slot parser is never fed a description (see FORGE-REPORT.md).
- The stub picks deterministically. A different pick order can produce different cases, but not different code paths.

## Creature bench (`creature.mjs`)

```
node tools/pipeline-bench/creature.mjs                   # monster and npc x levels -1,1,5,12,20,24 x none/elite/weak, plus the encounter
node tools/pipeline-bench/creature.mjs --kinds npc --levels 5 --verbose
```

Node 22+, after `tools/class-bench/fetch.mjs`. No install step, no Foundry, about a second. Findings and causes are in `CREATURE-REPORT.md`.

### What it runs

- `generateCreature()` and `generateEncounter()` from `scripts/creature-pipeline.mjs`: the NPC/monster chain and the per-member body. Stats come from `computeStats`, `adjustedStats`, `adjustedLevel` and `hpAdjustment` (`builder.mjs`); the encounter composition from `composeEncounter` (`encounter.mjs`); the GM Core rows from `tables.mjs`.
- The `ai` option replaces every AI call. `generateConcept` returns a fixed concept with every key `ai-response-validation.mjs` requires, using scale words and enum slugs only. Every select step returns the first offered candidate in the post-validation shape `ai.mjs` returns. `designEncounter` returns one brief per slot.
- The packs and Foundry globals come from `tools/class-bench/env.mjs`. Only the `Item` packs are needed: the bestiary `Actor` packs feed `art.mjs`'s scaffold lookup, which runs in `createActor`, outside the pipeline.

### Runs

Kind `monster` (no spellcasting) and `npc` (spellcasting allowed), each at every level and adjustment: 36 runs. Plus one encounter, `composeEncounter("severe", 4, 5)`, which gives three creatures (a level-7 boss and two level-3 minions) at party level 5.

### What each run asserts

- **No throw**, with the last step named on failure.
- **Manifest complete:** `completionManifest` reports no unresolved required record.
- **Sources:** every resolved ability, spell, feat, focus spell, equipment and loot line with a pack points to `sf2e.spells`, `sf2e.feats`, `sf2e.equipment` or the glossary pack, and the document exists in the cache. Narrative abilities and coins are exempt.
- **Stat bands:** each AC, HP, perception, save, ability modifier, strike attack and damage, and spell DC and attack equals the GM Core row for the concept's level and scale in `tables.mjs`. A table with no column for the scale uses the documented fallback column, and the detail line names it. Spell max rank is `min(10, max(1, ceil(level / 2)))`.
- **Elite/Weak applied once:** the concept keeps the GM level, the adjustment is stored once, and `adjustedStats` moves AC and HP by exactly one delta.
- **Advisory (WARN, never FAIL):** Weak's display level stays at or above the level -1 floor. Nothing cited in the repo says where Weak stops.
- **WARN:** any `console.warn` the pipeline emitted.

Status is `FAIL` for a failed non-advisory check, `WARN` for a warning or a failed advisory check, `PASS` otherwise. The exit code is 1 on any FAIL.

### Output

The matrix goes to stdout and to `tools/class-bench/cache/creature-matrix.md`. Per-run checks and warnings are in `tools/class-bench/cache/creature-results.json`. `CREATURE-REPORT.md` is the hand-written analysis of one run and is not regenerated.

### What it does not prove

- No live Foundry. No Rule Element runs, nothing is prepared, and `createActor` (art, token, sheet) is never called.
- The stub takes the first candidate only. Focus spells, spell-gem loot (scroll candidates), and encounter Elite/Weak are not reached.
- `CONFIG.PF2E.npcAttackTraits` and `creatureTraits` are not faked, so trait validation runs on its fallback. A fixture trait is dropped with a WARN (`builder.mjs:67`).
- Stats match the table row for the level and scale. They are not checked against the GM Core page numbers, which are cited in `tables.mjs` comments.
