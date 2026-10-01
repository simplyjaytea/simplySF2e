# SimplySF2e

AI generator for Starfinder 2e actors in Foundry VTT. Ported from [SimplyPF2e](https://github.com/simplyjaytea/simplyPF2e).

## Install

Paste this manifest URL into **Foundry → Add-on Modules → Install Module**:

```
https://github.com/simplyjaytea/simplySF2e/releases/latest/download/module.json
```

Every merge to `main` auto-publishes the next release tag (Alpha). See [Releases](https://github.com/simplyjaytea/simplySF2e/releases) for the current version.

## Status

**Alpha.** Identity is `simplysf2e` targeting system `sf2e` **1.5.0** (Foundry 14.361+ / verified 14.367).

What works as far as node tests allow (live Foundry QA is still outstanding):

- Module loads against `sf2e` with pack defaults from `system.sf2e.json` 1.5.0 (`sf2e.classes`, `class-features`, `feats`, `spells`, `equipment`, `ancestries`, `heritages`, `backgrounds`, `bestiary-ability-glossary-srd`, `alien-core-bestiary`).
- Six Standard presets: Envoy, Mystic, Operative, Solarian, Soldier, Witchwarper (flavor guides; scale-words only).
- Generated loot/wealth assembles as **Credits/Credstick** and **UPB** from cited v14-dev templates. Gold-piece language converts at 1 gp = 10 credits (`DENOMINATION_RATES`). Starting-wealth math is the inherited PF2e Table 10-10 lump sum (PF2e provenance — not an SF2e-authored table), **surfaced in credits**. Unmatched custom-item estimates are credits-first at the AI edge and normalize credits→gp (`creditsToGp`) at the builder fallback edge for both creation and budgeting.
- Encounter preview shows treasure in **credits** with thousands separators and over-budget styling parity with the XP readout. Generated item icons resolve against the active system id (`systems/sf2e/`, pf2e-compatible fallback) instead of hardcoded pf2e paths.
- Generator/forge/provider chrome uses cited SF2e navy/cyan tokens (no system artwork). Alpha polish deepens that HUD (panel ticks, mode/progress/button chrome, readable trust lines) on the module’s own Application windows only.
- Monster / NPC / Encounter pipelines: fail-closed grounding against enabled `sf2e` packs.
- Complete-only Character generation for all six published classes: **Envoy, Mystic, Operative, Solarian, Soldier, Witchwarper** — L1 class paths use cited `item:tag:` ChoiceSet + GrantItem bridges (`stageClassPaths`), with Operative's specialization skill feat and Sniper's bonus feat choices closed before create. Solarian has no L1 item:tag path (Solar Manifestations is GrantItem/Strike REs).
- Cited SF2e spellcasting tables for **Mystic** and **Witchwarper** in `pc-tables.mjs` matching `sf2e` v14-dev journal tables (3 base slots per rank, 5 cantrips, 10th-rank spell at level 19).
- Building Creatures / Treasure-by-Level numbers in `tables.mjs` are cited against *Starfinder GM Core* pp. 116–128.
- Elite/Weak creature adjustment (Alien Core pp. 204/207), four Starfinder NPC archetype presets, and a `/sf2e` chat command (`/sf2e itemforge`, `/sf2e npc 4 "street doc"`).
- Item Forge weapons/armor use SF2e equipment grades (commercial → paragon) and installed upgrades, priced in credits; augmentation and solarian crystal item kinds.

Limitations (honest residuals):

- Equipment grades: match published `sf2e.equipment` names (including a grade word when the catalog name has one). Do not invent `+1 striking` prefixes; v14-dev `Migration942EquipmentGrade` maps potency/striking onto `system.grade` and zeros runes. Item Forge grade/upgrade assembly is unverified live.
- Free Archetype prerequisite graphs and custom art are out of scope.
- Reskinning an existing creature and multiclass dedications exist as helpers only; there is no UI for them yet.
- Rest hook remains the cited `pf2e.restForTheNight` string.

## Links

- Repository: https://github.com/simplyjaytea/simplySF2e
- Foundry: v14 (compat minimum 14.361)
- Game system: [`sf2e`](https://foundryvtt.com/packages/sf2e) 1.5.0 (Starfinder Second Edition)
