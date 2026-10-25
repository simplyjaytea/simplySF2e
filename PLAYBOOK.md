# simplySF2e playbook

The one file every agent (Claude, Codex, anything else) reads first. It holds where the project stands, the rules, how to run things, how work is delegated and reviewed, and the traps already found. CLAUDE.md and AGENTS.md only point here. The user-facing guide is README.md. Older material lives in `docs/archive/` and is not needed for normal work.

**Update this file at the end of every session:** rewrite §1 "Where we are", and add durable lessons to §8. Keep it short; move anything finished or historical to `docs/archive/`.

## 0. Start here

1. **Coordinator:** read §1 to §3 and §6, then other sections as the task needs. **Worker or reviewer:** follow your prompt and read §3, §4 and §8.
2. `git log --oneline -10` and `git status`. Git is authoritative for branch state, not any file.
3. Baseline: run the all-tests command in §4 (bash only; on Windows use Git Bash, not PowerShell).
4. If §1 lists a review in flight, check whether its PR merged mid-review. If it did, ship fixes as a **new** PR.
5. End every session with the tree clean or committed on a named branch, never with uncommitted work on `main`.

## 1. Where we are (rewrite each session)

*Updated 2026-10-25.* Status **Beta**. Every merge to `main` publishes the next release; check GitHub Releases for the version.

- **No active feature plan.** The UI polish and Jev tracks (`docs/archive/next-steps.md`) and the GM-ready checklist (`docs/archive/gm-ready-checklist.md`) are complete.
- **Last sessions (2026-10-25):** cleanup PR #68 (v0.1.2); then this playbook replaced CLAUDE.md, AGENTS.md, HANDOFF.md and HISTORY.md, and the creature art fix landed (borrowed token art and scale kept, placeholder portrait dropped, token named after the new creature, numbered for encounter copies). All 37 merged remote branches were deleted on JT's OK.
- **Live evidence:** JT reported the live run of `docs/qa-checklist.md` OK on 2026-10-08 (verbal; no versions or per-row log). Not live-checked since: every feature in README.md "Live checks", plus the creature art fix. The three Reskin rows (compendium drop, world-actor drop, a renamed strike keeping its attack effects) were never confirmed one by one.
- **Open follow-ups (not started):**
  - `console.log` diagnostics in `generator-app.mjs` (token usage, equipment matches), `itemforge-app.mjs`, `item-builder.mjs` and `builder.mjs` (grep `console.log`) are kept as intentional. Demote them to `console.debug` if JT wants them quiet.
  - PF2e-only code paths remain by design: the Remaster PF2e caster rows in `pc-tables.mjs` and the Skillful Lessons branch in `pc-builder.mjs` only match PF2e documents.
  - Deferred past GM-ready: multiclass in the PC pipeline (`pc-support.mjs` map is unwired), full Free Archetype prerequisite graphs, upgrade prerequisite/exclusivity validation, shields and ammunition in the forge.
- **Environment:** no Foundry here; JT runs live QA on a VPS. `gh` works on JT's machine as of 2026-10-25 (it used to hang; fall back to `curl https://api.github.com/repos/simplyjaytea/simplySF2e/...` if it does). Claude Code cloud sessions have no `gh` (use the GitHub MCP tools) and can push only to their designated branch. Git identity: `user.name "jt"`, `user.email "jt_f@ymail.com"`.

## 2. The project

Foundry VTT module `simplysf2e`. An AI generates Starfinder 2e NPCs/monsters, encounters, player characters, magic items, shops and treasure from a text prompt. Every named pick is grounded against the real installed `sf2e` compendium. Repo `simplyjaytea/simplySF2e`. Targets system **`sf2e` 1.5.0+** (cited against `system.sf2e.json` 1.5.1, Foundry 14.361 min / 14.367 verified).

**Glossary.**
- **sf2e system**: built from the PF2e monorepo branch **v14-dev**. Pack ids are `sf2e.<packs[].name>`. "Real source" = that repo's TS/JSON fetched live: `https://raw.githubusercontent.com/foundryvtt/pf2e/v14-dev/<path>`.
- **Actor / Item**: a character or creature sheet, and anything embedded on one.
- **Compendium / pack**: a library of real game content. A pick either matches a real document or is marked custom.
- **GM Core**: *Starfinder GM Core* Building Creatures / Treasure by Level tables, cited in `tables.mjs` (Chapter 2, pp. 116–128). Never invent a table number.
- **ABC item**: the Ancestry, Background and Class items a PC embeds; a **Heritage** comes from its own pack. A **Grant** is an item that bundles others via `system.items`.
- **Rule Element (RE)**: a JSON rule in `system.rules`. A wrong key fails **silently**.
- **Spellcasting entry**: the item holding a caster's spells and slots (`system.prepared.value` = `prepared|spontaneous|innate|focus`). **Focus pool**: 1–3 points for class spells, separate from slots.
- **Slug**: `ghost-touch`. PF2e sometimes needs **camelCase** (`ghostTouch`) instead; they are not interchangeable.

## 3. Invariants (never break)

1. **Clone a real Rule Element from a published item; never hand-author one.** No hand-written fallback exists, by design.
2. **Use real v14-dev sf2e source when a field name or shape matters.** Never recall PF2e shapes. The coordinator fetches it and pastes the quoted lines into worker prompts; workers use only those; reviewers spot-check the citation. This has bitten the project repeatedly.
3. **The in-module AI never emits a number or writes code.** It picks scale words and enum slugs; the module supplies values from tables, real documents or pre-written macro bodies.
4. **Escape AI text before HTML** with `text.mjs` `esc`/`toHtml` (descriptions, actor notes, macro chat).
5. **Fail closed.** Drop an unresolved pick with `console.warn`; never guess. Exceptions: a PC feat slot or a PC caster's spell list, where empty is worse than approximate. Skill completion may use labeled key-ability defaults; budgets, schedules and unsupported mechanics are never guessed.
6. **Never push or merge to `main` directly.** Branch + PR. A merge to `main` auto-publishes a public release to every install.
7. **Design choices go to JT first:** UX, scope, balance numbers, and anything this file does not already decide.

## 4. Commands

No build step: Foundry loads `scripts/simplysf2e.mjs` and the plain ES modules it imports. Node 22+. Run from the repo root in bash (Git Bash on Windows).

| Task | Command |
| --- | --- |
| One test | `node scripts/<name>.test.mjs` (standalone `node:assert` script; non-zero exit = fail) |
| All tests | `for f in scripts/*.test.mjs; do node "$f" >/dev/null 2>&1 \|\| echo FAIL $f; done` |
| Syntax | `node --check scripts/<file>.mjs` |
| Pre-release gate | `git fetch origin main && bash tools/release-check.sh` (`--no-ui` skips screenshots; bash 4.4+) |
| UI screenshots | `cd tools/ui-preview && npm install && npm run shoot` → PNGs in `tools/ui-preview/out/` at 720 px and 460 px |

- **`tools/release-check.sh`** reruns every self-checkable check: syntax, all tests, duplicate keys in `module.json`/`lang/en.json`, missing manifest/template paths, merge-conflict markers, duplicate QA row ids, `git diff --check` against `origin/main`, and the UI harness. `tools/` never ships in the release zip.
- **Versioning:** each merge to `main` auto-publishes the next patch tag. A minor bump (as for v0.1.0) is cut by running Actions > Release > Run workflow with a `version` on the same commit; later merges count up from it.
- **CI** (`.github/workflows/pull-request.yml`, job `verify`): `node --check` on every `scripts/**/*.mjs`, every `*.test.mjs`, `jq empty module.json lang/en.json`, `git diff --check` base..head. Merging to `main` runs `auto-release.yml`.
- **Tests are pure logic only.** Anything that needs a live world goes into `docs/qa-checklist.md` and the PR body.
- **Runtime-built translation keys.** `i18n-keys.test.mjs` sees only literal keys. These families are built at runtime, so a key that looks unused may be live: `Treasure.Amount*` (`treasure-app.mjs`), `TreasureAmount.*` (`generator-app.mjs`, `manage-presets-app.mjs`), `Mode.*`, `Role.*`, `Threat.*`, `StatCheck.*`, `Skills.*`, `Loadout.*`, `Rarity.*`, `Shop.Size*`/`Category*`, `Preview.*`. Grep for the prefix before deleting a key.
- **Every PR with a GM-visible change** adds one `RELEASE_NOTES` entry (new unique `id`, i18n title/body in `lang/en.json`) at the top of `scripts/whats-new.mjs`.
- **UI changes:** run the screenshot harness and look at both widths. It has no Foundry core CSS and exits non-zero when a fixture is out of step with its template (`tools/ui-preview/README.md`). Narrow-window CSS uses `@container spf-window` on `.window-content`, never viewport `@media`. Shared styles are in `styles/simplysf2e.css`; single-window rules are in `styles/apps/<app>.css`.

## 5. Architecture and file map

Three actor/item pipelines over shared compendium and table code, plus the Shop, Treasure and setup windows. Reskin is a Generator mode, not a separate window.

**NPC / creature** (`builder.mjs`, the most tested path): `generateConcept()` in `ai.mjs` (one call on `systemPrompt()`, scales not numbers) → `normalizeConcept()` → spells (`chooseSpellFocus` → `getSpellCandidates` → `selectSpells`) → equipment (`getEquipmentCandidates` → `selectEquipment`) → feats/abilities/loot grounded to bounded real catalogs → `resolveConcept(..., { exactContent: true })` builds a completion manifest; an unresolved required pick blocks Create → `createActor()` clones real items and verifies persisted sources. Published picks keep their exact issued source references; custom abilities stay labeled narrative-only. After Create, `stat-check.mjs` compares the sheet with GM Core bands and only reports (it whispers the GM when something is off). Loot reroll is one small `generateLoot()` call. The art and token structure come from the closest bestiary creature (`art.mjs` `findBestiaryScaffold`). Encounter mode: `designEncounter()` sets a theme and per-role briefs, then runs the creature pipeline per member (N× the prompt cost), 3 at a time, or 1 at a time on a local provider (`pool.mjs`). Elite/Weak (Alien Core pp. 204/207) is applied once through the system's `adjustment`. **Reskin** mode: the GM drops an NPC; the AI writes new fiction and may rename strikes/abilities by id; stats, rules, traits and items are unchanged unless the GM re-levels the copy (`relevel.mjs`), and renamed items keep their original slug (`pf2eSluggify`).

**Player character** (`pc-builder.mjs`): no math layer. It embeds real ABC/heritage/feat items with correct `system.build` data and the system derives AC/HP/saves itself. `normalizePCConcept()` → `resolvePCConcept()` → `createCharacterActor()`. Single class; no pre-create edit screen.

**Item Forge** (`item-builder.mjs`, `rule-templates.mjs`, `itemforge-app.mjs`): passive items reuse unchanged rules from published `sf2e.equipment` (`getForgeEffectCatalog`); 1/day activations use pre-written macros (`macro-templates.mjs`). Weapons and armor clone a real base, set a native `system.grade` and install real upgrades in `system.subitems`. The system derives price and level.

| File | Role |
| --- | --- |
| `simplysf2e.mjs` | Entry: settings, launchers, `/sf2e` chat command, welcome auto-open, Actors right-click Reskin. |
| `ai.mjs` + `ai-response-validation.mjs`, `ai-task-profiles.mjs`, `ai-candidate-format.mjs` | All AI calls and prompts (`systemPrompt()`, `pcSystemPrompt()`, `lootGuide()`); streaming, retry-once, fail-closed JSON; per-task shape checks, token caps, candidate encoding. |
| `jev.mjs` / `jev-picks.mjs` | Jev fast picks (TypeSafe System One via OpenRouter or a TypeSafe endpoint): picks only, any doubt returns null so the chat model runs. |
| `settings.mjs` | Settings, exact-endpoint API-key binding (no key over plain http to the internet), provider readiness, the named connection bank. |
| `builder.mjs` | NPC pipeline + shared resolve/build helpers; `reskinActorData()`. |
| `compendium.mjs` | `findEntry`, pack indexes, candidate lists (`getShopCandidates` too), `DEFAULT_PACKS`, `priceToGp`, `RARITY_RANK`. |
| `tables.mjs` / `pc-tables.mjs` | Cited GM Core numbers / PC cadence, casting profiles, slot counts. |
| `pc-builder.mjs` + `pc-skills.mjs`, `pc-prerequisites.mjs`, `pc-loadout.mjs`, `pc-support.mjs`, `class-paths.mjs`, `choice-set.mjs` | PC pipeline; skill allocation; fail-closed feat prerequisites; equipment readying; complete-only classes (+ unwired multiclass map); L1 `item:tag:` class paths; pre-answered `ChoiceSet`s. |
| `completion.mjs` / `post-create.mjs` | Required-content manifests, persisted-source checks, create rollback. |
| `art.mjs` | Bestiary scaffold choice (prefers mapped art) and `scaffoldArt()`. |
| `reskin.mjs` / `relevel.mjs` / `reroll.mjs` / `stat-check.mjs` | Reskin copy, re-level by GM Core scale steps, reroll one pick, post-create stat report. |
| `item-builder.mjs` / `rule-templates.mjs` / `runes.mjs` / `macro-templates.mjs` | Forge assembly and pricing; passive-effect catalog; grades + upgrade candidates (+ legacy rune zeroing); activation macros. |
| `currency.mjs` + `currency/credstick.mjs`, `currency/upb.mjs` | Credits/UPB from verbatim v14-dev templates (as `.mjs`, because Firefox ESR 128 can't parse JSON import attributes; `import-attributes.test.mjs` blocks new JSON imports); 1 gp = 10 credits. |
| `shop.mjs`, `treasure.mjs` (+ `-app.mjs`) | Shop (`loot` actor, `lootSheetType: "Merchant"`) and Treasure hoard (`"Loot"`) windows. |
| `welcome.mjs`, `whats-new.mjs` (+ `-app.mjs`) | Welcome opens for a GM until the AI connection works or "Don't show again". What's new opens once per GM browser after an update with unseen notes, and silently seeds on a fresh install. |
| `generator-app.mjs`, `itemforge-app.mjs`, `manage-presets-app.mjs`, `sources-app.mjs`, `provider-setup-app.mjs`, `app-base.mjs` | UI windows over the shared shell (connection switch, token report, progress bar). |
| `presets.mjs`, `encounter.mjs`, `pool.mjs`, `party.mjs`, `folders.mjs`, `handout.mjs`, `generator-memory.mjs`, `recent-generations.mjs`, `progress.mjs`, `tokens.mjs`, `bug-report.mjs`, `text.mjs` | Presets; XP budgets; bounded concurrency; party summary; flagged folders (Creatures, NPCs, Characters, Shops, Treasure); NPC handouts (portrait, blurb, read-aloud only); remembered settings (never the prompt); recent previews; progress math; token counts; redacted bug report; slugify/escaping. |
| `*.test.mjs` | Standalone regression checks; CI runs all of them. |

## 6. How work runs

JT's standing rules (2026-10-25).

| Role | Model / settings | Does |
| --- | --- | --- |
| Coordinator | Opus 5.5, high effort | Makes every plan; fetches and cites sf2e source; dispatches; runs the review ladder; integrates; merges; updates this file. Never hands off release/workflow `.yml` reasoning. |
| Planner (optional) | Opus 5.5 `Plan` agent, high effort | Second opinion on a large or risky plan; the coordinator still owns it. |
| Worker | Haiku 5.5: `model: "haiku"`, `effort: "high"`, `isolation: "worktree"`, `run_in_background: true` | One task in its own worktree. Commits there; never pushes. |
| Schema worker | Sonnet 5.5, high effort, worktree | Any task that depends on sf2e/Foundry field names, enums, pack ids or rule shapes. Uses only the cited source pasted into its prompt. |
| Reviewers | Tier 1 Haiku → tier 2 Sonnet → tier 3 Opus (high effort, fresh context, never the builder) | Every finished worktree gets tiers 1 and 2. Tier 3 is added for schema- or balance-sensitive diffs (`tables.mjs`, `relevel.mjs`, `stat-check.mjs`, stat math, pack ids, enums, REs, PC grants/slots). |
| Extra capacity (optional) | DeepSeek Flash 4.1 (free tier, per JT) in opencode terminals via the Orca `orchestration` skill | Bulk read-only sweeps or mechanical edits. Same review ladder; never given secrets. |

A reviewer that must run tests needs an agent type that can run `node` (`general-purpose`). `caveman:cavecrew-reviewer` is told to use only git read commands, so it will not run tests. Treat any "verified" claim without a quoted source line as unverified.

**Lifecycle.**
1. **Plan:** goal, stop condition, and the files each task may touch. Do every sf2e lookup now and keep the quoted lines for the worker prompts.
2. **Split:** one task per worktree, with no file overlap between parallel tasks. This file, CLAUDE.md and AGENTS.md belong to the coordinator.
3. **Dispatch:** send all independent tasks in one message.
4. **Review ladder:** tier 1 → tier 2 (→ tier 3). A finding goes back to the same worker (`SendMessage`) as a **new** commit, never an amend, and the fix climbs again from the tier that found it. Minor findings in coordinator-owned docs are fixed by the coordinator instead.
5. **Integrate:** make one branch from `main`, `git merge --no-ff` each passed worktree branch, then give the combined diff its own tier 1 + tier 2 review and run `bash tools/release-check.sh` (`--no-ui` only if no template/CSS changed).
6. **PR and merge:** push, open **one** PR for the batch (each merge is a public release), and wait for `verify`. The coordinator may merge once an independent reviewer has no open blockers and `verify` is green on the current head.
7. **Tidy:** `git worktree remove` each worktree and delete local `worktree-agent-*` branches. Ask JT before any authenticated GitHub write. JT's standing authority covers push, PR and merge only, so deleting a remote branch needs JT's OK.
8. **Hand off:** rewrite §1; add lessons to §8.

**Worker prompt template.**
```
You are a <Haiku|Sonnet> worker on simplySF2e (Foundry VTT module for Starfinder 2e; ES modules in scripts/*.mjs; tests: node scripts/<name>.test.mjs). Task <ID> — <title>.
Context (verified by the coordinator): <facts with file:line and quoted evidence>
Do exactly this: 1. <step with file + line anchor> 2. ...
Cited source values you may use (do not look up or invent others): <quoted v14-dev lines | none>
Rules: only change <files>. No hand-authored REs, no invented schema, no AI-chosen numbers; esc/toHtml for AI text; fail closed. Keep CRLF and file style.
Git: git config user.name "jt"; git config user.email "jt_f@ymail.com"; commit in your worktree only; do NOT push or open PRs.
Verify: node --check touched .mjs; the all-tests loop prints no FAIL; git diff --check. Add a *.test.mjs for changed pure logic.
Report: worktree path, branch, SHA, files, test summary, anything unverified (quote a source line for every "verified").
```

**Reviewer prompt template.**
```
Independent review (tier <n>, <model>) of <branch/commit> in simplySF2e. Read-only: do NOT edit, commit or push.
Worktree: <path>. Diff: git -C <path> diff <main-sha> HEAD. Intent: <one sentence, incl. "no behavior change" if so>.
Check: 1. <specific risks: removed names still referenced, runtime-built keys, schema shapes, balance numbers> 2. any other behavior change 3. run node --check + the all-tests loop.
Output: one finding per line `path:line: severity: problem. fix.` (blocker/major/minor) or "no findings"; end with VERDICT: PASS|FAIL + test result.
```
Tier 2 and tier 3 prompts state what the lower tiers already checked. They then look deeper: indirect callers (namespace imports, `module.api`, macro bodies as strings, Hooks), lost side effects, lost coverage of live code, and wording a GM will read.

## 7. Verified against real source — do not re-litigate

The first four bullets are PF2e-era checks inherited with the builders (re-verify if the schema area is reworked); the rest were checked against v14-dev sf2e between 2026-10-01 and 2026-10-25.

- Setting all five `build.attributes.boosts` tiers regardless of level is safe (`character/document.ts` slices by `allowedBoosts`).
- A PC spellcasting entry's `proficiency.value` is a floor, not a cap (`spellcasting-entry/document.ts` takes `Math.max` with `base-spellcasting`).
- `details.languages.value` is not truncated; the system adds Int mod to `build.languages.max`.
- Do not write `system.price`/`system.level` on a graded/runed item: `physical/document.ts` `computeLevelRarityPrice()` recomputes both.
- A PC's focus pool needs no rule: `resources.focus.max` resets to 0 each prep and each embedded non-cantrip focus spell adds 1, capped at 3 (`item/spell/document.ts`, `creature/document.ts`; re-verified 2026-10-02). An NPC pool is plain actor data. Only Mystic and Witchwarper have focus spells.
- Credits/UPB: `ActorInventory.addCurrency` clones bundled `credstick.json`/`upb.json`; the credit amount is `system.price.value`. No sf2e gold-piece UUIDs exist.
- G1 skills: sf2e adds `computers` (int) and `piloting` (dex) (`src/scripts/config/index.ts`). NPC core skills are written to `system.skills.<slug>.base`, never as lore items (`item/lore.ts` appends `-lore`).
- Spell consumables are spell **gems**, not scrolls (`config/spell-consumables.ts`).
- The rest hook is still `pf2e.restForTheNight` in v14-dev; no `sf2e.` variant exists.
- Module art: the system's own `moduleArt` map (`system/module-art.ts`) only registers `pf2e.*` packs, so sf2e creatures get art-module art through Foundry core `CompendiumArt`. Core `CompendiumArt` injects that art into compendium documents, so a scaffold's `img`/`prototypeToken.texture` already carry it. This is inferred from core's type docs (core JS isn't public); if it ever fails, the creature falls back to the sf2e default art. The system default actor art is `systems/sf2e/icons/default-icons/<type>.svg` (`actor/base.ts` `getDefaultArtwork`), which is also what every sf2e NPC ships.
- Creature data snaps to published values: speeds and sense ranges to the 452 NPCs of the seven creature packs; generated casters get 3 slots per rank (`NPC_SLOTS_PER_RANK`); Recall Knowledge follows GM Core pg. 54; narrative abilities with dice/DC/HP text are dropped; a strike named after a carried weapon takes that weapon's damage, traits and range.

## 8. Traps and lessons

Each line is a bug class that already cost a fix. The full story is in `docs/archive/history-pf2e.md`.

**Foundry / system data (silent failures)**
- A wrong pack id (`pf2e.*` instead of `sf2e.<name>`), RE key, or slug vs camelCase matches nothing and fails quietly. Check the real source.
- Runtime-built translation keys look unused to `i18n-keys.test.mjs` (§4). The 2026-10-25 cleanup nearly deleted two live ones; the tier-1 review caught it.
- PC feat placement: slot feats set `system.location` to `<group>-<level>` (Free Archetype: `archetype-<level>`, category still `class`); ABC-granted feats use the granting item's `_id` (`pc-builder.mjs`).
- Attribute boosts live on each ABC item (`boosts[*].selected`, `keyAbility.selected`), applied by `assignItemBoosts`/`resolveKeyAbility`; skill increases follow the class's own `skillIncreaseLevels`.
- Background Lore is an embedded `type: "lore"` item at rank 1. NPC core skills are `system.skills.<slug>.base`.
- Item pre-create hooks shift current HP, so set PC HP to the derived max after embedding. Awaiting embedded creation does not settle detached `_onCreate` rule updates.
- `GrantItem.preselectChoices` skips option predicates: keep predicate exclusions, and leave predicated or dynamic choices to native prompts (`choice-set.mjs`). A finished create does not mean every choice is answered; report unresolved hints.
- Graded property-rune keys put the grade first (`greaterFlaming`; use `propertyRuneKey`). Exclude fundamental runes from property candidates or they are priced twice (`runes.mjs`, legacy path).
- A scaffold token's `name` and `texture` are copied onto the new actor; set the name and keep mapped token art (`createActor`, `reskin.mjs`).

**Pipeline safety**
- Exact-reference resolvers check the issued candidate identity plus pack. Pack membership alone lets a forged `{packId, _id}` through.
- Clear a draft only after writes verify; roll back only documents this run created; a retry must not duplicate actors.
- Each run owns an AbortSignal. `Cancelled` is never retried or reported as a timeout. Parse AI JSON with string-aware brace matching; a `length` truncation fails closed; reasoning-channel text is never the answer; the final SSE record can arrive at EOF.
- An explicit empty AI selection is a valid answer, not a failure. Candidate lists have fixed ceilings and are never expanded to fit.
- API keys never live in world settings and are bound to their exact endpoint; no key goes over plain http to the internet (`settings.mjs`).
- Macro bodies cannot import helpers: they embed a fixed `escHtml` and receive pre-escaped names (`macro-templates.mjs`).

**Release and process**
- A tag pushed with the default `GITHUB_TOKEN` does not fire `push: tags`; releases chain through `workflow_call`. In a reusable workflow, `github.event_name` is the caller's event, so use `inputs.version`. `node --check` never catches these; a `.yml` change needs a real test merge.
- Fresh-context review has caught real bugs many times; a builder's self-report is not verification.
- Parallel workers need one worktree each and disjoint files; shared worktrees collided before. Inline `git -c user.name=...` flags misparse in this shell; set identity with `git config` in the worktree.
- JT sometimes merges while a review is still running. Say when one is in flight; fixes for a merged PR go in a new PR.
- Scripts are CRLF on Windows checkouts. Keep each file's existing endings; `git diff --check` must stay clean.
- Squash merges hide merged branches from `git branch --merged`; match branch tips to merged PR heads through the GitHub API.

## 9. Known gaps (by design or deferred)

- **Focus:** a focus-only NPC (no tradition, so no DC) is unsupported. The NPC pool size (spell count, max 3) is a module default.
- **Item Forge passives** exist only for kinds with a published `sf2e.equipment` exemplar: item bonus, resistance, sense. Weakness, immunity and speed are hidden. No sf2e item uses an `etched-onto-*` usage.
- **Upgrades:** only `installed-in-a-weapon` / `installed-in-armor` usages are offered (`runes.mjs`, cited to `usage.ts`). Upgrade slot counts are **uncited and on hiatus** (`parseUpgradeCapacity` defaults to weapon 1 / armor 0). Prerequisites and exclusivity are not validated; shields and ammo are out of scope.
- **PC skills/feats:** unknown grant timing and missing class data are warned, not inferred. Duplicate native feat grants and new Lore replacements stay manual; not live-tested. Class-path details (Operative specialization, Sniper; Solarian has no `item:tag` path) are in `class-paths.mjs`; Mystic/Witchwarper casting (3 slots per rank, 5 cantrips, 10th rank at 19) in `pc-tables.mjs`. Free Archetype slot placement and ordinary prerequisites are checked (`pc-prerequisites.mjs`); a full prerequisite graph is unbuilt.
- **Rarity cap** covers ancestry/background/heritage only, by design.
- **Multiclass** is unbuilt: sf2e has dedications for all six classes and `pc-support.mjs` maps them, but nothing calls the map.

## 10. Archive (read only when needed)

- `docs/archive/history-pf2e.md`: the full session narrative and bug log, mostly inherited from the simplyPF2e parent. Search it before re-investigating an old question; §8 holds the lessons that still apply.
- `docs/archive/gm-ready-checklist.md`: G1–G14, how the module reached Beta.
- `docs/archive/next-steps.md`, `docs/archive/ui-audit.md`: the finished UI polish and Jev plans, and the 2026-10-02 UI audit.
- `docs/archive/pf2e/`: the PF2e-era audit.
- Live docs outside the archive: `README.md` (GM guide), `docs/qa-checklist.md` (live QA script), `tools/ui-preview/README.md`.
