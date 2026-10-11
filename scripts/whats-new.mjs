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

/** Seen list plus the given notes' ids, without duplicates. */
export function markSeen(seenIds, notes) {
  return [...new Set([...idList(seenIds), ...firstRunSeenIds(notes)])];
}

/** The newest notes for a manual open, capped. */
export function manualNotes(notes, cap = MANUAL_NOTE_CAP) {
  return (Array.isArray(notes) ? notes : []).slice(0, cap);
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
