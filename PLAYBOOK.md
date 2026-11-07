# simplySF2e playbook

The one file every agent (Claude, Codex, anything else) reads first. It holds where the project stands, the rules, how to run things, how work is delegated and reviewed, and the traps already found. CLAUDE.md and AGENTS.md only point here. The user-facing guide is README.md. Older material lives in `docs/archive/` and is not needed for normal work.

**Update this file at the end of every session:** rewrite §1 "Where we are", and add durable lessons to §8. Keep it short; move anything finished or historical to `docs/archive/`.

## 0. Start here

1. **Coordinator:** read §1 to §3 and §6, then other sections as the task needs. **Worker or reviewer:** follow your prompt and read §3, §4 and §8.
2. `git log --oneline -10` and `git status`. Git is authoritative for branch state, not any file.
3. Baseline: run the all-tests command in §4.
4. If §1 lists a review in flight, check whether its PR merged mid-review. If it did, ship fixes as a **new** PR.
5. End every session with the tree clean or committed on a named branch, never with uncommitted work on `main`.

## 1. Where we are (rewrite each session)

*Updated 2026-11-07.* Status **Beta**. `main` at `3e3bdde`. Beta channel is **v0.1.14** (`releases/download/beta/module.json`); stable `releases/latest` is still **v0.1.11** (tag = `0ff0561`). Verify with `https://github.com/simplyjaytea/simplySF2e/releases/latest/download/module.json`.

**Merged 2026-11-07:** #80 (the `batch/b1` batch: one-screen Welcome (M6), glossary-ability fills, Area Blast and Aura templates, inert AI text, cost per run, re-level rebuilds, error copy, listing fields, CHANGELOG, Generator/Shop layout fixes) -> beta v0.1.13; #79 (this playbook's herdr workflow) -> beta v0.1.14.

**This PR (`docs/playbook-v0114`):** repo cleanup (dead code, unused keys, i18n-keys runtime-family allow-list, archived `multiclass-plan.md` and `openai-oauth-investigation.md`, stale doc lines fixed, CHANGELOG regenerated), README refresh for v0.1.14, and this playbook update. Reviewed: cleanup by Kimi, README by Sonnet; both fix rounds applied.

- **UI plan (approved, not started):** `docs/ui-plan.md` — all ten items from Kimi's UI review plus four polish nits, one commit per item; waiting for Kimi usage. Build before the next live test (JT's choice), then extend `docs/beta-pass.md`.
- **Next:** JT live-tests v0.1.14 on the beta manifest, then promotes to stable (Actions > Release, version `0.1.14`, channel `stable`, ref tag `v0.1.14`) and checks `releases/latest/download/module.json`. Further ability templates (grab, on-hit riders, burst) only after Area Blast and Aura are live-tested. M8/M9 in `docs/consumer-plan.md`.
- **Waiting on JT:** live pass of `docs/qa-checklist.md` logged to `docs/live-log.md` — new rows 2.8-2.13 (filled abilities, Area Blast, Aura), 12t.* (Welcome), 12ab.* (re-level), 13m (cost), plus 12aa.* (run budget); a hosted model-matrix run (`MATRIX_API_KEY`, `tools/model-matrix/config.example.json`) and a local one on JT's machine (`--local`, see `tools/model-matrix/README.md`)
- **Aura numbers (JT confirmed 2026-11-07):** condition auras 10/30/90 ft, value 1 (level <= 7) / 2 (8-13) / 3 (14+) capped at 2 except sickened, save fixed per condition; damage auras 5/10/30 ft, dice `AREA_DAMAGE` unlimited at level - 2, basic save; DC `SPELL_DC` moderate default (GM Core pg. 129); immunity 1 minute.
- **JT decisions 2026-11-07:** run deadline default 5 minutes (0 = off; slow local encounters can hit it, GMs can raise it); D5 tier-1 models: `deepseek/deepseek-v4.1-flash`, `openai/gpt-5.4-mini`, `anthropic/claude-haiku-5.5` (Google dropped) plus whatever JT runs in local Ollama (the matrix tests every installed model with `--local`).
- **Earlier JT decisions still in force:** Welcome (Google shown "live check pending"; GM picks the model when the default is missing; sample monster = preview only; readiness only as a failure banner; Anthropic = OpenRouter filtered to `anthropic/*`); published-creature values where GM Core has no rule; fill rules R1-R7 (`ability-fill.mjs`); Area Blast cone/line rules (`ability-templates.mjs`); hoard budgets independent of rarity; feat cap 8; D6 60k run budget; D3, D5, D8-D11 Fable's recommendations until JT changes them.
- **sf2e 1.7.0** (2026-11-05, v14-dev `52dfeee`): offline compatible (drift clean, benches identical). Live checks pending; `BENCH_SHA` now pins it.
- **Bench baselines (pinned `52dfeee` = tag sf2e-1.7.0 since 2026-11-07; identical on the old pin `675d2b7`):** class 49/31/0, forge 126/48/0 (+6 n/a), market 240/0/0, creature 35/2/0. UI harness: all 82 fixtures pass.
- **Environment:** Linux VPS (bash, Node 22+, `gh` authenticated). Agents as herdr terminals (§6). Repo `/root/simplySF2e`; worktrees `/root/sf2e-wt/`; prompts `/root/sf2e-wt/prompts/`, reports `/root/sf2e-wt/reports/`. Git identity `jt` / `jt_f@ymail.com`. Rules reference: `https://2e.aonsrd.com/rules/<id>-<slug>`.

## 2. The project

Foundry VTT module `simplysf2e`. An AI generates Starfinder 2e NPCs/monsters, encounters, player characters, magic items, shops and treasure from a text prompt. Every named pick is grounded against the real installed `sf2e` compendium. Repo `simplyjaytea/simplySF2e`. Targets system **`sf2e` 1.6.0+** (cited against tag `sf2e-1.6.1` of the pf2e repo, Foundry 14.361 min / 14.369 verified). The 1.5.1→1.6.1 diff changed no pack ids; it added the Tech Core classes Mechanic and Technomancer.

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
6. **Never push or merge to `main` directly.** Branch + PR. A merge to `main` auto-publishes a public **beta** release (beta-manifest installs update). Promoting to **stable** (every install) is a separate, deliberate Release dispatch.
7. **Design choices go to JT first:** UX, scope, balance numbers, and anything this file does not already decide.

## 4. Commands

No build step: Foundry loads `scripts/simplysf2e.mjs` and the plain ES modules it imports. Node 22+. Run from the repo root in bash.

| Task | Command |
| --- | --- |
| One test | `node scripts/<name>.test.mjs` (standalone `node:assert` script; non-zero exit = fail) |
| All tests | `for f in scripts/*.test.mjs; do node "$f" >/dev/null 2>&1 \|\| echo FAIL $f; done` |
| Syntax | `node --check scripts/<file>.mjs` |
| Pre-release gate | `git fetch origin main && bash tools/release-check.sh` (`--no-ui` skips screenshots; bash 4.4+) |
| UI screenshots | `cd tools/ui-preview && npm install && npm install --no-save playwright@1.64.1 && node shoot.mjs` → PNGs in `tools/ui-preview/out/` at 720 px and 460 px (pin Playwright: the latest wants a browser build that is not downloaded) |

- **`tools/release-check.sh`** reruns every self-checkable check: syntax, all tests, duplicate keys in `module.json`/`lang/en.json`, missing manifest/template paths, merge-conflict markers, duplicate QA row ids, `git diff --check` against `origin/main`, and the UI harness. `tools/` never ships in the release zip.
- **Versioning and channels (from 2026-10-25):** each merge to `main` auto-publishes the next patch tag as a **beta** pre-release. It also refreshes the rolling `beta` release, whose `module.json` is the beta manifest. Stable installs follow `releases/latest`, which GitHub never points at a pre-release, so a merge no longer reaches them. To promote, run Actions > Release > Run workflow with a `version` and channel `stable`. Pick the tested beta's tag (for example `v0.1.4`) as the ref, so exactly that commit ships; `main` may already hold newer merges. A minor bump (as for v0.1.0) works the same way; later merges count up from it.
- **CI** (`.github/workflows/pull-request.yml`, job `verify`): `node --check` on every `scripts/**/*.mjs`, the golden replay suite, the AI fuzz suite, every `*.test.mjs`, `jq empty module.json lang/en.json`, `git diff --check` base..head. `.github/workflows/benches.yml` runs the class bench and the three pipeline benches against a **pinned** sf2e source (`BENCH_SHA`) and fails on FAIL only. `.github/workflows/sf2e-drift.yml` runs weekly. **`main` has no branch protection, so nothing is a required check: the coordinator must read the `Benches` and `verify` runs before merging.** Merging to `main` runs `auto-release.yml`.
- **Licensing.** Code is MIT (`LICENSE`). `LICENSES.md` carries the ORC Notice, the attribution for every Paizo book whose rules the module ships (today *Starfinder Player Core*, *GM Core*, *Tech Core*), and Paizo's Community Use Policy notice; it ships in the release zip. When a task transcribes rules from another book, add that book's exact credit line to `LICENSES.md` in the same PR.
- **Tests are pure logic only.** Anything that needs a live world goes into `docs/qa-checklist.md` and the PR body.
- **Runtime-built translation keys.** `i18n-keys.test.mjs` sees only literal keys. These families are built at runtime, so a key that looks unused may be live: `Treasure.Amount*` (`treasure-app.mjs`), `TreasureAmount.*` (`generator-app.mjs`, `manage-presets-app.mjs`), `Mode.*`, `Role.*`, `Threat.*`, `StatCheck.*`, `Skills.*`, `Loadout.*`, `Rarity.*`, `Shop.Size*`/`Category*`, `Preview.*`. Grep for the prefix before deleting a key.
- **Every PR with a GM-visible change** adds one `RELEASE_NOTES` entry (new unique `id`, i18n title/body in `lang/en.json`) at the top of `scripts/whats-new.mjs`.
- **UI changes:** run the screenshot harness and look at both widths. It has no Foundry core CSS and exits non-zero when a fixture is out of step with its template (`tools/ui-preview/README.md`). Narrow-window CSS uses `@container spf-window` on `.window-content`, never viewport `@media`. Shared styles are in `styles/simplysf2e.css`; single-window rules are in `styles/apps/<app>.css`.

## 5. Architecture and file map

Three actor/item pipelines over shared compendium and table code, plus the Shop, Treasure and setup windows. Reskin is a Generator mode, not a separate window.

**NPC / creature** (`builder.mjs`, the most tested path): `generateConcept()` in `ai.mjs` (one call on `systemPrompt()`, scales not numbers) → `normalizeConcept()` → spells (`chooseSpellFocus` → `getSpellCandidates` → `selectSpells`) → equipment (`getEquipmentCandidates` → `selectEquipment`) → feats/abilities/loot grounded to bounded real catalogs → `resolveConcept(..., { exactContent: true })` builds a completion manifest; an unresolved required pick blocks Create → `createActor()` clones real items and verifies persisted sources. Published picks keep their exact issued source references; a bespoke ability is either an Area Blast/Aura template (module-built from a published scaffold, numbers from tables; `ability-templates.mjs`) or narrative-only; the 7 blank glossary abilities are filled per level (`ability-fill.mjs`). After Create, `stat-check.mjs` compares the sheet with GM Core bands and only reports (it whispers the GM when something is off). Loot reroll is one small `generateLoot()` call. The art and token structure come from the closest bestiary creature (`art.mjs` `findBestiaryScaffold`). Encounter mode: `designEncounter()` sets a theme and per-role briefs, then runs the creature pipeline per member (N× the prompt cost), 3 at a time, or 1 at a time on a local provider (`pool.mjs`). Elite/Weak (Alien Core pp. 204/207) is applied once through the system's `adjustment`. **Reskin** mode: the GM drops an NPC; the AI writes new fiction and may rename strikes/abilities by id; stats, rules, traits and items are unchanged unless the GM re-levels the copy (`relevel.mjs`; it also rebuilds module-built abilities from their `flags.simplysf2e.built` provenance), and renamed items keep their original slug (`pf2eSluggify`).

**Player character** (`pc-builder.mjs`): no math layer. It embeds real ABC/heritage/feat items with correct `system.build` data and the system derives AC/HP/saves itself. `normalizePCConcept()` → `resolvePCConcept()` → `createCharacterActor()`. Single class; no pre-create edit screen.

**Item Forge** (`item-builder.mjs`, `rule-templates.mjs`, `itemforge-app.mjs`): passive items reuse unchanged rules from published `sf2e.equipment` (`getForgeEffectCatalog`); 1/day activations use pre-written macros (`macro-templates.mjs`). Weapons and armor clone a real base, set a native `system.grade` and install real upgrades in `system.subitems`. The system derives price and level.

| File | Role |
| --- | --- |
| `simplysf2e.mjs` | Entry: settings, launchers, `/sf2e` chat command, welcome auto-open, Actors right-click Reskin. |
| `ai.mjs` + `ai-response-validation.mjs`, `ai-task-profiles.mjs`, `ai-candidate-format.mjs` | All AI calls and prompts (`systemPrompt()`, `pcSystemPrompt()`, `lootGuide()`); streaming, retry-once, fail-closed JSON; per-task shape checks, token caps, candidate encoding. |
| `jev.mjs` / `jev-picks.mjs` | Jev fast picks (TypeSafe System One via OpenRouter or a TypeSafe endpoint): picks only, any doubt returns null so the chat model runs. |
| `settings.mjs` / `provider-connect.mjs` | Settings, exact-endpoint API-key binding (no key over plain http to the internet), provider readiness, the named connection bank (with optional manual prices), settings schema + `migrateSettings()`; the shared save/snapshot/restore used by Provider Setup and Welcome. |
| `builder.mjs` | NPC pipeline + shared resolve/build helpers; `reskinActorData()`. |
| `ability-fill.mjs` / `ability-templates.mjs` | Placeholder detection and the R1-R7 fills for the 7 blank glossary abilities; Area Blast and Aura templates (`normalize*`/`build*`, `buildModuleTemplate`). |
| `compendium.mjs` | `findEntry`, pack indexes, candidate lists (`getShopCandidates` too), `DEFAULT_PACKS`, `priceToGp`, `RARITY_RANK`. |
| `tables.mjs` / `pc-tables.mjs` | Cited GM Core numbers / PC cadence, casting profiles, slot counts. |
| `pc-builder.mjs` + `pc-skills.mjs`, `pc-prerequisites.mjs`, `pc-loadout.mjs`, `pc-support.mjs`, `class-paths.mjs`, `choice-set.mjs` | PC pipeline; skill allocation; fail-closed feat prerequisites; equipment readying; multiclass and dedication support; L1 `item:tag:` class paths; pre-answered `ChoiceSet`s. |
| `completion.mjs` / `post-create.mjs` | Required-content manifests, persisted-source checks, create rollback. |
| `art.mjs` | Bestiary scaffold choice (prefers mapped art) and `scaffoldArt()`. |
| `reskin.mjs` / `relevel.mjs` / `reroll.mjs` / `stat-check.mjs` | Reskin copy, re-level by GM Core scale steps, reroll one pick, post-create stat report. |
| `item-builder.mjs` / `rule-templates.mjs` / `runes.mjs` / `macro-templates.mjs` | Forge assembly and pricing; passive-effect catalog; grades + upgrade candidates (+ legacy rune zeroing); activation macros. |
| `currency.mjs` + `currency/credstick.mjs`, `currency/upb.mjs` | Credits/UPB from verbatim v14-dev templates (as `.mjs`, because Firefox ESR 128 can't parse JSON import attributes; `import-attributes.test.mjs` blocks new JSON imports); 1 gp = 10 credits. |
| `shop.mjs`, `treasure.mjs` (+ `-app.mjs`) | Shop (`loot` actor, `lootSheetType: "Merchant"`) and Treasure hoard (`"Loot"`) windows. |
| `welcome.mjs`, `whats-new.mjs` (+ `-app.mjs`) | One-screen Welcome (provider, key, Connect, model pick, sample monster); opens for a GM until the AI connection works or "Don't show again". What's new opens once per GM browser after an update with unseen notes, and silently seeds on a fresh install. |
| `generator-app.mjs`, `itemforge-app.mjs`, `manage-presets-app.mjs`, `sources-app.mjs`, `provider-setup-app.mjs`, `app-base.mjs` | UI windows over the shared shell (connection switch, token report, progress bar). |
| `presets.mjs`, `encounter.mjs`, `pool.mjs`, `party.mjs`, `folders.mjs`, `handout.mjs`, `generator-memory.mjs`, `recent-generations.mjs`, `progress.mjs`, `tokens.mjs`, `cost.mjs`, `bug-report.mjs`, `text.mjs` | Presets; XP budgets; bounded concurrency; party summary; flagged folders (Creatures, NPCs, Characters, Shops, Treasure); NPC handouts (portrait, blurb, read-aloud only); remembered settings (never the prompt); recent previews; progress math; token counts (+ `cost.mjs` run cost); redacted bug report; slugify/escaping and `inertProse`/`escAi` (AI text in enriched fields). |
| `*.test.mjs` | Standalone regression checks; CI runs all of them. |

## 6. How work runs

JT's standing rules (2026-11-05). Three long-lived agents run as terminals in one herdr workspace on the VPS. Each may spawn its own subagents.

| Role | Terminal | Does |
| --- | --- | --- |
| Coordinator | Claude Code, Opus 5.5 | Plans every task; fetches and cites sf2e source; creates worktrees; dispatches; reviews last (tier 3); integrates; opens PRs and merges; owns this file, CLAUDE.md and AGENTS.md. Writes code only when no worker fits. Never hands off release/workflow `.yml` reasoning. |
| Planner (optional) | Opus `Plan` subagent of the coordinator | Second opinion on a large or risky plan; the coordinator still owns it. |
| Default worker | Claude Code, Haiku 5.5 | **Most tasks go here:** mechanical edits, tests, sweeps, docs, bench runs, tier-1 review. |
| Heavy worker | Kimi Code, K3.1 Pro (thinking high) | UI (templates, CSS, screenshot harness), art, and tasks needing deeper reasoning, including schema-dependent work (sf2e field names, enums, pack ids, REs) from cited source. Tier-2 review. |

**Talking to terminals** (`hc` = `herdr-core`). Addresses (`t6`, `t8`, ...) change when a terminal restarts; run `hc ls` and match the `agent` field (`kimi-code`, `claude-code`) before dispatching. Check `hc read <t>` to tell the two Claude terminals apart.
- Dispatch: check `hc ls` first, then `hc send <t> "<prompt>"`. Never send to a `working` terminal; it lands mid-turn. (`--if idle` refuses a terminal whose status is `done`, which is also safe to send to.)
- Wait: `hc wait <t>` (not `sleep`). Long tasks: dispatch both workers first, then wait on each.
- Result: workers and reviewers write their report to `/root/sf2e-wt/reports/<ID>.md` and reply `DONE <ID>`. Do not rely on `hc read`: a TUI agent redraws its screen, so history past the visible pane is lost.
- Before a new, unrelated task, send `/clear` to the Haiku terminal (separate `hc send`, wait a few seconds) so old context does not leak in.
- Long prompts: write them to `/root/sf2e-wt/prompts/<ID>.md` and send `Read /root/sf2e-wt/prompts/<ID>.md and do the task.` Pasted multi-line text can be split into several turns.

**Review ladder.** Tier 1 Haiku → tier 2 Kimi → tier 3 coordinator. Nobody reviews their own diff: if the coordinator wrote it, tier 3 is a fresh Opus subagent; if Haiku built it, tier 1 is a fresh Haiku subagent spawned by the coordinator, and if Kimi built it, tier 2 is a fresh Claude subagent (Sonnet, `general-purpose`, so it can run `node`) spawned by the coordinator. When Kimi is busy, tier 2 is a fresh Sonnet `general-purpose` subagent spawned by the coordinator; tiers 1 and 2 may then run in parallel. Every diff gets tiers 1 and 2. The coordinator reads every diff before merge and gives a full tier-3 review to schema- or balance-sensitive ones (`tables.mjs`, `relevel.mjs`, `stat-check.mjs`, stat math, pack ids, enums, REs, PC grants/slots). Treat any "verified" claim without a quoted source line as unverified. A reviewer must be able to run `node` (the terminals can; `caveman:cavecrew-reviewer` subagents only run git read commands, so they cannot verify tests).

**Lifecycle.**
1. **Plan:** goal, stop condition, and the files each task may touch. Do every sf2e lookup now and keep the quoted lines for the prompts.
2. **Split:** one task per worktree, no file overlap between parallel tasks. The coordinator creates each one: `git -C /root/simplySF2e worktree add /root/sf2e-wt/<ID> -b work/<ID> main`, then sets the git identity in it (§1). First time: `mkdir -p /root/sf2e-wt/prompts /root/sf2e-wt/reports`.
3. **Dispatch:** Haiku by default; Kimi for UI, art, schema or hard reasoning. Send independent tasks before waiting on any.
4. **Review:** a finding goes back to the same worker as a **new** commit, never an amend, and the fix climbs again from the tier that found it. Minor findings in coordinator-owned docs are fixed by the coordinator.
5. **Integrate:** one branch from `main`, `git merge --no-ff` each passed branch, read the merged files, then run `bash tools/release-check.sh` (`--no-ui` only if no template/CSS changed). A batch of more than one branch gets the ladder again on the combined diff (tier 1 + 2, + 3 if sensitive).
6. **PR and merge:** push, open **one** PR for the batch (each merge is a public beta release), and wait for `verify` and `Benches`. The PR body lists the QA ids JT must run live. JT's results go into `docs/live-log.md`; a feature is live-verified only when it has a logged PASS there. The coordinator may merge once reviews have no open blockers and CI is green on the current head.
7. **Tidy:** `git worktree remove` each worktree and delete its local `work/<ID>` branch. JT's standing authority covers push, PR and merge only; anything else that writes to GitHub (deleting a remote branch, editing a release, labels) needs JT's OK.
8. **Hand off:** rewrite §1; add lessons to §8.

**Worker prompt template.**
```
You are a worker on simplySF2e (Foundry VTT module for Starfinder 2e; ES modules in scripts/*.mjs; tests: node scripts/<name>.test.mjs). Read /root/simplySF2e/PLAYBOOK.md §3, §4 and §8 first. Task <ID> — <title>.
Work only in: /root/sf2e-wt/<ID> (branch work/<ID>, already created). cd there first.
Context (verified by the coordinator): <facts with file:line and quoted evidence>
Do exactly this: 1. <step with file + line anchor> 2. ...
Cited source values you may use (do not look up or invent others): <quoted v14-dev lines | none>
Rules: only change <files>. No hand-authored REs, no invented schema, no AI-chosen numbers; esc/toHtml for AI text; fail closed. Keep each file's line endings and style.
Git: commit in the worktree only; do NOT push, open PRs, or touch /root/simplySF2e itself.
Verify: node --check touched .mjs; the all-tests loop prints no FAIL; git diff --check. Add a *.test.mjs for changed pure logic.
Report: write /root/sf2e-wt/reports/<ID>.md with branch, SHA, files, test summary, anything unverified (quote a source line for every "verified"). Then reply only: DONE <ID>.
```

**Reviewer prompt template.**
```
Independent review (tier <n>) of work/<ID> in simplySF2e. Read-only: do NOT edit, commit or push.
Worktree: /root/sf2e-wt/<ID>. Diff: git -C /root/sf2e-wt/<ID> diff <main-sha> HEAD. Intent: <one sentence, incl. "no behavior change" if so>.
Check: 1. <specific risks: removed names still referenced, runtime-built keys, schema shapes, balance numbers> 2. any other behavior change 3. run node --check + the all-tests loop.
Output: one finding per line `path:line: severity: problem. fix.` (blocker/major/minor) or "no findings"; end with VERDICT <ID>: PASS|FAIL + test result. Write it to /root/sf2e-wt/reports/<ID>-T<n>.md, then reply only: DONE <ID>-T<n>.
```
Tier 2 and tier 3 prompts state what the lower tiers already checked. They then look deeper: indirect callers (namespace imports, `module.api`, macro bodies as strings, Hooks), lost side effects, lost coverage of live code, and wording a GM will read.

## 7. Verified against real source — do not re-litigate

The first four bullets are PF2e-era checks inherited with the builders (re-verify if the schema area is reworked); the rest were checked against v14-dev sf2e between 2026-10-01 and 2026-10-25.

- Setting all five `build.attributes.boosts` tiers regardless of level is safe (`character/document.ts` slices by `allowedBoosts`).
- A PC spellcasting entry's `proficiency.value` is a floor, not a cap (`spellcasting-entry/document.ts` takes `Math.max` with `base-spellcasting`).
- `details.languages.value` is not truncated; the system adds Int mod to `build.languages.max`.
- Never write grade-derived values (grade credits, grade level) into a graded/runed item's `system.price`/`system.level`. `physical/document.ts` `computeLevelRarityPrice()` derives both on every prep from the stored base price and level (`physical/helpers.ts:38-39,61`, sf2e-1.6.1), so keeping the cloned base's own values is correct, and adding grade values would double-count (re-verified 2026-10-25, `tools/pipeline-bench/FORGE-REPORT.md`).
- A PC's focus pool needs no rule: `resources.focus.max` resets to 0 each prep and each embedded non-cantrip focus spell adds 1, capped at 3 (`item/spell/document.ts`, `creature/document.ts`; re-verified 2026-10-02). An NPC pool is plain actor data. Mystic, Witchwarper and Technomancer have focus spells. A Technomancer's initial magic hack is not GrantItem'd by the data; `pc-support.mjs` maps each programming language `_id` to its hack (cited from each language's description, tag `sf2e-1.6.1`).
- Credits/UPB: `ActorInventory.addCurrency` clones bundled `credstick.json`/`upb.json`; the credit amount is `system.price.value`. No sf2e gold-piece UUIDs exist.
- G1 skills: sf2e adds `computers` (int) and `piloting` (dex) (`src/scripts/config/index.ts`). NPC core skills are written to `system.skills.<slug>.base`, never as lore items (`item/lore.ts` appends `-lore`).
- Spell consumables are spell **gems**, not scrolls (`config/spell-consumables.ts`).
- The rest hook is still `pf2e.restForTheNight` in v14-dev; no `sf2e.` variant exists.
- Module art: the system's own `moduleArt` map (`system/module-art.ts`) only registers `pf2e.*` packs, so sf2e creatures get art-module art through Foundry core `CompendiumArt`. Core `CompendiumArt` injects that art into compendium documents, so a scaffold's `img`/`prototypeToken.texture` already carry it. This is inferred from core's type docs (core JS isn't public); if it ever fails, the creature falls back to the sf2e default art. The system default actor art is `systems/sf2e/icons/default-icons/<type>.svg` (`actor/base.ts` `getDefaultArtwork`), which is also what every sf2e NPC ships.
- Creature data snaps to published values: speeds and sense ranges to the 452 NPCs of the seven creature packs; generated casters get 3 slots per rank (`NPC_SLOTS_PER_RANK`); Recall Knowledge follows GM Core pg. 54; narrative abilities with dice/DC/HP text are dropped; a strike named after a carried weapon takes that weapon's damage, traits and range.

- sf2e glossary (`sf2e.bestiary-ability-glossary-srd`) ships 7 abilities with blank values (`@Damage[(0)`, `dc:` empty, `dc=0`, `Rupture [0]`, `<p>0 feet.`, `[Size]`/`[Listed …]`, Aura radius 0); published NPCs always fill them per creature (`/root/sf2e-wt/reports/I-ZERO.md`). GM Core has no rule for Rupture, aura distance or size limits; the Alien Core ability glossary entries are not on AoN. GM Core pg. 128: creature ability DCs use the Spell DC table; pg. 129: aura DC usually moderate; pg. 128 Area Damage table (unlimited/limited), checked against two independent AoN fetches.

- Aura rule: v14-dev `src/module/rules/rule-element/aura.ts` accepts `{key:"Aura", radius}` alone (radius clamped 5-240, rounded to 5; `traits`, `effects` default empty; slug defaults from the item); it only draws the aura and registers `actor.auras` — saves/conditions are not automated without `effects`. Same-slug auras on one actor merge (names are made unique per creature).
- Enricher patterns (v14-dev `src/scripts/hooks/init.ts`): `@(Check|Localize|Template)[...]`, `@(Damage)[...]` with nested brackets, `[[/act ...]]`; Foundry core adds `@UUID`/`@Embed`/`@Compendium` and `[[/r]]`. A U+200B after `@` / `&` and between `[[`/`]]` (`inertProse`) stops all of them.

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
- A run-level limit is not a step failure. `AIRequestError.runLimit` must be rethrown by every catch that otherwise degrades gracefully (`refineSpells`, `refineCreatureAbilities`, `refineCreatureFeats`, `refineEquipment`, `refineLoot`, `choice-set`'s callback, the generator's choice rounds), or a budget/deadline hit continues the run and commits a half-built actor with a generic message. Same for `cancelled`.
- A deadline armed inside a timer that every stream chunk resets is not a deadline. Arm one absolute timer per request; a keep-alive stream otherwise outlives it forever. Test it with a chunked SSE stub, not a silent socket, and race the assertion against a watchdog so a regression fails fast instead of hanging CI.
- A continuation step inside one run (`_beginProgress(..., { reuseRunSignal: true })`) must not open a second budget window, or spent tokens reset every choice round.
- Offline AI tests pass vacuously when the production selector early-returns (no wishlist → no request). Every fixture must assert result content, the request count, and a prompt/catalog fragment in the request body, or it is decoration.
- Mutate each production check the suite claims to protect and confirm the suite goes red. A negative fixture built by removing several keys at once hides which check it covers; compose it from a known-good payload and change exactly one leaf.

**Tools and CI**
- A manual tool's fixed arguments must be validated offline. Call every task entry against a stubbed provider and fail on a `TypeError`; otherwise a signature drift shows up as "this model is bad" in the matrix.
- A benchmark gate fails on **FAIL**, never on WARN: WARN is the documented steady state (class-bench alone is 31 WARN). `class-bench/run.mjs` needed an explicit `process.exitCode` before CI could gate on it.
- Never add a blind retry to a POST on a network error: the request may already have been received and billed. Retrying a rejected GET is safe; that is the only place `retryNetworkErrors` is used.
- A cost report must price prompt and completion separately from their own counts. Averaging the two prices and multiplying by the total is silently wrong.
- Clear a draft only after writes verify; roll back only documents this run created; a retry must not duplicate actors.
- Each run owns an AbortSignal. `Cancelled` is never retried or reported as a timeout. Parse AI JSON with string-aware brace matching; a `length` truncation fails closed; reasoning-channel text is never the answer; the final SSE record can arrive at EOF.
- An explicit empty AI selection is a valid answer, not a failure. Candidate lists have fixed ceilings and are never expanded to fit.
- API keys never live in world settings and are bound to their exact endpoint; no key goes over plain http to the internet (`settings.mjs`).
- Macro bodies cannot import helpers: they embed a fixed `escHtml` and receive pre-escaped names (`macro-templates.mjs`).

- Build test inputs with the production normalizer (`normalizeConcept`, the stat builder), never hand-written post-normalize objects. FIX-B's resolve check required a strike `damage` field that concept strikes never have, so every Trample would have been dropped; the tests passed because their fixtures carried `damage`. Assert the shape the check really sees.
- When a pick is checked early (resolve) and built later, both must run the same decision. Two hand-kept checks drift; dry-run the build function at resolve instead.
- A "longer, clearer" copy change can break layout: T-ERR's `Party.None` text widened the Generator by 172 px through a `min-width: max-content` row. Run the UI harness on any batch that changes GM-visible strings, not only on template/CSS changes.
- `ai.creatureFidelity.test.mjs` forbids naming published abilities in the creature prompt. Describe behaviour, not names.

- Kimi Code shows an idle-session dialog (compact / new session / continue) after long idle; `hc send` then reports `started:false`. The coordinator must not answer it (auto-mode blocks it, rightly); route the task to a Sonnet subagent instead and tell JT.
- Reviewers repeatedly caught bugs whose tests used fixture shapes production never produces (Trample damage, selector `{name, candidate}` refs, cost total-only usage). Every new feature gets one end-to-end test through the real normalizer, the real candidate list and a selector stub with the production return shape.
- QA row ids are global: pick a free prefix (`grep -n "^| <id>\." docs/qa-checklist.md`) and run `release-check.sh` — it catches duplicates.
- A shared Claude account limits both Claude terminals and all subagents; prefer Kimi for reviews when it is free.

**Release and process**
- A tag pushed with the default `GITHUB_TOKEN` does not fire `push: tags`; releases chain through `workflow_call`. In a reusable workflow, `github.event_name` is the caller's event, so use `inputs.version`. `node --check` never catches these; a `.yml` change needs a real test merge.
- Fresh-context review has caught real bugs many times; a builder's self-report is not verification.
- `hc read` loses a TUI agent's scrollback (the first T1 report on 2026-11-05 was unreadable). Always have agents write reports to files.
- Parallel workers need one worktree each and disjoint files; shared worktrees collided before. Set identity with `git config` in each new worktree.
- `hc read` shows only the visible pane of a TUI agent; `hc send --if idle` refuses a `done` terminal (send without `--if` after checking `hc ls`). Kimi Code asks before commands unless its approval mode is "Never Ask" (set by JT); the coordinator must not answer another agent's permission prompt.
- JT sometimes merges while a review is still running. Say when one is in flight; fixes for a merged PR go in a new PR.
- Keep each file's existing line endings (LF on this VPS clone); `git diff --check` must stay clean.
- `tools/release-check.sh` UI step runs `npm install`, which drops a `--no-save` Playwright; run `node tools/ui-preview/shoot.mjs` directly after `npm install --no-save playwright` if it reports `Cannot find module 'playwright'`.
- The offline class bench (`tools/class-bench/`, fetch then run) builds every class x level against real pack JSON; use it before claiming a PC-pipeline fix works.
- Promoting an existing beta pre-release to stable does not make GitHub recompute Latest (v0.1.4 stayed behind v0.1.3 until `gh release edit v0.1.4 --latest`). `release.yml` now sets Latest on a stable publish when the tag is the highest stable version. Always check `releases/latest/download/module.json` after a stable dispatch.
- Squash merges hide merged branches from `git branch --merged`; match branch tips to merged PR heads through the GitHub API.
- A stacked branch carries its parent's commits: land the parent PR first, or the child PR re-includes the whole parent diff. Rebuild the child branch on the new `main` afterwards so its diff is only the batch.
- Two implementations of the same concern merge **textually clean** and still be wrong. `scripts/ai-transport.mjs` here had a landed Retry-After/jitter path and a branch's network-retry path; the ort merge succeeded, and only reading the merged function showed they composed correctly. Read the merged file, then test it.
- Stray 0-byte untracked files (a killed run's leftovers) block `git merge` with "untracked working tree files would be overwritten" when the branch tracks those paths. Check `git status` before a merge, not after it fails.

## 9. Known gaps (by design or deferred)

- **Focus:** a focus-only NPC (no tradition, so no DC) is unsupported. The NPC pool size (spell count, max 3) is a module default.
- **Item Forge passives** exist only for kinds with a published `sf2e.equipment` exemplar: item bonus, resistance, sense. Weakness, immunity and speed are hidden. No sf2e item uses an `etched-onto-*` usage.
- **Upgrades:** only `installed-in-a-weapon` / `installed-in-armor` usages are offered (`runes.mjs`, cited to `usage.ts`). Upgrade slot counts are **uncited and on hiatus** (`parseUpgradeCapacity` defaults to weapon 1 / armor 0). Prerequisites and exclusivity are not validated; shields and ammo are out of scope.
- **PC skills/feats:** unknown grant timing and missing class data are warned, not inferred. Duplicate native feat grants and new Lore replacements stay manual; not live-tested. Class-path details (Operative specialization, Sniper; Solarian has no `item:tag` path) are in `class-paths.mjs`; Mystic/Witchwarper casting (spontaneous, 3 slots per rank, 5 cantrips, 10th rank at 19) and Technomancer (prepared arcane, base 2 slots) in `pc-tables.mjs`. Mechanic's Drone exocortex needs a companion the module does not create; the GM gets a whisper after Create. Exocortex and Programming Language are ordinary `item:tag` class paths. Free Archetype slot placement and ordinary prerequisites are checked (`pc-prerequisites.mjs`); a full prerequisite graph is unbuilt.
- **Technomancer spell database:** a high-level database fills only as far as the fixed spell candidate cap allows (12 per rank, 96 total; PLAYBOOK §8 says ceilings are never raised to fit). A shortfall warns at Create.
- **Rarity cap** covers ancestry/background/heritage only, by design.
- **Multiclass:** the GM picker and AI choice require Free Archetype; dedications and caster spell lists shipped in #70. A full prerequisite graph remains deferred. Live verification is still needed.

- **Ability fills/templates:** filled glossary values, Area Blast and Aura use the creature's base level; Elite/Weak leaves ability text unchanged (re-level rebuilds module-built abilities; older actors without the provenance flag are not rebuilt). Damage from the Area Damage table is approximate (published creatures tune per creature; 41% exact). Rupture is the Area Damage average (weakest fit). Area Blast has no burst shape (no clean published scaffold) and no riders; auras apply nothing automatically (the GM applies the save result). Single-ability reroll skips the resolve-time dry run (build backstop still guards). Two drafts with one glossary name merge into the first.
- **Cost:** a provider that mixes split and total-only usage in one request can read as a complete total; manual prices are per browser (the connection bank is client-scoped). A Reskin that renames a melee Strike leaves Trample's text naming the old Strike.

## 10. Archive (read only when needed)

- `docs/archive/history-pf2e.md`: the full session narrative and bug log, mostly inherited from the simplyPF2e parent. Search it before re-investigating an old question; §8 holds the lessons that still apply.
- `docs/archive/gm-ready-checklist.md`: G1–G14, how the module reached Beta.
- `docs/archive/next-steps.md`, `docs/archive/ui-audit.md`: the finished UI polish and Jev plans, and the 2026-10-02 UI audit.
- `docs/archive/pf2e/`: the PF2e-era audit.
- `docs/archive/multiclass-plan.md` (phase 1 shipped in #70), `docs/archive/openai-oauth-investigation.md` (2026-10-31 research, not built).
- Live docs outside the archive: `README.md` (GM guide), `docs/qa-checklist.md` (live QA script), `tools/ui-preview/README.md`.
