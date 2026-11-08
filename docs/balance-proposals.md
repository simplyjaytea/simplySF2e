# Balance proposals for JT

All three items are decided (recorded below). Bench results are offline and do not prove behavior on a Foundry sheet.

1. **Feat candidates — decided 2026-10-31: keep feat cap 8.** JT approved comparing 8 and 16. On the pinned sf2e 1.6.1 cache with PF2e duplicates, the 80-run deterministic bench had 49 PASS / 31 WARN under both settings. Runs with an empty archetype slot increased from 11 to 14; unresolved slots increased from 39 to 62, and the sum of issued candidates across 1,102 slots increased from 14,331 to 15,514. The overall per-slot ceiling stayed 16. The bench picks the first candidate, not a real model, and did not measure live token cost or latency. **Recommendation: keep 8**, investigate candidate ordering and dependency-aware selection before raising it. The bench also found only 13 provably legal general/skill feats for 15 Mystic slots in one level-20 case even with caps raised.
2. **Credstick count — decided 2026-11-08: CURRENCY_ITEM_MAX = 5,000,000.** JT approved investigating a limit high enough for one level-20 whole-level leftover. Investigation 2026-11-08 (bench pinned to sf2e 1.7.0, `52dfeee`; offline, no Foundry sheet or merchant flow).
   - **Largest leftover.** `scripts/tables.mjs` `TREASURE_BY_LEVEL` is cited to GM Core ("Party Treasure by Level", `scripts/tables.mjs:167-170`); its L20 entry is `490000` gp (`scripts/tables.mjs:194`, row `... 208000, 355000, 490000,`), and 1 gp = 10 credits. `scripts/treasure.mjs:50-52` says of the "level" amount: `"level" is the whole TREASURE_BY_LEVEL total ... Party size never changes it: the table is already per party.` The highest supported level is `TREASURE_MAX_LEVEL = 20` (`scripts/treasure.mjs:17`). So the largest hoard leftover, if the AI picks no items, is **4,900,000 credits = 490,000 gp** (`treasureBudgetCredits(20, "level")` returns 4900000). The largest single-encounter leftover at L20 is **392,000 credits** (`490000 / ENCOUNTERS_PER_LEVEL` = 490000 / 12.5 = 39,200 gp; `treasureBudgetCredits(20, "encounter")` returns 392000). Real hoards leave slightly less: the bench's L20 whole-level leftover is 4,899,512 to 4,899,539.
   - **Bench** (`node tools/pipeline-bench/market.mjs`, 24 hoard runs = levels 1/4/10/20 x encounter/level x common/uncommon/rare; all 240 runs PASS and exit 0 at every setting; one unsaved run by the worker. Reviewers reproduced the 100,000 row (177 / 49) and the arithmetic of the other rows agrees with the measured leftovers). `CURRENCY_ITEM_MAX` and the literal in `currencyQuantity` set together, then reverted:

     | `CURRENCY_ITEM_MAX` | Credstick rows, all 24 hoards | Max rows in one hoard | L20 whole level | L20 encounter |
     | --- | --- | --- | --- | --- |
     | 100,000 (current) | 177 | 49 | 49 | 4 |
     | 250,000 | 84 | 20 | 20 | 2 |
     | 1,000,000 | 36 | 5 | 5 | 1 |
     | 4,900,000 | 24 | 1 | 1 | 1 |

   - **Everything that depends on the 100000 cap or `CURRENCY_ITEM_MAX`** (the one change must touch or re-check all of these):
     - `scripts/currency.mjs:113` literal `100000` in `currencyQuantity` (NPC loot coin line clamp).
     - `scripts/currency.mjs:138-142` the constant and its comment; `:144-155` `splitCurrency`; `:162` `assembleCurrency` clamp.
     - `scripts/treasure-app.mjs:352-355` hoard Create: `splitCurrency(hoardLeftover(...))`, one `assembleCurrency("credits", part)` per part.
     - `scripts/builder.mjs:790` and `:800` literal `100000` in `applyTreasureBudget` (NPC treasure-budget credit padding; two more literals besides `currency.mjs:113`, none tied to the constant). Raising the constant alone breaks nothing here; lowering it below 100,000 without touching them would truncate at `assembleCurrency`.
     - `scripts/currency.test.mjs:8, 77-78, 112-113` (import, `1e9` caps at `100000`, `splitCurrency` cases; `:77-78` hardcode `100000` and must be edited, not only re-run; `:113` already sums `splitCurrency(4900000)`).
     - `scripts/builder.coins.test.mjs:83` uses `currencyQuantity` (no literal cap; re-run).
     - `tools/pipeline-bench/market.mjs:168-206` (reads `CURRENCY_ITEM_MAX`; asserts one stick per part and `sp <= CURRENCY_ITEM_MAX`).
     - `tools/pipeline-bench/MARKET-REPORT.md:12, 73, 100-113, 124` (F3 "by design", the 49-stick figure, the 100,000 wording).
     - `README.md:275` ("One Credstick holds at most 100,000 credits").
     - `docs/balance-proposals.md` (this item).
     - `lang/en.json`: no match for the cap or `100000`; `templates/` and `CHANGELOG.md`: no match.
     - Unrelated `100000` hits (not this cap): `scripts/runes.mjs:82` (rune price), `scripts/tables.mjs` table rows.
   - **What the v14-dev schema establishes.** `src/module/item/physical/schema.ts` lines 8-16 (branch v14-dev, fetched 2026-11-08; the bench pin `52dfeee` is sf2e 1.7.0 on that branch): `class PriceField extends fields.SchemaField<PriceSchema, ...> { constructor() { const denominationField = (): fields.NumberField<number, number, false, false, false> => new fields.NumberField({ required: false, nullable: false, integer: true, min: 0 }); super({ value: new PrunedSchemaField(R.mapToObj(COIN_DENOMINATIONS.toReversed(), (d) => [d, denominationField()]), { required: true, nullable: false }) ...`. So a denomination is an integer >= 0 with no schema maximum. It says nothing about sheet display or the merchant purchase flow, and nothing here claims it does.
   - **Verified against v14-dev (fetched 2026-11-08):** the excerpts below are the coordinator's fetch, quoted as given and not re-fetched for this change. No stored amount has a maximum in sf2e; the module's cap is the only one.
     ```
     src/module/item/physical/coins.ts:26-31 (constructor):
     for (const denomination of CURRENCY_DENOMINATIONS) { this[denomination] = Math.max(Math.floor(Math.abs(object[denomination] ?? 0)), 0); }
     ```
     ```
     src/module/item/physical/coins.ts:159-161 (toString, sf2e):
     } else if (SYSTEM_ID === "sf2e" || unit === "credits") { const value = Math.ceil(this.copperValue / 10); return short ? String(value) : `${value} ${_loc("PF2E.CurrencyAbbreviations.credits")}`;
     ```
     ```
     src/module/item/treasure/document.ts:36-39 (prepareBaseData):
     if (unit === "credits" || unit === "upb") { this.system.price.value = new Coins({ [unit]: Math.ceil(this.price.value.copperValue / 10) }); }
     ```
     ```
     src/module/actor/inventory/index.ts:105-108 (addCurrency merge):
     const newPrice = item.system.price.value.plus({ credits: quantity }); updates.itemUpdates.push({ _id: item.id, "system.price.value": newPrice.toObject() });
     ```
     ```
     src/module/actor/inventory/index.ts:124:
     source.system.price.value = { pp: undefined, gp: undefined, sp: quantity, cp: undefined };
     ```
     ```
     src/module/actor/sheet/base.ts:343-344:
     totalCurrency: coins.plus({ sp: currency.credits + currency.upb }).toString({ decimal: true }), totalWealth: totalWealth.toString({ decimal: true }),
     ```
     Conclusion: there is no cap in the system, so a Credstick's credits are `Math.ceil(copper / 10)` of its stored `sp` and `sp: N` reads back as N credits at any size. Prices and wealth totals print as plain digits plus "credits". The merchant purchase path and the Credstick sheet display are not covered by these excerpts.
   - **Recommendation (accepted): keep a finite cap and set `CURRENCY_ITEM_MAX = 5,000,000`.** It is a round value just above the 4,900,000-credit maximum leftover (about 2% headroom, so a table change would need a new cap), so every supported hoard is exactly one Credstick, while the module still refuses an absurd amount (the cap stays a sanity limit: a table or call-site error cannot write 1e9; the AI never sets this number). The trade-off is that one stick then holds up to 4.9M credits and an unverified sheet or loot path would see one large number instead of many small ones; if JT prefers to hedge against that, 1,000,000 (5 rows at L20 whole level, 1 at encounter size) is the fallback. The display and storage questions were settled by the v14-dev excerpts above before the decision. Still unverified live: a single 4,900,000-credit Credstick on a Foundry sheet (QA 13h.6).
3. **Hoard rarity — decided 2026-10-31:** JT chose to keep the budget independent of the rarity cap. The control limits what items may appear; it does not increase party wealth.

Evidence: `tools/class-bench/REPORT.md` and `tools/pipeline-bench/MARKET-REPORT.md`.
