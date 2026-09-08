# simplySF2e — project brief

Foundry VTT module. An AI generates Starfinder 2e NPCs/monsters, Player Characters, and magic items from a text prompt. Every named pick is grounded against the real installed `sf2e` compendium. Repo: `simplyjaytea/simplySF2e`.

**Session history, the full bug log, and PR narrative are in [HISTORY.md](HISTORY.md) — check there before re-investigating anything.** This file holds only what is true right now.

## Glossary

- **Foundry** — the VTT this is a module for. **Actor** = a character/creature sheet. **Item** = anything embedded on one.
- **sf2e system** — Starfinder Second Edition (`sf2e`), sourced from the PF2e monorepo branch **v14-dev**, manifest `system.sf2e.json` **1.5.0** (Foundry compat minimum 14.361 / verified 14.367). Pack collection ids are `sf2e.<packs[].name>`. "Real source" = that repo's actual TS/JSON, fetched live, not recalled from PF2e memory.
- **Compendium / pack** — a bundled library of real game content. The module never invents content: a pick either matches a real document or is marked custom.
- **GM Core** — PF2e-era Building Creatures / Treasure by Level **numbers** still hardcoded in `tables.mjs`. Comments now state they are inherited PF2e-compatible values pending a cited Starfinder 2e source. **Do not invent SF2e table numbers.**
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

**2. Player Character** (`pc-builder.mjs`) — no math layer at all. Embed real ABC/heritage/feat items with correct `system.build` data and the pf2e system computes AC/HP/saves/proficiencies itself. `normalizePCConcept()` → `resolvePCConcept()` (ABC/grants/feat slots/focus spells) → `createCharacterActor()`. Single-class, no multiclass, no pre-create edit screen.

**3. Item forge** (`item-builder.mjs`, `rule-templates.mjs`, `itemforge-app.mjs`) — standalone magic items. Passive wondrous items use unchanged supported rules from eligible published equipment at the requested level/rarity; 1/day activations use prewritten companion macros. Rune weapons/armor clone a real base and real rune items. Assembly returns source data plus transient preview estimates; PF2e derives the prepared price and level.

## Files

| File | Role |
| --- | --- |
| `ai.mjs` | All AI calls, SYSTEM_PROMPT, `pcSystemPrompt()`, `lootGuide()`. Streaming SSE, retry-once, fail-closed JSON parsing. |
| `ai-task-profiles.mjs` / `ai-candidate-format.mjs` | Pure per-operation token/sampling caps (`taskMaxTokens`) and compact grounded-candidate encoding. |
| `settings.mjs` | Foundry settings, exact-endpoint API-key binding, local/keyless provider readiness, and the client-side named connection bank. |
| `builder.mjs` | NPC pipeline + shared resolve/build helpers used by both actor pipelines (`resolveEquipment`, `resolveLoot`, `resolveFocusSpells`, `buildEquipmentItems`, `buildLootItems`, `filterItemTypes`, `applyTreasureBudget`, `enrichDescription`). |
| `currency.mjs` | Cited SF2e Credstick/UPB templates and gold-to-credit mapping. |
| `pc-builder.mjs` | PC pipeline. First file to check when PC generation misbehaves. |
| `completion.mjs` / `post-create.mjs` | Required-content manifests, persisted-source checks, and new-document commit/rollback boundaries. |
| `pc-support.mjs` / `class-paths.mjs` | Complete-only class eligibility and exact native Rogue/Investigator path staging. |
| `pc-loadout.mjs` | Readies only the newly generated equipment after native proficiencies are available. |
| `pc-prerequisites.mjs` | Fail-closed ordinary feat-prerequisite evaluator against a staged ABC/grant/skill snapshot. PF2e stores prereqs as display text, not an eligibility API. |
| `pc-skills.mjs` | Pure concept-priority validation, real-class skill schedules, chronological allocation and conservative reconciliation; read-only native skill snapshot extraction. |
| `choice-set.mjs` | Pre-answers supported static PF2e `ChoiceSet` rules on direct items and one level of `GrantItem` sources. Forced/key-ability/unambiguous concept choices resolve locally; other supported choices use one bounded, grounded AI batch through the generator. Real rule values stay local; exact catalog IDs are validated before applying. No first-option fallback. Unsupported/unanswered choices retain native prompts. Pure selection helpers are node-testable. |
| `compendium.mjs` | `findEntry` fuzzy match, pack indexes (incl. the extended equipment index), candidate lists, `getPacksFor`/`getAllPacksFor`, `priceToGp`, `RARITY_RANK`. |
| `runes.mjs` | All rune knowledge: parse out of a name, apply as system data, cap tiers to level, price from real rune docs, item-forge candidate lists. Never hardcodes a rune level or price. |
| `text.mjs` | `slugify`, `capitalized`, `esc`, `toHtml`. Pure shared HTML escaping with no Foundry dependency; node-testable. |
| `tables.mjs` | Inherited PF2e-compatible Building Creatures / Treasure by Level numbers — not Starfinder-authored. |
| `pc-tables.mjs` | PC leveling cadence (boost/skill/feat-slot levels), source-qualified Remaster casting profiles, and base spell-slot counts. |
| `rule-templates.mjs` | Harvests real RE exemplars from installed packs at runtime. Used by the forge and the PC focus-pool rule. |
| `item-builder.mjs` | Item forge: normalize, empirical pricing, item assembly. |
| `generator-app.mjs` / `itemforge-app.mjs` / `manage-presets-app.mjs` / `sources-app.mjs` | UI apps over `app-base.mjs` (token tracking + progress). |
| `app-base.mjs` | Shared generator/item-forge shell: connection switch, token report, monotonic progress bar. |
| `progress.mjs` | Pure weighted/monotonic generation-progress math (step budgets, stream mapping). |
| `tokens.mjs` | Token estimate + `normalizeUsage`; fallback counts are labeled estimated and coarsened on display. |
| `encounter.mjs` | XP budget/composition math. |
| `presets.mjs` | Six SF2e class flavor presets (Standard) + custom preset CRUD + random briefs. |
| `*.test.mjs` | Standalone regression checks (`node scripts/<name>.test.mjs`); CI runs every check before release. |

## Agent workflow

Cross-tool operating rules live in [AGENTS.md](AGENTS.md); the live session baton is [HANDOFF.md](HANDOFF.md) — read it at session start, overwrite it at session end. Codex sessions read those same two files.

Claude-side orchestration (when running as Fable/Opus with subagent tools):

- **Fable acts as coordinator**: plans, delegates, verifies, integrates, and owns the final report. It writes HANDOFF.md itself.
- **Delegate down aggressively**: Sonnet for mechanical execution of an already-specified plan (apply a mapped-out fix, write a test mirroring an existing one, mechanical renames). Opus for open-ended design, hard debugging, or anything where the plan itself is the hard part. Haiku only for trivial bulk text operations — this repo rarely has any.
- **Never delegate the two things that bite this repo**: (1) sf2e schema verification — the delegate must be explicitly told to fetch real `foundryvtt/pf2e` **v14-dev** source (`system.sf2e.json` / `packs/sf2e/`), and the coordinator spot-checks the citation; (2) release/workflow `.yml` reasoning.
- **Every schema-dependent or balance-sensitive diff gets an independent reviewer agent** (fresh context, not the builder) before the PR is called done — proven to catch real bugs three separate times (HISTORY.md process notes).
- Subagent claims of "verified" require a quoted source line; treat unquoted verification claims as recalled, i.e. unverified.

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
- A character's `resources.focus.max` is zeroed every prep and rebuilt only from ActiveEffectLike rules, so the PC focus pool needs a cloned RE; an NPC's can be plain actor data.
- v14-dev `ActorInventory.addCurrency` clones bundled `credstick.json` / `upb.json` for credits/UPB and still lists classic coin UUIDs on `pf2e.equipment-srd` (`src/module/actor/inventory/index.ts`). Credits quantity is stored on `system.price.value` (`sp` on create; prepared `.credits`). Do not invent sf2e gold-piece UUIDs. This module maps gold-piece loot language onto Credstick and assembles those cited templates.

## Current state (2026-09-08)

**Phase B first slice (currency / table honesty / copy).** simplySF2e identity is `simplysf2e` / SimplySF2e, targeting system **`sf2e` 1.5.0**. Published GitHub release is **v0.0.1**; source `module.json` is **0.0.2**. **Not play-ready.** Git is authoritative for branch state; [HANDOFF.md](HANDOFF.md) is the live baton.

- **Pack defaults:** `DEFAULT_PACKS` uses real `sf2e.*` collection ids from `system.sf2e.json` 1.5.0 (`classes`, `class-features`, `feats`, `spells`, `equipment`, `ancestries`, `heritages`, `backgrounds`, `bestiary-ability-glossary-srd`, `alien-core-bestiary`).
- **Chrome:** generator/forge/provider/preset windows use cited SF2e navy/cyan tokens (`src/styles/sf2e/index.scss`); no system artwork.
- **Standard presets:** the six published SF2e classes only (envoy, mystic, operative, solarian, soldier, witchwarper). Flavor guides; scale-words only.
- **Currency:** generated loot/wealth prefers **credits** (Credstick) and **UPB** via verbatim copies of v14-dev `credstick.json` / `upb.json`. Gold-piece AI language converts through cited `DENOMINATION_RATES` (1 gp = 10 credits). Classic `pf2e.equipment-srd` coin UUIDs are not the happy path and are not invented under `sf2e.equipment`.
- **Tables:** `tables.mjs` numbers are unchanged inherited PF2e-compatible benchmarks. Header/README/HANDOFF state they are **not** Starfinder-authored.
- **Complete-only registry:** empty. All six classes grant a mandatory level-1 path; none are proven to share the existing Fighter/Rogue/Investigator staging path. Fail closed.
- **Rest hook residual:** v14-dev still fires `Hooks.callAll("pf2e.restForTheNight", actor)`. No `sf2e.restForTheNight` is cited. The module keeps that exact string.
- **Still later (Phase B2+):** rune rewrite, complete-only PC unlock for the six classes, citing SF2e Building Creatures numbers, wealth-table units in credits rather than gp-equivalent, class-feature grant shapes.
- **Inherited code:** NPC/PC/forge pipelines, fail-closed grounding, cloned Rule Elements. Treat [HISTORY.md](HISTORY.md) as parent-project history, not simplySF2e releases.

**Recorded live evidence:** none for simplySF2e.

## Known gaps

Inherited from the PF2e scaffold and **not re-evaluated for SF2e**. Do not treat these as Starfinder class/feat coverage.

- **Skill completion limits:** unknown grant timing, non-floor native rank transformations, and missing class data are warned rather than inferred. Duplicate native feat grants and arbitrary new Lore replacements remain manual; this is not full feat-prerequisite validation or a historical level-up simulator. The latest native-clone/skill-write workflow has not been live-tested.

- **PC casting coverage:** inherited PF2e Remaster profiles remain in `pc-tables.mjs` and are not SF2e casting tables. Complete-only class selection is empty until an SF2e staging path is cited.
- **Free Archetype prerequisite graph is unbuilt** — level-2+ complete one-click generation stops before provider spend because that extra feat graph is not evaluated. Ordinary (non-variant) feat prerequisites now use the fail-closed staged-actor evaluator. Native `archetype-<level>` slot placement is exact.
- **Focus spells, v1 scope:** a focus-only NPC (no casting tradition, so no DC) is unsupported, and the pool-size convention (spell count, capped at 3) is a module default, not GM Core guidance. Both are signed-off decisions.
- **Rarity cap covers ancestry/background/heritage only** — feats/spells/equipment were explicitly excluded. `getFullCandidates()`'s `maxRarity` + `RARITY_RANK` are already in place if extending is wanted.
- **Item forge Phase 3:** no rune prerequisite/exclusivity validation, shield/ammunition runes out of scope. Armor property runes ARE now gated to the base armor's category (`propertyRuneFitsBase` in `runes.mjs`), but the three MATERIAL-constrained usages (`etched-onto-metal-armor`, `etched-onto-lm-nonmetal-armor`, `etched-onto-medium-heavy-metal-armor`) are excluded from candidates entirely — an armor's metal-ness isn't in the index data, so they fail closed.
- **Unbuilt roadmap:** chat command, reskin-existing-creature, elite/weak adjustments, multiclass.
