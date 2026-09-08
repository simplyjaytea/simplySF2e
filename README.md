# SimplySF2e

AI generator for Starfinder 2e actors in Foundry VTT. Ported from [SimplyPF2e](https://github.com/simplyjaytea/simplyPF2e).

## Install

Paste this manifest URL into **Foundry → Add-on Modules → Install Module**:

```
https://github.com/simplyjaytea/simplySF2e/releases/latest/download/module.json
```

Current published release: **v0.0.4** (Alpha). A merge to `main` auto-releases the next tag.

## Status

**Alpha.** Identity is `simplysf2e` targeting system `sf2e` **1.5.0** (Foundry 14.361+ / verified 14.367).

What works as far as node tests allow (live Foundry QA is still outstanding):

- Module loads against `sf2e` with pack defaults from `system.sf2e.json` 1.5.0 (`sf2e.classes`, `class-features`, `feats`, `spells`, `equipment`, `ancestries`, `heritages`, `backgrounds`, `bestiary-ability-glossary-srd`, `alien-core-bestiary`).
- Six Standard presets: Envoy, Mystic, Operative, Solarian, Soldier, Witchwarper (flavor guides; scale-words only).
- Generated loot/wealth assembles as **Credits/Credstick** and **UPB** from cited v14-dev templates. Gold-piece language converts at 1 gp = 10 credits (`DENOMINATION_RATES`). Starting-wealth math is the inherited Table 10-10 lump sum, **surfaced in credits**.
- Generator/forge/provider chrome uses cited SF2e navy/cyan tokens (no system artwork). Alpha polish deepens that HUD (panel ticks, mode/progress/button chrome, readable trust lines) on the module’s own Application windows only.
- Monster / NPC / Encounter pipelines: fail-closed grounding against enabled `sf2e` packs.
- Complete-only Character generation for **Envoy, Mystic, Solarian, Soldier, Witchwarper** — L1 class paths use cited `item:tag:` ChoiceSet + GrantItem bridges (`stageClassPaths`). Solarian has no L1 item:tag path (Solar Manifestations is GrantItem/Strike REs).

Limitations (honest residuals):

- **Operative** is not complete-only. Every specialization option carries a non-static `item:category:skill` ChoiceSet; unlocking would throw or invent a skill-feat resolver.
- Mystic/Witchwarper spell slot tables are still the inherited PF2e Remaster approximation, not cited SF2e casting tables.
- Building Creatures / Treasure-by-Level **numbers** in `tables.mjs` remain inherited PF2e-compatible benchmarks — not Starfinder-authored.
- Equipment grades: match published `sf2e.equipment` names (including a grade word when the catalog name has one). Do not invent `+1 striking` prefixes; v14-dev `Migration942EquipmentGrade` maps potency/striking onto `system.grade` and zeros runes. Item Forge rune assembly is still PF2e-era and unverified live.
- Free Archetype graphs, custom art, and elite/weak adjustments are out of scope.
- Rest hook remains the cited `pf2e.restForTheNight` string.

## Links

- Repository: https://github.com/simplyjaytea/simplySF2e
- Foundry: v14 (compat minimum 14.361)
- Game system: [`sf2e`](https://foundryvtt.com/packages/sf2e) 1.5.0 (Starfinder Second Edition)
