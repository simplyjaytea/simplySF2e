import { MODULE_ID, SETTINGS, getSetting } from "./settings.mjs";
import { CATEGORIES, CATEGORY_LABELS, DEFAULT_PACKS, detectAvailablePacks } from "./compendium.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Settings menu: scan the world's Item compendiums and let the GM choose
 * which packs each category (abilities, spells, feats, equipment) may draw
 * from. Empty selection for a category falls back to the system defaults.
 */
export class SourcesConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "simplysf2e-sources",
    tag: "form",
    classes: ["simplysf2e"],
    window: {
      title: "SIMPLYSF2E.Sources.Title",
      icon: "fa-solid fa-book-atlas",
      resizable: true
    },
    position: { width: 560, height: 640 },
    form: {
      handler: SourcesConfigApp.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      reset: SourcesConfigApp.#onReset
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/sources.hbs`, scrollable: [""] }
  };

  async _prepareContext() {
    const detected = await detectAvailablePacks();
    const stored = getSetting(SETTINGS.sourcePacks) ?? {};
    const categories = CATEGORIES.map((key) => {
      const selected = new Set(
        Array.isArray(stored[key]) && stored[key].length ? stored[key] : DEFAULT_PACKS[key]
      );
      return {
        key,
        label: CATEGORY_LABELS[key],
        packs: detected[key].map((pack) => ({
          ...pack,
          checked: selected.has(pack.id),
          isDefault: DEFAULT_PACKS[key].includes(pack.id)
        }))
      };
    });
    return { categories, noPacks: categories.every((category) => !category.packs.length) };
  }

  static async #onSubmit() {
    const selection = {};
    for (const category of CATEGORIES) {
      selection[category] = [
        ...this.element.querySelectorAll(`input[data-category="${category}"]:checked`)
      ].map((el) => el.dataset.pack);
    }
    await game.settings.set(MODULE_ID, SETTINGS.sourcePacks, selection);
    ui.notifications.info(game.i18n.localize("SIMPLYSF2E.Sources.Saved"));
  }

  static async #onReset() {
    const { DialogV2 } = foundry.applications.api;
    const confirmed = await DialogV2.confirm({
      window: { title: "SIMPLYSF2E.Sources.ResetTitle" },
      content: `<p>${game.i18n.localize("SIMPLYSF2E.Sources.ResetConfirm")}</p>`,
      rejectClose: false
    });
    if (!confirmed) return;
    await game.settings.set(MODULE_ID, SETTINGS.sourcePacks, {});
    ui.notifications.info(game.i18n.localize("SIMPLYSF2E.Sources.ResetDone"));
    await this.render();
  }
}
