# HANDOFF.md — live session baton

Read this first, then CLAUDE.md. HISTORY.md is the PF2e-era scaffold narrative; do not treat its v0.3.5.x release baton as simplySF2e state.

## Current session — 2026-09-08 Phase B first slice (currency / table honesty)

- Repo: `simplyjaytea/simplySF2e`. Started from `origin/main` tip `d0da690` (PR #2 Phase A merged; published **v0.0.2**). This PR auto-releases as **v0.0.3** on merge.
- **Currency:** generated loot/wealth prefers credits. `scripts/currency.mjs` clones verbatim v14-dev `credstick.json` / `upb.json` the same way `ActorInventory.addCurrency` does. Credits count is written to `system.price.value.sp` with quantity locked to 1; UPB uses `system.quantity`. Gold/silver/platinum/copper loot names convert through cited `DENOMINATION_RATES` (gp:100, credits:10 → 1 gp = 10 credits). Unknown denominations still fail closed. Classic `pf2e.equipment-srd` coin UUIDs are **not** used and no sf2e gold-piece UUIDs were invented.
- **AI copy:** `lootGuide()` asks for Credits/Credstick (and UPB for materials), not Gold Coins. Value remains gp-equivalent (10 credits = 1 gp) because treasure-budget numbers are still inherited PF2e tables.
- **Tables:** `tables.mjs` numbers are unchanged. Header/README/lang tooltip now say these are inherited PF2e-compatible benchmarks pending a cited Starfinder 2e GM Core source — never claimed as Starfinder-authored.
- **Copy:** preset placeholder `Undead Brute` → `Corpsefleet Bruiser`; Item Forge placeholder circlet → scorched visor.

## Exact next step

**Phase B2:** cite SF2e class-feature grant / path shapes from `packs/sf2e/` before complete-only staging; do not copy PF2e `item:tag:` paths and rename. Rune rewrite and SF2e Building Creatures numbers stay parked until a real source is in hand. Wealth math still budgets in gp-equivalent.

## Material limits

- Not play-ready. Rune systems, feat graphs, PC casting profiles, and complete-only remain PF2e-era.
- Live Foundry QA is not in scope for this slice (credstick/UPB embed + sheet currency display).
- HISTORY.md is inherited from the PF2e scaffold; do not rewrite it as SF2e history.
