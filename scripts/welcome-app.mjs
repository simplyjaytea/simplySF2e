import {
  MODULE_ID, SETTINGS, getProviderAuthWarningKey, getProviderRequestConfig,
  getSetting, isLikelyKeylessLocalEndpoint, normalizeApiBaseUrl
} from "./settings.mjs";
import { listProviderModels, testProviderConnection } from "./ai.mjs";
import { sourceReadiness, describeMissingSources } from "./compendium.mjs";
import { jevKeySource } from "./jev.mjs";
import { welcomeReadinessIssue, welcomeState } from "./welcome.mjs";
import {
  findProviderPreset, resolveModelChoice, restoreProviderConnection,
  saveProviderConnection, snapshotProviderConnection
} from "./provider-connect.mjs";
import { PROVIDER_PRESETS, ProviderSetupApp } from "./provider-setup-app.mjs";
import { SourcesConfigApp } from "./sources-app.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const GOOGLE_PRESET = {
  id: "google", label: "Google", icon: "fa-cloud",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: ""
};
const WELCOME_PROVIDER_IDS = ["openrouter", "openai", "deepseek", "google", "ollama"];

/** First-run provider connection and a preview-only sample generation. */
export class WelcomeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #openGenerator;
  #selectedId = "openrouter";
  #anthropicOnly = false;
  #apiKey = "";
  #baseUrl = null;
  #model = null;
  #availableModels = [];
  #modelChoice = false;
  #connectionSnapshot = null;
  #busy = false;
  #connected = false;
  #connectedProvider = "";
  #errorMessage = "";
  #focusTarget = null;
  #advancedOpen = false;

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
      chooseProvider: WelcomeApp.#onChooseProvider,
      connect: WelcomeApp.#onConnect,
      sample: WelcomeApp.#onSample,
      openProvider: WelcomeApp.#onOpenProvider,
      openSources: WelcomeApp.#onOpenSources,
      recheck: WelcomeApp.#onRecheck,
      closeWelcome: WelcomeApp.#onClose
    }
  };

  static ARRIVE_ON_OPEN = true;

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/welcome.hbs`, scrollable: [""] }
  };

  #preset(id = this.#selectedId) {
    if (id === "google") return GOOGLE_PRESET;
    return findProviderPreset(id, PROVIDER_PRESETS) ?? findProviderPreset("openrouter", PROVIDER_PRESETS);
  }

  #draft() {
    const preset = this.#preset();
    return {
      preset,
      baseUrl: this.#baseUrl ?? preset.baseUrl,
      model: this.#model ?? preset.model
    };
  }

  #connectDisabled() {
    if (this.#busy) return true;
    const { baseUrl, model } = this.#draft();
    if (this.#modelChoice) return !String(model ?? "").trim();
    if (isLikelyKeylessLocalEndpoint(baseUrl)) return false;
    if (this.#apiKey.trim()) return false;
    const current = getProviderRequestConfig();
    return !(current.hasConfiguredApiKey && normalizeApiBaseUrl(current.baseUrl) === normalizeApiBaseUrl(baseUrl));
  }

  async _prepareContext() {
    const state = welcomeState({
      systemId: game.system?.id,
      systemVersion: game.system?.version,
      creatureSources: sourceReadiness("npc"),
      characterSources: sourceReadiness("character"),
      providerWarningKey: getProviderAuthWarningKey(),
      jevSource: jevKeySource()
    });
    const issue = welcomeReadinessIssue(state);
    const { preset, baseUrl, model } = this.#draft();
    const keyless = isLikelyKeylessLocalEndpoint(baseUrl);
    return {
      sourcesMissing: issue === "sources",
      readinessWarning: issue === "system"
        ? game.i18n.format("SIMPLYSF2E.Welcome.SystemOld", { version: state.system.version, minimum: state.system.minimum })
        : issue === "sources"
          ? game.i18n.format("SIMPLYSF2E.Welcome.SourcesMissing", { categories: describeMissingSources(state.sources.missing) })
          : "",
      providers: WELCOME_PROVIDER_IDS.map((id) => {
        const provider = this.#preset(id);
        return {
          ...provider,
          selected: id === this.#selectedId,
          recommended: id === "openrouter",
          note: id === "google" ? game.i18n.localize("SIMPLYSF2E.Welcome.LiveCheckPending") : ""
        };
      }),
      selectedProvider: preset.label,
      apiKey: this.#apiKey,
      keyless,
      showBaseUrl: keyless || ["ollama", "lmstudio"].includes(this.#selectedId),
      baseUrl,
      model,
      availableModels: this.#availableModels,
      modelChoice: this.#modelChoice,
      connectDisabled: this.#connectDisabled(),
      connecting: this.#busy,
      connected: this.#connected,
      connectionProvider: this.#connectedProvider || preset.label,
      errorMessage: this.#errorMessage,
      advancedOpen: this.#advancedOpen,
      dismissed: Boolean(getSetting(SETTINGS.welcomeDismissed))
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelector('input[name="dismissed"]')?.addEventListener("change", (event) => {
      game.settings.set(MODULE_ID, SETTINGS.welcomeDismissed, event.currentTarget.checked)
        .catch((err) => console.warn(`${MODULE_ID} | could not save the welcome setting`, err));
    });
    this.element.querySelector("[name='apiKey']")?.addEventListener("input", (event) => {
      this.#apiKey = event.currentTarget.value;
      this.#syncConnectButton();
    });
    this.element.querySelector("[name='baseUrl']")?.addEventListener("input", (event) => {
      this.#baseUrl = event.currentTarget.value;
      this.#syncConnectButton();
    });
    this.element.querySelector("[name='model']")?.addEventListener("change", (event) => {
      this.#model = event.currentTarget.value;
      this.#syncConnectButton();
    });
    for (const field of this.element.querySelectorAll("[name='apiKey'], [name='baseUrl']")) {
      field.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.isComposing || event.defaultPrevented) return;
        event.preventDefault();
        const button = this.element.querySelector("[data-action='connect']");
        if (button && !button.disabled) button.click();
      });
    }
    this.element.querySelector(".spf-welcome-advanced")?.addEventListener("toggle", (event) => {
      this.#advancedOpen = event.currentTarget.open;
    });
    const focusTarget = this.#focusTarget;
    this.#focusTarget = null;
    if (focusTarget) requestAnimationFrame(() => {
      const selector = {
        key: "[name='apiKey']", base: "[name='baseUrl']", model: "[name='model']", sample: "[data-action='sample']"
      }[focusTarget];
      const control = selector ? this.element.querySelector(selector) : null;
      control?.focus();
      if (focusTarget === "key") control?.select();
    });
  }

  #syncConnectButton() {
    const button = this.element.querySelector("[data-action='connect']");
    if (button) button.disabled = this.#connectDisabled();
  }

  #providerSaved() {
    const current = getProviderRequestConfig();
    const match = [...WELCOME_PROVIDER_IDS, "lmstudio"].find((id) =>
      normalizeApiBaseUrl(this.#preset(id).baseUrl) === normalizeApiBaseUrl(current.baseUrl)
    );
    if (match) this.#selectedId = match;
    this.#anthropicOnly = false;
    this.#apiKey = "";
    this.#baseUrl = current.baseUrl;
    this.#model = current.model;
    this.#availableModels = [];
    this.#modelChoice = false;
    this.#connectionSnapshot = null;
    this.#connected = false;
    this.#connectedProvider = "";
    this.#errorMessage = "";
    return this.render();
  }

  static async #onChooseProvider(_event, target) {
    if (this.#busy) return;
    const preset = this.#preset(target.dataset.provider);
    if (!preset || preset.id !== target.dataset.provider) return;
    this.#selectedId = preset.id;
    this.#anthropicOnly = target.dataset.anthropic === "true";
    this.#apiKey = "";
    this.#baseUrl = preset.baseUrl;
    this.#model = preset.model;
    this.#availableModels = [];
    this.#modelChoice = false;
    this.#connectionSnapshot = null;
    this.#connected = false;
    this.#connectedProvider = "";
    this.#errorMessage = "";
    this.#focusTarget = isLikelyKeylessLocalEndpoint(preset.baseUrl) ? "base" : "key";
    await this.render();
  }

  async #restoreConnection() {
    const snapshot = this.#connectionSnapshot;
    this.#connectionSnapshot = null;
    if (!snapshot) return "";
    try {
      await restoreProviderConnection(snapshot);
      return "";
    } catch (err) {
      console.error(`${MODULE_ID} | could not restore the previous provider connection`, err);
      return game.i18n.localize("SIMPLYSF2E.Welcome.RestoreFailed");
    }
  }

  static async #onConnect() {
    if (this.#busy || this.#connectDisabled()) return;
    this.#connectionSnapshot = snapshotProviderConnection();
    const { preset, baseUrl } = this.#draft();
    try {
      this.#busy = true;
      this.#errorMessage = "";
      await this.render();
      if (!this.#modelChoice) {
        await saveProviderConnection({
          baseUrl, model: "", enteredApiKey: this.#apiKey, connectionName: preset.label,
          notify: false, requireModel: false
        });
        const warningKey = getProviderAuthWarningKey(undefined, globalThis.location?.protocol, false);
        if (warningKey) throw new Error(game.i18n.localize(warningKey));
        const models = await listProviderModels();
        const choice = resolveModelChoice(models, {
          defaultModel: preset.model,
          anthropicOnly: this.#anthropicOnly
        });
        if (!choice.availableModels.length) {
          throw new Error(game.i18n.format("SIMPLYSF2E.Welcome.NoModels", { provider: preset.label }));
        }
        this.#availableModels = choice.availableModels;
        this.#model = choice.model;
        if (choice.needsModelChoice) {
          const restoreError = await this.#restoreConnection();
          if (restoreError) throw new Error(restoreError);
          this.#modelChoice = true;
          this.#focusTarget = "model";
          return;
        }
      }
      const { provider } = await saveProviderConnection({
        baseUrl, model: this.#model, enteredApiKey: this.#apiKey, connectionName: preset.label,
        notify: false
      });
      const warningKey = getProviderAuthWarningKey();
      if (warningKey) throw new Error(game.i18n.localize(warningKey));
      await testProviderConnection();
      this.#connectionSnapshot = null;
      this.#connected = true;
      this.#connectedProvider = provider.name;
      this.#apiKey = "";
      this.#errorMessage = "";
      this.#focusTarget = "sample";
    } catch (err) {
      console.warn(`${MODULE_ID} | welcome connection failed`, err);
      const restoreError = await this.#restoreConnection();
      this.#errorMessage = [err?.message ?? String(err), restoreError].filter(Boolean).join(" ");
      this.#focusTarget = this.#modelChoice
        ? "model"
        : isLikelyKeylessLocalEndpoint(baseUrl) ? "base" : "key";
    } finally {
      this.#busy = false;
      await this.render();
    }
  }

  async close(options = {}) {
    if (this.#busy) return this;
    return super.close(options);
  }

  static #onSample() {
    if (!this.#connected) return;
    const generator = this.#openGenerator();
    if (!generator) return;
    this.close();
    return generator.runFromChat({
      mode: "monster",
      prompt: game.i18n.localize("SIMPLYSF2E.Welcome.SamplePrompt"),
      level: 1,
      rarity: "common",
      adjustment: null,
      allowSpellcasting: true,
      preset: "",
      partySize: 4,
      threat: "moderate",
      treasureAmount: "standard",
      rarityCap: "unique",
      multiclass: "none"
    }, { remember: false }).catch(console.error);
  }

  static #onOpenProvider() {
    if (this.#busy) return;
    ProviderSetupApp.open(() => this.#providerSaved());
  }

  static #onOpenSources() {
    SourcesConfigApp.open();
  }

  static #onRecheck() {
    if (!this.#busy) this.render();
  }

  static #onClose() {
    if (!this.#busy) this.close();
  }
}
