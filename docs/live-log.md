# Live log

Append-only record of live checks in a real Foundry world. A feature counts as live-verified only when a row here says PASS for its QA id on a recorded build. Agents cannot run Foundry; JT fills this in, or tells an agent the results to record.

How to use:
- Add one block per session, newest at the bottom. Never edit an old block; correct it in a new one.
- Use QA ids from `docs/qa-checklist.md`. The pass documents (`docs/release-pass.md`, `docs/live-pass.md`) list which ids to run.
- Result is `PASS`, `FAIL` or `N/A`. Every FAIL also goes into the failure log of the pass document you ran, so it can become a fix task.

## Session template

```
### YYYY-MM-DD, <who>
Foundry <version> · sf2e <version> · SimplySF2e <version or branch@sha> · provider/model <name> · browser <name>
Pass document: <docs/release-pass.md | docs/live-pass.md | other>

| QA id | Result | Evidence / notes |
| --- | --- | --- |
| 0.1 | PASS | |
```

## Sessions

### 2026-10-08, JT (verbal, recorded later)
Versions not recorded. JT reported that the full `docs/qa-checklist.md` passed live. No per-row results were kept, so no row from that session counts as live-verified for 1.0.
