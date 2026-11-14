// Pure "What's new" rules: the release-note list, which notes a browser has
// not seen yet, and when the window opens by itself. No Foundry globals, so it
// is node-testable; whats-new-app.mjs and simplysf2e.mjs supply live inputs.
//
// Releases are version-tagged automatically on every merge, so notes are keyed
// by a unique id, never by version. Every PR with a change a GM can see adds
// one entry at the TOP of RELEASE_NOTES (new unique id, i18n title and 2 to 5 bullets).

/** Newest first. title and each bullet are i18n keys in lang/en.json; a note has 2 to 5 bullets. */
export const RELEASE_NOTES = [
  {
    id: "2026-11-14-pop",
    title: "SIMPLYSF2E.WhatsNew.Note.Pop.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.Pop.B1",
      "SIMPLYSF2E.WhatsNew.Note.Pop.B2",
      "SIMPLYSF2E.WhatsNew.Note.Pop.B3",
      "SIMPLYSF2E.WhatsNew.Note.Pop.B4"
    ]
  },
  {
    id: "2026-11-14-interface-sounds",
    title: "SIMPLYSF2E.WhatsNew.Note.InterfaceSounds.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.InterfaceSounds.B1",
      "SIMPLYSF2E.WhatsNew.Note.InterfaceSounds.B2",
      "SIMPLYSF2E.WhatsNew.Note.InterfaceSounds.B3"
    ]
  },
  {
    id: "2026-11-14-mode-tiles",
    title: "SIMPLYSF2E.WhatsNew.Note.ModeTiles.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.ModeTiles.B1",
      "SIMPLYSF2E.WhatsNew.Note.ModeTiles.B2",
      "SIMPLYSF2E.WhatsNew.Note.ModeTiles.B3"
    ]
  },
  {
    id: "2026-11-14-result-cards",
    title: "SIMPLYSF2E.WhatsNew.Note.ResultCards.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.ResultCards.B1",
      "SIMPLYSF2E.WhatsNew.Note.ResultCards.B2",
      "SIMPLYSF2E.WhatsNew.Note.ResultCards.B3",
      "SIMPLYSF2E.WhatsNew.Note.ResultCards.B4"
    ]
  },
  {
    id: "2026-11-14-console-layout",
    title: "SIMPLYSF2E.WhatsNew.Note.ConsoleLayout.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.ConsoleLayout.B1",
      "SIMPLYSF2E.WhatsNew.Note.ConsoleLayout.B2",
      "SIMPLYSF2E.WhatsNew.Note.ConsoleLayout.B3",
      "SIMPLYSF2E.WhatsNew.Note.ConsoleLayout.B4",
      "SIMPLYSF2E.WhatsNew.Note.ConsoleLayout.B5"
    ]
  },
  {
    id: "2026-11-14-steadier-windows",
    title: "SIMPLYSF2E.WhatsNew.Note.SteadierWindows.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.SteadierWindows.B1",
      "SIMPLYSF2E.WhatsNew.Note.SteadierWindows.B2",
      "SIMPLYSF2E.WhatsNew.Note.SteadierWindows.B3",
      "SIMPLYSF2E.WhatsNew.Note.SteadierWindows.B4"
    ]
  },
  {
    id: "2026-11-10-review-fixes",
    title: "SIMPLYSF2E.WhatsNew.Note.ReviewFixes.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.ReviewFixes.B1",
      "SIMPLYSF2E.WhatsNew.Note.ReviewFixes.B2",
      "SIMPLYSF2E.WhatsNew.Note.ReviewFixes.B3",
      "SIMPLYSF2E.WhatsNew.Note.ReviewFixes.B4",
      "SIMPLYSF2E.WhatsNew.Note.ReviewFixes.B5"
    ]
  },
  {
    id: "2026-11-10-tidier-windows",
    title: "SIMPLYSF2E.WhatsNew.Note.TidierWindows.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.TidierWindows.B1",
      "SIMPLYSF2E.WhatsNew.Note.TidierWindows.B2",
      "SIMPLYSF2E.WhatsNew.Note.TidierWindows.B3",
      "SIMPLYSF2E.WhatsNew.Note.TidierWindows.B4",
      "SIMPLYSF2E.WhatsNew.Note.TidierWindows.B5"
    ]
  },
  {
    id: "2026-11-10-kept-work",
    title: "SIMPLYSF2E.WhatsNew.Note.KeptWork.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.KeptWork.B1",
      "SIMPLYSF2E.WhatsNew.Note.KeptWork.B2",
      "SIMPLYSF2E.WhatsNew.Note.KeptWork.B3",
      "SIMPLYSF2E.WhatsNew.Note.KeptWork.B4",
      "SIMPLYSF2E.WhatsNew.Note.KeptWork.B5"
    ]
  },
  {
    id: "2026-11-09-hunt-fixes",
    title: "SIMPLYSF2E.WhatsNew.Note.HuntFixes.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.HuntFixes.B1",
      "SIMPLYSF2E.WhatsNew.Note.HuntFixes.B2",
      "SIMPLYSF2E.WhatsNew.Note.HuntFixes.B3",
      "SIMPLYSF2E.WhatsNew.Note.HuntFixes.B4",
      "SIMPLYSF2E.WhatsNew.Note.HuntFixes.B5"
    ]
  },
  {
    id: "2026-11-08-progress-telemetry",
    title: "SIMPLYSF2E.WhatsNew.Note.ProgressTelemetry.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.ProgressTelemetry.B1",
      "SIMPLYSF2E.WhatsNew.Note.ProgressTelemetry.B2",
      "SIMPLYSF2E.WhatsNew.Note.ProgressTelemetry.B3",
      "SIMPLYSF2E.WhatsNew.Note.ProgressTelemetry.B4"
    ]
  },
  {
    id: "2026-11-08-theme-system",
    title: "SIMPLYSF2E.WhatsNew.Note.ThemeSystem.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.ThemeSystem.B1",
      "SIMPLYSF2E.WhatsNew.Note.ThemeSystem.B2",
      "SIMPLYSF2E.WhatsNew.Note.ThemeSystem.B3"
    ]
  },
  {
    id: "2026-11-08-setup-wiring",
    title: "SIMPLYSF2E.WhatsNew.Note.SetupWiring.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.SetupWiring.B1",
      "SIMPLYSF2E.WhatsNew.Note.SetupWiring.B2",
      "SIMPLYSF2E.WhatsNew.Note.SetupWiring.B3",
      "SIMPLYSF2E.WhatsNew.Note.SetupWiring.B4",
      "SIMPLYSF2E.WhatsNew.Note.SetupWiring.B5"
    ]
  },
  {
    id: "2026-11-08-copy-sweep",
    title: "SIMPLYSF2E.WhatsNew.Note.CopySweep.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.CopySweep.B1",
      "SIMPLYSF2E.WhatsNew.Note.CopySweep.B2",
      "SIMPLYSF2E.WhatsNew.Note.CopySweep.B3",
      "SIMPLYSF2E.WhatsNew.Note.CopySweep.B4"
    ]
  },
  {
    id: "2026-11-08-shell-consistency",
    title: "SIMPLYSF2E.WhatsNew.Note.ShellConsistency.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.ShellConsistency.B1",
      "SIMPLYSF2E.WhatsNew.Note.ShellConsistency.B2",
      "SIMPLYSF2E.WhatsNew.Note.ShellConsistency.B3",
      "SIMPLYSF2E.WhatsNew.Note.ShellConsistency.B4",
      "SIMPLYSF2E.WhatsNew.Note.ShellConsistency.B5"
    ]
  },
  {
    id: "2026-11-08-run-guards",
    title: "SIMPLYSF2E.WhatsNew.Note.RunGuards.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.RunGuards.B1",
      "SIMPLYSF2E.WhatsNew.Note.RunGuards.B2",
      "SIMPLYSF2E.WhatsNew.Note.RunGuards.B3",
      "SIMPLYSF2E.WhatsNew.Note.RunGuards.B4",
      "SIMPLYSF2E.WhatsNew.Note.RunGuards.B5"
    ]
  },
  {
    id: "2026-11-08-one-credstick",
    title: "SIMPLYSF2E.WhatsNew.Note.OneCredstick.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.OneCredstick.B1",
      "SIMPLYSF2E.WhatsNew.Note.OneCredstick.B2",
      "SIMPLYSF2E.WhatsNew.Note.OneCredstick.B3",
      "SIMPLYSF2E.WhatsNew.Note.OneCredstick.B4"
    ]
  },
  {
    id: "2026-11-08-reskin-trample",
    title: "SIMPLYSF2E.WhatsNew.Note.ReskinTrample.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.ReskinTrample.B1",
      "SIMPLYSF2E.WhatsNew.Note.ReskinTrample.B2"
    ]
  },
  {
    id: "2026-11-08-ui-polish",
    title: "SIMPLYSF2E.WhatsNew.Note.UiPolish.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.UiPolish.B1",
      "SIMPLYSF2E.WhatsNew.Note.UiPolish.B2",
      "SIMPLYSF2E.WhatsNew.Note.UiPolish.B3",
      "SIMPLYSF2E.WhatsNew.Note.UiPolish.B4",
      "SIMPLYSF2E.WhatsNew.Note.UiPolish.B5"
    ]
  },
  {
    id: "2026-11-07-run-deadline",
    title: "SIMPLYSF2E.WhatsNew.Note.RunDeadline.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.RunDeadline.B1",
      "SIMPLYSF2E.WhatsNew.Note.RunDeadline.B2",
      "SIMPLYSF2E.WhatsNew.Note.RunDeadline.B3"
    ]
  },
  {
    id: "2026-11-07-run-cost",
    title: "SIMPLYSF2E.WhatsNew.Note.RunCost.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.RunCost.B1",
      "SIMPLYSF2E.WhatsNew.Note.RunCost.B2",
      "SIMPLYSF2E.WhatsNew.Note.RunCost.B3"
    ]
  },
  {
    id: "2026-11-07-relevel-abilities",
    title: "SIMPLYSF2E.WhatsNew.Note.RelevelAbilities.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.RelevelAbilities.B1",
      "SIMPLYSF2E.WhatsNew.Note.RelevelAbilities.B2"
    ]
  },
  {
    id: "2026-11-07-aura",
    title: "SIMPLYSF2E.WhatsNew.Note.Aura.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.Aura.B1",
      "SIMPLYSF2E.WhatsNew.Note.Aura.B2",
      "SIMPLYSF2E.WhatsNew.Note.Aura.B3",
      "SIMPLYSF2E.WhatsNew.Note.Aura.B4"
    ]
  },
  {
    id: "2026-11-06-one-screen-welcome",
    title: "SIMPLYSF2E.WhatsNew.Note.OneScreenWelcome.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.OneScreenWelcome.B1",
      "SIMPLYSF2E.WhatsNew.Note.OneScreenWelcome.B2",
      "SIMPLYSF2E.WhatsNew.Note.OneScreenWelcome.B3"
    ]
  },
  {
    id: "2026-11-05-area-blast",
    title: "SIMPLYSF2E.WhatsNew.Note.AreaBlast.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.AreaBlast.B1",
      "SIMPLYSF2E.WhatsNew.Note.AreaBlast.B2",
      "SIMPLYSF2E.WhatsNew.Note.AreaBlast.B3"
    ]
  },
  {
    id: "2026-11-05-blank-abilities",
    title: "SIMPLYSF2E.WhatsNew.Note.BlankAbilities.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.BlankAbilities.B1",
      "SIMPLYSF2E.WhatsNew.Note.BlankAbilities.B2",
      "SIMPLYSF2E.WhatsNew.Note.BlankAbilities.B3",
      "SIMPLYSF2E.WhatsNew.Note.BlankAbilities.B4"
    ]
  },
  {
    id: "2026-11-05-clearer-errors",
    title: "SIMPLYSF2E.WhatsNew.Note.ClearerErrors.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.ClearerErrors.B1",
      "SIMPLYSF2E.WhatsNew.Note.ClearerErrors.B2",
      "SIMPLYSF2E.WhatsNew.Note.ClearerErrors.B3"
    ]
  },
  {
    id: "2026-10-31-run-budget",
    title: "SIMPLYSF2E.WhatsNew.Note.RunBudget.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.RunBudget.B1",
      "SIMPLYSF2E.WhatsNew.Note.RunBudget.B2",
      "SIMPLYSF2E.WhatsNew.Note.RunBudget.B3"
    ]
  },
  {
    id: "2026-10-31-provider-retry",
    title: "SIMPLYSF2E.WhatsNew.Note.ProviderRetry.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.ProviderRetry.B1",
      "SIMPLYSF2E.WhatsNew.Note.ProviderRetry.B2",
      "SIMPLYSF2E.WhatsNew.Note.ProviderRetry.B3",
      "SIMPLYSF2E.WhatsNew.Note.ProviderRetry.B4"
    ]
  },
  {
    id: "2026-10-25-multiclass",
    title: "SIMPLYSF2E.WhatsNew.Note.Multiclass.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.Multiclass.B1",
      "SIMPLYSF2E.WhatsNew.Note.Multiclass.B2",
      "SIMPLYSF2E.WhatsNew.Note.Multiclass.B3",
      "SIMPLYSF2E.WhatsNew.Note.Multiclass.B4",
      "SIMPLYSF2E.WhatsNew.Note.Multiclass.B5"
    ]
  },
  {
    id: "2026-10-25-class-fixes",
    title: "SIMPLYSF2E.WhatsNew.Note.ClassFixes.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.ClassFixes.B1",
      "SIMPLYSF2E.WhatsNew.Note.ClassFixes.B2",
      "SIMPLYSF2E.WhatsNew.Note.ClassFixes.B3",
      "SIMPLYSF2E.WhatsNew.Note.ClassFixes.B4",
      "SIMPLYSF2E.WhatsNew.Note.ClassFixes.B5"
    ]
  },
  {
    id: "2026-10-25-tech-core",
    title: "SIMPLYSF2E.WhatsNew.Note.TechCore.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.TechCore.B1",
      "SIMPLYSF2E.WhatsNew.Note.TechCore.B2",
      "SIMPLYSF2E.WhatsNew.Note.TechCore.B3",
      "SIMPLYSF2E.WhatsNew.Note.TechCore.B4"
    ]
  },
  {
    id: "2026-10-25-ui-refresh",
    title: "SIMPLYSF2E.WhatsNew.Note.UiRefresh.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.UiRefresh.B1",
      "SIMPLYSF2E.WhatsNew.Note.UiRefresh.B2",
      "SIMPLYSF2E.WhatsNew.Note.UiRefresh.B3",
      "SIMPLYSF2E.WhatsNew.Note.UiRefresh.B4",
      "SIMPLYSF2E.WhatsNew.Note.UiRefresh.B5"
    ]
  },
  {
    id: "2026-10-25-creature-art",
    title: "SIMPLYSF2E.WhatsNew.Note.CreatureArt.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.CreatureArt.B1",
      "SIMPLYSF2E.WhatsNew.Note.CreatureArt.B2",
      "SIMPLYSF2E.WhatsNew.Note.CreatureArt.B3",
      "SIMPLYSF2E.WhatsNew.Note.CreatureArt.B4"
    ]
  },
  {
    id: "2026-10-11-whats-new",
    title: "SIMPLYSF2E.WhatsNew.Note.WhatsNew.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.WhatsNew.B1",
      "SIMPLYSF2E.WhatsNew.Note.WhatsNew.B2"
    ]
  },
  {
    id: "2026-10-11-faster-encounters",
    title: "SIMPLYSF2E.WhatsNew.Note.FasterEncounters.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.FasterEncounters.B1",
      "SIMPLYSF2E.WhatsNew.Note.FasterEncounters.B2"
    ]
  },
  {
    id: "2026-10-11-treasure",
    title: "SIMPLYSF2E.WhatsNew.Note.Treasure.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.Treasure.B1",
      "SIMPLYSF2E.WhatsNew.Note.Treasure.B2",
      "SIMPLYSF2E.WhatsNew.Note.Treasure.B3",
      "SIMPLYSF2E.WhatsNew.Note.Treasure.B4"
    ]
  },
  {
    id: "2026-10-11-relevel",
    title: "SIMPLYSF2E.WhatsNew.Note.Relevel.Title",
    bullets: [
      "SIMPLYSF2E.WhatsNew.Note.Relevel.B1",
      "SIMPLYSF2E.WhatsNew.Note.Relevel.B2",
      "SIMPLYSF2E.WhatsNew.Note.Relevel.B3"
    ]
  }
];

/** Most notes a manual open lists. */
export const MANUAL_NOTE_CAP = 10;

const idList = (seenIds) => (Array.isArray(seenIds) ? seenIds.map(String) : []);

/** Notes whose id is not in seenIds, keeping the given (newest first) order. */
export function unseenNotes(notes, seenIds) {
  const seen = new Set(idList(seenIds));
  return (Array.isArray(notes) ? notes : []).filter((note) => note?.id && !seen.has(note.id));
}

/** Every current id, for a fresh install that should not be shown old news. */
export function firstRunSeenIds(notes) {
  return (Array.isArray(notes) ? notes : []).map((note) => note?.id).filter(Boolean);
}

/**
 * The seen list to start from when this browser has never stored one. A new
 * install (the welcome window is still opening: no working AI connection and
 * not dismissed) starts with every note seen. A GM who already set the module
 * up is upgrading from a release before this window existed, so every note
 * counts as unseen and they are shown once.
 */
export function initialSeenIds(notes, { welcomeOpening = false } = {}) {
  return welcomeOpening ? firstRunSeenIds(notes) : [];
}

/** Seen list plus the given notes' ids, without duplicates. */
export function markSeen(seenIds, notes) {
  return [...new Set([...idList(seenIds), ...firstRunSeenIds(notes)])];
}

/** The newest notes for a manual open, capped. */
export function manualNotes(notes, cap = MANUAL_NOTE_CAP) {
  return (Array.isArray(notes) ? notes : []).slice(0, cap);
}

/**
 * The window's mode and notes. An array is the automatic view (the unseen notes);
 * anything else is the manual view (the newest RELEASE_NOTES, capped).
 */
export function whatsNewView(notes) {
  return Array.isArray(notes)
    ? { manual: false, notes }
    : { manual: true, notes: manualNotes(RELEASE_NOTES) };
}

/** Split manual notes into newest release day vs earlier. */
export function splitManualNotes(notes) {
  const arr = Array.isArray(notes) ? notes : [];
  if (arr.length === 0) return { newest: [], earlier: [] };
  const newestDay = String(arr[0].id).slice(0, 10);
  const newest = [];
  const earlier = [];
  for (const n of arr) {
    if (String(n.id).slice(0, 10) === newestDay) newest.push(n);
    else earlier.push(n);
  }
  return { newest, earlier };
}

/**
 * Whether the window opens by itself at login: a GM on sf2e, not disabled,
 * a previous run recorded (seenIds is an array; null means a fresh install,
 * which the caller seeds silently), at least one unseen note, and the welcome
 * window not opening on this same load.
 */
export function shouldAutoOpenWhatsNew({ isGM, systemId, disabled, seenIds, unseenCount, welcomeOpening } = {}) {
  return Boolean(isGM)
    && systemId === "sf2e"
    && !disabled
    && Array.isArray(seenIds)
    && Number(unseenCount) > 0
    && !welcomeOpening;
}
