# Item Forge bench report

Run of `node tools/pipeline-bench/forge.mjs` on the sf2e cache pinned at foundryvtt/pf2e v14-dev `be4ab21b` (`system.sf2e.json` version 1.6.1). Branch `simplyjaytea/m1-t3` at `498ed23`, the tip of `batch/m2-m4`. Production code was not changed.

## Verdict

**0 FAIL, 80 WARN, 84 PASS, 4 n/a** across 14 variants × levels 1, 3, 5, 8, 13, 18 × rarity common, uncommon (168 cases).

- Every passive rule is an unchanged clone of a real `sf2e.equipment` rule.
- Grades are published grades, offered at the item's level.
- Installed upgrades use only offered usages, and projectile upgrades appear only on `system.group === "projectile"` bases.
- No case throws.
- Macro bodies compile, and the item name reaches them escaped.
- The AI stub never emitted a number.

All 80 WARN cases trace to W1 to W4 below: graded-item data and the slot logic. None is a crash or an unescaped string.

## Matrix

| variant | L1 co | L1 un | L3 co | L3 un | L5 co | L5 un | L8 co | L8 un | L13 co | L13 un | L18 co | L18 un |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wondrous-passive | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| wondrous-1day-damage | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| wondrous-1day-condition | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| wondrous-1day-heal | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| wondrous-1day-selfbuff | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| augmentation | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| crystal | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| weapon-graded | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) |
| weapon-top-grade | WARN(2) | WARN(2) | WARN(3) | WARN(3) | WARN(3) | WARN(3) | WARN(3) | WARN(3) | WARN(3) | WARN(3) | WARN(3) | WARN(3) |
| weapon-projectile | n/a | n/a | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) | WARN(1) |
| weapon-published-grade | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) |
| weapon-projectile-misfit | n/a | n/a | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) |
| armor-graded | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) |
| armor-top-grade | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) | WARN(2) |

`co` = common, `un` = uncommon. The n/a cells are level 1: the first projectile-only upgrade is Impact Enhancer (Commercial), level 3 (`sf2e.equipment`).

## WARN causes

Each cause is one message; a case can hit several.

| cases | cause | where |
| --- | --- | --- |
| 80 | **W1.** Graded or runed items keep the base's `system.price` and `system.level`. The module writes them by copying the base document, not by computing them. PLAYBOOK §7 says never to write them. | `item-builder.mjs:299` (`toItemData(baseDoc)`); the installed upgrades are copied the same way at `item-builder.mjs:309-313` |
| 48 | **W2.** A requested upgrade beyond the base's slot count is dropped with no warning. Weapon-graded asks for two and gets one (base slots 1). Every armor case asks for one and gets none (armor slots 0). | `item-builder.mjs:230` (`maxSlots`), `:237` (`if (propertyRunes.length >= maxSlots) break;`) |
| 20 | **W3.** The name carries the grade twice. Some published bases already have a grade in the name, e.g. `Grenade Launcher (Ultimate)`, published `system.grade: "commercial"`. The forge then adds `(Ultimate: …)` to it. | `item-builder.mjs:327-338` |
| 12 | **W4.** A base published at a non-commercial grade is re-graded to the chosen grade. The 10 affected bases are in the pack: `Caramel Cannon` (tactical), `Quantum Reaver` (advanced), `Meme Cannon` (advanced), `Reality Ripper` (tactical), and six `Hardlight Handwraps (…)`. The result is a commercial copy of a tactical item. | `item-builder.mjs:301` (`data.system.grade = grade;`); candidates from `runes.mjs:347-358`, which filters only on `specific` |

### Why W2 and armor upgrades never install (not a single cause)

- **Dead description path.** `getBaseItemCandidates` parses upgrade slots from `e.description` (`runes.mjs:356`). `getAllEquipmentEntries` sets `description` from the index (`compendium.mjs:274`), but `getEquipmentIndex` never requests `system.description.value` (`compendium.mjs:239`). So the parser always gets `""` and returns the default. Measured: all 42 non-specific armor bases get 0 slots, all 238 non-specific weapon bases get 1.
- **The default does not fit the data.** Some real armor prose says "one upgrade slot" (Gnarefuroid Carapace, Pact Observer Armor, Stormbreaker Armor). `parseUpgradeCapacity` (`runes.mjs:84-90`) matches digits only, so prose would not parse even if the description arrived. Slot counts are not in the item JSON. PLAYBOOK §9 already lists them as uncited and on hiatus.
- **Armor upgrades are offered but cannot install.** `ARMOR_UPGRADE_USAGES` (`runes.mjs:101`) matches the 105 equipment items in the pack with usage `installed-in-armor`. Each one that is offered to the AI is then silently dropped at `item-builder.mjs:230-237`.

## Production findings with fix sketches

Nothing here is a FAIL. Each fix is a suggestion for JT to decide.

1. **W1, copied price/level** (`item-builder.mjs:299-301`, `309-313`). Fix sketch: after `data.system.grade = grade;`, `delete data.system.price; delete data.system.level;`, and the same for each `sub` built at `:309-313`. Confirm `Item.create` accepts the missing fields (they fall back to schema defaults). If PLAYBOOK §7 is the rule, this makes the code match it. If JT prefers the base snapshot, change §7 instead.
2. **W2, silent slot-cap drop** (`item-builder.mjs:237`). Fix sketch: `console.warn` the upgrade name before the `break`. This makes the drop visible and lets the bench stop reporting it as silent.
3. **Armor upgrades offered but never installable** (`runes.mjs:377-386`, `runes.mjs:356`, `compendium.mjs:239`). Fix sketch, in order of cost: (a) return no armor upgrade candidates while no armor base has a slot, so the AI is not offered what it cannot get; (b) add `system.description.value` to the index fields and teach the parser number words ("one upgrade slot"), so the description path works; (c) cite the real slot counts when JT wants them (PLAYBOOK §9).
4. **W3, grade twice in the name** (`item-builder.mjs:327-338`). Fix sketch: strip a trailing `(Grade)` from `baseDoc.name` before adding the grade label. Also exclude or re-grade the bases in W4.
5. **W4, published-grade bases** (`runes.mjs:347-358`, `compendium.mjs:239`). Fix sketch: request `system.grade` in the equipment index and skip, or keep the published grade for, bases whose published grade is not commercial. Today the forge silently overwrites it.

## Passes, with evidence

- **Passive rules are clones.** `rule-templates.mjs:169-200` clones each rule (`:191-192`). The bench compares each created rule with the rule of the `sf2e.equipment` item named by its `sourceUuid` (canonical JSON, key order ignored). Every rule checked in every case matched.
- **Published grades.** The grades on sf2e equipment items are exactly the seven in `runes.mjs:52-54`: commercial, tactical, advanced, superior, elite, ultimate, paragon.
- **Upgrade usage gate.** `runes.mjs:100-101` and `:110-112` define the allowed usages. `runes.mjs:120-123` allows the projectile usage only on group `projectile`. `item-builder.mjs:291-294` re-checks against the real base. The misfit control proves the drop: the projectile upgrade on a non-projectile base is removed with a warning in every case where it was offered.
- **Macro escaping.** `macro-templates.mjs:360` escapes the item name (`esc(item.name)`). The fixed `escHtml` in the macro header is at `macro-templates.mjs:103`. Every activation macro compiles, carries the escaped name (`&lt;img`, never `<img`), and each self-buff's embedded `RULES` match real rules.
- **No AI numbers.** The stub's output contains no number in any case; the bench checks this per case.

## Unverified (live Foundry needed)

- That the system recomputes price and level on graded items. PLAYBOOK §7 cites `physical/document.ts`, which is not in the pack cache.
- `GRADE_LEVELS` and `GRADE_CREDITS_DELTA` (`runes.mjs:56-76`) cite `src/scripts/config/index.ts`, which is not in the cache. They are not checked here.
- Macros execute: the damage, heal and condition cards, the charge decrement, and the self-buff effect creation. The bench only compiles them.
- Passive rules change the actor. No Rule Element runs here.
- Upgrade slot counts. No data offline (see above).
- The cache is v14-dev `be4ab21`, with `system.sf2e.json` version 1.6.1. PLAYBOOK §2 cites the tag `sf2e-1.6.1`. Whether that tag points at `be4ab21` was not checked.
- `CONFIG.PF2E.equipmentTraits` is not faked, so the unknown-trait drop in `normalizeMagicItemConcept` is not exercised.

Live-check list (after a Create on each kind): a graded weapon's sheet price and level after reload match the system's computation; an armor upgrade shows its slot cap in the sheet; the activation macro runs its damage card and decrements the charge.
