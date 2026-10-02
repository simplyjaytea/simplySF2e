# HANDOFF.md — live session baton

Read this first, then CLAUDE.md. HISTORY.md is the PF2e-era scaffold narrative; do not treat its v0.3.5.x release baton as simplySF2e state.

## Last session — 2026-10-01 cleanup + GM-ready plan

- Docs cleanup merged as PR #9 (`a9d5e78`): CLAUDE.md Files table, README status, PF2e audit archived to `docs/archive/pf2e/`.
- Remote branches fully merged into `main` and still to delete by hand (the cloud git proxy returned 403 on the delete): `cursor/free-archetype-archetype-slot-validation`, `cursor/table-cites`, `integrate/wave-p0-p4`.
- Reviewed every open item (HANDOFF, CLAUDE.md known gaps/roadmap, code scan, upstream v14-dev source) and built the **GM-ready checklist** below. Nothing in it has been started.
- 99/99 test suites pass on `main`.

## GM-ready checklist

"GM-ready" means a GM can install from the manifest, configure a provider, and generate NPCs/encounters/PCs/items that are correct on the sheet, with known limits documented. Tick items (`[x]` + PR link) rather than deleting them. IDs are stable; reference them in branch names and PR titles.

### Gate A — correctness blockers (code)

- [x] **G1 · SF2e skills Computers and Piloting are missing everywhere.** Done in PR #11, together with the NPC core-skill fix below. Verified 2026-10-01 against `foundryvtt/pf2e@v14-dev` `src/scripts/config/index.ts`:
  ```
  ...(SYSTEM_ID === "sf2e"
      ? {
            computers: { label: "PF2E.Skill.Computers", attribute: "int" },
            piloting: { label: "PF2E.Skill.Piloting", attribute: "dex" },
  ```
  The module hardcodes the PF2e 16-skill list in `builder.mjs` (`STANDARD_SKILLS` ~L23, `CHECK_TYPES` ~L997) and `pc-skills.mjs` (`SKILL_ATTRIBUTES`, whose comment cites PF2e master/8.4.1). Result: a hacker or pilot NPC can never get Computers/Piloting, and PC skill allocation never trains them. Fix: add both with the cited attributes; grep `ai.mjs` and the templates for any other skill list; add a test asserting both slugs survive normalization for NPC and PC. **Worker: Sonnet** (values cited above). **Review:** independent.
- [x] **G2 · Upstream sf2e moved to 1.5.1.** Done 2026-10-02. The v14-dev `system.sf2e.json` 1.5.1 and the `sf2e-1.5.0` tag manifest are identical apart from `version` and `download` (same `packs[]`, same compatibility 14.361 / 14.367 / max 14), so `DEFAULT_PACKS` still matches. Citations now say 1.5.1. `module.json` keeps `minimum: "1.5.0"` because nothing the module uses changed.
- [x] **G3 · Sweep the remaining hardcoded PF2e-era enums against v14-dev sf2e.** Done 2026-10-02 (table in the G3 PR). Differed and fixed in `builder.mjs`: NPC `LANGUAGE_TYPES` was the PF2e list (now `LANGUAGES_BY_RARITY.sf2e`), `SENSE_TYPES` lacked bloodsense/electromagnetic-sense, IWR lacked peachwood, aging, prediction, time. Matched: damage types (`system/damage/values.ts`), sizes, rarities, traditions, movement types, save types, condition slugs (a deliberate subset of the sf2e `conditions` pack, which gets PF2e conditions via `build/duplicates.json`; sf2e-only glitching/suppressed/untethered are not offered), check types. **Found by the G3 review:** spell scrolls are PF2e-only; sf2e uses spell gems (`config/spell-consumables.ts`), see G14. PC languages already read `CONFIG.PF2E.languages` at runtime.
- [x] **G14 · Scroll loot should be spell gems.** Done 2026-10-02. Loot and PC gear build "Spell Gem of {name} (Rank {n})" from the cited `spell-gem` rank templates, mirroring `createConsumableFromSpell` (`item/consumable/spell-consumables.ts`). PF2e-style "Scroll of" drafts are read and built as gems. Blank gem templates are excluded from candidate lists.
- [x] **G1b · NPC core skills were written as lore items (found in G1 review).** v14-dev `item/lore.ts` `sluggifyLoreName` appends `-lore`, so "Stealth" became a separate `stealth-lore` skill and the real skill stayed untrained. `createActor` now writes `system.skills.<slug>.base` (`npc/data.ts` `NPCSkillSource`). PR #11.
- [x] **G4 · Independent review of `68c7124`.** Done 2026-10-02. Fixed: Elite/Weak applied once through the system and `/sf2e` arguments (PR #13); Augmentation/Solarian Crystal forge kinds rebuilt on real sf2e usage/traits (PR #14); upgrade usages limited to cited `installed-in-a-weapon` / `installed-in-armor`, grade tables cited to `config/index.ts`, legacy potency mapping removed, preview level matches `computeLevelRarityPrice` (G4 cleanup PR). **On hiatus (JT):** upgrade slot counts. No sf2e data or code carries one, so `parseUpgradeCapacity` defaults stay uncited. Nothing here is live-tested.
- [x] **G5 · Browser compatibility of JSON import attributes.** Done 2026-10-02. Foundry publishes no minimum browser versions (its requirements page only says "a modern web browser like Chrome, Firefox, Opera, or Edge"), and Firefox only parses `import ... with { type: "json" }` from version 138, so Firefox ESR 128 would fail to load the module. The two currency templates are now verbatim `.mjs` default exports (`scripts/currency/credstick.mjs`, `upb.mjs`), and `import-attributes.test.mjs` blocks new JSON imports.

### Gate B — GM-facing usability

- [x] **G6 · Reskin has no entry point.** JT decided (2026-10-02): a fifth generator mode; the GM drags an NPC from the Actors sidebar or a compendium onto a drop zone; the AI writes flavor and also renames strikes/abilities (rules, damage, traits unchanged). Built in the G6 PR. Needs a live check (G10/G11): compendium drop, world-actor drop, a renamed strike with attack effects still applying.
- [x] **G7 · Multiclass scope.** JT decided (2026-10-02): deferred until after GM-ready. `SF2E_MULTICLASS_DEDICATIONS` (`pc-support.mjs`) is unwired. **User decision:** defer past GM-ready (recommended; needs a PC feat-slot design plus prerequisite checks), or wire it into the PC pipeline now (Opus design, then Sonnet build).
- [x] **G8 · README GM guide.** Done 2026-10-02: README rewritten as a GM guide (quick start, provider/connection bank, launchers, all five modes + Item Forge kinds, credits/UPB, manual-review list, troubleshooting, privacy), every label from `lang/en.json`/templates. Original brief:
  - quick start: install, enable, provider setup including local/keyless, and where the launchers are (the Actors directory header button, Item Forge entry, and `/sf2e`; confirm each placement in `simplysf2e.mjs`)
  - a walkthrough of each mode (Monster/NPC/Encounter/Character/Item Forge)
  - credits and UPB currency
  - what is left to native prompts or manual review
  - troubleshooting: wrong system, missing packs, provider/auth errors, timeouts
  - a privacy note: prompts and candidate lists go to the configured provider

  Use the real `lang/en.json` labels so the guide matches the UI. **Worker: Sonnet.**
- [ ] **G9 · Re-evaluate "Known gaps" for SF2e.** CLAUDE.md's list is inherited from PF2e. Check, with citations: which SF2e classes have focus pools; whether the focus-pool RE exemplar exists in `sf2e.*` packs (`rule-templates.mjs` `focusPool`); whether passive Item Forge REs have eligible exemplars in `sf2e.equipment`. Also rewrite the rune-era Phase 3 notes in upgrade terms. **Worker: Opus** (research), Sonnet for the doc edit.
- [ ] **G10 · Live QA script.** Write `docs/qa-checklist.md`: per feature, give exact steps, the expected result, where to look on the sheet, and a result/evidence column. Cover:
  - Item Forge grade/upgrades/credits
  - NPC with GM Core stats, including Elite/Weak
  - Encounter
  - all six classes as PCs
  - Computers/Piloting (after G1)
  - the `/sf2e` command
  - rest-hook counter reset
  - the activation macro's `DamageRoll`
  - Manage Presets and Sources
  - provider setup

  **Worker: Sonnet.**

### Gate C — live verification (the user, on the VPS)

- [ ] **G11 · Run `docs/qa-checklist.md`** on Foundry 14.367 with sf2e 1.5.x. Record the evidence under CLAUDE.md "Recorded live evidence" (currently "none").
- [ ] **G12 · Fix live findings.** One PR per finding cluster, each with a regression test where the logic is pure.

### Gate D — release

- [ ] **G13 · Promote Alpha → Beta.** User decision once Gates A–C are clean: version bump, README status, release notes.

### Deferred (not GM-ready blockers)

Full Free Archetype prerequisite graphs; upgrade prerequisite/exclusivity validation; shields and ammunition in the forge; PF2e comment residue (Champion/Investigator comments in `pc-builder.mjs`, PF2e casting rows in `pc-tables.mjs`).

## How to run this with Sonnet workers

The coordinator (Opus or Fable) owns planning, every sf2e schema verification, integration, git, the PR, and this file. Sonnet workers do the mechanical edits. Full rules are in CLAUDE.md "Agent workflow".

**Wave 1** (parallel, no file overlap): G1 (Sonnet), G5 (Sonnet), G8 (Sonnet), G10 (Sonnet), G4 (Opus reviewer). Before Wave 1, the coordinator does the G2 and G3 verification itself.
**Wave 2** (after G1 merges into the integration branch): G3 apply, G2 apply, G9.
**Blocked on the user:** G6 and G7 (design decisions), G11 (live QA), G13.

Spawn each worker with the `Agent` tool: `model: "sonnet"`, `isolation: "worktree"`, `run_in_background: true`, one checklist ID per worker. Prompt template:

```
You are a Sonnet worker on simplySF2e (Foundry VTT module, sf2e system). Task: <ID> — <title>.
Read CLAUDE.md (Invariants + Files) and the <ID> entry in HANDOFF.md first.

Do exactly this:
<concrete steps, files, and line anchors from the checklist entry>

Cited source values you may use (do not look up or invent others):
<quoted upstream lines pasted by the coordinator, or "none needed">

Rules:
- Do not change files outside: <file list>.
- Never hand-author Rule Elements, invent sf2e schema, or emit AI-chosen numbers.
- Escape AI/user text with text.mjs esc/toHtml.
- Git identity: user.name "jt", user.email "jt_f@ymail.com". Commit in your worktree only; do NOT push or open PRs.
- Verify: node --check every touched .mjs; `for f in scripts/*.test.mjs; do node "$f" || echo FAIL $f; done` must show no FAIL. Add a *.test.mjs for any pure logic you change.

Report back: commit SHA(s), files changed, test output summary, and anything you could not do. Quote a source line for every "verified" claim, or say "unverified".
```

The coordinator then reviews each worker diff, merges the worktree commits into the session's designated branch, reruns the full test suite, and sends schema-dependent diffs (G1, G2, G3, G4 fixes) to a fresh-context reviewer agent. Then it pushes and opens one PR per wave. Cloud sessions can push only to their designated branch, so workers must not push.

## Material limits

- Live Foundry QA is not in this environment.
- HISTORY.md is inherited from the PF2e scaffold; do not rewrite it as SF2e history.
