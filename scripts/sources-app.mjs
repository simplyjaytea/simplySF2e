import { MODULE_ID, SETTINGS, getSetting } from "./settings.mjs";
import { CATEGORIES, CATEGORY_LABELS, DEFAULT_PACKS, detectAvailablePacks } from "./compendium.mjs";
import { packMatches } from "./sources-filter.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Settings menu: scan the world's Item compendiums and let the GM choose
 * which packs each category (abilities, spells, feats, equipment) may draw
 * from. Empty selection for a category falls back to the system defaults.
 */
export class SourcesConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #filter = { query: "", selectedOnly: false };

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
    const f = this.#filter;
    const active = f.query.trim() !== "" || f.selectedOnly;
    const totalPacks = (cats) => cats.reduce((a, c) => a + c.packs.length, 0);
    const categories = CATEGORIES.map((key) => {
      const selected = new Set(
        Array.isArray(stored[key]) && stored[key].length ? stored[key] : DEFAULT_PACKS[key]
      );
      const packs = detected[key].map((pack) => {
        const p = { ...pack, checked: selected.has(pack.id), isDefault: DEFAULT_PACKS[key].includes(pack.id) };
        return { ...p, hidden: active ? !packMatches(p, f) : false };
      });
      const selectedCount = packs.filter((p) => p.checked).length;
      const allHidden = active && packs.length > 0 && packs.every((p) => p.hidden);
      return { key, label: CATEGORY_LABELS[key], packs, selectedCount, hidden: allHidden };
    });
    const shown = categories.reduce((a, c) => a + c.packs.filter((p) => !p.hidden).length, 0);
    const total = totalPacks(categories);
    const filter = {
      query: f.query,
      selectedOnly: f.selectedOnly,
      active: f.query.trim() !== "" || f.selectedOnly,
      shown,
      total,
      noMatches: (f.query.trim() !== "" || f.selectedOnly) && shown === 0
    };
    return { categories, noPacks: categories.every((category) => !category.packs.length), filter };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    const update = () => {
      const q = root.querySelector("[data-source-filter]")?.value ?? "";
      const so = !!root.querySelector("[data-source-selected-only]")?.checked;
      this.#filter = { query: q, selectedOnly: so };
      const active = q.trim() !== "" || so;
      let shown = 0, total = 0;
      for (const fs of root.querySelectorAll("fieldset[data-source-category]")) {
        const rows = [...fs.querySelectorAll("label.spf-pack")];
        let allHidden = rows.length > 0;
        for (const row of rows) {
          const cb = row.querySelector("input[type='checkbox']");
          const pack = { title: row.textContent, package: cb?.dataset?.package, id: cb?.dataset?.pack, checked: !!cb?.checked };
          const hidden = active ? !packMatches(pack, { query: q, selectedOnly: so }) : false;
          row.hidden = hidden;
          if (!hidden) allHidden = false;
          shown += hidden ? 0 : 1;
          total += 1;
        }
        fs.hidden = active && rows.length > 0 && allHidden;
      }
      const status = root.querySelector("[data-source-filter-status]");
      if (status) status.hidden = !active;
      const noMatch = root.querySelector("[data-source-no-match]");
      if (noMatch) noMatch.hidden = !(active && shown === 0);
      const countEl = root.querySelector("[data-source-filter-count]");
      if (countEl) countEl.textContent = game.i18n.format("SIMPLYSF2E.Sources.FilterStatus", { shown, total });
    };
    const filterInput = root.querySelector("[data-source-filter]");
    filterInput?.addEventListener("input", update);
    // The filter applies as the GM types. Enter must not submit the form (that saves and closes).
    filterInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") event.preventDefault();
    });
    root.querySelector("[data-source-selected-only]")?.addEventListener("change", update);
    for (const cb of root.querySelectorAll("label.spf-pack input[type='checkbox']")) {
      cb.addEventListener("change", () => {
        const fs = cb.closest("fieldset[data-source-category]");
        const countEl = fs?.querySelector("[data-source-count]");
        if (countEl) {
          const total = fs.querySelectorAll("label.spf-pack").length;
          const selected = fs.querySelectorAll("label.spf-pack input[type='checkbox']:checked").length;
          countEl.textContent = game.i18n.format("SIMPLYSF2E.Sources.CategoryCount", { selected, total });
        }
      });
    }
    root.querySelector("[data-source-filter-clear]")?.addEventListener("click", () => {
      const inp = root.querySelector("[data-source-filter]");
      const so = root.querySelector("[data-source-selected-only]");
      if (inp) inp.value = "";
      if (so) so.checked = false;
      update();
      inp?.focus();
    });
    // re-apply filter from context on render
    update();
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
