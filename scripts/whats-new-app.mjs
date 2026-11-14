import { MODULE_ID, SETTINGS, getSetting } from "./settings.mjs";
import { markSeen, splitManualNotes, whatsNewView } from "./whats-new.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const localizeNote = (note) => ({
  id: note.id,
  title: game.i18n.localize(note.title),
  bullets: note.bullets.map((key) => game.i18n.localize(key))
});

/**
 * "What's new" window. Auto-open passes only the unseen notes; a manual open
 * (settings menu, /sf2e whatsnew, api.openWhatsNew) passes none and shows the
 * newest RELEASE_NOTES, capped, even when auto-open is disabled.
 */
export class WhatsNewApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #notes;
  #manual = false;

  constructor(options = {}, notes = null) {
    super(options);
    const view = whatsNewView(notes);
    this.#manual = view.manual;
    this.#notes = view.notes;
  }

  /** Switch an open automatic window to the manual view (newest notes). Caller renders. */
  showManual() {
    const view = whatsNewView(null);
    this.#manual = view.manual;
    this.#notes = view.notes;
  }

  static DEFAULT_OPTIONS = {
    id: "simplysf2e-whats-new",
    tag: "div",
    classes: ["simplysf2e"],
    window: {
      title: "SIMPLYSF2E.WhatsNew.Title",
      icon: "fa-solid fa-bolt",
      resizable: true
    },
    position: { width: 520, height: "auto" },
    actions: {
      gotIt: WhatsNewApp.#onGotIt,
      disable: WhatsNewApp.#onDisable
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/whats-new.hbs`, scrollable: [""] }
  };

  async _prepareContext() {
    let notesList = this.#notes;
    let earlierList = [];
    if (this.#manual) {
      const split = splitManualNotes(this.#notes);
      notesList = split.newest;
      earlierList = split.earlier;
    }
    return {
      version: game.modules.get(MODULE_ID)?.version ?? "",
      manual: this.#manual,
      notes: notesList.map(localizeNote),
      earlierNotes: earlierList.map(localizeNote)
    };
  }

  async #markSeen() {
    try {
      const seen = getSetting(SETTINGS.whatsNewSeen);
      await game.settings.set(MODULE_ID, SETTINGS.whatsNewSeen, markSeen(seen, this.#notes));
    } catch (err) {
      console.warn(`${MODULE_ID} | could not save the What's new state`, err);
    }
  }

  static async #onGotIt() {
    await this.#markSeen();
    this.close();
  }

  static async #onDisable() {
    try {
      await game.settings.set(MODULE_ID, SETTINGS.whatsNewDisabled, true);
    } catch (err) {
      console.warn(`${MODULE_ID} | could not save the What's new setting`, err);
    }
    await this.#markSeen();
    this.close();
  }
}
