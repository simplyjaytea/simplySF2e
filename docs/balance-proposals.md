# Balance proposals for JT

These are proposals, not implemented decisions. Bench results are offline and do not prove behavior on a Foundry sheet.

1. **Feat candidates:** JT approved comparing 8 and 16. On the pinned sf2e 1.6.1 cache with PF2e duplicates, the 80-run deterministic bench had 49 PASS / 31 WARN under both settings. Runs with an empty archetype slot increased from 11 to 14; unresolved slots increased from 39 to 62, and the sum of issued candidates across 1,102 slots increased from 14,331 to 15,514. The overall per-slot ceiling stayed 16. The bench picks the first candidate, not a real model, and did not measure live token cost or latency. **Recommendation: keep 8**, investigate candidate ordering and dependency-aware selection before raising it. The bench also found only 13 provably legal general/skill feats for 15 Mystic slots in one level-20 case even with caps raised.
2. **Credstick count:** JT approved investigating a limit high enough for one level-20 whole-level leftover. The current 100,000-credit limit produces 49 rows in the bench. In [sf2e 1.6.1's `PriceField`](https://github.com/foundryvtt/pf2e/blob/sf2e-1.6.1/src/module/item/physical/schema.ts), the denomination field is an integer with `min: 0` and no explicit maximum. That does not establish a safe practical maximum or live sheet behavior; retain a finite module ceiling and verify the whole create and merchant flows before choosing it.
3. **Hoard rarity — decided 2026-10-31:** JT chose to keep the budget independent of the rarity cap. The control limits what items may appear; it does not increase party wealth.

Evidence: `tools/class-bench/REPORT.md` and `tools/pipeline-bench/MARKET-REPORT.md`.
