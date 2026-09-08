# HANDOFF.md — live session baton

Read this first, then CLAUDE.md. HISTORY.md is the PF2e-era scaffold narrative; do not treat its v0.3.5.x release baton as simplySF2e state.

## Current session — 2026-09-08 Phase B2 alpha

- Repo: `simplyjaytea/simplySF2e`. Started from `origin/main` tip `4a4fa38` (PR #3 Phase B1 merged; published **v0.0.3**). This PR auto-releases as **v0.0.4** on merge.
- **Complete-only:** `COMPLETE_PC_CLASS_SLUGS` is **envoy, mystic, solarian, soldier, witchwarper**. Cited v14-dev L1 bridges use ChoiceSet `item:tag:<tag>` + GrantItem `{item|flags.system.rulesSelections.<flag>}` (`packs/sf2e/classes/soldier.json` → Soldier Fighting Style → `item:tag:soldier-fighting-style`). Same shape: envoy-leadership-style, mystic-connection, witchwarper-paradox, witchwarper-anchor. Solarian Solar Manifestations is GrantItem/Strike REs, not an item:tag ChoiceSet — nothing to stage. **Operative locked:** every specialization option has a non-static `item:category:skill` + `item:level:1` ChoiceSet.
- **Wealth:** inherited Table 10-10 lump sums stay in gp internally; `gpToCredits` / `pcStartingWealthCredits` surface them at cited `DENOMINATION_RATES` (1 gp = 10 credits). Assembly remains Credstick/UPB.
- **Grades vs runes:** `sf2e.equipment` weapons carry `system.grade` (sample Laser Pistol `commercial`). v14-dev `Migration942EquipmentGrade` maps potency/striking onto grades and zeros runes. No Weapon Potency / Striking / Resilient items in `sf2e.equipment` (solarian crystals are a separate type). Rune-prefix happy path is disabled; unpublished prefixes drop; published catalog names (including grade words when present) are copied exactly.
- Rest hook kept as cited `pf2e.restForTheNight`. Chrome S polish skipped.

## Exact next step

Live Foundry QA of complete-only Envoy/Mystic/Solarian/Soldier/Witchwarper (path dialogs, grants, spell entries). Operative skill-feat ChoiceSet staging if a cited resolver is wanted. SF2e Building Creatures numbers and Item Forge live verification stay parked.

## Material limits

- Alpha, not a finished product. Mystic/Witchwarper spell slot tables are still inherited PF2e Remaster approximations. Item Forge rune assembly is still PF2e-era.
- Live Foundry QA is not in this environment.
- HISTORY.md is inherited from the PF2e scaffold; do not rewrite it as SF2e history.
