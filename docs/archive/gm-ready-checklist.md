# GM-ready checklist (archived 2026-10-25)

Complete. Kept as a record of how simplySF2e reached Beta (G1–G14). IDs are referenced in old branch names and PR titles.

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

- [x] **G6 · Reskin has no entry point.** JT decided (2026-10-02): a fifth generator mode; the GM drags an NPC from the Actors sidebar or a compendium onto a drop zone; the AI writes flavor and also renames strikes/abilities (rules, damage, traits unchanged). Built in the G6 PR. Needs a live check (G10/G11; the 2026-10-08 QA run was reported OK as a whole; these three rows were not individually confirmed): compendium drop, world-actor drop, a renamed strike with attack effects still applying.
- [x] **G7 · Multiclass scope.** JT decided (2026-10-02): deferred until after GM-ready. `SF2E_MULTICLASS_DEDICATIONS` (`pc-support.mjs`) is unwired. **User decision:** defer past GM-ready (recommended; needs a PC feat-slot design plus prerequisite checks), or wire it into the PC pipeline now (Opus design, then Sonnet build).
- [x] **G8 · README GM guide.** Done 2026-10-02: README rewritten as a GM guide (quick start, provider/connection bank, launchers, all five modes + Item Forge kinds, credits/UPB, manual-review list, troubleshooting, privacy), every label from `lang/en.json`/templates. Original brief:
  - quick start: install, enable, provider setup including local/keyless, and where the launchers are (the Actors directory header button, Item Forge entry, and `/sf2e`; confirm each placement in `simplysf2e.mjs`)
  - a walkthrough of each mode (Monster/NPC/Encounter/Character/Item Forge)
  - credits and UPB currency
  - what is left to native prompts or manual review
  - troubleshooting: wrong system, missing packs, provider/auth errors, timeouts
  - a privacy note: prompts and candidate lists go to the configured provider

  Use the real `lang/en.json` labels so the guide matches the UI. **Worker: Sonnet.**
- [x] **G9 · Re-evaluate "Known gaps" for SF2e.** CLAUDE.md's list is inherited from PF2e. Check, with citations: which SF2e classes have focus pools; whether the focus-pool RE exemplar exists in `sf2e.*` packs (`rule-templates.mjs` `focusPool`); whether passive Item Forge REs have eligible exemplars in `sf2e.equipment`. Also rewrite the rune-era Phase 3 notes in upgrade terms. **Worker: Opus** (research), Sonnet for the doc edit. Done 2026-10-02: only Mystic/Witchwarper have focus pools; no `sf2e.*` focus-pool RE exists, but v14-dev `spell/document.ts` adds +1 per focus spell so the pool works without it; forge passive kinds with sf2e.equipment exemplars are item bonus, resistance, sense (none for weakness/immunity/speed). Known gaps rewritten.
- [x] **G10 · Live QA script.** (Done: `docs/qa-checklist.md` written, 13 sections plus failure log; the G11 live run was reported OK on 2026-10-08.) Write `docs/qa-checklist.md`: per feature, give exact steps, the expected result, where to look on the sheet, and a result/evidence column. Cover:
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

- [x] **G11 · Run `docs/qa-checklist.md`** on Foundry 14.367 with sf2e 1.5.x. Closed on JT's verbal report that the live QA run was OK on 2026-10-08; no versions, world or per-row evidence log were recorded. Recorded under CLAUDE.md "Recorded live evidence".
- [x] **G12 · Fix live findings.** No findings to fix: JT reported the live run OK on 2026-10-08; no failures or per-row log were recorded.

### Gate D — release

- [x] **G13 · Promote Alpha → Beta.** Done 2026-10-11 on JT's request: README, module.json description and CLAUDE.md say Beta. JT picked "Beta as 0.1.0" on the card: the merge auto-publishes v0.0.71, then v0.1.0 is published from the same commit with Actions > Release > Run workflow, so later merges count up from 0.1.1. Release notes are GitHub's generated notes.

### Deferred (not GM-ready blockers)

Full Free Archetype prerequisite graphs; upgrade prerequisite/exclusivity validation; shields and ammunition in the forge; PF2e-only code paths (the Skillful Lessons branch in `pc-builder.mjs`, PF2e casting rows in `pc-tables.mjs`; the Champion comment was fixed on 2026-10-25).
