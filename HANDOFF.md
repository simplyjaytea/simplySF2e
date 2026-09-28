# HANDOFF.md — live session baton

Read this first, then CLAUDE.md. HISTORY.md is the PF2e-era scaffold narrative; do not treat its v0.3.5.x release baton as simplySF2e state.

## Last session — 2026-09-28 P0–P4 improvement wave (integration branch pushed, NOT released)

- Exploratory sweep found P0–P4 items; built in 6 branches off `2aeffec`, all Muse Spark 1.3 Free (`opencode/muse-spark-1.3-contributor-free`): `chore/p0-quick-wins` (dead lang key, encounter credits display, tooltip/hint/comment refresh), `chore/p1-sf2e-icons` (`systemIcon` helper + credits log wording), `chore/p1-credits-prompts` (AI credits-first, wondrous gp comment), `chore/p2-tables-provenance` (comments-only PF2e labels), `chore/p3-coverage` (new `tables.test.mjs` + `currency.test.mjs`), `chore/p4-ux-docs` (thousands separators, README/audit provenance flags).
- Independent review via Codex CLI `gpt-6-astra` (`codex exec`, diff piped via stdin — `review --commit` rejects a prompt arg): P4 + P2 ACCEPT; P3/P1-prompts/P1-icons REQUEST CHANGES (all fixed: template-shape test cases, sp×10 comment, `gpToCredits` in logs).
- DeepSeek V4 Pro (`opencode-go/deepseek-v4-pro`) merged all six into `integrate/wave-p0-p4`, added `creditsToGp` fallback normalization (creation + budget edges) with `builder.creditsFallback.test.mjs`, 90/90 tests pass, pushed to origin. `main` untouched at `38d15b6` — no release published.
- Prior session (2026-09-26): tables-cite + Free Archetype wave merged to main at explicit user request; see git log.

## Exact next step

1. Open PR `integrate/wave-p0-p4` → `main` (link: `https://github.com/simplyjaytea/simplySF2e/pull/new/integrate/wave-p0-p4`). Merging to `main` auto-publishes a release — confirm intent first.
2. Live Foundry QA on the VPS: credits preview + over-budget styling, custom-item fallback pricing (`value/10` gp), `systems/sf2e/` icons, credits-first prompts with grounded items unaffected.
3. Remaining larger work: Item Forge rune re-target (SF2e grade/crystal model), stat-array schema discovery (Alien Core), UI-shell tests (`app-base`, presets, sources).

## Material limits

- Alpha, not a finished product. Building Creatures / Treasure by Level numbers in `tables.mjs` remain inherited PF2e-compatible benchmarks pending cited Starfinder 2e numbers.
- Item Forge rune assembly is still PF2e-era.
- Live Foundry QA is not in this environment.
- HISTORY.md is inherited from the PF2e scaffold; do not rewrite it as SF2e history.
