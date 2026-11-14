/**
 * The parts of the four tool windows (Generator, Item Forge, Shop, Treasure)
 * and the classes of the body element that holds them.
 *
 * Each window renders three ApplicationV2 parts inside one persistent
 * `.spf-window-body` element (`SpfApp._replaceHTML`):
 *   status  the shared status strip (connection, model, readiness, key warning)
 *   brief   the form the GM fills in
 *   result  progress, error, previews and the empty state
 * A render can name the parts that changed, so a click in the result does not
 * rebuild the form. The body element is created once and only its classes are
 * updated, which is also why the window keeps its scroll position.
 *
 * Pure data and functions: no Foundry globals, so the screenshot harness
 * (`tools/ui-preview/render.mjs`) builds the same DOM from the same source.
 */

/**
 * Opening height of the four tool windows, in px. A fixed height keeps the
 * window where the GM put it: a result scrolls inside the body instead of
 * resizing the frame. Foundry clamps it to the screen, and the window stays
 * resizable.
 */
export const CONSOLE_HEIGHT = 700;

const part = (file) => `templates/${file}`;

const MODE_CLASS = [
  ["monsterMode", "spf-mode-monster"],
  ["npcMode", "spf-mode-npc"],
  ["encounterMode", "spf-mode-encounter"],
  ["characterMode", "spf-mode-character"],
  ["reskinMode", "spf-mode-reskin"]
];

export const WINDOW_PARTS = {
  generator: {
    parts: {
      status: part("generator-status.hbs"),
      brief: part("generator-brief.hbs"),
      result: part("generator-result.hbs")
    },
    /** Exactly one mode class (the mode accent, generator.css), plus the busy flag. */
    bodyClasses(context = {}) {
      const mode = MODE_CLASS.find(([flag]) => context[flag])?.[1];
      return ["simplysf2e-generator", ...(mode ? [mode] : []), ...(context.busy ? ["spf-busy"] : [])];
    }
  },
  itemforge: {
    parts: {
      status: part("itemforge-status.hbs"),
      brief: part("itemforge-brief.hbs"),
      result: part("itemforge-result.hbs")
    },
    bodyClasses: () => ["simplysf2e-generator", "spf-hud"]
  },
  shop: {
    parts: {
      status: part("shop-status.hbs"),
      brief: part("shop-brief.hbs"),
      result: part("shop-result.hbs")
    },
    bodyClasses: () => ["simplysf2e-generator", "simplysf2e-shop", "spf-hud"]
  },
  treasure: {
    parts: {
      status: part("treasure-status.hbs"),
      brief: part("treasure-brief.hbs"),
      result: part("treasure-result.hbs")
    },
    bodyClasses: () => ["simplysf2e-generator", "simplysf2e-treasure", "spf-hud"]
  }
};

/** The body element's full class attribute for one window and render context. */
export function windowBodyClassName(windowId, context) {
  const spec = WINDOW_PARTS[windowId];
  if (!spec) throw new Error(`unknown tool window "${windowId}"`);
  return ["spf-window-body", ...spec.bodyClasses(context)].join(" ");
}

/** `static PARTS` for a tool window: one entry per part, in render order. */
export function windowPartsConfig(windowId, moduleId) {
  const spec = WINDOW_PARTS[windowId];
  if (!spec) throw new Error(`unknown tool window "${windowId}"`);
  return Object.fromEntries(Object.entries(spec.parts).map(([id, path]) =>
    [id, { template: `modules/${moduleId}/${path}` }]));
}

/**
 * Carry the GM's open folds across a part re-render. A `<details data-fold>`
 * that was open stays open in the new markup; one the template itself renders
 * open (it holds an error or a required choice) is never closed here.
 * Folds are matched by their `data-fold` name, in document order per name.
 * @param {{querySelectorAll: Function}|null} prior the part element being replaced
 * @param {{querySelectorAll: Function}|null} next  the part element replacing it
 * @returns {number} how many folds were re-opened
 */
export function carryOpenFolds(prior, next) {
  if (!prior?.querySelectorAll || !next?.querySelectorAll) return 0;
  const openCounts = new Map();
  const seen = new Map();
  for (const fold of prior.querySelectorAll("details[data-fold]")) {
    const name = fold.dataset?.fold ?? "";
    const index = seen.get(name) ?? 0;
    seen.set(name, index + 1);
    if (fold.open) openCounts.set(`${name}#${index}`, true);
  }
  let reopened = 0;
  seen.clear();
  for (const fold of next.querySelectorAll("details[data-fold]")) {
    const name = fold.dataset?.fold ?? "";
    const index = seen.get(name) ?? 0;
    seen.set(name, index + 1);
    if (!fold.open && openCounts.get(`${name}#${index}`)) {
      fold.open = true;
      reopened++;
    }
  }
  return reopened;
}

/**
 * Whether the Generator's brief folds to its one-line summary.
 * The brief folds once the active mode shows a result, so the result gets
 * the window; it never folds in Reskin mode, whose brief holds the source
 * creature and the re-level table (a kept-at-old-level line must stay in
 * view). During a run the fold keeps the state it had when the run began
 * (`auto`), so the form does not jump open and shut around the progress card.
 * @param {object} context the render context (preview keys, `busy`, `reskinMode`)
 * @param {{auto?: boolean|null, override?: boolean|null}} [state]
 *   `auto`: whether the last idle render had a result; `override`: the GM's
 *   own toggle since the last run (true = collapsed), or null.
 * @returns {{foldable: boolean, collapsed: boolean, hasResult: boolean}}
 */
export function briefFoldContext(context = {}, { auto = null, override = null } = {}) {
  const hasResult = Boolean(context.preview || context.encounterPreview || context.pcPreview
    || context.reskinPreview || context.created || context.characterReview);
  const wanted = context.busy ? auto === true : hasResult;
  const foldable = !context.reskinMode && wanted;
  return { foldable, collapsed: foldable && (override ?? true), hasResult };
}

/**
 * Whether a freshly rendered result part should play its one-time arrival.
 * A result arrives when the part shows a card of another kind than the
 * render before it did (none, a preview, a completion card: the card's
 * `data-result`). With `afterRun`, a card that a finished run replaced with
 * one of the same kind arrives too; the Generator leaves that off, because
 * its draft is already on screen while the run works and a reroll changes
 * one row. A re-render of a card already shown never replays the arrival,
 * and neither does the first render of a window that opens on a stored result.
 * @param {{busy: boolean, kind: string}} now `kind` is "" when no card shows
 * @param {{busy: boolean, kind: string}|null} before the previous render of the part
 * @param {{afterRun?: boolean}} [options]
 */
export function resultArrives(now, before, { afterRun = false } = {}) {
  if (!now?.kind || !before) return false;
  if (now.kind !== before.kind) return true;
  return Boolean(afterRun && before.busy && !now.busy);
}

/** The Generator's mode tiles in the order the template renders them. */
export const MODE_ORDER = ["monster", "npc", "encounter", "character", "reskin"];

/**
 * Motion "slide": the tile the selection marker leaves when the mode changes.
 * Returns that tile's index, or null when nothing should move (the first
 * render, the same mode again, an unknown mode).
 */
export function modeSlideFrom(before, now) {
  const from = MODE_ORDER.indexOf(before);
  const to = MODE_ORDER.indexOf(now);
  return from < 0 || to < 0 || from === to ? null : from;
}
