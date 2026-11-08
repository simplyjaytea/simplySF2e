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
  outputPerM: "SIMPLYSF2E.ProviderSetup.PriceOutput",
  jevSource: "SIMPLYSF2E.ProviderSetup.JevSourceLabel",
  jevEndpoint: "SIMPLYSF2E.ProviderSetup.JevEndpointLabel",
  jevApiKey: "SIMPLYSF2E.ProviderSetup.JevKeyLabel",
  clearJevApiKey: "SIMPLYSF2E.ProviderSetup.ClearJevKey"
});

/** Another open window runs a generation (its progress or run budget is live); the connection must not change under it. */
function anotherRunInProgress(self) {
  for (const app of foundry.applications.instances?.values?.() ?? []) {
    if (app !== self && (app?._progress || app?._generationAbort)) return true;
  }
  return false;
}

/** Prices as the summary line shows them, as used after a save. */
function pricesSummaryText(prices) {
  if (prices.inputPerM == null && prices.outputPerM == null) return game.i18n.localize("SIMPLYSF2E.ProviderSetup.CostNotSet");
  const shown = (value) => (value == null ? "—" : `$${value}`);
  return game.i18n.format("SIMPLYSF2E.ProviderSetup.CostSummary", { input: shown(prices.inputPerM), output: shown(prices.outputPerM) });
}

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
  #keysElement = null;
  #availableModels = [];
  #modelsBaseUrl = "";
  #busy = false;
  #pricesOpen = false;
  #priceError = null;
  /** Which manual price the last validation rejected: "input", "output" or null. */
  #priceErrorField = null;
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
      priceErrorField: this.#priceErrorField,
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

  /** The Jev key placeholder is the same whether or not a key is saved; the saved state shows as a hint (JevKeySaved). */
  static #jevPlaceholder(_hasKey, source) {
    return game.i18n.format("SIMPLYSF2E.ProviderSetup.JevKeyPlaceholder", { source: JEV_SOURCES[source].label });
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
    // The frame survives re-renders but not close and reopen, so bind once per frame (as app-base does).
    if (this.#keysElement !== this.element && this.element?.addEventListener) {
      this.#keysElement = this.element;
      this.element.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.isComposing || event.defaultPrevented) return;
        const field = event.target;
        if (field?.tagName !== "INPUT" || ["checkbox", "button", "submit"].includes(field.type)) return;
        event.preventDefault();
        this.element.querySelector("[data-action='saveAndTest']")?.click();
      });
    }
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

  /** Unsaved Jev edits in the form (they persist only on their own Save), as form field names. */
  #jevDirtyFields() {
    const stored = getJevRequestConfig();
    const control = (name) => this.element?.querySelector(`[name='${name}']`);
    const dirty = [];
    const source = control("jevSource");
    if (source && normalizeJevSource(source.value) !== normalizeJevSource(stored.source)) dirty.push("jevSource");
    const endpoint = control("jevEndpoint");
    if (endpoint && String(endpoint.value ?? "").trim() !== String(stored.endpoint ?? "").trim()) dirty.push("jevEndpoint");
    if (String(control("jevApiKey")?.value ?? "").trim()) dirty.push("jevApiKey");
    if (control("clearJevApiKey")?.checked) dirty.push("clearJevApiKey");
    return dirty;
  }

  /**
   * Ask before a render would drop unsaved chat or Jev edits. True when there
   * are none, or the GM chooses to go on. Same dialog for every action that renders.
   */
  async #confirmDropEdits({ continuing = false } = {}) {
    const dirty = [...this.#dirtyFields(), ...this.#jevDirtyFields()];
    if (!dirty.length) return true;
    const { DialogV2 } = foundry.applications.api;
    const name = esc(getProviderRequestConfig().connectionName);
    const labels = dirty.map((field) => game.i18n.localize(UNSAVED_FIELD_LABELS[field]));
    // Create and Delete are not a switch: their dialog says Continue, not Switch.
    const body = continuing ? "SIMPLYSF2E.ProviderSetup.UnsavedBodyContinue" : "SIMPLYSF2E.ProviderSetup.UnsavedBody";
    const yes = continuing ? "SIMPLYSF2E.ProviderSetup.UnsavedContinue" : "SIMPLYSF2E.ProviderSetup.UnsavedSwitch";
    return DialogV2.confirm({
      window: { title: "SIMPLYSF2E.ProviderSetup.UnsavedTitle" },
      content: `<p>${game.i18n.format(body, {
        fields: esc(labels.join(", ")), name
      })}</p>`,
      yes: { label: yes },
      no: { label: "SIMPLYSF2E.ProviderSetup.UnsavedStay" },
      rejectClose: false
    });
  }

  static async #switchConnection(id) {
    const current = getProviderRequestConfig().connectionId;
    if (!id || id === current) return;
    // Stay, or a refused switch: put the select back on the connection still loaded.
    const keepCurrent = () => {
      const select = this.element?.querySelector("[name='activeConnection']");
      if (select) select.value = current;
    };
    // A run in this window or in another one reads the connection per request: refuse, do not switch under it.
    if (this.#busy || anotherRunInProgress(this)) {
      ui.notifications.warn("SIMPLYSF2E.ProviderSetup.BusySwitch", { localize: true });
      keepCurrent();
      return;
    }
    if (!(await this.#confirmDropEdits())) {
      keepCurrent();
      return;
    }
    // The dialog was open: a save, test or run may have started meanwhile.
    if (this.#busy || anotherRunInProgress(this)) {
      keepCurrent();
      return;
    }
    await selectProviderConnection(id);
    this.#selectedPreset = null;
    this.#availableModels = [];
    this.#modelsBaseUrl = "";
    await this.render();
  }

  static async #onCreateConnection() {
    if (this.#busy) return;
    if (!(await this.#confirmDropEdits({ continuing: true })) || this.#busy) return;
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
    if (!(await this.#confirmDropEdits({ continuing: true })) || this.#busy) return;
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
    this.#priceErrorField = null;
    const prices = { inputPerM: priceInputs.inputPerM?.value, outputPerM: priceInputs.outputPerM?.value };
    for (const field of ["inputPerM", "outputPerM"]) {
      // A number field blanks non-numeric text; validity.badInput still sees it.
      if (!parsePrice(prices[field]).error && !priceInputs[field]?.validity?.badInput) continue;
      const message = game.i18n.localize(`SIMPLYSF2E.ProviderSetup.Price${field === "inputPerM" ? "Input" : "Output"}Invalid`);
      this.#priceError = message;
      this.#priceErrorField = field === "inputPerM" ? "input" : "output";
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
      ui.notifications.error("SIMPLYSF2E.ProviderSetup.JevSaveFailed", {
        localize: true, format: { message: err?.message ?? String(err) }, escape: true
      });
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
      ui.notifications[notice.level](notice.key, { localize: true, format: notice.data, escape: true });
    } catch (err) {
      console.error("simplysf2e | Jev test failed", err);
      ui.notifications.error("SIMPLYSF2E.ProviderSetup.JevSaveFailed", {
        localize: true, format: { message: err?.message ?? String(err) }, escape: true
      });
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
      ui.notifications.error("SIMPLYSF2E.ProviderSetup.SaveFailed", {
        localize: true, format: { message: err?.message ?? String(err) }, escape: true
      });
    } finally {
      this.#endBusy(state);
    }
  }

  /** What a settings save can change in the open form, updated in place (no render). */
  #refreshAfterSave(state) {
    const list = this.element?.querySelector("#spf-provider-model-list");
    if (list) list.innerHTML = this.#availableModels.map((model) => `<option value="${esc(model)}"></option>`).join("");
    const option = this.element?.querySelector(`[name='activeConnection'] option[value='${state.connectionId}']`);
    if (option) option.textContent = state.connectionName;
    const summary = this.element?.querySelector("details[data-section='prices'] .spf-fold-state");
    if (summary && this.#priceError == null) summary.textContent = pricesSummaryText(getActiveProviderPrices());
    // The key field and the clear-key box follow hasApiKey, as provider-setup.hbs renders them.
    const keyInput = this.element?.querySelector("[name='apiKey']");
    if (keyInput) {
      keyInput.placeholder = state.hasConfiguredApiKey ? "" : game.i18n.localize("SIMPLYSF2E.ProviderSetup.ApiKeyOptional");
      keyInput.value = "";
    }
    const clearBox = this.element?.querySelector(".spf-provider-clear-key");
    const privacy = this.element?.querySelector(".spf-provider-privacy");
    if (state.hasConfiguredApiKey && !clearBox) {
      privacy?.insertAdjacentHTML("beforebegin", `<label class="spf-provider-clear-key"><input type="checkbox" name="clearApiKey"> ${esc(game.i18n.localize("SIMPLYSF2E.ProviderSetup.ClearApiKey"))}</label>`);
    } else if (!state.hasConfiguredApiKey && clearBox) {
      clearBox.remove();
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
      // In place, not a render: a render would drop unsaved Jev and chat edits.
      this.#refreshAfterSave(state);
      ui.notifications.info("SIMPLYSF2E.ProviderSetup.ModelsLoaded", {
        localize: true, format: { count: this.#availableModels.length }, escape: true
      });
    } catch (err) {
      console.error("simplysf2e | provider model discovery failed", err);
      ui.notifications.error("SIMPLYSF2E.ProviderSetup.ModelsFailed", {
        localize: true, format: { message: err?.message ?? String(err) }, escape: true
      });
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
      ui.notifications.info("SIMPLYSF2E.ProviderSetup.TestSuccess", {
        localize: true,
        format: { provider: provider.name, model, total: usage.total.toLocaleString() },
        escape: true
      });
      await this.close();
    } catch (err) {
      console.error("simplysf2e | provider save-and-test failed", err);
      ui.notifications.error("SIMPLYSF2E.ProviderSetup.TestFailed", {
        localize: true, format: { message: err?.message ?? String(err) }, escape: true
      });
    } finally {
      this.#endBusy(busy);
    }
  }

  static async #onCancel() {
    if (this.#busy) return;
    await this.close();
  }
}
