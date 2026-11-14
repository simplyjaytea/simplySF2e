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
