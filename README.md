# SimplySF2e

AI generator for Starfinder 2e actors in Foundry VTT. Ported from [SimplyPF2e](https://github.com/simplyjaytea/simplyPF2e); under construction.

## Install

Paste this manifest URL into **Foundry → Add-on Modules → Install Module**:

```
https://github.com/simplyjaytea/simplySF2e/releases/latest/download/module.json
```

Current published release: **v0.0.1** (identity rebrand). This branch targets **v0.0.2**. Auto-release stamps `module.json` on each merge to `main`.

## Status

Phase B in progress — **not play-ready**. Identity is `simplysf2e` targeting system `sf2e` **1.5.0** (Foundry 14.361+ / verified 14.367). Pack defaults and Standard presets are Starfinder 2e; generated loot/wealth prefers credits (and UPB for materials) via cited `sf2e` credstick/UPB templates. Creature-building and treasure-budget **numbers** in `tables.mjs` are still inherited PF2e-compatible values — they are not Starfinder-authored. Rune math and complete-only PC staging remain later slices. Complete one-click Character generation is not offered for SF2e classes yet.

## Links

- Repository: https://github.com/simplyjaytea/simplySF2e
- Foundry: v14 (compat minimum 14.361)
- Game system: [`sf2e`](https://foundryvtt.com/packages/sf2e) 1.5.0 (Starfinder Second Edition)
