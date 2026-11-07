# UI improvement plan

Status: **approved by JT 2026-11-07, not started** (Kimi out of usage). Source: Kimi's UI review of all 82 harness fixtures at 720 px and 460 px (2026-11-07). JT chose to build all ten items plus the polish nits, before the next beta's live test.

Hand this file to the UI worker as its task. One branch (`work/T-UI` from the current batch branch), **one commit per item**, so a reviewer can bisect and JT can drop an item.

## Rules for every item

- PLAYBOOK §3 and §4 "UI changes": narrow layouts use `@container spf-window` on `.window-content`, never viewport `@media`; shared controls and tokens live in `styles/simplysf2e.css`, single-window rules in `styles/apps/<app>.css`.
- No behaviour change beyond what the item says. Never hide an active warning, a validation error, unsaved edits, a kept-at-old-level re-level line, or the run cost.
- Collapsible sections use native `<details>/<summary>` (keyboard and screen-reader friendly). Their open state may be remembered per browser only if an existing pattern does that already; otherwise they start in the state the item names.
- New strings only as keys in `lang/en.json` under the window's existing prefix. Keep every existing key that is still used; delete keys made unused (and let `scripts/i18n-keys.test.mjs` prove it).
- AI text keeps going through `escAi`/`toHtml` (PLAYBOOK §8).
- For every changed window: update or add `tools/ui-preview/fixtures/*` states, run the harness, and look at the PNGs at both widths before committing.

## Items (build in this order: low risk first)

| # | Window | Change | Effort | Done when |
| --- | --- | --- | --- | --- |
| 3 | All previews (Generator, Forge, Shop, Treasure) | Token report becomes a `<details>` block, collapsed by default; its summary shows the run total and the cost line (incl. "at least" / ≈ labels). Create / Reroll / Discard stay where they are; no sticky bar. | S | The summary always shows tokens and cost; expanding shows today's full report; fixtures for a cost and a partial-cost preview. |
| 8 | What's new (manual "all notes" view) | Newest release notes open; older ones grouped under a collapsed **Earlier changes** `<details>`. The automatic unseen-notes view is unchanged. | S | `whats-new-manual-all` fixture shows the split; unseen view identical to today. |
| 9 | Generator encounter preview | Member stats as a two-column label/value grid instead of one run-on statline; header chips labelled **XP** and **Credits**; member count controls in the same place on every card. Keep over-budget and skipped-member cues. | S | `generator-encounter-preview` at 460 px reads as a grid; no overflow. |
| 10 | Shop and Treasure tables | At the narrow container size: short visible headings **Lvl** / **Qty** with the full label kept for assistive tech (`<abbr title>` or visually hidden text); item names wrap by word; Type moves to a secondary line under the item name; remove buttons stay aligned. 720 px unchanged. | S | `shop-preview@460` and `treasure-preview@460` scan cleanly; harness passes. |
| 6 | Generator status rows | Keep the provider/model row. Merge the Compendium and Jev rows into one compact readiness row whose detail text expands on click. Any warning state shows expanded and prominent, as today. | S | Healthy fixtures show two rows instead of three; `generator-empty-attention` still shows every warning. |
| 1 | Generator character review | Show the snapshot/validation caveat once at the top. Each warning gets a short action title ("Choose a heritage option", "Review one untrained weapon") with its current text as an expandable explanation. Every warning stays present and announced. | S | `generator-character-review` at 460 px fits the actions without repeated caveats. |
| 7 | Re-level preview (Reskin) | Group each Strike's attack and damage rows under the Strike's short name, old and new values aligned. The "unchanged" explanation moves into a collapsed `<details>`. Rebuilt and kept-at-old-level ability lines stay visible. Also fix the stale Reskin hint (nit 1). | M | `generator-reskin-relevel` at both widths; no truncated formulas at 460 px. |
| 2 | AI Provider Setup | Connection, endpoint, model and key stay visible. Manual prices go under a **Cost estimate** `<details>`; Jev settings under **Fast picks**. A section opens automatically when it holds a validation error or the active route needs it (Jev/TypeSafe chosen). Save buttons unchanged. | M | `provider-setup-prices` and `provider-setup-jev-typesafe` fixtures, incl. an error-opened state; existing provider-setup tests pass. |
| 5 | Item Forge | Replace the five large descriptive tiles with compact kind buttons (or a labelled select), the selected kind's description shown once below. All five kinds equally visible and keyboard reachable; selected state has a non-colour cue. | M | `itemforge-empty-*` fixtures at 460 px put the prompt above the fold. |
| 4 | Compendium Sources | Add a pack-name filter field and a **Selected only** checkbox above the list. Category headings, counts and the pinned Save/Reset row stay. Filtering never drops unchecked edits; focus and scroll position are kept. | M | `sources-default` plus a filtered fixture state; a pure filter helper with a node test. |

## Polish nits (one commit together)

1. Reskin empty hint after a drop: when a source exists, say "Reskin or Preview Plan to create the preview" (done with item 7).
2. Welcome provider-note text (Recommended / Live check pending): use `--spf-text-xs`, allow two clean lines.
3. Error and readiness boxes (`generator-empty-attention`, `shop-empty-attention`): action first, endpoint/setup detail second.
4. Manage Presets: a slightly stronger separator before Delete using the existing spacing token; labels and confirmation unchanged.

## Verification for the branch

- `node --check` every touched `.mjs`; all-tests loop; `node scripts/i18n-keys.test.mjs`; golden replay; `bash tools/release-check.sh` **with** the UI step (pin `npm install --no-save playwright@1.64.1` first); harness exit 0 at both widths.
- Add QA rows for each item in `docs/qa-checklist.md` (free id prefixes; release-check catches duplicates) and add a UI step to `docs/beta-pass.md` that covers them.
- One "What's new" entry for the whole UI batch.
- Review ladder: tier 1 Haiku (harness + every PNG), tier 2 Sonnet or Kimi (accessibility, warnings never hidden, no behaviour change), coordinator reads the diff.
