/**
 * Recent generations: a short, in-memory list of previews the GM moved away
 * from, so a new run, a discard of the wrong preview, or a closed window
 * never throws away a paid AI run. Lives only as long as the page; nothing
 * here is written to settings, flags or browser storage.
 *
 * Pure list helpers: no Foundry dependency, node-testable.
 */

/** How many earlier previews the Generator keeps. */
export const RECENT_LIMIT = 5;

/** The preview modes an entry can restore into. */
export const RECENT_MODES = Object.freeze(["monster", "npc", "encounter", "character", "reskin"]);

/**
 * Put `entry` at the front of `list`, replacing any entry with the same id,
 * and drop the oldest past `limit`. Returns a new array; `list` is unchanged.
 */
export function rememberRecent(list, entry, limit = RECENT_LIMIT) {
  if (!entry?.id || !RECENT_MODES.includes(entry.mode)) return [...(list ?? [])];
  const rest = (list ?? []).filter((item) => item.id !== entry.id);
  return [entry, ...rest].slice(0, Math.max(0, limit));
}

/** `list` without the entry `id`. Returns a new array. */
export function forgetRecent(list, id) {
  return (list ?? []).filter((item) => item.id !== id);
}

/** The entry `id` from `list`, or null. */
export function findRecent(list, id) {
  return (list ?? []).find((item) => item.id === id) ?? null;
}

/**
 * Which mode a captured preview state belongs to. A reskin flavor only counts
 * when that is the mode the preview was made in, because the dropped source
 * creature stays loaded while the GM generates in other modes.
 */
export function previewModeOf(state, madeIn) {
  if (!state) return null;
  if (madeIn === "reskin" && state.reskinFlavor) return "reskin";
  if (state.encounter) return "encounter";
  if (state.pcConcept) return "character";
  if (state.concept) return madeIn === "npc" ? "npc" : "monster";
  if (state.reskinFlavor) return "reskin";
  return null;
}

/** Display name for a captured preview, or "" when it has none. */
export function previewNameOf(state, mode) {
  const name = {
    monster: state?.concept?.name,
    npc: state?.concept?.name,
    encounter: state?.encounter?.name,
    character: state?.pcConcept?.name,
    reskin: state?.reskinFlavor?.name ?? state?.reskinSource?.name
  }[mode];
  return typeof name === "string" ? name.trim() : "";
}
