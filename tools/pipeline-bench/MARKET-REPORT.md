# Shop and Treasure bench: findings

Hand-written analysis of one run of `tools/pipeline-bench/market.mjs` against sf2e 1.6.1 (`foundryvtt/pf2e` v14-dev `be4ab21`, the pin in `tools/class-bench/cache/SOURCE.txt`). The bench changes no production file. Rerun it after a fix and compare the matrix; this report is not regenerated.

Run: `node tools/class-bench/fetch.mjs` once, then `node tools/pipeline-bench/market.mjs`. It covers 240 runs in under a second and exits 1 because of finding F1. Per-run detail is in `tools/pipeline-bench/out/market.json`.

## Scope

- **Shops:** levels 0, 1, 5, 10, 15, 20 × sizes small (8), standard (16), large (24) × categories weapons, armor, gear, consumables × rarity caps common, uncommon, rare = 216 runs.
- **Hoards:** levels 1, 4, 10, 20 × amounts encounter, level × rarity caps common, uncommon, rare = 24 runs. Every category is offered.
- **Real code:** `scripts/shop.mjs`, `treasure.mjs`, `currency.mjs`, `tables.mjs` and `compendium.mjs` (`getShopCandidates`, `getCandidateDocument`, `toItemData`, `priceToGp`). The packs come from the class-bench cache through its Foundry fake.
- **AI stub:** the first valid candidates in catalog order, preceded by one invented id (`c-bench-invented`) and followed by a repeat of the first. The module must drop the invented id and dedupe the repeat.
- **Mirrored, not run:** the step order of `shop-app.mjs` `#onGenerate` (207-276) and `treasure-app.mjs` `#onGenerate` (240-318) and `#onCreateTreasure` (344-362). Those classes are ApplicationV2 and do not load offline. The bench copies their steps one for one, and a drift in them would not be caught here.

## Matrix

Shop cells: `ok`, or `FAIL n/3` where n is the number of the three sizes that fail. The gear column also shows stock counts for small/standard/large. Hoard cells: `ok <items>i <percent of budget in items>`, or `FAIL (n)` with n problems.

**Shop, rarity cap common**

| level | weapons | armor | gear | consumables | gear stock s/m/l |
| --- | --- | --- | --- | --- | --- |
| L0 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L1 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L5 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L10 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L15 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L20 | ok | FAIL 3/3 | ok | ok | 8/16/24 |

**Shop, rarity cap uncommon**

| level | weapons | armor | gear | consumables | gear stock s/m/l |
| --- | --- | --- | --- | --- | --- |
| L0 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L1 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L5 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L10 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L15 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L20 | ok | FAIL 3/3 | ok | ok | 8/16/24 |

**Shop, rarity cap rare**

| level | weapons | armor | gear | consumables | gear stock s/m/l |
| --- | --- | --- | --- | --- | --- |
| L0 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L1 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L5 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L10 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L15 | ok | FAIL 3/3 | ok | ok | 8/16/24 |
| L20 | ok | FAIL 3/3 | ok | ok | 8/16/24 |

**Treasure hoard**

| level | encounter / common | encounter / uncommon | encounter / rare | level / common | level / uncommon | level / rare |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | FAIL (1) | FAIL (1) | FAIL (1) | FAIL (1) | FAIL (1) | FAIL (1) |
| L4 | FAIL (1) | ok 12i 35% | ok 12i 35% | FAIL (1) | ok 24i 6% | ok 24i 6% |
| L10 | ok 12i 4% | ok 12i 4% | ok 12i 4% | ok 24i 1% | ok 24i 1% | ok 24i 1% |
| L20 | ok 12i 0% | ok 12i 0% | ok 12i 0% | ok 24i 0% | ok 24i 0% | ok 24i 0% |

Totals: 178 pass, 62 fail. All 62 failures are the single check in F1.

Passing checks, all 240 runs: no throw; stock count equals min(size, offered) (8/16/24 for gear at every level); every stocked item is in the cache, at or below the shop or party level, within the rarity cap and in the category's types; the invented id is always reported as dropped; no duplicate stock; budgets match `tables.mjs` and the QA anchors (level 4: 680 for one encounter, 8,500 for the whole level); items plus Credstick equal the budget; Credsticks use the credstick template with the amount in `system.price.value`; shop actors are `type: "loot"`, `lootSheetType: "Merchant"`, and hoard actors are `lootSheetType: "Loot"`.

The rarity caps are exercised: the offered pools include uncommon and rare items (57 rare candidates across the rare-cap shop runs), and no stocked item breaks a cap. The stub picks cheap common items first: it never stocks a rare item, and stocks uncommon only in the uncommon and rare caps.

## Findings

### F1. Unpriced equipment is stocked at 0 credits (bug, fail-open)

Fifteen sf2e 1.6.1 equipment items have `system.price.value: {}` (or `{per, value: {}}`): Armored Copi Exoskeleton, Armplates, Atraxid Jewelry, Barathu Shell, Chitinous Plates, Chitinous Shield, Gnarefuroid Carapace, Hellforged Plates, Petrified Bark, Urog Shell, Vesk Scales, Scrimshaw Shard, Motion Sensors (Microwave), Genetic Backup, Mnemonic Editor (Advanced). Nothing checks for a price, so each one is offered to the AI, stocked, and sold or put in a hoard for 0 credits. That breaks the fail-closed rule (PLAYBOOK §3.5: drop with `console.warn`, never guess).

Causes:

- `scripts/compendium.mjs:75-84` `priceToGp` returns 0 for `{}`. A missing price and a free item look the same.
- `scripts/currency.mjs:59-62` `gpToCredits(0)` returns 0 (the `n <= 0` branch at line 61).
- `scripts/shop-app.mjs:262` prices each stocked row with `gpToCredits(priceToGp(...))` and has no has-price check.
- `scripts/treasure-app.mjs:284` does the same for hoard picks.
- `scripts/treasure.mjs:121-127` `fillHoard` rejects only a non-finite or negative price. Zero passes, so the item is pushed for 0 credits. The `unpriced` bucket is never filled for these items.
- `scripts/compendium.mjs:206-213` `getIndex` does not request `system.price`, and `getShopCandidates` (`compendium.mjs:781-811`) has no price filter. The AI therefore sees priceless items as candidates and spends slots on them. `getEquipmentIndex` (`compendium.mjs:229-245`) does request the price.

Scale: 54 of 216 shop runs (armor, all levels) and 8 of 24 hoard runs (levels 1 and 4, common). Shop armor fails in every cell.

Fix sketch:

1. Add `hasPrice(price)` to `currency.mjs`: true only when at least one of `pp`, `gp`, `sp`, `cp`, `credits`, `upb` in `price.value` is a finite number greater than 0.
2. In `shop-app.mjs` before line 262 and `treasure-app.mjs` before line 284: if `!hasPrice(doc.system?.price?.value)`, `console.warn` the name and `continue`. This drops the row and keeps the module's convention.
3. In `treasure.mjs` `fillHoard` (line 123), treat `price <= 0` as unpriced, so a zero-price candidate can never be pushed.
4. Better still, filter in `getShopCandidates` before the AI sees the list: build it from `getEquipmentIndex` (which already requests `system.price.value`), keep only `hasPrice` entries. That spends AI slots on sellable items.
5. Tests: a `treasure.test.mjs` case where a candidate with `credits: 0` lands in `unpriced`, and a `shop.test.mjs` or `currency.test.mjs` case for `hasPrice`.

Unverified live: that the 15 items really have no price in the running sf2e 1.6.1 system (the pack JSON says so, and the sheet may show a dash). A live check: at a level 3 armor shop, no stock row shows 0 cr, and the GM sees a warning for each dropped item.

### F2. Hoard budget ignores the rarity cap (design question, JT)

`treasure.mjs:54-57` `treasureBudgetCredits` always calls `treasureBudget(lv, "common", "standard")`. The Rarity control only caps candidates. The bench shows identical budgets for common, uncommon and rare hoards (for example 680 at level 4 for one encounter). `RARITY_TREASURE_MULTIPLIER` (`tables.mjs:179`) is used by the NPC generator and item builder but not by hoards. Whether an uncommon hoard should carry more is a balance call for JT, so this is not a code bug. QA 13h.3 is written for Common only.

### F3. Whole-level hoards can produce many Credstick rows (design question, JT)

The stub picks cheap items first, so hoards spend 0 to 35 percent of budget. At level 20, a whole-level hoard (4,900,000 credits) then carries 49 Credstick rows: `currency.mjs:142` caps one Credstick at 100,000 credits, and `treasure-app.mjs:352-357` splits the remainder onto several. The rows are correct, but the loot sheet is cluttered. Two things set the spend and are the real AI's to decide, not the stub's: `TREASURE_PICKS` (`treasure.mjs:29`, 12 encounter and 24 whole level) and the pick order. Common items at level 20 or lower reach 700,000 credits, so a 24-item hoard can spend a whole-level budget with the right picks. JT should decide whether to raise the pick cap, merge the Credstick rows, or accept the split.

## Not proved

- No live Foundry: no `Actor.create`, `verifyCreatedActor`, `moveToGeneratedFolder`, sheet, Reroll or preview. The shop and hoard steps are mirrors (see Scope), so a drift in the app would not be caught here.
- The AI is a stub. Spend, rarity mix and item variety in the matrix say nothing about real picks.
- Prices are the pack JSON's values, not the live system's prepared data (`priceToGp` and `gpToCredits` run on the raw source).

## Live check for JT

Run `docs/qa-checklist.md` 12z.2 and 13h.3, and at an armor shop, level 3, confirm no row shows 0 cr. Then compare one hoard's Credstick against the bench's budget line.
