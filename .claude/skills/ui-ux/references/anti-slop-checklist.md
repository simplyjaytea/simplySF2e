# Anti-slop checklist for simplySF2e windows

What "AI slop" looks like in a Foundry module, and the check that catches it. Run it on every UI diff and every harness PNG (720, 460, short). Long-form rules with rationale: `quick-reference.md` in this folder (MIT, Next Level Builder; stack-agnostic sections 1, 4, 5, 6, 8 apply; ignore its search-tool and mobile-only lines).

## 1. It must look like Foundry and sf2e, not like a SaaS landing page

- [ ] The module's deliberate look is JT's **Neon Drift HUD** (decision 2026-11-08): cyan and magenta on the dark sf2e surface, glow on the primary action and the active state, sheen/pulse/blink motion only while a run works. That is the idiom, not slop. Slop is the generic version: gradients or glow on things that are not the primary action or the active state, glassmorphism blur, emoji, sparkle or rocket motifs, motion while idle, SaaS hero layout. Apply the theme's rules (`docs/ui-overhaul-plan.md` §1) the same way in every window.
- [ ] Controls are Foundry's native elements styled by core CSS (`button`, `select`, `input`, `<details>`), not re-drawn pills and toggles. Customise only through `--spf-*` tokens in `styles/simplysf2e.css`.
- [ ] Radius, border and spacing come from tokens. No raw hex, no raw px in `styles/apps/*.css`. One accent colour; the rest is the sf2e dark surface scale.
- [ ] Compare the PNG against a published sf2e NPC sheet at the same width. If the window would look foreign dropped next to that sheet, it is wrong.

## 2. Hierarchy comes from size, weight and spacing, not from colour or decoration

- [ ] One primary action per window; secondary actions visually subordinate; destructive actions red and separated.
- [ ] No cards inside cards. One level of grouping (`<fieldset>` or a `<details>`), then rows.
- [ ] Dense by design: GM tools are worked in, not browsed. Spacing scale from the tokens (4/8 rhythm); no oversized padding, no hero whitespace, no centred marketing layout.
- [ ] Headings are short nouns ("Loadout", "Run cost"), sentence case, no colons, no emoji, no exclamation marks.

## 3. Words a GM reads

- [ ] Every status or error names the cause and the next step. No "Oops", no "Something went wrong", no "Please try again later" without a reason.
- [ ] No filler: "simply", "just", "seamlessly", "powerful", "intelligent", "✨". No praise of the module in its own UI.
- [ ] Labels are visible, not placeholder-only; helper text sits under the field; validation errors sit next to the field and stay until fixed.
- [ ] Numbers the GM compares (DCs, prices, tokens, credits) are right-aligned with tabular figures (`font-variant-numeric: tabular-nums`); names wrap by word; shortened headers use `<abbr title>` or visually hidden text.

## 4. Nothing is hidden that the GM must see

- [ ] Active warnings, validation errors, unsaved edits, a kept-at-old-level re-level line and the run cost are always visible. A collapsed `<details>` never holds one of them.
- [ ] A section with an error or a required choice renders open.
- [ ] At 460 px and in the 360 px short render, every control can be reached by scrolling; the harness fails otherwise.

## 5. Accessible by default

- [ ] Text contrast at least 4.5:1 and control boundaries at least 3:1 on the dark surface. Check with a picker on the PNG, do not assume.
- [ ] Visible focus ring on every interactive element; tab order matches visual order; icon-only buttons carry `aria-label`; decorative icons beside text carry `aria-hidden="true"`.
- [ ] Colour is never the only signal: a warning has an icon or a word; a selected state has a non-colour cue.
- [ ] Motion only from the module's vocabulary (sheen = working, pulse = awaiting the GM, blink = active step, arrive = a new result card, unfold = the GM opened the form) and only while a run works, a GM action is awaited or something just changed; nothing animates idle and nothing waits for an animation. Respect `prefers-reduced-motion` and reserve space so nothing shifts.

## 6. Icons

- [ ] Font Awesome 6 Free, one style (solid) per hierarchy level, sized from one token. No mixing outline and solid in one row; no Pro-only glyph without a note in the report (it renders blank in the harness, fine in Foundry).

## How to run it

1. After the harness, open each changed fixture at `@720`, `@460` and `@460-short` and go down sections 1 to 6.
2. Read every new or changed `lang/en.json` string aloud; apply section 3.
3. In the report, list each checklist line you could not verify (for example contrast, when no picker was run) under "unverified". A reviewer treats an unlisted line as claimed.
