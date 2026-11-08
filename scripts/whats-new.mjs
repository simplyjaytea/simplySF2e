// Pure "What's new" rules: the release-note list, which notes a browser has
// not seen yet, and when the window opens by itself. No Foundry globals, so it
// is node-testable; whats-new-app.mjs and simplysf2e.mjs supply live inputs.
//
// Releases are version-tagged automatically on every merge, so notes are keyed
// by a unique id, never by version. Every PR with a change a GM can see adds
// one entry at the TOP of RELEASE_NOTES (new unique id, i18n title and body).

/** Newest first. title/body are i18n keys in lang/en.json. */
export const RELEASE_NOTES = [
  {
    id: "2026-11-08-one-credstick",
    title: "SIMPLYSF2E.WhatsNew.Note.OneCredstick.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.OneCredstick.Body"
  },
  {
    id: "2026-11-08-reskin-trample",
    title: "SIMPLYSF2E.WhatsNew.Note.ReskinTrample.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.ReskinTrample.Body"
  },
  {
    id: "2026-11-08-ui-polish",
    title: "SIMPLYSF2E.WhatsNew.Note.UiPolish.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.UiPolish.Body"
  },
  {
    id: "2026-11-07-run-deadline",
    title: "SIMPLYSF2E.WhatsNew.Note.RunDeadline.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.RunDeadline.Body"
  },
  {
    id: "2026-11-07-run-cost",
    title: "SIMPLYSF2E.WhatsNew.Note.RunCost.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.RunCost.Body"
  },
  {
    id: "2026-11-07-relevel-abilities",
    title: "SIMPLYSF2E.WhatsNew.Note.RelevelAbilities.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.RelevelAbilities.Body"
  },
  {
    id: "2026-11-07-aura",
    title: "SIMPLYSF2E.WhatsNew.Note.Aura.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.Aura.Body"
  },
  {
    id: "2026-11-06-one-screen-welcome",
    title: "SIMPLYSF2E.WhatsNew.Note.OneScreenWelcome.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.OneScreenWelcome.Body"
  },
  {
    id: "2026-11-05-area-blast",
    title: "SIMPLYSF2E.WhatsNew.Note.AreaBlast.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.AreaBlast.Body"
  },
  {
    id: "2026-11-05-blank-abilities",
    title: "SIMPLYSF2E.WhatsNew.Note.BlankAbilities.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.BlankAbilities.Body"
  },
  {
    id: "2026-11-05-clearer-errors",
    title: "SIMPLYSF2E.WhatsNew.Note.ClearerErrors.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.ClearerErrors.Body"
  },
  {
    id: "2026-10-31-run-budget",
    title: "SIMPLYSF2E.WhatsNew.Note.RunBudget.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.RunBudget.Body"
  },
  {
    id: "2026-10-31-provider-retry",
    title: "SIMPLYSF2E.WhatsNew.Note.ProviderRetry.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.ProviderRetry.Body"
  },
  {
    id: "2026-10-25-multiclass",
    title: "SIMPLYSF2E.WhatsNew.Note.Multiclass.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.Multiclass.Body"
  },
  {
    id: "2026-10-25-class-fixes",
    title: "SIMPLYSF2E.WhatsNew.Note.ClassFixes.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.ClassFixes.Body"
  },
  {
    id: "2026-10-25-tech-core",
    title: "SIMPLYSF2E.WhatsNew.Note.TechCore.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.TechCore.Body"
  },
  {
    id: "2026-10-25-ui-refresh",
    title: "SIMPLYSF2E.WhatsNew.Note.UiRefresh.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.UiRefresh.Body"
  },
  {
    id: "2026-10-25-creature-art",
    title: "SIMPLYSF2E.WhatsNew.Note.CreatureArt.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.CreatureArt.Body"
  },
  {
    id: "2026-10-11-whats-new",
    title: "SIMPLYSF2E.WhatsNew.Note.WhatsNew.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.WhatsNew.Body"
  },
  {
    id: "2026-10-11-faster-encounters",
    title: "SIMPLYSF2E.WhatsNew.Note.FasterEncounters.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.FasterEncounters.Body"
  },
  {
    id: "2026-10-11-treasure",
    title: "SIMPLYSF2E.WhatsNew.Note.Treasure.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.Treasure.Body"
  },
  {
    id: "2026-10-11-relevel",
    title: "SIMPLYSF2E.WhatsNew.Note.Relevel.Title",
    body: "SIMPLYSF2E.WhatsNew.Note.Relevel.Body"
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
