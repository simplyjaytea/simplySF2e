# Shop and Treasure bench: findings

Hand-written analysis of `tools/pipeline-bench/market.mjs` against sf2e 1.6.1 (`foundryvtt/pf2e` v14-dev `be4ab21`, the pin in `tools/class-bench/cache/SOURCE.txt`). The bench changes no production file. Rerun it after a fix and compare the matrix; this report is not regenerated.

Run: `node tools/class-bench/fetch.mjs` once, then `node tools/pipeline-bench/market.mjs`. It covers 240 runs in under a second. Per-run detail is in `tools/pipeline-bench/out/market.json`.

## Headline

R5 (branch `simplyjaytea/m-r5`, base `batch/m2-m4`): **240 of 240 runs pass; the bench exits 0.** HC (branch `simplyjaytea/fix-hc`, base `batch/m2-m4`) makes the hoard create step mirror `treasure-app.mjs` exactly. The matrix is unchanged; the Credstick counts are now the app's.

- F1 (unpriced equipment stocked at 0 credits): fixed. Unpriced items are left out of shop and hoard candidates before the AI sees them.
- F3 (several Credstick rows per hoard): by design. The leftover is split at `CURRENCY_ITEM_MAX` (100,000 credits per Credstick), so only hoards above 100,000 credits get several Credsticks.
- F2 (hoard budget ignores rarity): not changed; a balance call for JT (see "Owner decisions needed").

Before R5 the bench exited 1 with 62 failing runs (178 pass, all 62 failures F1).

## Scope

- **Shops:** levels 0, 1, 5, 10, 15, 20 × sizes small (8), standard (16), large (24) × categories weapons, armor, gear, consumables × rarity caps common, uncommon, rare = 216 runs.
- **Hoards:** levels 1, 4, 10, 20 × amounts encounter, level × rarity caps common, uncommon, rare = 24 runs. Every category is offered.
- **Real code:** `scripts/shop.mjs`, `treasure.mjs`, `currency.mjs`, `tables.mjs` and `compendium.mjs` (`getShopCandidates`, `getCandidateDocument`, `toItemData`, `priceToGp`). The packs come from the class-bench cache through its Foundry fake, which returns only the fields a caller requests (as Foundry's `getIndex` does).
- **AI stub:** the first valid candidates in catalog order, preceded by one invented id (`c-bench-invented`) and followed by a repeat of the first. The module must drop the invented id and dedupe the repeat.
- **Mirrored, not run:** the step order of `shop-app.mjs` `#onGenerate` (207-276) and `treasure-app.mjs` `#onGenerate` (240-318) and `#onCreateTreasure` (344-362). Those classes are ApplicationV2 and do not load offline. The bench copies their steps one for one, and a drift in them would not be caught here. The hoard create step (`treasure-app.mjs` 352-355) is mirrored the same way.

## Matrix (after R5)

Shop cells: `ok`, or `FAIL n/3` where n is the number of the three sizes that fail. The gear column also shows stock counts for small/standard/large. Hoard cells: `ok <items>i <percent of budget in items>`, or `FAIL (n)` with n problems.

**Shop, rarity cap common**

| level | weapons | armor | gear | consumables | gear stock s/m/l |
| --- | --- | --- | --- | --- | --- |
| L0 | ok | ok | ok | ok | 8/16/24 |
| L1 | ok | ok | ok | ok | 8/16/24 |
| L5 | ok | ok | ok | ok | 8/16/24 |
| L10 | ok | ok | ok | ok | 8/16/24 |
| L15 | ok | ok | ok | ok | 8/16/24 |
| L20 | ok | ok | ok | ok | 8/16/24 |

**Shop, rarity cap uncommon**

| level | weapons | armor | gear | consumables | gear stock s/m/l |
| --- | --- | --- | --- | --- | --- |
| L0 | ok | ok | ok | ok | 8/16/24 |
| L1 | ok | ok | ok | ok | 8/16/24 |
| L5 | ok | ok | ok | ok | 8/16/24 |
| L10 | ok | ok | ok | ok | 8/16/24 |
| L15 | ok | ok | ok | ok | 8/16/24 |
| L20 | ok | ok | ok | ok | 8/16/24 |

**Shop, rarity cap rare**

| level | weapons | armor | gear | consumables | gear stock s/m/l |
| --- | --- | --- | --- | --- | --- |
| L0 | ok | ok | ok | ok | 8/16/24 |
| L1 | ok | ok | ok | ok | 8/16/24 |
| L5 | ok | ok | ok | ok | 8/16/24 |
| L10 | ok | ok | ok | ok | 8/16/24 |
| L15 | ok | ok | ok | ok | 8/16/24 |
| L20 | ok | ok | ok | ok | 8/16/24 |

**Treasure hoard**

| level | encounter / common | encounter / uncommon | encounter / rare | level / common | level / uncommon | level / rare |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | ok 8i 84% | ok 8i 84% | ok 9i 91% | ok 24i 51% | ok 24i 57% | ok 24i 51% |
| L4 | ok 12i 35% | ok 12i 35% | ok 12i 35% | ok 24i 9% | ok 24i 9% | ok 24i 9% |
| L10 | ok 12i 4% | ok 12i 4% | ok 12i 4% | ok 24i 1% | ok 24i 1% | ok 24i 1% |
| L20 | ok 12i 0% | ok 12i 0% | ok 12i 0% | ok 24i 0% | ok 24i 0% | ok 24i 0% |

The hoard percentages moved because the stub's first picks changed: the 15 unpriced items no longer take pick slots, so cheap priced items fill them instead.

Passing checks, all 240 runs: no throw; stock count equals min(size, offered); every stocked item is in the cache, at or below the shop or party level, within the rarity cap and in the category's types; the invented id is always reported as dropped; no duplicate stock; no unpriced item stocked; budgets match `tables.mjs` and the QA anchors (level 4: 680 for one encounter, 8,500 for the whole level); items plus Credsticks equal the budget; the Credsticks sum to the leftover; every Credstick holds at most `CURRENCY_ITEM_MAX` and more than 0 credits; Credsticks use the credstick template with the amount in `system.price.value`; shop actors are `type: "loot"`, `lootSheetType: "Merchant"`, and hoard actors are `lootSheetType: "Loot"`.

The rarity caps are exercised: the offered pools include uncommon and rare items, and no stocked item breaks a cap. The stub picks cheap common items first: it never stocks a rare item, and stocks uncommon only in the uncommon and rare caps.

## Findings

### F1. Unpriced equipment is stocked at 0 credits (bug, fail-open): FIXED

Fifteen sf2e 1.6.1 equipment items have `system.price.value: {}` (or `{per, value: {}}`): Armored Copi Exoskeleton, Armplates, Atraxid Jewelry, Barathu Shell, Chitinous Plates, Chitinous Shield, Gnarefuroid Carapace, Hellforged Plates, Petrified Bark, Urog Shell, Vesk Scales, Scrimshaw Shard, Motion Sensors (Microwave), Genetic Backup, Mnemonic Editor (Advanced). Before the fix each one was offered to the AI, stocked, and sold or hoarded for 0 credits. That broke the fail-closed rule (PLAYBOOK §3.5).

What changed:

- `scripts/shop.mjs` `hasPositivePrice(priceValue)` (new export): true only when some denomination (`pp`, `gp`, `sp`, `cp`, `credits`, `upb`) is a number greater than 0. `{}`, zero, negative, NaN and non-objects are unpriced.
- `scripts/compendium.mjs` `getIndex` now requests `system.price.value`, so the shared index carries the price.
- `scripts/compendium.mjs` `getShopCandidates` drops unpriced entries before the duplicate check and before the ceiling. Candidate ceilings and ordering are unchanged. It emits one `console.warn` per call, with the count and names. Shop stock and hoard candidates both come from this function.
- `scripts/treasure.mjs` `fillHoard` treats `credits <= 0` as unpriced (defense in depth; the candidate filter already removes them).

Not changed: `shop-app.mjs:262` and `treasure-app.mjs:284` still price each row with `gpToCredits(priceToGp(...))`. With the candidate filter in place, a zero-price row cannot reach them.

Unverified live: that the 15 items really have no price in the running sf2e 1.6.1 system (the pack JSON says so; the sheet may show a dash). A live check: at a level 3 armor shop, no stock row shows 0 cr, and the console shows one warning listing the dropped items.

### F2. Hoard budget ignores the rarity cap (design question, JT): OPEN

`treasure.mjs` `treasureBudgetCredits` always calls `treasureBudget(lv, "common", "standard")`. The Rarity control only caps candidates. The bench shows identical budgets for common, uncommon and rare hoards (for example 680 at level 4 for one encounter). `RARITY_TREASURE_MULTIPLIER` (`tables.mjs:179`) is used by the NPC generator and item builder but not by hoards. Whether an uncommon hoard should carry more is a balance call for JT, so R5 changed no budget math. QA 13h.3 is written for Common only.

### F3. Several Credstick rows per hoard: BY DESIGN

`treasure-app.mjs` `#onCreateTreasure` splits the leftover with `splitCurrency` and makes one Credstick per part with `assembleCurrency("credits", part)`. The part cap is `CURRENCY_ITEM_MAX` (100,000 credits), a module sanity cap in `currency.mjs`, not a game rule. So several Credsticks appear only above 100,000 credits. Matrix leftovers and Credstick counts (`out/market.json`):

- L20 whole level: 4,899,512 to 4,899,539 credits left, 49 Credsticks (48 of 100,000 and one of 99,5xx).
- L20 one encounter: 391,760 credits left, 4 Credsticks.
- L10 whole level: 79,512 to 79,539 credits left, 1 Credstick. L10 one encounter: 6,160 left, 1 Credstick.
- L1 to L4 hoards: 1 Credstick each.

`checkHoard` fails a hoard when a Credstick is over `CURRENCY_ITEM_MAX` or the Credsticks do not sum to the leftover.

## Owner decisions needed

1. **F2 (JT):** should a Rare or Uncommon hoard carry a larger budget than a Common one? Today all three use the common standard budget. R5 did not change the math.
2. **F3 pick cap (JT):** `TREASURE_PICKS` (`treasure.mjs`, 12 encounter and 24 whole level) limits how many items the AI is asked for. A 24-item hoard can still spend little of a whole-level budget with cheap picks. Should the cap rise, or should the hoard hold more of the budget as Credsticks (as it does now)?
3. **F3 sheet size (JT):** a whole-level level-20 hoard is 49 Credsticks of 100,000 credits (one of 99,5xx). Confirm that is acceptable on the sheet. Raising `CURRENCY_ITEM_MAX` changes only the count, not the total.

## Open

- Live: run the hoard create path once with a whole-level level-20 hoard. `verifyCreatedActor(actor, { complete: true }, items)` checks the created items, so the 49 Credsticks must all verify.

## Not proved

- No live Foundry: no `Actor.create`, `verifyCreatedActor`, `moveToGeneratedFolder`, sheet, Reroll or preview. The shop and hoard steps are mirrors (see Scope), so a drift in the app would not be caught here.
- The AI is a stub. Spend, rarity mix and item variety in the matrix say nothing about real picks.
- Prices are the pack JSON's values, not the live system's prepared data (`priceToGp` and `gpToCredits` run on the raw source).
- Whether Foundry accepts a Credstick with up to 100,000 credits in `system.price.value.sp` (the value is only a number in the source; no sf2e validation was checked).

## Live check for JT

Run `docs/qa-checklist.md` 12z.2 and 13h.3. At an armor shop, level 3, confirm no row shows 0 cr and the console shows the dropped-item warning. Then create one whole-level level-20 hoard and confirm it holds 49 Credsticks that sum to the leftover (the bench's count for that hoard).
