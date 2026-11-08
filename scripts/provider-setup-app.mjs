import {
  MODULE_ID, SETTINGS, createProviderConnection, deleteProviderConnection,
  ensureProviderBank, getActiveProviderPrices, getJevRequestConfig, getProviderAuthWarningKey, getProviderRequestConfig,
  normalizeApiBaseUrl, selectProviderConnection, setActiveProviderPrices
} from "./settings.mjs";
import {
  connectionFormDirty, connectionFormValues, saveProviderConnection, savedConnectionForDirty, snapshotProviderConnection
} from "./provider-connect.mjs";
import { listProviderModels, testProviderConnection } from "./ai.mjs";
import {
  JEV_SOURCES, TYPESAFE_JEV_ENDPOINT, normalizeJevSource, normalizeTypeSafeEndpoint, testJevConnection
} from "./jev.mjs";
import { esc } from "./text.mjs";
import { parsePrice } from "./cost.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export const PROVIDER_PRESETS = Object.freeze([
  { id: "deepseek", label: "DeepSeek", icon: "fa-cloud", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash" },
  { id: "openai", label: "OpenAI", icon: "fa-cloud", baseUrl: "https://api.openai.com/v1", model: "gpt-6-luna" },
  { id: "openrouter", label: "OpenRouter", icon: "fa-cloud", baseUrl: "https://openrouter.ai/api/v1", model: "deepseek/deepseek-v4.1-flash" },
  { id: "ollama", label: "Ollama", icon: "fa-server", baseUrl: "http://localhost:11434/v1", model: "" },
  { id: "lmstudio", label: "LM Studio", icon: "fa-server", baseUrl: "http://localhost:1234/v1", model: "" },
  { id: "custom", label: "Custom", icon: "fa-sliders", baseUrl: "", model: "", preserve: true }
]);

/** Localized labels for the fields the Unsaved changes dialog can name. */
const UNSAVED_FIELD_LABELS = Object.freeze({
  connectionName: "SIMPLYSF2E.ProviderSetup.ConnectionName",
  apiBaseUrl: "SIMPLYSF2E.Settings.ApiBaseUrl.Name",
  model: "SIMPLYSF2E.Settings.Model.Name",
  apiKey: "SIMPLYSF2E.Settings.ApiKey.Name",
  clearApiKey: "SIMPLYSF2E.ProviderSetup.ClearApiKey",
  inputPerM: "SIMPLYSF2E.ProviderSetup.PriceInput",
  outputPerM: "SIMPLYSF2E.ProviderSetup.PriceOutput"
});

/** Presets that talk to a server the GM runs, so the CORS / OLLAMA_ORIGINS hint applies. */
const LOCAL_PRESET_IDS = new Set(["ollama", "lmstudio", "custom"]);

/**
 * Toast for a Test Jev result: `{ level, key, data }`. Pure so it is node-testable.
 * A browser reports a CORS refusal as a plain network error, so on the official
 * TypeSafe endpoint a network failure names the known CORS block; on a GM's own
 * proxy it names that address instead.
 */
export function jevTestNotice(result) {
  const source = JEV_SOURCES[normalizeJevSource(result?.source)]?.label ?? "OpenRouter";
  const seconds = (Math.max(0, Number(result?.ms) || 0) / 1000).toFixed(1);
  if (result?.ok) return { level: "info", key: "SIMPLYSF2E.ProviderSetup.JevTestSuccess", data: { source, seconds } };
  const fail = (suffix, data = {}) => ({ level: "error", key: `SIMPLYSF2E.ProviderSetup.JevTest${suffix}`, data: { source, ...data } });
  switch (result?.reason) {
    case "unconfigured": return fail("Off");
    case "http": return [401, 403].includes(result.status) ? fail("BadKey", { status: result.status }) : fail("Http", { status: result.status || "?" });
    case "network":
      if (result.source !== "typesafe") return fail("Network");
      return result.endpoint && result.endpoint !== TYPESAFE_JEV_ENDPOINT
        ? fail("ProxyNetwork", { endpoint: result.endpoint })
        : fail("TypeSafeCors");
    case "timeout": return fail("Timeout");
    case "shape": return fail("Shape");
    default: return fail("Network");
  }
}

/** Focused provider setup, reachable both from module settings and the generator. */
export class ProviderSetupApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #onSaved;
  #selectedPreset = null;
  #enterBound = false;
  #availableModels = [];
  #modelsBaseUrl = "";
  #busy = false;
  #pricesOpen = false;
  #priceError = null;
  #jevOpen = false;

  constructor(options = {}, onSaved = null) {
    if (typeof options === "function") {
      onSaved = options;
      options = {};
    }
    super(options);
    this.#onSaved = typeof onSaved === "function" ? onSaved : null;
  }

  static DEFAULT_OPTIONS = {
    id: "simplysf2e-provider-setup",
    tag: "form",
    classes: ["simplysf2e"],
    window: {
      title: "SIMPLYSF2E.ProviderSetup.Title",
      icon: "fa-solid fa-plug-circle-check",
      resizable: true
    },
    position: { width: 520, height: "auto" },
    form: {
      handler: ProviderSetupApp.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: false
    },
    actions: {
      chooseProvider: ProviderSetupApp.#onChooseProvider,
      loadModels: ProviderSetupApp.#onLoadModels,
      saveAndTest: ProviderSetupApp.#onSaveAndTest,
      saveJevKey: ProviderSetupApp.#onSaveJevKey,
      testJev: ProviderSetupApp.#onTestJev,
      createConnection: ProviderSetupApp.#onCreateConnection,
      deleteConnection: ProviderSetupApp.#onDeleteConnection,
      cancel: ProviderSetupApp.#onCancel
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/provider-setup.hbs`, scrollable: [""] }
  };

  async _prepareContext() {
    await ensureProviderBank();
    const state = getProviderRequestConfig();
    if (this.#modelsBaseUrl && state.baseUrl !== this.#modelsBaseUrl) {
      this.#availableModels = [];
      this.#modelsBaseUrl = "";
    }
    const inferred = PROVIDER_PRESETS.some((provider) => provider.id === state.provider.id)
      ? state.provider.id
      : "custom";
    const selected = this.#selectedPreset ?? inferred;
    const prices = getActiveProviderPrices();
    const jev = ProviderSetupApp.#jevContext();
    const pricesSummary = (prices.inputPerM == null && prices.outputPerM == null)
      ? null
      : { input: prices.inputPerM == null ? "—" : `$${prices.inputPerM}`, output: prices.outputPerM == null ? "—" : `$${prices.outputPerM}` };
    return {
      providers: PROVIDER_PRESETS.map((provider) => ({
        ...provider,
        selected: provider.id === selected
      })),
      connections: state.connections,
      connectionName: state.connectionName,
      canDeleteConnection: state.connections.length > 1,
      apiBaseUrl: state.baseUrl,
      model: state.model,
      availableModels: this.#availableModels,
      inputPerM: prices.inputPerM ?? "",
      outputPerM: prices.outputPerM ?? "",
      hasApiKey: state.hasConfiguredApiKey,
      ...jev,
      pricesOpen: this.#priceError != null || this.#pricesOpen,
      priceError: this.#priceError,
      pricesSummary,
      jevOpen: jev.jevOnTypeSafe || jev.hasJevKey || this.#jevOpen,
      showLocalHint: LOCAL_PRESET_IDS.has(selected),
      localServerHint: game.i18n.format("SIMPLYSF2E.ProviderSetup.LocalServerHint", {
        origin: globalThis.location?.origin ?? "Foundry"
      })
    };
  }

  static #jevContext() {
    const jev = getJevRequestConfig();
    const source = normalizeJevSource(jev.source);
    return {
      hasJevKey: Boolean(jev.apiKey),
      jevSources: Object.values(JEV_SOURCES).map(({ id, label }) => ({ id, label, selected: id === source })),
      jevOnTypeSafe: source === "typesafe",
      jevEndpoint: String(jev.endpoint ?? "").trim(),
      jevDefaultEndpoint: TYPESAFE_JEV_ENDPOINT,
      jevKeyPlaceholder: ProviderSetupApp.#jevPlaceholder(Boolean(jev.apiKey), source)
    };
  }

  static #jevPlaceholder(hasKey, source) {
    return hasKey
      ? game.i18n.localize("SIMPLYSF2E.ProviderSetup.JevKeySaved")
      : game.i18n.format("SIMPLYSF2E.ProviderSetup.JevKeyPlaceholder", { source: JEV_SOURCES[source].label });
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // A saved key belongs to its route (source, and for TypeSafe the endpoint);
    // once the form shows another route, the key field asks for a new key.
    const syncJevRoute = () => {
      const source = normalizeJevSource(this.element.querySelector("[name='jevSource']")?.value);
      for (const typeSafeOnly of this.element.querySelectorAll(".spf-jev-warning, .spf-jev-endpoint")) {
        typeSafeOnly.hidden = source !== "typesafe";
      }
      const stored = getJevRequestConfig();
      const typed = this.element.querySelector("[name='jevEndpoint']")?.value;
      const sameRoute = source === normalizeJevSource(stored.source)
        && (source !== "typesafe" || normalizeTypeSafeEndpoint(typed) === normalizeTypeSafeEndpoint(stored.endpoint));
      const hasKey = Boolean(stored.apiKey) && sameRoute;
      const input = this.element.querySelector("[name='jevApiKey']");
      if (input) input.placeholder = ProviderSetupApp.#jevPlaceholder(hasKey, source);
      const clearLabel = this.element.querySelector(".spf-jev-clear");
      if (clearLabel) clearLabel.hidden = !hasKey;
    };
    this.element.querySelector("[name='jevSource']")?.addEventListener("change", syncJevRoute);
    this.element.querySelector("[name='jevEndpoint']")?.addEventListener("input", syncJevRoute);
    // open jev section on typesafe
    const jevDetails = this.element.querySelector("details[data-section='jev']");
    if (jevDetails && (normalizeJevSource(this.element.querySelector("[name='jevSource']")?.value) === "typesafe")) jevDetails.open = true;
    for (const details of this.element.querySelectorAll("details[data-section]")) {
      details.addEventListener("toggle", () => {
        if (details.dataset.section === "prices") this.#pricesOpen = details.open;
        if (details.dataset.section === "jev") this.#jevOpen = details.open;
      });
    }
    this.element.querySelector("[name='apiBaseUrl']")?.addEventListener("input", (event) => {
      if (normalizeApiBaseUrl(event.currentTarget.value) !== this.#modelsBaseUrl) {
        this.#clearModelSuggestions();
      }
    });
    // Enter in a field runs the visual primary (Save & Test), not the plain submit button.
    // The form element survives re-renders, so bind it only once.
    if (!this.#enterBound) this.element.addEventListener?.("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing || event.defaultPrevented) return;
      const field = event.target;
      if (field?.tagName !== "INPUT" || ["checkbox", "button", "submit"].includes(field.type)) return;
      event.preventDefault();
      this.element.querySelector("[data-action='saveAndTest']")?.click();
    });
    this.#enterBound = true;
    this.element.querySelector("[name='activeConnection']")?.addEventListener("change", (event) =>
      ProviderSetupApp.#switchConnection.call(this, event.currentTarget.value)
    );
  }

  #clearModelSuggestions() {
    this.#availableModels = [];
    this.#modelsBaseUrl = "";
    this.element.querySelector("#spf-provider-model-list")?.replaceChildren?.();
  }

  /**
   * Freeze the displayed provider configuration for an async setup action.
   * Otherwise a second action or a mid-request edit can make the dialog show
   * a different configuration from the one that was saved and tested.
   */
  #beginBusy(target) {
    if (this.#busy) return null;
    this.#busy = true;
    const element = this.element;
    const controls = [...element.querySelectorAll("button, input, select, textarea")];
    const disabled = controls.map((control) => control.disabled);
    const icon = target?.querySelector?.("i");
    const originalIconClass = icon?.className;
    for (const control of controls) control.disabled = true;
    if (icon) icon.className = "fa-solid fa-spinner fa-spin";
    element.setAttribute?.("aria-busy", "true");
    // Foundry clears this.element when a successful Save & Test closes the
    // application. Keep the element that was made busy so cleanup remains
    // safe even after the dialog has been destroyed.
    return { element, controls, disabled, icon, originalIconClass };
  }

  #endBusy(state) {
    state.controls.forEach((control, index) => {
      control.disabled = state.disabled[index];
    });
    if (state.icon && state.originalIconClass) {
      state.icon.className = state.originalIconClass;
    }
    state.element?.removeAttribute?.("aria-busy");
    this.#busy = false;
  }

  /** Fields the GM edited on the connection being left, as form field names. */
  #dirtyFields() {
    const state = getProviderRequestConfig();
    const snapshot = snapshotProviderConnection();
    const control = (name) => this.element?.querySelector(`[name='${name}']`);
    const form = connectionFormValues((name) => (
      name === "clearApiKey" ? Boolean(control(name)?.checked) : control(name)?.value
    ));
    return connectionFormDirty(
      savedConnectionForDirty(snapshot, { connectionName: state.connectionName, prices: getActiveProviderPrices() }),
      form
    );
  }

  static async #switchConnection(id) {
    if (this.#busy) return;
    const current = getProviderRequestConfig().connectionId;
    if (!id || id === current) return;
    const dirty = this.#dirtyFields();
    if (dirty.length) {
      const { DialogV2 } = foundry.applications.api;
      const name = esc(getProviderRequestConfig().connectionName);
      const labels = dirty.map((field) => game.i18n.localize(UNSAVED_FIELD_LABELS[field]));
      const switchAnyway = await DialogV2.confirm({
        window: { title: "SIMPLYSF2E.ProviderSetup.UnsavedTitle" },
        content: `<p>${game.i18n.format("SIMPLYSF2E.ProviderSetup.UnsavedBody", {
          fields: esc(labels.join(", ")), name
        })}</p>`,
        yes: { label: "SIMPLYSF2E.ProviderSetup.UnsavedSwitch" },
        no: { label: "SIMPLYSF2E.ProviderSetup.UnsavedStay" },
        rejectClose: false
      });
      if (!switchAnyway) {
        // Stay: keep the edits and put the select back on the connection still loaded.
        const select = this.element?.querySelector("[name='activeConnection']");
        if (select) select.value = current;
        return;
      }
      // The dialog was open: a save or test may have started meanwhile.
      if (this.#busy) return;
    }
    await selectProviderConnection(id);
    this.#selectedPreset = null;
    this.#availableModels = [];
    this.#modelsBaseUrl = "";
    await this.render();
  }

  static async #onCreateConnection() {
    if (this.#busy) return;
    const inferred = getProviderRequestConfig().provider.id;
    const selected = this.#selectedPreset
      ?? (PROVIDER_PRESETS.some((provider) => provider.id === inferred) ? inferred : "custom");
    const preset = PROVIDER_PRESETS.find((entry) => entry.id === selected) ?? PROVIDER_PRESETS.at(-1);
    await createProviderConnection({
      name: preset.preserve ? "New connection" : preset.label,
      apiBaseUrl: preset.baseUrl,
      model: preset.model
    });
    this.#selectedPreset = preset.id;
    this.#availableModels = [];
    this.#modelsBaseUrl = "";
    await this.render();
  }

  static async #onDeleteConnection() {
    if (this.#busy) return;
    const state = getProviderRequestConfig();
    if (!state.connectionId || state.connections.length < 2) return;
    const { DialogV2 } = foundry.applications.api;
    const confirmed = await DialogV2.confirm({
      window: { title: "SIMPLYSF2E.ProviderSetup.DeleteTitle" },
      content: `<p>${game.i18n.format("SIMPLYSF2E.ProviderSetup.DeleteConfirm", {
        name: esc(state.connectionName)
      })}</p>`,
      rejectClose: false
    });
    if (!confirmed) return;
    await deleteProviderConnection(state.connectionId);
    this.#selectedPreset = null;
    this.#availableModels = [];
    this.#modelsBaseUrl = "";
    await this.render();
  }

  static async #onChooseProvider(_event, target) {
    if (this.#busy) return;
    const preset = PROVIDER_PRESETS.find((entry) => entry.id === target.dataset.provider);
    if (!preset) return;
    this.#selectedPreset = preset.id;
    const localHint = this.element.querySelector(".spf-provider-local-hint");
    if (localHint) localHint.hidden = !LOCAL_PRESET_IDS.has(preset.id);
    for (const button of this.element.querySelectorAll("[data-action='chooseProvider']")) {
      const active = button === target;
      button.classList.toggle("spf-provider-preset-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    if (!preset.preserve) {
      this.element.querySelector("[name='apiBaseUrl']").value = preset.baseUrl;
      this.element.querySelector("[name='model']").value = preset.model;
      if (normalizeApiBaseUrl(preset.baseUrl) !== this.#modelsBaseUrl) {
        this.#clearModelSuggestions();
      }
    }
  }

  static async #saveSettings({ notify = true, requireModel = true } = {}) {
    // Validate the price fields first: a bad value blocks the whole save with a field error.
    const priceInputs = {
      inputPerM: this.element.querySelector("[name='inputPerM']"),
      outputPerM: this.element.querySelector("[name='outputPerM']")
    };
    for (const input of Object.values(priceInputs)) input?.setCustomValidity?.("");
    this.#priceError = null;
    const prices = { inputPerM: priceInputs.inputPerM?.value, outputPerM: priceInputs.outputPerM?.value };
    for (const field of ["inputPerM", "outputPerM"]) {
      // A number field blanks non-numeric text; validity.badInput still sees it.
      if (!parsePrice(prices[field]).error && !priceInputs[field]?.validity?.badInput) continue;
      const message = game.i18n.localize(`SIMPLYSF2E.ProviderSetup.Price${field === "inputPerM" ? "Input" : "Output"}Invalid`);
      this.#priceError = message;
      priceInputs[field]?.closest?.("details")?.setAttribute?.("open", "");
      const errEl = priceInputs[field]?.closest?.("details")?.querySelector?.("[data-price-error]");
      if (errEl) { errEl.hidden = false; const span = errEl.querySelector("span"); if (span) span.textContent = message; }
      priceInputs[field]?.setCustomValidity?.(message);
      priceInputs[field]?.reportValidity?.();
      throw new Error(message);
    }
    const result = await saveProviderConnection({
      baseUrl: this.element.querySelector("[name='apiBaseUrl']")?.value,
      model: this.element.querySelector("[name='model']")?.value,
      enteredApiKey: this.element.querySelector("[name='apiKey']")?.value,
      clearApiKey: Boolean(this.element.querySelector("[name='clearApiKey']")?.checked),
      connectionName: this.element.querySelector("[name='connectionName']")?.value,
      notify,
      requireModel
    });
    // After the connection save, so the prices land on the connection just saved.
    if (priceInputs.inputPerM && priceInputs.outputPerM) await setActiveProviderPrices(prices);
    await this.#onSaved?.();
    return result;
  }

  /**
   * Save or clear the separate Jev key, its source and the TypeSafe endpoint.
   * Independent of #saveSettings so a GM with no chat model can still save it.
   * Empty input keeps the stored key, unless the route changed (another source,
   * or another TypeSafe endpoint): a key belongs to the address it was saved for,
   * so a route change without a new key clears the old one (as a chat key is
   * cleared when its base URL changes). An unusable endpoint throws before any
   * write. Returns "saved", "cleared", "source" (route only) or null.
   */
  static async #saveJevKey() {
    const entered = String(this.element.querySelector("[name='jevApiKey']")?.value ?? "").trim();
    const clear = Boolean(this.element.querySelector("[name='clearJevApiKey']")?.checked);
    const stored = getJevRequestConfig();
    const storedSource = normalizeJevSource(stored.source);
    const picker = this.element.querySelector("[name='jevSource']");
    const source = picker ? normalizeJevSource(picker.value) : storedSource;
    const storedEndpoint = normalizeTypeSafeEndpoint(stored.endpoint);
    const endpointField = this.element.querySelector("[name='jevEndpoint']");
    const endpoint = endpointField ? normalizeTypeSafeEndpoint(endpointField.value) : storedEndpoint;
    // The field is hidden unless TypeSafe is the source, so a bad value there never
    // blocks an OpenRouter save; it is simply not written.
    if (!endpoint && source === "typesafe") {
      throw new Error(game.i18n.localize("SIMPLYSF2E.ProviderSetup.JevEndpointInvalid"));
    }
    // Store "" for the official endpoint so a later default change follows it.
    const endpointSetting = endpoint === TYPESAFE_JEV_ENDPOINT ? "" : endpoint;
    const endpointChanged = Boolean(endpoint) && endpointSetting !== String(stored.endpoint ?? "").trim();
    const sourceChanged = source !== storedSource;
    const routeChanged = sourceChanged || (source === "typesafe" && endpoint !== storedEndpoint);
    // Clear the old key before the route moves, so no read in between (or a
    // failed later write) can pair the old key with another address.
    if (routeChanged && stored.apiKey) await game.settings.set(MODULE_ID, SETTINGS.jevApiKey, "");
    if (endpointChanged) await game.settings.set(MODULE_ID, SETTINGS.jevTypeSafeEndpoint, endpointSetting);
    if (sourceChanged) await game.settings.set(MODULE_ID, SETTINGS.jevSource, source);
    const sourceOrEndpointSaved = sourceChanged || endpointChanged;
    if (clear) {
      if (!routeChanged || !stored.apiKey) await game.settings.set(MODULE_ID, SETTINGS.jevApiKey, "");
      return "cleared";
    }
    if (entered) {
      await game.settings.set(MODULE_ID, SETTINGS.jevApiKey, entered);
      return "saved";
    }
    if (routeChanged && stored.apiKey) return "cleared";
    return sourceOrEndpointSaved ? "source" : null;
  }

  /** Toast for a #saveJevKey result; null shows nothing. */
  static #notifyJevSaved(result) {
    const key = {
      saved: "SIMPLYSF2E.ProviderSetup.JevSaved",
      cleared: "SIMPLYSF2E.ProviderSetup.JevCleared",
      source: "SIMPLYSF2E.ProviderSetup.JevSourceSaved"
    }[result];
    if (key) ui.notifications.info(game.i18n.localize(key));
  }

  #syncJevControls(hasKey) {
    const input = this.element.querySelector("[name='jevApiKey']");
    if (input) {
      input.value = "";
      input.placeholder = ProviderSetupApp.#jevPlaceholder(hasKey, normalizeJevSource(getJevRequestConfig().source));
    }
    const clear = this.element.querySelector("[name='clearJevApiKey']");
    if (clear) clear.checked = false;
    const label = this.element.querySelector(".spf-jev-clear");
    if (label) label.hidden = !hasKey;
  }

  static async #onSaveJevKey(_event, target) {
    const busy = this.#beginBusy(target);
    if (!busy) return;
    try {
      const result = await ProviderSetupApp.#saveJevKey.call(this);
      if (result) {
        ProviderSetupApp.#notifyJevSaved(result);
        // Update in place: a re-render would discard unsaved chat fields.
        this.#syncJevControls(Boolean(getJevRequestConfig().apiKey));
        await this.#onSaved?.();
      }
    } catch (err) {
      console.error("simplysf2e | Jev key save failed", err);
      ui.notifications.error(game.i18n.format("SIMPLYSF2E.ProviderSetup.JevSaveFailed", {
        message: err?.message ?? String(err)
      }));
    } finally {
      this.#endBusy(busy);
    }
  }

  /**
   * Save the Jev key/source, then send one tiny question over the exact route
   * generation would use (separate key, else the saved OpenRouter connection).
   * Leaves the window open and unsaved chat fields untouched.
   */
  static async #onTestJev(_event, target) {
    const busy = this.#beginBusy(target);
    if (!busy) return;
    try {
      const saved = await ProviderSetupApp.#saveJevKey.call(this);
      if (saved) {
        ProviderSetupApp.#notifyJevSaved(saved);
        this.#syncJevControls(Boolean(getJevRequestConfig().apiKey));
        await this.#onSaved?.();
      }
      const notice = jevTestNotice(await testJevConnection());
      ui.notifications[notice.level](game.i18n.format(notice.key, notice.data));
    } catch (err) {
      console.error("simplysf2e | Jev test failed", err);
      ui.notifications.error(game.i18n.format("SIMPLYSF2E.ProviderSetup.JevSaveFailed", {
        message: err?.message ?? String(err)
      }));
    } finally {
      this.#endBusy(busy);
    }
  }

  static async #onSubmit(_event, _form, _formData) {
    const state = this.#beginBusy(this.element.querySelector("button[type='submit']"));
    if (!state) return;
    try {
      // First, so a Jev key typed before Save is kept even if the chat save throws.
      ProviderSetupApp.#notifyJevSaved(await ProviderSetupApp.#saveJevKey.call(this));
      await ProviderSetupApp.#saveSettings.call(this);
      await this.close();
    } catch (err) {
      // closeOnSubmit is off so a failed save keeps the form open with its edits.
      console.error("simplysf2e | provider save failed", err);
      ui.notifications.error(game.i18n.format("SIMPLYSF2E.ProviderSetup.SaveFailed", {
        message: err?.message ?? String(err)
      }));
    } finally {
      this.#endBusy(state);
    }
  }

  /** Save/bind the displayed endpoint first, then populate model suggestions. */
  static async #onLoadModels(_event, target) {
    const busy = this.#beginBusy(target);
    if (!busy) return;
    try {
      const { state } = await ProviderSetupApp.#saveSettings.call(this, {
        notify: false,
        requireModel: false
      });
      const warningKey = getProviderAuthWarningKey(
        state, globalThis.location?.protocol, false
      );
      if (warningKey) throw new Error(game.i18n.localize(warningKey));
      this.#availableModels = await listProviderModels();
      this.#modelsBaseUrl = state.baseUrl;
      await this.render();
      ui.notifications.info(game.i18n.format("SIMPLYSF2E.ProviderSetup.ModelsLoaded", {
        count: this.#availableModels.length
      }));
    } catch (err) {
      console.error("simplysf2e | provider model discovery failed", err);
      ui.notifications.error(game.i18n.format("SIMPLYSF2E.ProviderSetup.ModelsFailed", {
        message: err?.message ?? String(err)
      }));
    } finally {
      this.#endBusy(busy);
    }
  }

  /** Save first, then exercise the exact production request path. */
  static async #onSaveAndTest(_event, target) {
    const busy = this.#beginBusy(target);
    if (!busy) return;
    try {
      const jev = await ProviderSetupApp.#saveJevKey.call(this);
      ProviderSetupApp.#notifyJevSaved(jev);
      if (jev) this.#syncJevControls(Boolean(getJevRequestConfig().apiKey));
      const { provider, model, state } = await ProviderSetupApp.#saveSettings.call(this, { notify: false });
      const warningKey = getProviderAuthWarningKey(state);
      if (warningKey) throw new Error(game.i18n.localize(warningKey));
      const usage = await testProviderConnection();
      ui.notifications.info(game.i18n.format("SIMPLYSF2E.ProviderSetup.TestSuccess", {
        provider: provider.name,
        model,
        total: usage.total.toLocaleString()
      }));
      await this.close();
    } catch (err) {
      console.error("simplysf2e | provider save-and-test failed", err);
      ui.notifications.error(game.i18n.format("SIMPLYSF2E.ProviderSetup.TestFailed", {
        message: err?.message ?? String(err)
      }));
    } finally {
      this.#endBusy(busy);
    }
  }

  static async #onCancel() {
    if (this.#busy) return;
    await this.close();
  }
}
