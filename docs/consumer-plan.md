# Consumer-ready plan (after 1.0)

Planned by Fable on 2026-10-25. Status: **accepted with JT's decisions (2026-10-25), recorded in §4.** This builds on `docs/roadmap-1.0.md` (M0-M4) and adds M5-M9. The goal, in JT's words: "other people can use it ... no bugs, it just works flawlessly. We just give it the API key and it just goes to town."

## 1. Bars a consumer release must meet

| Bar | Target |
| --- | --- |
| R1 Reliability per mode | Over 20 runs, at least 95% of Monster, NPC, Encounter, PC (L1/L5/L12), Forge ×5, Shop, Treasure, Reskin and Re-level runs end in a verified Create on the reference model. At least 90% on every tier-1 model. Every failure ends in a documented fail-closed message |
| R2 No unhandled errors | Zero uncaught errors with `simplysf2e` in the stack across the release pass and the 14-day soak on JT's worlds |
| R3 Time to first generation | A fresh world with a key in the clipboard reaches a created L5 monster in 3 minutes or less, and 4 clicks or fewer after pasting |
| R4 Cost visible and bounded | Every run shows tokens, plus currency when the price is known. Big encounters show an estimate first. A per-run token budget stops runaway retries |
| R5 Graceful failure | Every error names the cause and the next step. Cancel never leaves a draft. Retries never duplicate actors |
| R6 No data loss | A failed Create deletes only its own documents. Reskin sources are never touched |
| R7 Upgrades never break worlds | N-1 → N → N-1 on the same world keeps settings and generated actors working |
| R8 Compatibility | Green on Foundry 14 min/verified × sf2e 1.6.x. A newer sf2e warns but never blocks. A pack-id change is caught |
| R9 Support loop | A bug report reaches the maintainer in one click, with versions and redacted settings |

**Exit:** all nine bars are green on one stable build, after a 14-day beta soak on JT's worlds with no open blocker. JT decided against outside testers and a smoke bot.

## 2. Milestones

### M5: trust the pipe (reliability infrastructure, no JT time)

- Move the AI transport into `scripts/ai-transport.mjs` with an injectable transport, so the pipelines can run offline.
- **Golden prompt suite:** record real responses per model and task once, then replay them through the real pipelines in CI (no live API).
- **Fuzzing:** broken JSON, missing keys, HTML/script, truncation and forged references must fail closed.
- **Provider/model matrix:** pass rate per task per model.
- **429/5xx backoff, a run deadline, and a per-run token budget.**
- **CI gates:** release-check, class bench, pipeline benches, golden replay, fuzz, and a weekly sf2e drift check.

### M6: paste one key (onboarding)

- **One-screen Welcome:** a provider button, the key field, then Connect. Connect validates the key through `/models`, fills in a default model, tests it, and offers "Generate a sample monster".
- **First-class providers:**
  - OpenRouter (recommended default);
  - OpenAI;
  - DeepSeek;
  - Google via its OpenAI-compatible endpoint, once proven live;
  - Ollama with a default model.
- **Everything else goes behind Advanced:** Anthropic via OpenRouter, LM Studio, Jev and TypeSafe.
- **Error copy:** every `Errors.*` string states the cause and the next step.
- **Cost display:** OpenRouter `usage.cost`, plus optional manual prices.

### M7: release channels

- Every merge goes to a **beta** channel (a rolling `beta` release with its own manifest). **Stable** releases happen only by manual dispatch.
- Listing fields in `module.json` (bugs, changelog, readme, license, media), a `CHANGELOG.md`, and issue templates.
- An "Open issue" button in the bug report.
- Rollback docs and a settings schema version.
- `LICENSES.md` with the ORC notice.
- Each `.yml` change gets a real test merge.

### M8: many hands (QA at scale)

- **Live smoke runner:** not built — JT decided against a smoke bot (D1). Live testing stays manual; the golden replay suite plus JT's logged passes carry R1/R2.
- **Beta cohort:** not recruited — JT decided against outside testers (D7). The 14-day soak runs on JT's own worlds.
- **Fix waves** come from intake and JT's logged passes.

### M9: consumer release

- Stable 1.0.0 published by dispatch.
- The Foundry package listing goes live.
- A GIF, an FAQ and a model recommendation table.
- The README changes from Beta to Stable.

### Out of scope

- Companion actors.
- Shields and ammunition.
- Upgrade slot capacity.
- A light theme.
- Languages other than English.
- The native Anthropic API (OpenRouter covers it).
- Image generation.
- Foundry v13 and PF2e.
- A hosted proxy.

## 3. Top risks

1. **JT is the only live tester.** Contained by the golden replay suite, JT's logged passes and the 14-day soak on his own worlds (no smoke bot, no outside cohort per D1/D7).
2. **Auto-release ships beta-quality code to everyone.** Contained by the channels (M7) before the next risky merge.
3. **Model and provider drift.** Contained by re-running the matrix each stable release, `/models` validation and an alias table.
4. **sf2e renames packs or changes shapes.** Contained by the drift cron, a soft version warning and pinned benches.
5. **False confidence from offline suites.** Contained by stating limits in each README; derived stats stay live rows.
6. **Cost surprises.** Contained by the budget, estimates and currency display.
7. **Workflow mistakes.** Contained by test merges on throwaway tags.
8. **Scope creep during beta.** Fixes come only from intake clusters.

## 4. JT decisions (Fable's recommendation in brackets)

- D1 Build the VPS live smoke runner? [Yes]
- D2 Release channels before the next merge? [Yes: build M7 right after the current batch]
- D3 Version naming? [Consumer release = 1.0.0; "playable" ships as the first beta]
- D4 Default provider for new users? [OpenRouter; DeepSeek stays the QA reference]
- D5 Tier-1 models (at most 5)? [DeepSeek V4 Flash, one OpenAI, an Anthropic and a Google model via OpenRouter, one Ollama model]
- D6 Default run token budget and the encounter cost confirmation? [60k tokens; confirm above 4 members]
- D7 Recruit an outside beta cohort? [Yes, 5-10 GMs]
- D8 License: MIT code plus the ORC notice and a Paizo community-use statement? [Yes; JT confirms the wording]
- D9 Player handouts GM-only by default, with a Share button? [Yes]
- D10 Foundry package listing at beta or stable? [Stable only]
- D11 Cost: manual price fields, OpenRouter cost, or both? [Both]

### JT's decisions (2026-10-25)

- **D2 Channels:** yes, before the next merge. The M2-M4 batch ships to beta, not to every install.
- **D4 Providers:** OpenRouter and DeepSeek are both first-class defaults on the Welcome screen.
- **D1 Smoke bot:** no. Live testing stays manual.
- **D7 Beta cohort:** no. The exit criteria change: R1/R2 are measured by the golden replay suite plus JT's logged passes, and the 14-day soak runs on JT's own worlds.
- D3, D5, D6, D8, D9, D10, D11: Fable's recommendations stand until JT says otherwise.
