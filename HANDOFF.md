# HANDOFF.md — live session baton

Read this first, then CLAUDE.md. HISTORY.md is the PF2e-era scaffold narrative; do not treat its v0.3.5.x release baton as simplySF2e state.

## Last session — 2026-09-30 Tracks A, B, C & Group 1 Roadmap Features Wave

- **Track A (Item Forge SF2e Re-Target):**
  - Re-targeted Item Forge weapon/armor pipeline from PF2e fundamental runes to Starfinder 2e equipment grades (`commercial`, `tactical`, `advanced`, `superior`, `elite`, `ultimate`, `paragon`) and installed upgrade subitems (`system.subitems`).
  - Zeroed legacy `system.runes` per `Migration942EquipmentGrade`.
  - Preserved base document's published `analog` / `tech` traits.
  - Embedded subitems preserve/generate unique `_id` to survive native `PhysicalItemPF2e` document indexing.
  - Upgrades gated by published base item upgrade capacity (`parseUpgradeCapacity`).
  - Price and level calculation reflects grade credit delta + upgrade pricing in credits.

- **Track B (SF2e Building Creatures / Alien Core Stat-Array Discovery):**
  - Fully audited and cited all 9 creature-building stat arrays in `tables.mjs` against *Starfinder GM Core* Chapter 2 "Building Games" (pp. 116–128; Rules 989–1025).
  - Calibrated benchmark adjustments: extreme ability modifier (+12 at lvl 22-23), low HP midpoint (323 at lvl 22), moderate/low strike attack, updated strike damage dice formulas, and level-21–24 resistance scaling (with regression test for level 22 maximum = 24).

- **Track C (UI-Shell Test Coverage):**
  - Standalone test suites for `app-base.mjs`, `manage-presets-app.mjs`, `sources-app.mjs`, and `presets.mjs` (CRUD, validation, import, export).

- **Group 1 Roadmap Features:**
  - **Elite and Weak Adjustments:** Added Alien Core pp. 204/207 adjustments (`system.attributes.adjustment: 'elite' | 'weak' | null`) to `builder.mjs` `computeStats()` and `createActor()`, with UI selector in `generator.hbs` and regression test `builder.adjustment.test.mjs`.
  - **Starfinder NPC Archetype Presets:** Added 4 thematic Starfinder NPC archetypes (`corp-guard`, `free-captain`, `cyberdoc`, `bounty-hunter`) with dedicated optgroup in the preset dropdown and 5 example prompts each.
  - **Chat Command Generator Trigger:** Added `/sf2e` and `/simplysf2e` slash commands (`chatMessage` hook in `simplysf2e.mjs`) supporting `/sf2e itemforge` or pre-populating mode/level/prompt (e.g. `/sf2e npc 4 "street doc"`), tested via `chat-command.test.mjs`.
  - **Reskin Existing Bestiary Creature:** Added `reskinActor()` in `builder.mjs` preserving 100% of native statistics while embedding fresh narrative flavor and recall knowledge, tested via `builder.reskin.test.mjs`.

- **Group 2 Thematic Extensions:**
  - **Cybernetics & Augmentations:** Added `augmentation` kind in Item Forge (`installed-in-body`, auto-tagging `augmentation` and `cybernetic`/`biotech` traits, dedicated tech icon `icons/commodities/tech/sensor-red.webp`), tested via `item-builder.augmentations.test.mjs`.
  - **Solarian Weapon Crystals:** Added `crystal` kind in Item Forge (`other` usage, auto-tagging `solarian` and `crystal` traits, crystal icon `icons/commodities/gems/gem-faceted-round-purple.webp`), tested via `item-builder.augmentations.test.mjs`.
  - **Multiclass PC Dedication Support:** Added `SF2E_MULTICLASS_DEDICATIONS` and `getMulticlassDedicationSlug` in `pc-support.mjs` mapping all 6 Starfinder 2e core classes to their official dedication feats (`envoy-dedication`, `mystic-dedication`, etc.), tested via `pc-support.multiclass.test.mjs`.

- **Quality Bar & Verification:**
  - All 99 test suites pass cleanly (`for f in scripts/*.test.mjs; do node "$f"; done`).
  - `node --check` clean across all `.mjs` files.

1. Open PR `integrate/wave-p0-p4` → `main` (link: `https://github.com/simplyjaytea/simplySF2e/pull/new/integrate/wave-p0-p4`). Merging to `main` auto-publishes a release — confirm intent first.
2. Live Foundry QA on the VPS:
   - Item Forge weapon/armor generation: verify equipment grade (`tactical`, `advanced`, etc.) renders on actor sheet, upgrades show in subitems tab, and credit price reflects grade deltas.
   - Creature generation with Starfinder GM Core calibrated stats.
   - UI shell dialogs: Manage Presets and Sources apps.

## Material limits

- Live Foundry QA is not in this environment.
- HISTORY.md is inherited from the PF2e scaffold; do not rewrite it as SF2e history.
