# simplySF2e — project brief

Foundry VTT module. An AI generates Starfinder 2e NPCs/monsters, Player Characters, and magic items from a text prompt. Every named pick is grounded against the real installed `sf2e` compendium. Repo: `simplyjaytea/simplySF2e`.

**Session history, the full bug log, and PR narrative are in [HISTORY.md](HISTORY.md) — check there before re-investigating anything.** This file holds only what is true right now.

## Glossary

- **Foundry** — the VTT this is a module for. **Actor** = a character/creature sheet. **Item** = anything embedded on one.
- **sf2e system** — Starfinder Second Edition (`sf2e`), sourced from the PF2e monorepo branch **v14-dev**, manifest `system.sf2e.json` **1.5.1** (Foundry compat minimum 14.361 / verified 14.367; the 1.5.0 manifest is identical apart from version/download, so the module still allows 1.5.0). Pack collection ids are `sf2e.<packs[].name>`. "Real source" = that repo's actual TS/JSON, fetched live, not recalled from PF2e memory.
- **Compendium / pack** — a bundled library of real game content. The module never invents content: a pick either matches a real document or is marked custom.
- **GM Core** — *Starfinder GM Core* Building Creatures / Treasure by Level tables, hardcoded and cited in `tables.mjs` (Chapter 2, pp. 116–128). **Do not invent SF2e table numbers**; any new number needs a citation.
- **ABC item** — Ancestry/Background/Class, the real items a PC embeds to derive stats. **Heritage** — a 4th, in its own pack.
- **Grant** — an item that auto-bundles another when embedded (an ancestry grants its features), via `system.items` on the granting doc.
- **Rule Element (RE)** — a JSON rule object in `system.rules` that makes something mechanically happen. Foundry fails **silently** on a wrong key, so a hand-typed RE can look right and do nothing.
- **Spellcasting entry** — the item holding a caster's spells + slots. `system.prepared.value` = `prepared`|`spontaneous`|`innate`|`focus`.
- **Tradition** — arcane/divine/occult/primal. **Focus spell / pool** — a small pool (1–3) spent on class spells, refilled by Refocus, separate from slots.
- **Slug** — lowercase-hyphenated id (`ghost-touch`). PF2e sometimes needs **camelCase** instead (`ghostTouch`) — NOT interchangeable, a recurring silent-bug source.
- **Trait** — a tag in `system.traits.value` used for filtering (real focus spells all carry `focus`).

## Invariants

1. **Clone a real RE from a published item; never hand-author one.** See `rule-templates.mjs`. No hand-written fallback exists, by design.
2. **When a system field name or shape matters, fetch the real installed `sf2e` source** instead of recalling PF2e shapes. This has bitten the PF2e parent project repeatedly — see HISTORY.md's first two bug-log entries. Do not invent SF2e schema.
3. **The AI never emits a number or writes code.** It picks scale words and enum slugs; the module supplies values from tables, real documents, or pre-written macro bodies.
4. **Escape AI text before it reaches HTML** — use `text.mjs`'s `esc`/`toHtml`. Generated names/descriptions land in `system.description.value`, actor notes, and macro chat content.
5. **Fail closed.** An unresolved pick is dropped with a `console.warn`, never guessed. Exception: a PC feat slot or a PC caster's spell list, where empty is worse than approximate. Approved skill-completion policy: missing/partial skill preferences use labeled key-ability defaults over the known core catalog; missing budgets/schedules or unsupported native mechanics are never guessed.

## Architecture

Three pipelines over shared compendium/table infrastructure.

**1. NPC / creature** (`builder.mjs`, the most battle-tested path)
1. `generateConcept()` (`ai.mjs`) — one call against SYSTEM_PROMPT; returns a concept in *scales*, not numbers.
2. `normalizeConcept()` — coerce/clamp into a safe shape.
3. Spells (2 extra calls): `chooseSpellFocus()` → keywords → `getSpellCandidates()` narrows the real tradition list → `selectSpells()` picks from it.
4. Equipment (1 extra call): keywords tokenized locally → `getEquipmentCandidates()` → `selectEquipment()`. Failure keeps first-draft names.
5. Ground creature feats/abilities and loot against bounded real catalogs. Published picks retain their exact issued source references; deliberately custom abilities stay labeled narrative-only.
6. `resolveConcept(..., { exactContent: true })` — resolve those references and build a completion manifest. An unresolved required pick blocks one-click creation. `findEntry()` remains for legacy/pre-selection calls and internal templates.
7. `createActor()` — clone real items, apply runes/quantities/carry state, and verify persisted sources and spell links before committing the new actor.

Encounter mode: `designEncounter()` picks a theme + per-role briefs once, then the whole per-creature pipeline runs per member (N× system-prompt cost). Loot reroll: `generateLoot()`, a small call on the concept summary.

**2. Player Character** (`pc-builder.mjs`) — no math layer at all. Embed real ABC/heritage/feat items with correct `system.build` data and the pf2e system computes AC/HP/saves/proficiencies itself. `normalizePCConcept()` → `resolvePCConcept()` (ABC/grants/feat slots/focus spells) → `createCharacterActor()`. Single-class, no pre-create edit screen. `pc-support.mjs` maps each class to its multiclass dedication slug, but nothing in the pipeline calls it yet.

**3. Item forge** (`item-builder.mjs`, `rule-templates.mjs`, `itemforge-app.mjs`) — standalone magic items. Passive wondrous items use unchanged supported rules from eligible published equipment at the requested level/rarity; 1/day activations use prewritten companion macros. Rune weapons/armor clone a real base and real rune items. Assembly returns source data plus transient preview estimates; PF2e derives the prepared price and level.

## Files

| File | Role |
| --- | --- |
| `simplysf2e.mjs` | Module entry: settings registration, app launchers, `/sf2e` / `/simplysf2e` chat command. |
| `ai.mjs` | All AI calls, SYSTEM_PROMPT, `pcSystemPrompt()`, `lootGuide()`. Streaming SSE, retry-once, fail-closed JSON parsing. |
| `ai-response-validation.mjs` | Per-task required-key shape checks on parsed AI responses (`taskResponseProblem`). |
| `ai-task-profiles.mjs` / `ai-candidate-format.mjs` | Pure per-operation token/sampling caps (`taskMaxTokens`) and compact grounded-candidate encoding. |
| `settings.mjs` | Foundry settings, exact-endpoint API-key binding, local/keyless provider readiness, and the client-side named connection bank. |
| `builder.mjs` | NPC pipeline + shared resolve/build helpers used by both actor pipelines (`resolveEquipment`, `resolveLoot`, `resolveFocusSpells`, `buildEquipmentItems`, `buildLootItems`, `filterItemTypes`, `applyTreasureBudget`, `enrichDescription`). `reskinActorData()` builds a Reskin copy via `reskin.mjs`. |
| `reskin.mjs` | Pure Reskin validation/copy: `normalizeReskin` drops unknown/duplicate renames, `applyReskin` changes only prose and strike/ability display names, pinning each renamed item's original slug (`pf2eSluggify`, a port of v14-dev `sluggify`). |
| `art.mjs` | Borrows token art/structure from the closest-matching bestiary creature (`findBestiaryScaffold`, `findBestiaryArt`). |
| `currency.mjs` | Cited SF2e Credstick/UPB templates and gold-to-credit mapping. |
| `pc-builder.mjs` | PC pipeline. First file to check when PC generation misbehaves. |
| `completion.mjs` / `post-create.mjs` | Required-content manifests, persisted-source checks, and new-document commit/rollback boundaries. |
| `pc-support.mjs` / `class-paths.mjs` | Complete-only class eligibility (plus the unwired multiclass dedication map) and cited SF2e L1 `item:tag:` class-path staging. |
| `pc-loadout.mjs` | Readies only the newly generated equipment after native proficiencies are available. |
| `pc-prerequisites.mjs` | Fail-closed ordinary feat-prerequisite evaluator against a staged ABC/grant/skill snapshot. PF2e stores prereqs as display text, not an eligibility API. |
| `pc-skills.mjs` | Pure concept-priority validation, real-class skill schedules, chronological allocation and conservative reconciliation; read-only native skill snapshot extraction. |
| `choice-set.mjs` | Pre-answers supported static PF2e `ChoiceSet` rules on direct items and one level of `GrantItem` sources. Forced/key-ability/unambiguous concept choices resolve locally; other supported choices use one bounded, grounded AI batch through the generator. Real rule values stay local; exact catalog IDs are validated before applying. No first-option fallback. Unsupported/unanswered choices retain native prompts. Pure selection helpers are node-testable. |
| `compendium.mjs` | `findEntry` fuzzy match, pack indexes (incl. the extended equipment index), candidate lists, `getPacksFor`/`getAllPacksFor`, `priceToGp`, `RARITY_RANK`. |
| `runes.mjs` | SF2e equipment grades + upgrade capacity/candidates for the forge, plus legacy PF2e rune parsing/zeroing. Never hardcodes a rune level or price. |
| `text.mjs` | `slugify`, `capitalized`, `esc`, `toHtml`. Pure shared HTML escaping with no Foundry dependency; node-testable. |
| `tables.mjs` | Building Creatures / Treasure by Level numbers, cited against *Starfinder GM Core* pp. 116–128. |
| `pc-tables.mjs` | PC leveling cadence (boost/skill/feat-slot levels), source-qualified Remaster casting profiles, and base spell-slot counts. |
| `rule-templates.mjs` | Harvests real RE exemplars from installed packs at runtime. Used by the Item Forge. |
| `item-builder.mjs` | Item forge: normalize, empirical pricing, item assembly (incl. augmentation and solarian crystal kinds). |
| `macro-templates.mjs` | Pre-written activation macro bodies for forged 1/day items; AI supplies only enum slugs/prose. |
| `generator-app.mjs` / `itemforge-app.mjs` / `manage-presets-app.mjs` / `sources-app.mjs` / `provider-setup-app.mjs` | UI apps over `app-base.mjs` (token tracking + progress). |
| `app-base.mjs` | Shared generator/item-forge shell: connection switch, token report, monotonic progress bar. |
| `progress.mjs` | Pure weighted/monotonic generation-progress math (step budgets, stream mapping). |
| `tokens.mjs` | Token estimate + `normalizeUsage`; fallback counts are labeled estimated and coarsened on display. |
| `encounter.mjs` | XP budget/composition math. |
| `presets.mjs` | Six SF2e class flavor presets (Standard), four SF2e NPC archetype presets, custom preset CRUD + random briefs. |
| `*.test.mjs` | Standalone regression checks (`node scripts/<name>.test.mjs`); CI runs every check before release. |

## Agent workflow

Cross-tool operating rules live in [AGENTS.md](AGENTS.md); the live session baton is [HANDOFF.md](HANDOFF.md) — read it at session start, overwrite it at session end. Codex sessions read those same two files.

Claude-side orchestration (when running as Fable/Opus with subagent tools):

- **Fable acts as coordinator**: plans, delegates, verifies, integrates, and owns the final report. It writes HANDOFF.md itself.
- **Delegate down aggressively**: Sonnet for mechanical execution of an already-specified plan (apply a mapped-out fix, write a test mirroring an existing one, mechanical renames). Opus for open-ended design, hard debugging, or anything where the plan itself is the hard part. Haiku only for trivial bulk text operations — this repo rarely has any.
- **Never delegate the two things that bite this repo**: (1) sf2e schema verification — the delegate must be explicitly told to fetch real `foundryvtt/pf2e` **v14-dev** source (`system.sf2e.json` / `packs/sf2e/`), and the coordinator spot-checks the citation; (2) release/workflow `.yml` reasoning.
- **Every schema-dependent or balance-sensitive diff gets an independent reviewer agent** (fresh context, not the builder) before the PR is called done — proven to catch real bugs three separate times (HISTORY.md process notes).
- Subagent claims of "verified" require a quoted source line; treat unquoted verification claims as recalled, i.e. unverified.
- **Sonnet worker recipe:** `Agent` with `model: "sonnet"`, `isolation: "worktree"`, `run_in_background: true`, one checklist ID per worker. Use the prompt template in HANDOFF.md "How to run this with Sonnet workers". The coordinator pastes any cited upstream values into the prompt; workers never look up schema themselves. Workers commit in their worktree and never push, because cloud sessions can push only to the designated branch. The coordinator merges their commits, reruns all tests, gets independent review where required, then pushes and opens the PR.

## How to work here

- **Branch + PR, never direct to main.** A merge to `main` auto-publishes a public release to every install's "latest" manifest — treat it like a manual `gh release create`. `.github/workflows/*.yml` changes need a real test merge; syntax validity doesn't catch trigger-chain bugs (two were found that way).
- **Verify:** `node --check` on everything touched; run the `*.test.mjs` checks; add one for genuinely pure logic behind a bug-shaped change. Most behavior (does the actor render/compute correctly in a live world) is **not** self-checkable.
- Local git identity for this repo: `user.name "jt"`, `user.email "jt_f@ymail.com"`.
- The user sometimes merges a PR while a requested review is still running. If an audit is in flight, say so; fixes for a mid-audit merge ship as a new PR, not folded into the merged one.

## Verified against real pf2e source — do not re-litigate

Inherited PF2e-era notes for the scaffolded builders. They are **not** SF2e schema. Revisit during schema discovery.

- Setting all five `build.attributes.boosts` tiers regardless of level is **safe** — `character/document.ts` slices each tier by `allowedBoosts`.
- A PC spellcasting entry's `proficiency.value` is a **floor, not a cap** — `spellcasting-entry/document.ts` takes `Math.max` with the actor's `base-spellcasting` rank, which class features raise.
- `details.languages.value` is **not** truncated to max, and the system already adds Int mod to `build.languages.max` itself.
- Not writing `system.price`/`system.level` on a runed item is **correct** — `physical/document.ts` recomputes both via `computeLevelRarityPrice()` every prep.
- A character's `resources.focus.max` is reset to 0 every prep (`character/document.ts`), then each embedded non-cantrip focus spell adds 1 (`item/spell/document.ts` `prepareActorData`), clamped to 3. So the PC pool needs no rule; cloning one would double-count. An NPC's pool is plain actor data (`npc/document.ts`). Re-verified against v14-dev 2026-10-02.
- v14-dev `ActorInventory.addCurrency` clones bundled `credstick.json` / `upb.json` for credits/UPB and still lists classic coin UUIDs on `pf2e.equipment-srd` (`src/module/actor/inventory/index.ts`). Credits quantity is stored on `system.price.value` (`sp` on create; prepared `.credits`). Do not invent sf2e gold-piece UUIDs. This module maps gold-piece loot language onto Credstick and assembles those cited templates.

## Current state (2026-10-01)

**Active plan: the GM-ready checklist (G1–G13) in [HANDOFF.md](HANDOFF.md).** Work it in the waves listed there.

**Starfinder 2e "Neon Drift" UI overhaul.** simplySF2e identity is `simplysf2e` / SimplySF2e, targeting system **`sf2e` 1.5.0 or later** (cited against 1.5.1). Status is **Alpha**. Every merge to `main` publishes the next tag; check GitHub Releases for the current version rather than pinning it here. Git is authoritative for branch state; [HANDOFF.md](HANDOFF.md) is the live baton.

- **Pack defaults:** `DEFAULT_PACKS` uses real `sf2e.*` collection ids from `system.sf2e.json` 1.5.1, unchanged since 1.5.0 (`classes`, `class-features`, `feats`, `spells`, `equipment`, `ancestries`, `heritages`, `backgrounds`, `bestiary-ability-glossary-srd`, `alien-core-bestiary`).
- **Chrome:** cited SF2e navy/cyan/violet tokens (`src/styles/sf2e/index.scss`) plus a magenta primary action and per-mode accents (`--spf-mode-*`). Shared kit lives in `styles/simplysf2e.css`; rules used by one template live in `styles/apps/<app>.css`; `module.json` `styles` lists the shared file first. Narrow-window rules use `@container spf-window` on `.window-content` (never viewport `@media`) because Foundry windows resize inside a wide viewport.
- **Standard presets:** the six published SF2e classes only (envoy, mystic, operative, solarian, soldier, witchwarper). Flavor guides; scale-words only.
- **Currency:** generated loot/wealth prefers **credits** (Credstick) and **UPB** via verbatim copies of v14-dev `credstick.json` / `upb.json`. Gold-piece AI language converts through cited `DENOMINATION_RATES` (1 gp = 10 credits). Starting-wealth math is surfaced in credits via `gpToCredits` / `pcStartingWealthCredits`. Classic `pf2e.equipment-srd` coin UUIDs are not the happy path and are not invented under `sf2e.equipment`.
- **Tables:** `tables.mjs` is fully cited against SF2e sources (verified 2026-09-30): LEVEL_DC + rarity, TREASURE L1-20 totals (x10 credits), identificationDC mapping, and Moderate 80 XP. The Building Creatures stat arrays (ABILITY_MODIFIER, PERCEPTION_AND_SAVES, SKILL, AC, HP, STRIKE_ATTACK, STRIKE_DAMAGE, SPELL_DC, SPELL_ATTACK, RESISTANCE) are fully cited and calibrated against *Starfinder GM Core* Chapter 2 "Building Games" pp. 116–128 (Rules 989–1025).
- **Complete-only registry:** all six published SF2e classes: envoy, mystic, operative, solarian, soldier, witchwarper. Cited `item:tag:` L1 bridges staged by `stageClassPaths`, including Operative specialization skill-feat and Sniper bonus-feat preselection. Solarian has no L1 item:tag path.
- **Equipment grades & Item Forge:** Item Forge weapon/armor generation targets the native SF2e equipment grade (commercial, tactical, advanced, superior, elite, ultimate, paragon) and installed upgrade modules model (`system.subitems`). Legacy system runes are zeroed per Migration942EquipmentGrade, base analog/tech classification is preserved, and prices preview in credits.
- **Rest hook residual:** v14-dev still fires `Hooks.callAll("pf2e.restForTheNight", actor)`. No `sf2e.restForTheNight` is cited. The module keeps that exact string.
- **Generator extras:** Elite/Weak adjustment selector (Alien Core pp. 204/207) and the `/sf2e` chat command are wired end to end. The **Reskin** generator mode (G6) is wired: the GM drops an NPC from the Actors sidebar or a compendium, the AI writes new fiction and may rename strikes/abilities by id, and the module creates a copy (stats, rules, traits, items unchanged). The multiclass dedication map is still a tested helper only.
- **Still later:** see the GM-ready checklist. Deferred past GM-ready: full Free Archetype graphs, upgrade prerequisite validation, shields/ammo.
- **Inherited code:** NPC/PC/forge pipelines, fail-closed grounding, cloned Rule Elements. Treat [HISTORY.md](HISTORY.md) as parent-project history, not simplySF2e releases.

**Recorded live evidence:** none for simplySF2e.

## Known gaps

Re-evaluated for SF2e against v14-dev sf2e 1.5.1 on 2026-10-02 (checklist G9).

- **Focus pools:** only Mystic (Initial Epiphany, `packs/sf2e/class-features/mystic/initial-epiphany.json`) and Witchwarper (Witchwarper Spellcasting / Paradox, `packs/sf2e/class-features/witchwarper/`) get Focus Points. Their focus spells are in `packs/sf2e/spells/focus/{mystic,witchwarper}/`. Envoy, operative, solarian and soldier have none. The module no longer clones a focus-pool rule for PCs: v14-dev `item/spell/document.ts` `prepareActorData` adds 1 to a character's `focus.max` for each embedded non-cantrip focus spell, and `creature/document.ts` clamps it to the cap of 3 (no `sf2e.*` pack carries a focus-max `ActiveEffectLike` anyway). NPC pools are plain actor data (`npc/document.ts` merges `resources.focus` from source).
- **PC casting:** Mystic and Witchwarper have cited spontaneous profiles and slot tables in `pc-tables.mjs` (3 base slots per rank, 5 cantrips, 10th-rank spell at level 19).
- **Focus spells, v1 scope:** a focus-only NPC (no casting tradition, so no DC) is unsupported. The NPC pool size (spell count, capped at 3) is a module default, not GM Core guidance. Both are signed-off decisions.
- **Item Forge passive effects** come only from `sf2e.equipment` (`getForgeEffectCatalog`). At level 20 / unique there are 13 exemplars: item bonus (9: Active Camouflage, Voice Amplifier, Aeon Stone (Uplifting), Antigrav Harness, Shredskin), resistance (1: Mindshutter Stone, mental 3) and sense (3: Darkvision Visor, Retinal Reflectors, Functionary's Mask). Weakness, immunity and speed have no exemplar: the pack has no Weakness or Immunity rule, and its only BaseSpeed rules (Hook Claws, Ultralight Wings) carry predicates. The forge hides those kinds. Several sources are armor upgrades or augmentations, not worn items.
- **Item Forge upgrades:** weapons and armor take a native `system.grade` plus installed upgrades in `system.subitems`. Only `installed-in-a-weapon` / `installed-in-armor` upgrades are offered (`propertyRuneFitsBase` and `getUpgradeCandidates` in `runes.mjs`, cited to v14-dev `usage.ts`). Other installed usages depend on base traits and fail closed. No sf2e item uses an `etched-onto-*` usage. Upgrade slot counts are **uncited and on hiatus**: `parseUpgradeCapacity` reads "Upgrade Slots N" from the base text and otherwise defaults to weapon 1 / armor 0, and no sf2e data or code carries a slot count. Upgrade prerequisites and exclusivity are not validated. Shields and ammo are out of scope.
- **Skill completion limits:** unknown grant timing, non-floor native rank transformations, and missing class data are warned rather than inferred. Duplicate native feat grants and arbitrary new Lore replacements remain manual. This is not full feat-prerequisite validation or a level-up simulator. Not live-tested. Computers and Piloting are covered (G1).
- **Feat prerequisites:** Free Archetype slot placement is checked (`validateArchetypeSlotPlacement`) and ordinary feat prerequisites use the fail-closed staged-actor evaluator (`pc-prerequisites.mjs`). A full prerequisite graph is unbuilt. sf2e uses the same native `archetype` free-archetype slot (`character/feats/collection.ts`).
- **Rarity cap covers ancestry/background/heritage only.** Feats, spells and equipment are excluded by design. `getFullCandidates()`'s `maxRarity` and `RARITY_RANK` (`compendium.mjs`) can extend it.
- **Unbuilt roadmap:** multiclass in the PC pipeline. sf2e has dedications for all six classes (`packs/sf2e/feats/archetype/multiclass-archetypes/`) and `pc-support.mjs` maps them, but nothing calls the map (deferred past GM-ready, G7).
