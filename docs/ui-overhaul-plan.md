# UI overhaul plan (2026-11-08)

Direction from JT (2026-11-08): keep the Neon Drift colours and animations; make the module look and feel more unique. Functionality stays exactly as it is. Source of findings: `docs/ui-audit-2026-11-08.md` (90 findings over 94 fixtures). This file turns them, plus JT's direction, into a build plan, five feature proposals and a list of optimisation candidates.

## 1. The theme as a system

Today the neon kit is applied by hand per window, so it reads as decoration. The overhaul gives every effect a job and applies the same rules everywhere. These rules go into the header comment of `styles/simplysf2e.css` and into `.claude/skills/ui-ux/references/anti-slop-checklist.md` §1.

| Element | Role | Rule |
| --- | --- | --- |
| Magenta | the one primary action | gradient fill, glow and text-shadow only on `.spf-primary`; nothing else glows magenta |
| Cyan | system state: readiness, status bar, HUD labels, legends | flat accent; glow only on the active/selected state |
| Per-mode tints (violet, cyan, amber, magenta, mint) | which mode you are in | active mode tile and the statblock rule only; status bar and recent rows stay cyan |
| Red / green | danger / success, always with a word or icon | Discard, Delete, Reset are red and separated; success only for a confirmed result |
| Glow | "this is live" | primary action, active tile, the running progress card; never on static frames (Sources category frames lose theirs) |
| Sheen | "working" | progress fill while a run works |
| Pulse | "waiting for you" | a panel that needs a GM decision (review choices, unresolved content); not the busy card |
| Blink | "active step" | the current progress step only |
| Scan lines | "standby" | empty-state panels only, one short line of text, left-aligned |
| Corner ticks and notch | the window's HUD frame | outer cards only; nested panels (encounter members, stat check, review list) are plain |
| Uppercase + letter-spacing | HUD labels (legends, chips, status keys) | never on headings or buttons; hierarchy comes from size and weight |
| Typography | Signika from Foundry; tabular figures for every number the GM compares | wrap by word, no ellipsis |

Everything idle is still. Everything that moves says what the module is doing.

## 2. Batches

Each batch: one worktree per window group, Opus subagent for visuals (`.claude/skills/ui-ux/`), Haiku for strings, fixtures and tests, Sonnet integrates; harness exit 0 at 720, 460 and short on every PR; QA rows and a What's new entry per batch. Nothing to `main` until JT wants a live test. Finding ids refer to `docs/ui-audit-2026-11-08.md`.

| Batch | Contents | Status |
| --- | --- | --- |
| **U1 bugs** | G1 two primaries; W9 aria-label; W18 What's new manual intro; F1 Treasure duplicate Reroll; F12 raw grade slug; F15 Forge preview `aria-label`; F7 party hint placement; W2 unsaved edits lost on connection switch; fixture fixes G15, W19, F16 | landed on `next` 2026-11-08 (BATCH-3, BATCH-5); the bug-hunt fixes landed as BATCH-4/5/6 |
| **U2 shell consistency** | S1 control edges 3:1; S3 Discard/Delete/Reset red and separated; S4 pending step icons; S5 notices with icon and word; S8 tabular numbers; S11 status bar at 460 and word-wrap; S12 one-line readiness row in Forge/Shop/Treasure; S13 flat disabled primary, no duplicate model name; S15 empty states as standby panels; S16 one place named for the API key; G3 nested cards plain; G4 party note width; G7 provenance tags neutral; G10 statgrid IWR; G11 read-aloud and "Based on"; G13 reskin spacing; G14 24 px targets; W7 Welcome disclosure chevron; W14 one grouping frame; W15 Sources id column at 460; W17 accent only on icons; F8 Quantity heading; F9 table row density; F10 budget sentence; F14 kind grid at 460 | next |
| **U3 copy sweep** | S6 sentence case (uppercase stays a CSS effect on HUD labels only); S7 plurals; S14 busy fallback; G8 mode names; G9 mode hints and tooltips say what the control does; G12 readiness text; F2-F5 next steps and wrong references; F11 "e.g."; F13 row tooltips; W3 provider notes with reasons; W5 error title; W6 setup buttons heading and hard-coded strings; W8 legends; W10 visible provider label; W11 footer hint; W12 saved-key hints; W16 no-packs next step | after U2 |
| **U4 signature pass** (Opus designer) | apply §1 as a system: motion vocabulary wired to real states (pulse on panels awaiting the GM, not the busy card); mode tints scoped to tile and statblock rule; Sources frames lose static glow; HUD frame only on outer cards; progress card as telemetry (step list with elapsed time per step, from existing `progress.mjs` data); Welcome as a boot sequence without wizard numbering; empty states as standby panels; square neon trait tags (S10 in neon colours, sf2e tag shape); tokens for every literal (S9) incl. `--spf-glow`, `--spf-sheen`, `--spf-window-bg`, `--spf-on-fill` | after U2, needs D1-D3 |
| **U5 wiring** | F6 inline prompt validation; W4 open-Sources button in the readiness warning; W13 `aria-invalid` on the bad price field; F11 per-kind Forge placeholder; S5 if core adds no glyph | after U3; each needs a `docs/ui-contract.md` entry |

**Decisions still open for JT:** D1 spacing scale to a 4/8 rhythm (U4). D2 confirmed by direction: per-mode tints stay, scoped per §1. D3 uppercase stays on HUD labels only, not headings (default unless JT objects). D5 inline prompt validation (U5).

## 3. Functionality guard

- Template logic is display only; app behaviour changes go through `docs/ui-contract.md` and a wiring task with a test.
- Every changed window gets its fixtures updated in the same PR; harness exit 0; all `scripts/*.test.mjs`; `i18n-keys.test.mjs`; `release-check.sh` with the UI step.
- GM-visible change = QA row + What's new entry. Live verification is JT's pass, logged in `docs/live-log.md`.
- Review ladder as PLAYBOOK §6; the anti-slop checklist runs on every PNG and string.

## 4. Five feature proposals

Each is grounded in what exists, keeps PLAYBOOK §3 (the AI never emits numbers; everything resolves to real compendium content), and needs JT's yes before design.

1. **Run history with replay and diff.** `recent-generations.mjs` already keeps recent previews. Add a drawer in the Generator that lists the last N runs per mode with prompt, model, tokens and cost; one click re-opens the preview, one click re-runs the same prompt on the current model, and two selected runs show a side-by-side of picks (abilities, spells, gear). Pure UI over stored data; the only new AI call is the explicit re-run.
2. **Live encounter balancing in the preview.** When the GM changes a member's level, count or Elite/Weak in the encounter preview, the XP budget, threat band and per-member role lines recompute from `encounter.mjs` and `tables.mjs` without an AI call; the Create button shows the new budget. Today that needs a new run.
3. **Campaign lore sheet.** A GM-written, per-world text block (factions, tone, names to reuse, names to avoid) stored like presets and prepended to every system prompt as fiction guidance. `generator-memory.mjs` and `presets.mjs` carry the storage pattern; `ai.mjs` `systemPrompt()` takes the text. It only shapes prose; picks still resolve against the compendium. Needs a token-cost line in the preview so the GM sees what the sheet costs per run.
4. **Create and place.** After Create, a "Place on scene" button drops the new actor's token at the centre of the active scene's view (or at a chosen position on next click) and, for NPCs, offers the existing `handout.mjs` handout to players in one step. Uses core `TokenDocument.create` with the actor's prototype token; no new data model.
5. **Cost profiles.** Three named profiles per connection (Cheap, Standard, Quality) that set model, run token budget (D6) and pool concurrency together, switchable from the status bar; the encounter confirmation shows the estimate under the chosen profile. `settings.mjs` and `provider-connect.mjs` already hold the named connection bank; a profile is a connection plus two numbers.

Also considered, lower value: a batch queue (several concepts run back to back through `pool.mjs`); a "why this pick" tooltip from the candidate list. Not proposed now.

## 5. Optimisation candidates (measure before changing)

Functionality must not change. Each candidate names how to measure it; only measured wins get built, each with its own tests and the golden replay suite as the guard. Investigation task T-PERF (Sonnet) produces the numbers.

**Measured 2026-11-08** (full report: `docs/archive/ui-audit-2026-11-08/perf-measurements.md`; estimator tokens, offline benches, no live Foundry):

| # | Verdict | Measurement | Next step |
| --- | --- | --- | --- |
| P5 harness | **do first** (tools only) | serial run 175.6 s for 376 PNGs with 25% CPU; a 4-worker page pool 52 s, 8 workers 35 s; same file set, same problems. Animated fixtures are not pixel-stable even serially. | task: page pool in `tools/ui-preview/shoot.mjs` (+ optional animation freeze for pixel diffs); guard = exit 0, same 376 names, same problem list |
| P2 prompt size | **do** (own task, full ladder) | one L5 NPC run = 7 requests, 41,201 chars (~10,600 est. tokens); opaque `c-<base64 pack+doc>` ids are 32% of the body, their constant per-pack prefix alone 18%; shop/treasure selectors the same ratio; an encounter pays it per member | short per-request ids (`E1..`) with a local map, as `encodeFeatCandidateSlots` already does; touches `jev-picks.mjs` and `isIssuedCandidate`; guard = golden replay incl. forged-candidate negatives, fuzz, creature bench 35/2/0, new "no base64 id in the body" assertion. Also fix stale "copy each name EXACTLY" wording (`ai.mjs:100, 630, 759`) and confirm the NPC `equipment[].value` schema line is dead before cutting |
| P4 generator-app split | **do later**, staged | 2,451 lines, 90 methods; context builders ~700 lines share three row mappers and `adjustedStats`; 13 test files read the file as source text and must move in the same PR | after U2/U3 land; extract `scripts/generator-context/*.mjs` as pure functions; guard = 27 generator fixtures, 9 generator-app tests, golden replay, plus before/after deep-equal on each builder |
| P6 CSS dedupe | fold into U4 | 36 duplicated declaration sets over 89 rules (3.2 KB of 94 KB); 40 raw colour literals outside the tokens | part of the S9 token pass, not its own task |
| P1 indexes | not worth it | `getIndex`/`getEquipmentIndex` caches persist for the process; 4 indexes built once (69-81 ms); per-run candidate scans 60-90 ms, under 1% of one provider call | none |
| P3 pool width | not reachable | `composeEncounter` yields at most 2 members, so width 3 never saturates | revisit only with cost profiles (feature 5) |
| P7 per-render work | not worth it | no clones in any `_prepareContext`; about 60 localize calls per render, none in a candidate loop | none |
| P8 resolve/build | not worth it | the dry run is PLAYBOOK §8 by design; 17-46 µs per fill; under 0.5 ms per creature | none |

| # | Candidate | Where | How to measure | Guard |
| --- | --- | --- | --- | --- |
| P1 | Compendium index and candidate lists rebuilt per run | `compendium.mjs` (`findEntry`, pack indexes, `get*Candidates`) | time one NPC run's index phase in the pipeline bench with the pinned packs; count index loads per run | bench output identical |
| P2 | Prompt size of candidate catalogs | `ai-candidate-format.mjs`, `ai-task-profiles.mjs` | token count per task from the golden replay fixtures; look for repeated names, long descriptions, unused fields | golden replay passes; fuzz passes |
| P3 | Encounter pool concurrency fixed at 3 | `pool.mjs`, `encounter.mjs` | wall time of a 4- and 8-member encounter in the bench with a stubbed provider at a fixed latency; test 2/3/4 | all-or-nothing rollback unchanged |
| P4 | `generator-app.mjs` at 2,450 lines | `generator-app.mjs` `_prepareContext` and `#build*PreviewContext` | render time is not the issue; maintainability is: count context builders and their shared helpers; propose a split into `generator-context/*.mjs` with no behaviour change | harness fixtures identical, golden replay |
| P5 | Harness runtime (376 PNGs serially) | `tools/ui-preview/shoot.mjs` | time a full run; try a page pool of 3-4 | identical PNG set |
| P6 | Duplicated chip, legend and frame CSS | `styles/apps/*.css` | count duplicated rule blocks; token the literals (S9) | harness PNGs unchanged except intended |
| P7 | Repeated `game.i18n.localize` and `structuredClone` in per-render context builders | `*-app.mjs` | count per render in the harness fixtures' context shapes | none needed if memoised per render |
| P8 | Stat check and completion manifest run twice (resolve dry-run + build) | `completion.mjs`, `builder.mjs` resolve/build | count calls per run in the creature bench; PLAYBOOK §8 requires both to run the same decision, so only the shared pieces can be cached | creature bench 35/2/0 unchanged |
