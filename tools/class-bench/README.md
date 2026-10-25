# Class test bench

An offline diagnostic. It runs the **real** player-character pipeline from `scripts/` against the **real** sf2e compendium JSON and reports, per class, level and Free Archetype setting, what throws or silently ends up empty. It reports findings; it fixes nothing and changes no production file.

```
node tools/class-bench/fetch.mjs      # once: download the sf2e packs (about 5,000 small files, under a minute)
node tools/class-bench/run.mjs        # 8 classes x levels 1, 2, 5, 10, 20 x Free Archetype off/on = 80 runs, under a second
node tools/class-bench/audit-prereqs.mjs   # optional: which feat prerequisite clauses can the parser never prove?
```

Node 22+. No install step, no Foundry.

## What it does

- `fetch.mjs` reads the PF2e monorepo branch `v14-dev` at one commit, pins that commit SHA in `cache/SOURCE.txt`, and downloads every `Item` pack listed in `system.sf2e.json` (`packs/sf2e/<pack>/**`). It uses one GitHub API call for the commit, one for the file tree, and plain `raw.githubusercontent.com` downloads (24 at a time) for the files. It is resumable and wipes the cache if the pinned SHA changes. Options: `--sha <sha>` to pin a commit, `--concurrency <n>`, and `GITHUB_TOKEN` in the environment to lift the API rate limit. All Item packs are fetched (not only `DEFAULT_PACKS`) because grants are resolved with `fromUuid` across packs. It also fetches the PF2e documents the sf2e build copies into those packs (see "Duplicated PF2e content").
- `env.mjs` fakes only Foundry globals: `game.packs` (index with the same field projection as `getIndex`, `getDocument` by id or by name, as sf2e's `Compendium.sf2e.class-features.Item.<name>` uuids need), `fromUuid`, `game.settings` (the `sourcePacks` and `freeArchetype` settings), `game.i18n`, `foundry.utils.randomID`, `CONST`, `CONFIG.PF2E.skills`, `ui`, `Hooks`, and an `Actor`. Module functions are never stubbed.
- `run.mjs` runs, per class, level and Free Archetype setting: `normalizePCConcept` → issue candidates → `resolvePCConcept` (which runs `planClassPaths` and `getFeatCandidates` for every slot) → `resolveFeatPicks` with the first not-yet-taken candidate in each slot → `validateArchetypeSlotPlacement` → a spell plan from `pcSpellcastingProfile` / `pcSpellPlan` → the final `resolvePCConcept` → `createCharacterActor` (which runs `stageClassPaths`, `preselectChoiceSets` and skill allocation). The one AI seam, the `selectChoices` callback, gets a stub that answers every group with its first option. The other AI calls (`selectFeats`, spell and ABC selection) live in `generator-app.mjs` and `ai.mjs`, not in `pc-builder.mjs`, so the bench feeds their results straight in; no production change was needed.
- Each run records: pass or throw (with stage and message), feat slots left unresolved, slots with zero candidates, per-category slot-versus-distinct-candidate counts, the class path chosen, the casting profile (null or found), slots and picks per rank, spell shortfalls, ChoiceSets still unanswered on the embedded items, ChoiceSets on natively granted class/ABC features, skill review warnings, the projected skill plan (`skillPlan`: trained skills, increase events, ranks at the top level) and every `console.warn` line the pipeline emitted. Detail goes to `cache/results.json`; the matrix goes to `cache/matrix.md` and stdout.
- **PASS** = no throw, every feat slot filled, no warning. **WARN(n)** = n distinct warnings or findings (for example a caster class with no casting profile, or a feat slot left empty because no legal feat was left: completion never blocks Create on that, the GM is warned instead). **FAIL** = a throw at any stage.

`REPORT.md` is the hand-written analysis of one run of this bench; it is not regenerated. Rerun the bench after a fix and compare the matrix. The default character is Human / Urbanite Human / Athlete (`--ancestry`, `--heritage`, `--background` change it; `--priorities athletics,medicine,nature` sets `concept.skillPriorities` as the AI would; `--classes soldier,mystic` and `--levels 1,5` narrow the run; `--path Striker` makes the class-path choice select that option, and the run is FAIL if the plan does not select it, so other paths are exercised, not only the first candidate; `--abilities wis` sets `concept.abilityPriorities` (free-boost preference, as the AI would), `--multiclass envoy` sets the second class, pins its dedication to the first archetype slot and runs Free Archetype on only, and reports "not pinned" when that dedication is not provable for the character; `--verbose` prints stacks).

## Duplicated PF2e content

The sf2e build does not take its packs only from `packs/sf2e/**`. `build/duplicates.json` (at the pinned SHA; a copy is cached as `cache/duplicates.json`) lists PF2e documents that the build copies into sf2e packs. Its shape is an array of `{ publication, entries: { <pack dir>: [<document name>] } }`. For "Starfinder Player Core", `spells` alone lists 262 names (Haste, Protection, Translate, Hydraulic Torrent, True Target, Arctic Rift, ...), plus actions, feats, conditions, equipment and effects. Those documents exist only under `packs/pf2e/<pack>/**`, so the live `sf2e.spells` pack has them and the cache did not, until `fetch.mjs` added them.

The copy logic is in `build/lib/compendium-pack.ts`, not `build/build-packs.ts`: `build-packs.ts` only calls `CompendiumPack.loadJSON(dir, { systemId })` for each pack directory (line 34). The lines the fetch relies on, at the pinned SHA `be4ab21`:

```ts
// build/lib/compendium-pack.ts, loadJSON(): sf2e only
if (systemId === "sf2e") {
    const resolvedDuplicates = duplicates.flatMap((group) => {
        const data = objectHasKey(group.entries, packDirName) ? group.entries[packDirName] : null;
        return data?.map((d) => ({ publication: group.publication, name: d })) ?? [];
    });
            const pf2eFilePaths = R.mapToObj(getPackJSONPaths(packDirName, "pf2e"), (p) => [
                (p.split(path.sep)?.at(-1) ?? p).replace(".json", ""),
                p,
            ]);
            for (const { publication, name } of resolvedDuplicates) {
                const pf2ePath = pf2eFilePaths[sluggify(name)];
                if (!pf2ePath) {
                    throw PackError(`Duplicate item ${name} could not be found in pf2e pack ${packDirName}`);
                }
                const source = parsePackEntrySource(pf2ePath);
                parsedData.push(this.#adjustPF2eDocumentForSF2e(source, { publication }));
```

How each part is mirrored:

- **Pack.** The pack directory name is the key in `entries` and also the `packs/pf2e/<pack>/` directory searched. An entry whose pack is not an sf2e Item pack is not copied: `macros` (1 name, a Macro pack) is the only one at this SHA. It is recorded in `cache/SOURCE.txt`.
- **Match.** `helpers.ts` `getPackJSONPaths` takes every `.json` under `packs/pf2e/<pack>/` except `_folders.json`, and the lookup key is the file name without `.json`. The key is `sluggify(name)`, from `src/util/misc.ts` with `camel = null`:

  ```ts
  case null:
      return text
          .replace(lowerCaseThenUpperCaseRE, "$1-$2")
          .toLowerCase()
          .replace(/['’]/g, "")
          .replace(nonWordCharacterRE, " ")
          .trim()
          .replace(/[-\s]+/g, "-");
  ```

  `fetch.mjs` ports those regexes. It fails closed where the build throws: no file, more than one file with the same name, or a file of that name already in the sf2e pack (the cache holds one file per name). All 654 copies at this SHA match exactly one file.
- **Edits.** `#adjustPF2eDocumentForSF2e` is applied to each copy, in the same order: the book icon `icons/sundries/books/book-red-exclamation.webp` becomes `systems/sf2e/icons/default-icons/feats-sf2e.webp`; when the group has a `publication`, `system.publication` gets `license = "ORC"`, `remaster = true`, `title = publication`; `flags.pf2e` moves to `flags.sf2e`; then every string value has `systems/pf2e` → `systems/sf2e`, `flags.pf2e.` → `flags.sf2e.`, and `Compendium.pf2e.<name>` → `Compendium.sf2e.<name>` for each pack that the two manifests share by `path`:

  ```ts
  static get sf2eCompendiumRemap(): Record<string, string> {
      ...
      for (const { name, path } of pf2eManifest.packs) {
          const match = sf2eManifest.packs.find((p) => p.path === path);
          if (match) this.#sf2eCompendiumRemap[name] = match.name;
      }
  ```

  A copy's `folder` is replaced by the sf2e folder id of the same folder path (folder paths come from `_folders.json` in each pack, `getFolderPath` in `helpers.ts`). A missing folder warns, as the build does.
- **Where it lands.** `cache/<sf2e pack>/<sluggify(name)>.json`, next to the native files of that pack. `env.mjs` reads the pack directory recursively, so a copy is a document of that pack exactly as in the build. `env.mjs` needed no change.

Counts per pack (native sf2e files and copies) are in `cache/SOURCE.txt`. At `be4ab21`: 654 copies in 13 Item packs, `spells` 271, `feats` 119, `actions` 85, `conditions` 43, `bestiary-ability-glossary-srd` 35, `spell-effects` 70, `other-effects` 12.

Not reproduced: the build's LevelDB output and its document `_id`s and `_stats`; only the source JSON is compared. A copy's `_id` is the PF2e one, as in the build.

## What it proves

- The module's own candidate lists, prerequisite filter, class-path planning and staging, ChoiceSet preselection, feat-slot cadence, spell plan and skill allocation behave as claimed on the real sf2e data, for every class and level it samples.
- Which feat slots end up with no usable candidate, which class paths cannot be staged, which classes get no casting profile.

## What it does not prove

- No live Foundry: **no Rule Element ever runs**, there are no derived stats (AC, HP, saves, modifiers), and no real item preparation. `doc.system` is the raw pack source, not Foundry's prepared data.
- Native ABC grants are not expanded the way `ABCItemPF2e.createGrantedItems` does. The bench walks the class and ancestry `system.items` grants itself and lists open ChoiceSets, but it does not run them.
- The fake `Actor` has no data preparation: Intelligence is 0, HP max is 1, and native skill ranks come only from the class and background `trainedSkills.value`. Skill review warnings that depend on that (`grant-timing`, `unspent-training`, `unspent-increases`) are therefore ignored. `projection-mismatch` is ignored for the same reason: the fake actor's native ranks come only from `trainedSkills.value`, so the projected-rank check against the created actor cannot match a real Foundry preparation.
- `CONFIG.PF2E` has only `skills`; that is the only config path any sf2e ChoiceSet reads.
- The AI never runs. Feat picks are "first candidate not already taken", spells are the first eligible per rank, not what a model would choose. A different pick order can change which slots collide, but not a pool that has fewer distinct feats than slots.
- One ancestry / heritage / background per run, no equipment, loot, focus spells or languages, and no rarity cap.

## Shop and Treasure bench (`tools/pipeline-bench/market.mjs`)

The same cache and Foundry fake, pointed at the shop and hoard pipeline. It runs the real `scripts/shop.mjs`, `treasure.mjs`, `currency.mjs` and `compendium.mjs` (`getShopCandidates`, `getCandidateDocument`, `toItemData`, `priceToGp`) on the sf2e equipment pack, with a deterministic AI stub that offers the first valid candidates plus one invented id and one repeat. The app flows in `shop-app.mjs` and `treasure-app.mjs` are ApplicationV2 classes and do not load offline, so the bench mirrors their steps and cites each line.

```
node tools/pipeline-bench/market.mjs [--verbose]   # after fetch.mjs; 240 runs in under a second; exits 1 on any failing run
```

It checks, per run: no throw; stock count equals the smaller of the size and the offered list; every stocked item is in the cache, at or below the level and rarity cap, and in the category's types; the invented id is reported as dropped; hoard budgets match `tables.mjs` (party level 4: 680 one encounter, 8,500 whole level, the QA rows in `docs/qa-checklist.md` 13h.3); items plus the Credstick line equal the budget; Credsticks use the credstick template with the amount in `system.price.value`; shop actors are `Merchant` loot and hoard actors are `Loot` loot. Findings and their causes are in `tools/pipeline-bench/MARKET-REPORT.md`. The output is in `tools/pipeline-bench/out/` (gitignored).
