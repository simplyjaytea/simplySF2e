import { MODULE_ID, SETTINGS, getSetting, getProviderAuthWarningKey } from "./settings.mjs";
import { sourceReadiness, describeMissingSources } from "./compendium.mjs";
import { jevKeySource } from "./jev.mjs";
import { welcomeState } from "./welcome.mjs";
import { ProviderSetupApp } from "./provider-setup-app.mjs";
import { SourcesConfigApp } from "./sources-app.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * First-run welcome: checks the Starfinder system, compendium content and the
 * AI connection, and links to the window that fixes each. Opens by itself at
 * login until the connection works or the GM ticks "Don't show this again"
 * (see shouldAutoOpenWelcome); always reachable from module settings and
 * `/sf2e welcome`.
 */
export class WelcomeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #openGenerator;

  constructor(options = {}, openGenerator = null) {
    super(options);
    this.#openGenerator = typeof openGenerator === "function"
      ? openGenerator
      : () => game.modules.get(MODULE_ID)?.api?.open?.();
  }

  static DEFAULT_OPTIONS = {
    id: "simplysf2e-welcome",
    tag: "div",
    classes: ["simplysf2e"],
    window: {
      title: "SIMPLYSF2E.Welcome.Title",
      icon: "fa-solid fa-rocket",
      resizable: true
    },
    position: { width: 520, height: "auto" },
    actions: {
      openProvider: WelcomeApp.#onOpenProvider,
      openSources: WelcomeApp.#onOpenSources,
      openGenerator: WelcomeApp.#onOpenGenerator,
      recheck: WelcomeApp.#onRecheck,
      closeWelcome: WelcomeApp.#onClose
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/welcome.hbs`, scrollable: [""] }
  };

  async _prepareContext() {
    const state = welcomeState({
      systemId: game.system?.id,
      systemVersion: game.system?.version,
      creatureSources: sourceReadiness("npc"),
      characterSources: sourceReadiness("character"),
      providerWarningKey: getProviderAuthWarningKey(),
      jevSource: jevKeySource()
    });
    return {
      ...state,
      sourcesMissing: describeMissingSources(state.sources.missing),
      providerWarning: state.provider.warningKey ? game.i18n.localize(state.provider.warningKey) : "",
      dismissed: Boolean(getSetting(SETTINGS.welcomeDismissed))
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const checkbox = this.element.querySelector('input[name="dismissed"]');
    checkbox?.addEventListener("change", (event) => {
      game.settings.set(MODULE_ID, SETTINGS.welcomeDismissed, event.currentTarget.checked);
    });
  }

  static #onOpenProvider() {
    new ProviderSetupApp(() => this.render()).render(true);
  }

  static #onOpenSources() {
    new SourcesConfigApp().render(true);
  }

  static #onOpenGenerator() {
    this.#openGenerator();
    this.close();
  }

  static #onRecheck() {
    this.render();
  }

  static #onClose() {
    this.close();
  }
}
