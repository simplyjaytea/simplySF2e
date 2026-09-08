# HANDOFF.md — live session baton

Read this first, then CLAUDE.md. HISTORY.md is the PF2e-era scaffold narrative; do not treat its v0.3.5.x release baton as simplySF2e state.

## Current session — 2026-09-08 Chrome S (generator HUD polish)

- Repo: `simplyjaytea/simplySF2e`. Started from `origin/main` tip `2c07cc6` (PR #4 Phase B2 / published **v0.0.4**). This chrome PR auto-releases as **v0.0.5** on merge.
- **Chrome S:** deepened the existing navy/cyan Application HUD against cited `foundryvtt/pf2e` v14-dev `src/styles/sf2e/index.scss` (`$primary-color` #1d3c53, `$secondary-color` #40256f, `--color-bg-trait` #2d4f6a, `--color-border-trait` #9edae6, proficiency master/legendary). No system sheet art, no new image assets.
- Generator window: HUD corner ticks on cards, segmented mode radios, cyan focus glow, Advanced chevron, generate/cancel/secondary buttons, progress sheen + pulse (real step percent, no fake ETA), trust/status lines use `--spf-text-muted` instead of opacity. Busy toggles `.spf-busy` on the root and the Application element.
- New/expanded CSS variables: `--spf-brand-secondary`, `--spf-warning`, `--spf-text`, `--spf-text-muted`, `--spf-glow`, `--spf-inset-glow`, `--spf-tick`, `--spf-font-mono`.

## Exact next step

Live Foundry QA of complete-only Envoy/Mystic/Solarian/Soldier/Witchwarper (path dialogs, grants, spell entries) **plus** this generator chrome next to official sf2e sheets (dark + light Foundry themes). Operative skill-feat ChoiceSet staging if a cited resolver is wanted. SF2e Building Creatures numbers and Item Forge live verification stay parked.

## Material limits

- Alpha, not a finished product. Mystic/Witchwarper spell slot tables are still inherited PF2e Remaster approximations. Item Forge rune assembly is still PF2e-era.
- Live Foundry QA is not in this environment. Foundry core/theme CSS can still override window-header/input backgrounds; residual listed on the PR.
- HISTORY.md is inherited from the PF2e scaffold; do not rewrite it as SF2e history.
