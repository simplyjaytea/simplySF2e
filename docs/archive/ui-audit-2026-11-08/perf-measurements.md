# T-PERF report: measured optimisation candidates P1-P8

Worktree /root/sf2e-wt/T-PERF (work/T-PERF, packs 52dfeee, sf2e 1.7.0), node v26.8.2, 4 cores. No production file edited. All instrumentation ran on scratch copies under /tmp/claude-0/t-perf/ (wt/ = scripts+tools copy with wrappers; ui/ = repo copy for the harness). The bench runs I did in the worktree wrote gitignored output (creature-matrix.md, pipeline-bench/out); I deleted those; `git status` is clean.

Ranked verdicts at the bottom.

## P1 Compendium indexes per run: NOT WORTH IT

Claim in the plan (rebuilt per run) is wrong for the index; the cost is the per-call candidate scan, and it is small.

- Index caches are module-level and never cleared: `indexCache` compendium.mjs:189, `getIndex` :201-221, `equipmentIndexCache` :223, `getEquipmentIndex` :231, `getAllEquipmentEntries` memoised promise :257-259. `clearPlaceholderCache` (:899) is the only reset. Two pack.getIndex calls bypass it: art.mjs:38 and rule-templates.mjs:140.
- Method: /tmp/claude-0/t-perf/instrument.mjs renames each compendium function to `X__o` and re-exports a counting/timing wrapper (scratch copy /tmp/claude-0/t-perf/wt/scripts/compendium.mjs); the bench copies also wrap `pack.getIndex`/`getDocument` on the fake packs (tools/class-bench/env.mjs:42-50). Commands: `node tools/pipeline-bench/{creature --kinds npc --levels 5, forge, market}.mjs` in wt/. Raw: /tmp/claude-0/t-perf/perf-{creature,forge,market}.txt.
- creature (3 NPC runs + 1 encounter, 1.84 s wall incl. env load): `pack.getIndex` ran 4 times total (spells, glossary, feats, equipment), once per pack for the whole process, 69-81 ms combined (feats 47.7 ms, equipment 15.6, spells 9.7, glossary 1.9). `getIndex` was called 21 times, 17 were cache hits (~0 ms). No index is built twice.
- Per run (warm), calls and time: getSpellCandidates 1 (6-10 ms), getFocusSpellCandidates 1 (0.2-1 ms), getAbilityCandidates 1 (1.7-3.3 ms), getFeatCandidates 1 (1-1.7 ms), getEquipmentCandidates 1 (19-27 ms), getLootCandidates 1 (22-47 ms, calls getEquipmentCandidates, compendium.mjs:771-773), findEntry 1 (0.2 ms). About 60-90 ms of candidate scanning per run, 1% or less of one provider call. Cold first run adds the index builds above.
- placeholderState: 225 calls over 75 distinct entries (3 runs); first read ~2.5 ms each (document parse in the fake), repeats 0.2 ms (cache, compendium.mjs:857). getDocument: 80 calls, 75 distinct.
- forge bench (180 cases, 1.23 s): 3 `pack.getIndex` calls (equipment, three field sets: 7, 9, 14 fields), `getAllEquipmentEntries` 194 calls but one build (11 ms total), `findEntry` 134 calls, 78.6 ms (0.6 ms each; 13 distinct names, a name repeats up to 34 times).
- market bench (1.38 s): 1 `pack.getIndex` (20 ms), `getShopCandidates` 240 calls, 203 ms (0.85 ms each; 21 distinct arg sets, repeat up to 14).
- Expected gain of memoising candidate lists or `findEntry`: under 100 ms per run, and arguments (keywords) differ per real run so the hit rate in production would be near zero. Guard if ever done: creature bench 35 PASS / 2 WARN / 0 FAIL and forge/market matrices identical.

## P2 Prompt size: WORTH DOING (id encoding)

- Fixtures: tools/golden-replay/fixtures/*.json (20 files; replay.mjs FUNC_MAP :9-24). They carry tiny hand-written candidate lists, so they understate real size; I measured real sizes instead. `ai-candidate-format.mjs` only encodes PC feat slots (short `F0..` ids, :7-44); every other selector uses long opaque ids from `candidateId` (compendium.mjs:340-343: `c-` + base64(`<packId>\0<docId>`)).
- Method: /tmp/claude-0/t-perf/wt/tools/pipeline-bench/p2.mjs (bench with the real ai.mjs behind a capturing `fetch` stub; the bench AI answers so the pipeline continues) and p2b.mjs (shop, treasure, forge, reskin, PC calls with real candidate lists at level 5). Captures: /tmp/claude-0/t-perf/p2-capture.json, p2b-capture.json; analysis /tmp/claude-0/t-perf/p2-analyze.mjs. Tokens = `estimateTokens` (tokens.mjs:13-22, chars/4 plus JSON punctuation). Base64 ids tokenise worse than prose in a real BPE, so real tokens are higher than these.

Request body (JSON of the whole POST), level-5 NPC run, one request each:

| task | body chars | est tokens | system | user | ids share of user |
| --- | --- | --- | --- | --- | --- |
| generateConcept | 11136 | 2940 | 10273 | 161 | - |
| chooseSpellFocus | 1132 | 310 | 677 | 171 | - |
| selectSpells | 5435 | 1387 | 1380 | 3776 | 60% (57 ids) |
| selectCreatureAbilities | 8473 | 2140 | 884 | 7253 | 71% (74 ids) |
| selectCreatureFeats | 2319 | 603 | 872 | 1167 | 52% (16 ids) |
| selectEquipment | 7124 | 1808 | 1598 | 5246 | 59% (70 ids) |
| selectLoot | 5582 | 1424 | 1405 | 3894 | 54% (48 ids) |
| designEncounter | 1021 | 278 | 605 | 148 | - |
| NPC run total (7 calls) | 41201 | 10612 | | | |

Other tasks (same method): shopConcept 1168 / 317; shopStock(16 of 71 offered) 5721 / 1453; treasureConcept 1058 / 288; treasurePicks(12 of 71) 5834 / 1481; magicItemConcept 5281 / 1429; runedItemConcept(weapon, 128 bases, 17 runes) 4187 / 1070; reskin 1612 / 431; pcConcept 7567 / 1964; pcFeats (6 slots, F-ids) 2605 / 673 (chars / est tokens). Not measured: ABC selection, character choices, PC spell selection, rerollPick, loot draft (need a staged PC; see Not measured).

Three largest contributors per task:
- generateConcept: (1) the `loot` schema line 1684 chars (ai.mjs:194), (2) the `equipment` schema line 962 chars (ai.mjs:193), (3) the `feats` line 490 chars; the whole 10 KB system prompt is the cost, the user text is 161 chars.
- selectCreatureAbilities: (1) id column 5180 chars (base64 ids), of which 3626 are the identical pack prefix `c-c2YyZS5iZXN0aWFyeS1hYmlsaXR5LWdsb3NzYXJ5LXNyZAA...` (70% of the id), (2) names ~1500 chars, (3) system 884.
- selectEquipment: (1) `weapon:` row 2063 chars, (2) `equipment:` row 706, (3) `consumable:` row 614; ids are 3080 of 5246 user chars, 1540 of those are the repeated `c-c2YyZS5lcXVpcG1lbnQA` prefix.
- selectLoot: rows `consumable` 630, `equipment` 628, `weapon` 584; ids 2112 of 3894, prefix 1056. 22 of its 48 names are also in the equipment list sent one call earlier.
- selectSpells: `Available focus spells:` line 1205 chars, `Rank 1` 618, `Rank 3` 576; ids 2280 of 3776, prefix 1026.
- shopStock/treasurePicks: ids 3124 of ~5070 user chars, prefix 1562.
- selectCreatureFeats: ids 608 of 1167, prefix 272.
- magicItemConcept 4643 and runedItemConcept 3832 and pcConcept 7000: fixed system schema text, no variable list worth cutting except the offered-effects line.

Totals for one NPC run: id strings = 13260 of 41201 body chars (32%); the repeated per-pack prefix inside them = 7520 chars (18% of the body, about 1900 tokens by the estimator, more under a real tokenizer). An encounter pays this per member (PLAYBOOK §5).

Prompt text the module never uses or contradicts:
- `GRADE_NAME_NOTE` (ai.mjs:100) and the spell/equipment system prompts (ai.mjs:630, :759) say "copy each name EXACTLY" while the schema asks for `id` (ai.mjs:760). The model never needs to copy a name; wording is stale (token cost small, confusion risk only).
- NPC concept schema asks for `"value"` on every `equipment` and `loot` line (ai.mjs:193-194). Under `exactContent` an unmatched line is dropped (builder.mjs:1128-1148, :682-750) and the selector writes `value: 0` for picks; `equipment[].value` is only read by the PC wealth path (`equipmentValueGp`, builder.mjs:1162, generator-app.mjs:1504). Treat the NPC `equipment` value request as probably dead; loot `value` still prices Credits lines. Needs a code-owner confirm before cutting.
- Verdict: worth doing. Replace the per-run `c-<base64 pack+doc>` ids shown to the model by short per-request ids (`E1..`, as `encodeFeatCandidateSlots` already does for PC feats, ai-candidate-format.mjs:7-44) with a local map back to the issued ref; keep `isIssuedCandidate` identity (compendium.mjs:359-363) for resolve. Saves up to 13.2k chars (~32%) per NPC run; the minimum variant (strip only the constant pack prefix) saves 7.5k (18%). Touches Jev too (jev-picks.mjs:122, :144-162 key on `candidate.id`), so plan it as its own task.
- Guard: `node scripts/golden-replay.test.mjs` (incl. negative-forged-candidates), scripts/ai-fuzz.test.mjs, ai.creatureFidelity/ai.creatureGrounding/ai.forgeContract tests, creature bench 35/2/0, plus a new assertion that the request body contains no `c-` base64 and the same picks resolve.

## P3 Pool concurrency: NOT WORTH IT (cannot be reached)

- Code: `ENCOUNTER_CONCURRENCY = 3`, `encounterConcurrency` pool.mjs:12-21, `runPool` :36-56; used once at creature-pipeline.mjs:427.
- Decisive fact: `composeEncounter` returns at most two members (a boss group plus one minion group; the minion `count` is copies of one concept, not extra pool tasks), encounter.mjs:54, :64-72. Sweep of threat x party size 1-8 x party level 1-20: 678 compositions, 262 with 1 member, 416 with 2, max 2 (/tmp/claude-0/t-perf/members.mjs). Width 3 never saturates, so 4 and 8 member encounters do not exist in production and widths 4 and 6 gain nothing.
- Method: wt/tools/pipeline-bench/p3.mjs, production `generateEncounter` with every AI call sleeping 300 ms, scratch pool.mjs reads `PW` env for the width (`N=<members> PW=<width> node tools/pipeline-bench/p3.mjs`). A member makes 5 AI calls here (concept, abilities, feats, equipment, loot; plus 1 design call), 21 calls for 4 members, 41 for 8. Wall times:

| members | width 1 | width 3 | width 4 | width 6 |
| --- | --- | --- | --- | --- |
| 4 | 6626 ms | 3483 ms | 2007 ms | 2030 ms |
| 8 | 12763 ms | 5035 ms | 3618 ms | 3569 ms |

  Pure pool with one 300 ms task per member (no pipeline): 4 members 1202/601/301/300 ms, 8 members 2404/901/601/603 ms at widths 1/3/4/6. Arithmetic: wall = design call + ceil(members / width) x member chain. Width 4 would help only an encounter with 4 or more groups.
- Verdict: not worth it. Only a future composer that yields more than 3 groups changes this; revisit with plan §4 item 5 (cost profiles). The all-or-nothing rollback (creature-pipeline.mjs:420-455 onError abort, pool.mjs:41-53) is untouched.

## P4 generator-app.mjs split: WORTH DOING as a maintainability task, staged, with test edits

- File is 2451 lines (`wc -l`), one class, 90 methods covering 2032 lines. Biggest: `#generatePC` 286 (1277-1562), `#createCharacterActor` 135 (1769-1903), `_prepareContext` 103 (229-331), `#createEncounterActors` 85 (1935-2019), `#runGenerationSteps` 79 (1130-1208), `#onRerollPick` 73, `#onCreateActor` 69, `#buildPreviewContext` 62 (729-790), `#buildRelevelContext` 58 (355-412), `#generateEncounter` 53, `_onRender` 51, `#readForm` 49. Script: inline python in this session; method line ranges above are from it.
- Context builders (lines): `_prepareContext` 229-331, `#buildReskinPreviewContext` 333-347, `#buildRelevelContext` 355-412, `#multiclassPickerContext`/`#multiclassPreview` 425-441, `#archetypePlacementContext` 451-490, `#buildPCPreviewContext` 492-533, `static #pcFeatRows/#emptyFeatSlots/#featSlotLabel/#skillName` 537-557, `static #skillReportContext` 559-597, `static #statCheckContext` 606-620, `static #whisperStatCheck` 622-630, `static #completionContext` 633-646, `static #mapNamed/#mapSpells/#mapGear` 654-687, `#buildEncounterPreviewContext` 689-727, `#buildPreviewContext` 729-790, `#matchSummary` 802-808, `#buildRecentContext` 2378-2398. About 700 lines.
- What they share: (a) the row mappers `#mapNamed/#mapSpells/#mapGear` (used by creature and PC previews, :674 comment at :649-652) and `#matchSummary` (pure, 6 lines); (b) `adjustedStats(computeStats(c), c)` + `signed()` display strings (:704, :733); (c) `game.i18n` only; (d) private state read: creature preview `#concept`, `#resolved`; encounter `#encounter`; PC `#pcConcept`, `#pcResolved`; reskin `#reskinFlavor`, `#reskinSource`, `#reskinData`, `#reskinSources`; recent `#recent`; `_prepareContext` reads 13 fields. Static helpers (#map*, #skillReportContext, #statCheckContext, #completionContext, #pcFeatRows) read no instance state.
- Proposal, no behaviour change (pure functions taking the state as arguments; the class keeps the fields and calls them):
  - `scripts/generator-context/rows.mjs`: mapNamed, mapSpells, mapGear, matchSummary.
  - `.../creature-preview.mjs` (729-790), `.../encounter-preview.mjs` (689-727), `.../pc-preview.mjs` (492-557 plus 451-490, 559-597), `.../reskin-context.mjs` (333-347, 355-412), `.../result-context.mjs` (statCheck 606-630, completion 633-646, recent 2378-2398), `.../shell-context.mjs` (readiness, presets and model parts of `_prepareContext`, 229-300). Net: generator-app.mjs about 1750 lines; the pipeline methods (#generatePC, #createCharacterActor, #createEncounterActors) are the next, bigger split and need their own task.
- Risk found: 13 test files read `generator-app.mjs` as source text and rewrite private names (generator-app.matchSummary.test.mjs:16 `replace(/#(concept|resolved|buildPreviewContext|matchSummary)\b/g, "_test_$1")`; also uistate, goldshortfall, rerollPick, lootReroll, review, multiclass, ui.layout, i18n-keys, chat-command, builder.equipmentValueGp, builder.pcLootBudget, ai.pcSpells). A split breaks the ones that target moved methods; they need updating in the same PR (matchSummary, ui.layout, i18n-keys at minimum). `i18n-keys.test.mjs` also has to scan the new folder.
- Guard that proves it: `node tools/ui-preview/shoot.mjs` with the 27 `generator-*` fixtures (tools/ui-preview/fixtures/generator.mjs: generator-empty-encounter-no-party, -empty-attention, -jev-off, -readiness-open, -readiness-open-jev-off, -jev-key, -jev-typesafe, -two-connections, -busy-progress, -busy-no-progress, -error, -npc-negative, -encounter-preview, -character-empty-free-archetype, -character-review, -character-review-open, -character-review-clean, -recent-empty, -recent-preview, -created, -created-stat-problems, -created-stat-failed, -reskin-empty, -reskin-dropped, -reskin-relevel, -reskin-relevel-open, -reskin-preview) with exit 0 and missing-key check; all `scripts/generator-app.*.test.mjs` (9 files); golden replay; creature bench 35/2/0. Better guard: add a test that calls each extracted builder with the same state before and after and deep-equals the result (fixtures only check keys, not values).

## P5 Harness runtime: WORTH DOING (tools only), page pool 3.4x to 5x

- Baseline: `cd tools/ui-preview && npm install && npm install --no-save playwright@1.64.1 && time node shoot.mjs` in a scratch copy (/tmp/claude-0/t-perf/ui): 94 fixtures x 2 widths = 376 PNGs (plus 188 html), exit 0, no problems. Wall 2m55.6s (175.6 s), user 33.7 s, sys 10.4 s. 0.93 s per page at 188 pages; CPU is only 25% of wall, so it waits. The wait is `page.goto(..., { waitUntil: "networkidle" })` (shoot.mjs:77; Playwright networkidle waits 500 ms of quiet per page, which would be about 94 s of the 175 s by arithmetic, not separately timed) plus serial order.
- Feasibility: yes. Fixtures are independent: render is pure (render.mjs), the server is read-only, each page is a fresh `browser.newPage()` closed after use (shoot.mjs:74, :120), `problems` is a shared array (safe in one thread), the only ordering dependency is console `ok` lines. Scratch variant: /tmp/claude-0/t-perf/ui/tools/ui-preview/shoot-pool.mjs (queue + N workers over fixtures, nothing else changed). Results on 4 cores: CONC=4 52.2 s (3.4x), CONC=8 35.4 s (5.0x). Saving about 2 min per run; `release-check.sh` and every UI PR run it.
- Output identity: file set identical (376 PNG). Pixels are not byte-identical to the serial run for animated fixtures (busy/progress/relevel-open etc., 28 PNGs differed between two pool-4 runs; a serial rerun of generator-busy-no-progress@460 also differed from the earlier serial run), because sheen/blink animations are not frozen. So the "identical PNG set" guard must mean same names, same exit code, same problem list; a pixel diff needs `animation: none` in the harness first (cheap, would also make future diffs useful).
- Verdict: worth doing. Gain 175 s to about 50 s (CONC=4) or 35 s (CONC=8); also try `waitUntil: "load"` plus `document.fonts.ready` to cut the 500 ms idle (not measured; could change pixels if a font/icon loads late). Guard: exit 0 on the full run, same 376 names, same problems output.

## P6 Duplicated CSS: WORTH DOING only inside the U4 token pass

- Method: python rule extractor over styles/*.css and styles/apps/*.css (comments stripped; rule body normalised and sorted; naive but nested `@container` rules are matched). 94,394 bytes of CSS, 3404 lines.
- Rule blocks per file: simplysf2e.css 161, generator.css 147, welcome 39, provider-setup 35, sources 27, treasure 24, shop 22, manage-presets 13, itemforge 12, whats-new 9.
- Exact-duplicate declaration sets (same body in 2+ rules, body over 25 chars): 36 sets covering 89 rules, 34 sets across files. Rules inside such sets per file: generator 20, treasure 16, shop 15, simplysf2e 15, provider-setup 9, welcome 5, sources 4, manage-presets 2, whats-new 2, itemforge 1. Merge saves about 3.2 KB (3.4% of CSS).
- Concrete repeats: shop-stock and treasure-items tables are copies (thead th, th/td, table, wrap, last-child: shop.css vs treasure.css, 5 sets); window root flex column (`.simplysf2e-manage-presets/-sources/-whats-new/-generator`, 4 rules, 90 chars); provider-setup and welcome section `legend` (366-char body, identical); `color: var(--spf-text-muted); font-size: var(--spf-text-sm)` x5 (generator `.spf-recent-detail`, `.spf-relevel-unchanged > summary`, provider-setup `.spf-fold-state`, treasure `.spf-treasure-each`, ...); `color: var(--spf-text-muted)` alone x6; focus ring (generator `.spf-mode-toggle label:focus` vs simplysf2e `:is(button, input...)`).
- Selectors by family: hint 9 rules (itemforge 2, provider-setup 2, shop, sources, treasure, welcome, simplysf2e 1 each), legend 4 (provider-setup, sources, welcome, simplysf2e), note 4 (generator, welcome, whats-new 2), tag 3 (generator), frame 1 (sources), card 5 (simplysf2e).
- Raw colour literals outside `--spf-*` token definitions (hex or rgb): simplysf2e.css 23, generator.css 8, whats-new 2, manage-presets 2, sources 2, itemforge 1, provider-setup 1, welcome 1, shop 0, treasure 0 (total 40). `color-mix(` uses: generator 25, simplysf2e 44 (some embed `#0c1620`: 6 in generator, 5 in simplysf2e). `#9edae6`, `#1d3c53`, `#e8f6fa` repeat 4-6 times in simplysf2e.css. Token-use baseline: `var(--spf` 255 in simplysf2e.css, 221 in generator.css.
- Verdict: worth doing as part of U4 (tokens for literals S9), not alone: bytes saved are small, and shared rules need one place (simplysf2e.css) so per-window files keep only differences. Guard: ui-preview run, PNG diff (with animations frozen per P5) shows no change except intended; ui.layout.test.mjs.

## P7 Per-render localize/structuredClone: NOT WORTH IT

- Static count (script in this session over `scripts/*-app.mjs`): whole-file `i18n.localize|format` call sites: generator 107, itemforge 19, provider-setup 17, treasure 17, manage-presets 16, shop 15, welcome 8, sources 5, whats-new 4. `structuredClone`/`deepClone` in app files: 2, both in create handlers, not render: shop-app.mjs:303 and treasure-app.mjs:349 (`deepClone(row.itemData)` per stock row at Create). Zero in any `_prepareContext`.
- Per render, in `_prepareContext` and its builders: Generator `_prepareContext` 229-331: 4 sites (apiKeyWarning :237 area, promptPlaceholder, plus `localize(p.nameKey)` per standard preset :273 and archetype preset :278); loops are over 8 standard + 4 archetype presets (measured `presetPickerGroups`), so about 14 calls. `#buildRelevelContext` 2 format per ability line (:409-410); `#skillReportContext` 5 (:570-592); `#buildPCPreviewContext` 3 (:519-524, none per candidate); `#buildRecentContext` 2 per entry, `RECENT_LIMIT = 5` (recent-generations.mjs:11); `_buildTokenReport` (app-base.mjs:282-348) 1 format per recorded step; What's new 2 per note, 21 notes in `RELEASE_NOTES` so up to 42 in the manual view (whats-new-app.mjs:53-59, :58-59). Others 1-5.
- None runs over a candidate list (candidate lists never reach a context builder; previews iterate resolved picks, tens of rows). Worst case about 60 lookups per render, each a dictionary lookup in Foundry's `game.i18n`.
- Not measured: actual Foundry `localize` cost (needs a live world); a lookup is microseconds, so the render total is well under 1 ms. Verdict: not worth it. A per-render memo has no measurable payoff and would add state.

## P8 Resolve/build double work: NOT WORTH IT (nothing safe or useful to cache)

- What both compute (builder.mjs): (1) module templates: `resolveAbilityPick` dry-runs `buildModuleTemplate` (:973) and `createActor` calls it again (:1764); (2) fillable blank glossary abilities: `fillDryRunBlocker` runs `fillBlocker` + `fillPlaceholderAbility(toItemData(doc), ...)` with placeholder `1d4` damage (:952-966, called :998-1000) and `createActor` fills again with real strike damage (:1784-1789); (3) `computeStats` at create (:1709) and at every preview render (generator-app.mjs:704, :733) and in stat check (stat-check.mjs:27); (4) `completionManifest` once per resolve (creature-pipeline.mjs:384, :469) and again after reroll (generator-app.mjs:2196, :2277) and for characters (:1543). The dry run is the PLAYBOOK §8 "dry-run the build function at resolve" rule, intended.
- Counts in the creature bench (scratch wrappers, `node tools/pipeline-bench/creature.mjs`, P8 line): full bench (36 runs + encounter): resolveConcept 38, completionManifest 38, computeStats 38 (bench's own band checks), adjustedStats 36, resolveAbilityPick 18. So one resolve, one manifest and one stats per creature. `buildModuleTemplate` and `fillPlaceholderAbility` were 0 calls: the bench stub takes the first glossary candidate, which is never a fillable blank or a template, so the double work is not exercised by the bench. The bench also never calls `createActor`.
- Cost measured directly (wt/tools/pipeline-bench/p8.mjs, real data, 200-20000 iterations): the 7 fillable blanks (Constrict, Engulf, Frightful Presence, Greater Constrict, Stench, Swallow Whole, Trample): resolve dry run 17-46 us, build fill 12-30 us; `buildModuleTemplate` area-blast 2.9 us, aura 2.2 us; `computeStats` NPC 12.9 us; `completionManifest` 0.5 us. Per creature the duplicated work is under 0.5 ms.
- Cacheable without breaking §8: the document parse behind the dry run is already cached (`placeholderDocs`, compendium.mjs:860, :889; comment "without a second pack read (FIX-B5)"). Caching the dry-run result itself would break the point: the dry run must call the same function with the same inputs as the build, and inputs differ (placeholder damage vs real). Do not cache.
- Guard if anyone tries: creature bench 35 PASS / 2 WARN / 0 FAIL (verified on the unmodified code), builder.* and ability-fill/ability-templates tests, reroll.resolve.test.mjs.

## Not measured

- Real tokenizer counts and real-model behaviour for shorter ids (needs a provider; estimator only).
- PC-path prompts beyond pcConcept and selectFeats (ABC selection, character choices, PC spell plans, rerollPick, loot draft): need a staged PC; not built here.
- Live Foundry costs: `game.i18n.localize`, `pack.getIndex` against core (core caches indexes itself), real render time.
- Create-time (createActor) timings and call counts: the creature bench never calls createActor (README "What it does not prove").
- `waitUntil: "load"` for the harness (would change timing/pixels; not tried). Serial-vs-serial pixel noise rate (needs two more 3-minute runs).
- Real provider latency/rate limits for concurrency; stub is fixed 300 ms.
- CSS counts come from a naive parser (nested rules matched, `@media`/`@container` wrappers not tracked); treat counts as +-10%.

## Final ranking (gain per risk)

1. P5 harness page pool: 175 s to 35-52 s per UI run, tools only, no module risk. Do first; freeze animations in the same change if pixel diffs are wanted.
2. P2 short per-request candidate ids: 18-32% of every NPC/shop/treasure selector body, per member in encounters; also cuts a constant prefix the model never uses. Own task; touches Jev and the issued-candidate checks, so needs a review ladder pass.
3. P4 generator-app split (context builders first, ~700 lines): maintainability only; do after U1/U2 UI batches land, update the 13 source-reading tests in the same PR.
4. P6 CSS dedupe: 3.2 KB and 40 colour literals; fold into U4 token work, not a task of its own.
5. P1, P7, P8: not worth it (under 100 ms, under 1 ms, under 0.5 ms per run). P3: not reachable (max 2 encounter groups, width 3 already covers it).
