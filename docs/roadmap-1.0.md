# Roadmap to playable 1.0

Planned by Fable on 2026-10-25 against branch `batch/class-fixes` (stacked on PR #70). JT's answers to §4 go here as they are made. Update this file when a milestone lands.

## 1. What "playable" means

A GM uses a live Foundry v14 (14.361+) world on sf2e 1.6.x with one hosted provider. JT fixes the reference model, for example DeepSeek. With the browser console open, every step below shows **zero `simplysf2e |` errors**. Warnings appear only in documented fail-closed cases.

| # | Capability | Bar |
| --- | --- | --- |
| P1 | Install from the manifest, connect a provider, Welcome readiness, Sources defaults | qa 0.1-0.12 and 12t all PASS |
| P2 | Monster/NPC generate and create, levels -1 to 24, Elite/Weak applied once, stat check | 9 of 10 runs create an actor whose every item is a real compendium copy. Stat check is green or explained (qa 2.x at L1/5/12, 3.x, 12x, 12s) |
| P3 | Encounter: budget, pooled build, create all, all-or-nothing rollback, cancel | qa 4.1-4.8, 13k |
| P4 | Player Character: all 8 classes, L1-20, Free Archetype off and on | Offline bench 80/80. Live: each class at L1 and L5 creates with no unexpected native prompt, every feat slot filled, and casters' slots and focus right (qa 7, 7a, 7b, 7c). One L20 caster live |
| P5 | Reskin and re-level | qa 5.3-5.11, 13j.1-13j.5 |
| P6 | Item Forge, all 5 kinds, and the item works on a sheet (Activate macro, rest recharge, strike, AC) | qa 6a-6e, 9.1-9.6 |
| P7 | Shop and Treasure create real loot actors on budget; merchant buy flow | qa 12z.1-12z.6, 13h.1-13h.5 |
| P8 | Safety: fail-closed messages, cancel, keys never leak, AI text escaped, bug report | qa 12.1-12.5, 12u, 13c, 5.11, 13c.4 |
| P9 | Docs match the UI. Every live row has a logged PASS with versions. `tools/release-check.sh` is green | A `docs/live-log.md` entry for the 1.0 release candidate |

1.0 means all nine pass on one logged pass of one release-candidate build. Then make a minor bump to 1.0.0 (PLAYBOOK §4, Actions > Release).

## 2. Gap analysis (2026-10-25)

| Capability | Status | Evidence |
| --- | --- | --- |
| P1 setup, welcome | Works, unverified on 1.6 | sf2e gate `scripts/welcome.mjs`; `module.json` min 1.6.0. Last live pass was 2026-10-08 on 1.5.x, verbal only |
| P2 NPC pipeline | Works (most tested); stat check and art fix unverified | 37 `builder.*` tests. Stat check 12x never logged. Art fix #69 never live |
| P3 encounter | Works, unverified | Pooled build in `generator-app.mjs`; "faster encounters" never live |
| P4 PC | 78/80 offline; everything since #70 unverified live | `tools/class-bench/REPORT.md`. Hardlight Body and SRO Frame have object-valued ChoiceSets that are left native (`choice-set.mjs` accepts only string/number values). Technomancer spell database not modelled (slots only). Drone companion is a manual whisper. Archetype placement is checked with a `null` context in `generator-app.mjs`. PF2e dead rows remain in `pc-tables.mjs`, plus Skillful Lessons in `pc-builder.mjs`. Presets cover 6 classes |
| P4 multiclass | Missing (planned) | `docs/multiclass-plan.md` |
| P5 reskin, re-level | Works, unverified | Reskin rows never confirmed one by one; re-level never live |
| P6 Forge | Works, unverified live; has gaps | Only the `installed-in-a-weapon`/`installed-in-armor` usages are offered (`runes.mjs`), so 5 Tech Core projectile upgrades are unreachable. Slot capacity uncited. No shields or ammunition |
| P7 shop, treasure | Shop live 2026-10-08 (verbal); treasure never live | README "Live checks" |
| P8 safety | Works, unverified since 10-08 (http key rule, bug report) | README "Live checks" |
| P9 verification | Partial | `tools/release-check.sh`. The class bench covers PCs only. No live log exists. The creature step chain lives inside a Foundry `ApplicationV2` subclass, so no offline bench can reach it today |

## 3. Milestones

One PR per milestone, and each merge is a public release. JT's live time is batched into three passes (A, B, RC) plus one smoke check.

### M0: land Tech Core and class fixes as one release

- **Goal:** PR #70 and class-fixes merge as one release, with the bench at 80/80 or a JT-accepted exception.
- **Tasks:** the class-fixes batch (done: W1-W6), a Fable audit, and a fast-forward of #70's branch.
- **Pre-merge gate (JT):**
  - Confirm the VPS runs sf2e 1.6.x.
  - Do a release-candidate install of the branch (`git clone -b <branch>` into `Data/modules/simplysf2e`).
- **Live pass A** (JT, about 3 h):
  - `docs/live-pass.md` rows 1-18.
  - qa 7.1-7.9 for all eight classes at L1 and L5.
  - 7a, 7c.1-7c.2, 12x.1-12x.3, 12d.1, 0.1/0.8/0.12.
  - Log every row in `docs/live-log.md`.
- **Exit:** release published and live-log entry written. Failure-log clusters become M2 tasks.
- **Risk:** the 1.6 requirement breaks 1.5 worlds. The Welcome gate message and the release note contain it.

### M1: verification infrastructure (runs while JT does pass A)

Each task touches separate files.

- **T1 (Sonnet, tiers 1-3, no behaviour change):** extract the creature step chain and the per-member encounter body from `generator-app.mjs` into `scripts/creature-pipeline.mjs`. It takes injected AI functions and `onStep`/`onTokens` callbacks.
- **T2 (Haiku):** add a bench fetch option for the seven bestiary Actor packs, and a new `tools/pipeline-bench/creature.mjs`. It covers levels -1/1/5/12/20/24 × Elite/Weak, with first-candidate stubs. It asserts:
  - every item has a `_stats.compendiumSource` in an allowed pack;
  - stats are inside `tables.mjs` bands;
  - the manifest is complete.
- **T3 (Haiku):** `tools/pipeline-bench/forge.mjs`, covering 5 kinds × levels × rarity. It asserts:
  - rules are cloned from real `sf2e.equipment`;
  - the grade name is a published one;
  - the upgrade usage is cited;
  - no `system.price`/`system.level` is written on graded items.
- **T4 (Haiku):** `tools/pipeline-bench/market.mjs`, covering shop and treasure level, rarity and budget bounds.
- **T5 (Coordinator):**
  - `docs/live-log.md`.
  - PLAYBOOK §6 gains the release-candidate install, live rows in the PR body, and a live-log entry.
  - `release-check.sh` fails when `live-pass.md` names a QA id missing from `qa-checklist.md`.
- **Risk:** benches run no Rule Elements and no derived data. They prove assembly, not sheets, and each bench README says so.

### M2: fix wave and sf2e 1.6 content gaps (one release with M1)

- **Tasks:**
  - Pass A failure clusters.
  - Object-valued ChoiceSets (Hardlight Body, SRO Frame) pre-answered with the cited `selection` shape (Sonnet, tier 3).
  - The `installed-in-a-weapon-that-uses-projectiles` usage, gated on the cited base-weapon signal (Sonnet, tier 3).
  - Mechanic and Technomancer presets (Haiku).
  - New qa rows 7d and 6d.7.
  - A release note.
- **Sources to fetch first:**
  - `src/module/rules/rule-element/choice-set/{rule-element,data}.ts`.
  - The Hardlight Body and SRO Frame JSON.
  - `src/scripts/config/usage.ts`.
  - The five Tech Core upgrade JSONs and one projectile weapon JSON.
- **Live pass B** (JT, about 1.5 h): re-run fixed rows, plus 7d, 6d.7, 1.1, the T1 smoke rows and 13i.2-13i.3.

### M3: PC depth (multiclass and Technomancer spell database); can be cut to 1.1

- **Multiclass** per `docs/multiclass-plan.md`:
  - The dedication rule and a real context for archetype placement.
  - A GM picker (Free Archetype only) plus an AI pick.
  - Slot pinning.
  - Caster dedication entries from the cited Basic Spellcasting table.
- **Technomancer spell database:** embedded known spells equal the cited database size.
- **Bench:** `--multiclass <class>`.
- **Sources:** `journals/archetypes.json` Basic Spellcasting; the Spell Database feature; the Technomancer class table; `spellcasting-entry/data.ts`.

### M4: polish and release hardening

- **Codex:** the remaining art-review items (texture restraint; anything left after #70's UI refresh), with screenshots at both widths.
- **Haiku:**
  - Remove the PF2e dead paths (no behaviour change).
  - Refresh README and PLAYBOOK §9.
  - Write `docs/release-pass.md`, the roughly 90-row 1.0 subset.
- **RC pass** (JT, about 3 h): the full release pass, logged. Then Actions > Release with version 1.0.0.

### Out of scope for 1.0

- Companion actors (Drone stays a whisper).
- Shields and ammunition in the Forge.
- Upgrade slot capacity and upgrade prerequisite/exclusivity.
- Full prerequisite graphs beyond the dedication chain.
- Focus-only NPCs.
- Forge passives beyond item bonus, resistance and sense.
- A light theme, custom art, TypeSafe direct (CORS), and languages other than English.

## 4. JT decisions needed (Fable's recommendation in brackets)

1. Install a release candidate before each merge? [Yes. Every merge updates every install.]
2. Does the VPS run sf2e 1.6.x? [It must, before #70 merges.]
3. Multiclass in 1.0 or 1.1? [1.0 only if pass B is clean on the first run.]
4. Pre-answer object-valued ChoiceSets (Hardlight Body, SRO Frame)? [Yes: small, cited.]
5. Add the projectile-weapon upgrade usage? [Yes.]
6. Model the Technomancer spell database for 1.0? [Yes, in M3.]
7. Mechanic and Technomancer presets? [Yes, in M2.]
8. Light theme? [Already decided: always dark.]
9. Remove the PF2e-only rows and the Skillful Lessons branch? [Yes, in M4.]
10. Reference QA model for P2? [DeepSeek.]
11. Live time budget: passes A (3 h), B (1.5 h), RC (3 h), M3 (1.5 h, can be folded in)?

## 5. Top risks

1. **Live-verification debt.** Run pass A before any new feature; nothing counts as verified without a live-log row.
2. **Public auto-release of a breaking requirement (sf2e 1.6).** Contain it with the VPS check, a release-candidate install, the release note and the Welcome gate.
3. **Silent schema failures.** Contain them with cited v14-dev source pasted into prompts, Sonnet for schema tasks, tier 3 review, and benches on real pack JSON.
4. **False confidence from benches.** Each README states its limits; derived stats stay live rows.
5. **Process: scope creep, file collisions, mid-review merges.** One PR per milestone, disjoint files, and M3 can be cut.
