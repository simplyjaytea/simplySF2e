# simplySF2e — agent playbook

How work in this repo is planned, split, built, reviewed and merged. These are JT's standing rules (set 2026-10-25). They replace the older "Sonnet worker recipe" that lived in CLAUDE.md and HANDOFF.md. CLAUDE.md holds the project brief and invariants; AGENTS.md holds the tool-neutral rules. If this file and AGENTS.md disagree on merging or verification, AGENTS.md wins.

## Roles

| Role | Who | Settings | Does |
| --- | --- | --- | --- |
| Coordinator | Opus 5.5 | high effort | Makes every plan, splits it into tasks, fetches and cites sf2e source, dispatches workers, runs the review ladder, integrates, opens and merges the PR, writes HANDOFF.md. Never hands off release/workflow `.yml` reasoning. |
| Planner (optional) | Opus 5.5 `Plan` agent | `model: "opus"`, `effort: "high"` | A second opinion on a large or risky plan. The coordinator still owns the plan. |
| Worker | Haiku 5.5 | `model: "haiku"`, `effort: "high"`, `isolation: "worktree"`, `run_in_background: true` | One task, in its own worktree. Commits there; never pushes. |
| Schema worker | Sonnet 5.5 | `model: "sonnet"`, `effort: "high"`, `isolation: "worktree"` | Any task whose code depends on sf2e field names, enums, pack ids or rule shapes. Uses only the cited source the coordinator pasted in. |
| Reviewer, tier 1 | Haiku 5.5 | `effort: "high"`, fresh context | First pass on every finished worktree. |
| Reviewer, tier 2 | Sonnet 5.5 | `effort: "high"`, fresh context | Second pass on every finished worktree. |
| Reviewer, tier 3 | Opus 5.5 | `effort: "high"`, fresh context | Only for schema- or balance-sensitive diffs (anything touching `tables.mjs`, `relevel.mjs`, `stat-check.mjs`, stat math in `builder.mjs`, pack ids, sf2e enums, Rule Elements, PC grants/slots). |
| Extra capacity (optional) | DeepSeek Flash 4.1 (free tier, per JT) in opencode terminals | via the Orca `orchestration` skill | Bulk read-only sweeps or mechanical edits when Claude workers are busy. Its output goes up the same review ladder, and it gets no secrets. |

Reviewers are never the agent that built the change. For a tier that must run tests, use an agent type that can run `node` (e.g. `general-purpose`). The `caveman:cavecrew-reviewer` type limits its shell to git read commands, so it cannot run tests (seen 2026-10-25).

## Lifecycle of a piece of work

1. **Intake.** Read HANDOFF.md, then CLAUDE.md "Current state". Check `git log --oneline -10` and `git status`. Run the full test loop once for a baseline.
2. **Plan (Opus, high).** Write down the goal, the stop condition, and every file each task may touch. Do the sf2e schema lookups now: fetch `https://raw.githubusercontent.com/foundryvtt/pf2e/v14-dev/<path>` and keep the quoted lines for the worker prompts. Ask JT only about real design choices; per AGENTS.md rule 1 they go to JT first.
3. **Split.** One task per worktree, with **no file overlap between tasks that run in parallel**. A task that needs a file another task owns waits for that task to merge into the integration branch. Docs that describe the code (CLAUDE.md, AGENTS.md, HANDOFF.md) belong to the coordinator, not to workers.
4. **Dispatch.** Send every independent task in one message so the workers run in parallel. Use the worker template below.
5. **Review ladder.** When a worker reports back, send its worktree to tier 1, then tier 2, then tier 3 if the diff is schema- or balance-sensitive. A finding goes back to **the same worker** (`SendMessage` to its id) as a **new commit** (never an amend). The fixed branch then climbs the ladder again **from the tier that found the problem**. Minor findings in coordinator-owned docs are fixed by the coordinator later rather than sent back.
6. **Integrate.** Create one integration branch from `main` (e.g. `cleanup/<topic>` or `feat/<topic>`) and merge every passed worktree branch into it (`git merge --no-ff <branch>`). Then rerun the full gate on the integration branch: `bash tools/release-check.sh` (add `--no-ui` only when no template or CSS changed).
7. **PR and merge.** Push the integration branch (in a cloud session, push to the session's designated branch instead), open **one** PR for the whole batch, and wait for the `verify` check. **Each merge to `main` publishes a public release**, so batch work rather than merging one PR per task. The coordinator may merge once an independent reviewer has no open blockers and `verify` is green on the current head (AGENTS.md rule 1). If the change is visible to a GM, add one `RELEASE_NOTES` entry first (see AGENTS.md).
8. **Tidy.** After the merge: `git worktree remove <path>` for each worker worktree, and delete the local `worktree-agent-*` branches. Delete a merged remote branch only after JT approves (AGENTS.md: ask before authenticated GitHub writes outside push → PR → merge).
9. **Hand off.** Overwrite HANDOFF.md with what was done, what is in flight, the exact next step, and anything unverified. Add durable lessons to HISTORY.md (newest first).

## Worker prompt template

```
You are a <Haiku|Sonnet> worker on simplySF2e (Foundry VTT module for Starfinder 2e; plain ES modules in scripts/*.mjs; tests are standalone `node scripts/<name>.test.mjs`). Task <ID> — <title>.

Context (verified by the coordinator): <what is true, with file:line and quoted evidence>

Do exactly this:
1. <concrete step with file and line anchor>
2. ...

Cited source values you may use (do not look up or invent others):
<quoted v14-dev lines, or "none needed">

Rules:
- Only change: <file list>.
- Never hand-author Rule Elements, invent sf2e schema, or let the in-module AI emit numbers. Escape AI/user text with text.mjs esc/toHtml. Fail closed.
- Git identity: `git config user.name "jt"` and `git config user.email "jt_f@ymail.com"` in the worktree first. Commit in your worktree only. Do NOT push or open PRs.
- Verify: `node --check` every touched .mjs; `for f in scripts/*.test.mjs; do node "$f" >/dev/null 2>&1 || echo FAIL $f; done` prints no FAIL. Add a *.test.mjs for any pure logic you change.

Report back: worktree path, branch, commit SHA, files changed, test summary, anything you could not do. Quote a source line for every "verified" claim, or say "unverified".
```

## Reviewer prompt template

```
Independent review (tier <1 Haiku | 2 Sonnet | 3 Opus>) of <commit/branch> in simplySF2e. Read-only: do NOT edit, commit, or push.
Worktree: <path>. Diff: `git -C <path> diff <main-sha> HEAD`.
Intent: <one sentence, including "no behavior change" when that applies>.
Check:
1. <the specific risks for this diff — removed names still referenced, dynamic keys, schema shapes, balance numbers>
2. Anything else in the diff that changes behavior.
3. Run: `node --check` on touched files and the full test loop.
Output: one finding per line `path:line: severity: problem. fix.` (blocker/major/minor), or "no findings". End with VERDICT: PASS or FAIL and the test result.
```

Tier 2 and tier 3 prompts say what the lower tiers already checked and ask for the deeper risks: indirect callers (namespace imports, `module.api`, macro bodies as strings, Hooks), lost side effects, lost test coverage of live code, and wording a GM will read.

## Traps this repo has already hit

- **Translation keys built at runtime.** `i18n-keys.test.mjs` only sees literal keys. `treasure-app.mjs` builds `` `SIMPLYSF2E.Treasure.Amount${Value}` `` (note: `SIMPLYSF2E.TreasureAmount.*` is a different, also runtime-built family), and several other families are built the same way (see CLAUDE.md "Commands"). The 2026-10-25 cleanup nearly deleted two live keys; the tier-1 Haiku review caught it. Grep for the prefix before deleting any key.
- **sf2e is not PF2e.** Never recall a field name or enum from PF2e memory. Fetch v14-dev source (CLAUDE.md invariant 2, HISTORY.md bug log).
- **Merging to `main` is a public release.** Treat it like `gh release create`.
- **`.github/workflows/*.yml` changes** need a real test merge; syntax checks miss trigger-chain bugs.
- **Line endings.** The scripts are CRLF on Windows checkouts. Keep the file's existing endings, and make sure `git diff --check` is clean.
- **Local `gh` hangs** on this machine. Use `curl https://api.github.com/repos/simplyjaytea/simplySF2e/...` for reads, and ask JT before any authenticated GitHub write that is not part of the normal push → PR → merge flow.
- **Squash merges** mean `git branch --merged` cannot tell which remote branches landed. Match branch tips against merged PR heads through the GitHub API instead.
- **Nothing here runs Foundry.** Rendering, derived stats and grant chains need JT's live check. List those items in the PR body and in HANDOFF.md, and add rows to `docs/qa-checklist.md` when a new feature needs one.

## Using DeepSeek Flash 4.1 through Orca (optional)

Use it when a task is large, cheap to check, and does not need sf2e schema judgment: repo-wide sweeps, listing call sites, mechanical renames across many files. Load the `orchestration` skill (and `orca-cli` for terminals and worktrees), open an opencode terminal on DeepSeek Flash 4.1 in its own Orca worktree, and give it the same worker template. Its result goes up the same review ladder as a Claude worker's. Never paste API keys or other secrets into its prompt.
