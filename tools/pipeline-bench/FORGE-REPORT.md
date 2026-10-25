# Item Forge bench report

Run of `node tools/pipeline-bench/forge.mjs` on the sf2e cache pinned at foundryvtt/pf2e v14-dev `be4ab21b` (`system.sf2e.json` version 1.6.1). Branch `simplyjaytea/m-r6` (R6 commit `6b5fc3e`) on `batch/m2-m4` (`70ce787`). R6 changed the forge fixes listed below. The bench is still offline and reads only the cache.

## Verdict

**0 FAIL, 48 WARN, 116 PASS, 4 n/a** across 14 variants × levels 1, 3, 5, 8, 13, 18 × rarity common, uncommon (168 cases).

Before R6 (`simplyjaytea/m1-t3`, `498ed23`): 0 FAIL, 80 WARN, 84 PASS, 4 n/a.

- The 48 WARN are one class: a requested upgrade past the base's slot cap is skipped. The skip is now warned by name and shown on the Forge preview. The cap stays, because slot capacity is uncited and on hiatus (PLAYBOOK §9). 24 cases are armor, whose slot count is 0 because of the dead description path (runes.mjs:356, see below). 24 are weapon cases asking for two upgrades on a one-slot base.
- The 80 copied price/level WARNs are gone: the copy is the input the system recomputes from, so it is expected (below), and the bench now checks that the copy equals the base.
- Duplicated grade labels: fixed. Published-grade bases: the published grade is kept, with a notice; a base that would come out above the GM's level is refused.

| variant | L1 co | L1 un | L3 co | L3 un | L5 co | L5 un | L8 co | L8 un | L13 co | L13 un | L18 co | L18 un |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wondrous-passive | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| wondrous-1day-damage | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| wondrous-1day-condition | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| wondrous-1day-heal | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| wondrous-1day-selfbuff | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| augmentation | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| crystal | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| weapon-graded | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) |
| weapon-top-grade | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) |
| weapon-projectile | n/a | n/a | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| weapon-published-grade | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| weapon-projectile-misfit | n/a | n/a | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| armor-graded | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) |
| armor-top-grade | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) |

`co` = common, `un` = uncommon. The n/a cells are level 1 and level 3 for projectile variants: the first projectile-only upgrade is Impact Enhancer (Commercial), level 3 (`sf2e.equipment`).

## Source for the price/level decision

Fetched from `foundryvtt/pf2e` tag `sf2e-1.6.1` (`src/module/item/physical/document.ts`, `helpers.ts`, `src/scripts/config/index.ts`):

- `physical/document.ts:274` (in `prepareBaseData`): `this.system.price.value = new Coins(this.system.temporary ? {} : this.system.price.value).normalized();`
- `physical/document.ts:338` (`prepareDerivedData`), lines 355-358:
  ```
  const { level, rarity, price } = computeLevelRarityPrice(this);
  this.system.level.value = level;
  this.system.traits.rarity = rarity;
  this.system.price.value = price;
  ```
- `physical/helpers.ts:38`: `const basePrice = materialValue > 0 || runeValue > 0 ? new Coins() : item.price.value;`
- `physical/helpers.ts:39`: `const gradeValue = item.isSpecific ? 0 : getGradeData(item).price;`
- `physical/helpers.ts:61`: `const level = Math.max(...runesData.map((r) => r.level), materialData?.level ?? 0, gradeData.level, item.level);`
- `physical/helpers.ts:88`: `const price = gradeData.credits / 10; // convert to gp`
- `config/index.ts:789-812`: `weaponImprovements` (tactical `{ level: 2, tracking: 1, dice: 1, credits: 350 }`) and `armorImprovements` (tactical `{ level: 5, bonus: 1, resilient: 0, credits: 1600 }`). Every level and credits row for weapon, armor and shield matches `runes.mjs` `GRADE_LEVELS` and `GRADE_CREDITS_DELTA`.

Conclusion: `computeLevelRarityPrice` runs on every derived prep and reads the stored base `system.price.value` (helpers.ts:38) and `item.level`. It then adds the grade's credits (helpers.ts:39) and takes the max level including the grade level (helpers.ts:61). So a graded item that copies its base's own price and level is correct, because the system derives the graded values from them. Writing grade credits or a grade level into the stored data would double-count. PLAYBOOK §7's bullet ("Do not write `system.price`/`system.level` on a graded/runed item") is too broad: the copy is harmless, and the real rule is "do not write grade-derived values". The coordinator owns PLAYBOOK, so that edit is for them.

Inference, not checked live: that derived assignments do not change `_source` (DataModel behaviour; core JS is not public). The live check below covers it.

## Production findings and status

1. **W1, copied price/level** (`item-builder.mjs` `buildRunedItem`, the `toItemData(baseDoc)` line). Resolved as expected. No code path writes grade credits or a grade level. A comment cites the source. The bench check is now: the copied `system.price`/`system.level` equal the base document's.
2. **W2, silent slot-cap drop** (`item-builder.mjs` `normalizeRunedItemConcept`). Still a drop, now surfaced: one `console.warn` names the skipped upgrades (`no free upgrade slot on "…" (N slot)…; not installed: …`) and the preview shows a warning notice (`SIMPLYSF2E.ItemForge.UpgradesSkipped`, `itemforge-app.mjs` `#buildRunedPreviewContext`, template `preview.skippedNote`). The concept carries `skippedUpgrades`; `buildRunedItem` returns it on `preview.skippedUpgrades`.
3. **W3, grade twice in the name** (`item-builder.mjs` naming). Fixed. A `(Commercial)` base label is stripped and replaced by the chosen grade (`Grenade Launcher (Commercial)` at tactical → `Grenade Launcher (Tactical)`; with an upgrade → `Grenade Launcher (Commercial: <upgrade>)`). Bases labelled above commercial (Hardlight Handwraps (Tactical) and others, 6 weapons) are no longer offered (`runes.mjs` `getBaseItemCandidates`, `isPublishedAboveCommercial`). The grenade family (`Frag Grenade (Advanced)`, system.grade commercial) is excluded by the same name rule.
4. **W4, published-grade bases re-graded** (`item-builder.mjs` `buildRunedItem`). Partly fixed. A base published above commercial keeps its published grade and the build warns (`… is published at tactical grade; kept tactical instead of commercial`). The preview reports the grade actually built. A base whose level would come out above the GM's level is refused (`comes out at level N, above this item's level M`), because `normalizeRunedItemConcept` now carries `level`, which the app passes. Four unlabelled published bases are still offered to the AI: Caramel Cannon (tactical), Meme Cannon (advanced), Quantum Reaver (advanced), Reality Ripper (tactical). The index does not request `system.grade`, so the candidate list cannot exclude them. The full fix needs `system.grade` in `getEquipmentIndex` (`compendium.mjs:239`), which R6 did not change.
5. **Dead slot-parser path** (`runes.mjs:356`, `compendium.mjs:239`). Left alone, as the brief asked. `getEquipmentIndex` never requests `system.description.value`, so `parseUpgradeCapacity` always gets `""` and returns its default: 0 for armor, 1 for weapons. The parser also matches digits only, so prose such as "one upgrade slot" would not parse. This is the reason every armor upgrade is skipped and the reason the armor WARN class exists.

## Passes, with evidence

- **Passive rules are clones.** `rule-templates.mjs` clones each rule. The bench compares each created rule with the `sf2e.equipment` rule of its `sourceUuid`. Every rule checked in every case matched.
- **Published grades.** The grades on sf2e equipment items are the seven in `runes.mjs` `EQUIPMENT_GRADES`.
- **Upgrade usage gate.** Projectile upgrades appear only on `system.group === "projectile"` bases. The misfit control shows the drop with its warning in every case.
- **Macro escaping.** The item name reaches the macro escaped (`&lt;img`).
- **No AI numbers.** The stub's output contains no number in any case.
- **Candidates.** No base offered to the AI is named for a non-commercial grade (checked per runed case).

## Unverified (live Foundry needed)

- That the system derives a graded weapon's price and level from the copied base values, and that `_source` keeps them (the inference above).
- That the Forge preview's upgrade notice reads correctly in a live Foundry window (the screenshot harness only renders it from the fixture).
- Upgrade slot counts. No data offline (see item 5).
- Macros execute: the damage, heal and condition cards, the charge decrement, and the self-buff effect creation. The bench only compiles them.
- `CONFIG.PF2E.equipmentTraits` is not faked, so the unknown-trait drop in `normalizeMagicItemConcept` is not exercised.
- The cache is v14-dev `be4ab21`, with `system.sf2e.json` version 1.6.1. PLAYBOOK §2 cites the tag `sf2e-1.6.1`. Whether that tag points at `be4ab21` was not checked.

Live-check list (after a Create on each kind): a graded weapon's sheet price and level after reload match the system's computation (copied base values in, recomputed values out); a kept published grade (e.g. Caramel Cannon) shows its published grade on the sheet; an armor upgrade request shows the Forge notice and is not installed; the activation macro runs its damage card and decrements the charge.
