import {
  MODULE_ID, SETTINGS, authorizeApiKeyForCurrentBaseUrl, describeProvider,
  getProviderRequestConfig, normalizeApiBaseUrl, setActiveProviderPrices, upsertActiveProviderConnection,
  withProviderConnectionGuard
} from "./settings.mjs";

export function findProviderPreset(id, presets) {
  return presets.find((preset) => preset.id === id) ?? null;
}

export function filterProviderModels(models, { anthropicOnly = false } = {}) {
  return models.filter((model) => !anthropicOnly || model.startsWith("anthropic/"));
}

export function defaultModelPresent(models, defaultModel) {
  return Boolean(defaultModel) && models.includes(defaultModel);
}

export function resolveModelChoice(models, { defaultModel = "", anthropicOnly = false } = {}) {
  const availableModels = filterProviderModels(models, { anthropicOnly });
  const useDefault = !anthropicOnly && defaultModelPresent(availableModels, defaultModel);
  return {
    availableModels,
    model: useDefault ? defaultModel : "",
    needsModelChoice: !useDefault
  };
}

const CONNECTION_SNAPSHOT_KEYS = Object.freeze([
  SETTINGS.apiBaseUrl, SETTINGS.model, SETTINGS.apiKey, SETTINGS.apiKeyBaseUrl, SETTINGS.providerBank
]);

/** Clone every setting a temporary Welcome connection probe can touch. */
export function snapshotProviderConnection(read = (key) => game.settings.get(MODULE_ID, key)) {
  return Object.fromEntries(CONNECTION_SNAPSHOT_KEYS.map((key) => [key, structuredClone(read(key))]));
}

/** Restore the exact pre-probe route, key binding and named-connection bank. */
export async function restoreProviderConnection(
  snapshot,
  write = (key, value) => game.settings.set(MODULE_ID, key, value),
  read = (key) => game.settings.get(MODULE_ID, key)
) {
  await withProviderConnectionGuard(async () => {
    for (const key of CONNECTION_SNAPSHOT_KEYS) await write(key, structuredClone(snapshot[key]));
  });
  const restoredBinding = await read(SETTINGS.apiKeyBaseUrl);
  if (restoredBinding !== snapshot[SETTINGS.apiKeyBaseUrl]) {
    throw new Error("Previous API key endpoint binding was not restored");
  }
  return restoredBinding;
}

const DIRTY_FIELDS = Object.freeze(["connectionName", "apiBaseUrl", "model", "apiKey"]);

/**
 * Form fields that differ from a saved connection, in DIRTY_FIELDS order.
 * Values are trimmed and an undefined value counts as "". The API key field
 * never shows the stored secret, so a blank key means "keep it" and is not a
 * change; a typed key is compared only as changed or not. Other form keys are ignored.
 */
export function connectionFormDirty(saved = {}, form = {}) {
  const text = (value) => String(value ?? "").trim();
  return DIRTY_FIELDS.filter((field) => {
    const next = text(form?.[field]);
    if (field === "apiKey") return next !== "" && next !== text(saved?.apiKey);
    return next !== text(saved?.[field]);
  });
}

/** Save and authorize one exact provider route for Provider Setup and Welcome. */
export async function saveProviderConnection({
  baseUrl, model = "", enteredApiKey = "", clearApiKey = false, connectionName = "",
  notify = true, requireModel = true
} = {}) {
  baseUrl = normalizeApiBaseUrl(baseUrl);
  model = String(model ?? "").trim();
  enteredApiKey = String(enteredApiKey ?? "").trim();
  connectionName = String(connectionName ?? "").trim();

  let parsed;
  try { parsed = new URL(baseUrl); }
  catch { throw new Error(game.i18n.localize("SIMPLYSF2E.ProviderSetup.InvalidBaseUrl")); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(game.i18n.localize("SIMPLYSF2E.ProviderSetup.InvalidBaseUrl"));
  }
  if (requireModel && !model) throw new Error(game.i18n.localize("SIMPLYSF2E.Errors.NoModel"));

  const currentBaseUrl = normalizeApiBaseUrl(game.settings.get(MODULE_ID, SETTINGS.apiBaseUrl));
  const baseChanged = currentBaseUrl !== baseUrl;
  await game.settings.set(MODULE_ID, SETTINGS.apiBaseUrl, baseUrl);
  await game.settings.set(MODULE_ID, SETTINGS.model, model);

  // A stored key belongs to its old endpoint. Switching providers without
  // entering a replacement clears it instead of silently offering that
  // secret for authorization against a different service.
  if (clearApiKey || baseChanged || enteredApiKey) {
    await game.settings.set(MODULE_ID, SETTINGS.apiKey, clearApiKey ? "" : enteredApiKey);
  }

  const configuredKey = String(game.settings.get(MODULE_ID, SETTINGS.apiKey) ?? "").trim();
  const authorized = configuredKey
    ? await authorizeApiKeyForCurrentBaseUrl(baseUrl)
    : false;
  await upsertActiveProviderConnection({ name: connectionName });
  // Manual prices belong to the provider they were entered for.
  if (baseChanged) await setActiveProviderPrices({});
  const provider = describeProvider(baseUrl, model);
  const state = getProviderRequestConfig();
  const insecure = Boolean(state.apiKeyInsecure);
  const messageKey = insecure
    ? "SIMPLYSF2E.Errors.InsecureKeyEndpoint"
    : authorized
      ? "SIMPLYSF2E.ProviderSetup.SavedAuthorized"
      : state.keylessLocal
        ? "SIMPLYSF2E.ProviderSetup.Saved"
        : "SIMPLYSF2E.ProviderSetup.SavedNeedsKey";
  if (notify) {
    const notifySaved = insecure || (!authorized && !state.keylessLocal)
      ? ui.notifications.warn.bind(ui.notifications)
      : ui.notifications.info.bind(ui.notifications);
    notifySaved(game.i18n.format(
      messageKey,
      { provider: provider.name, model }
    ));
  }
  return { provider, model, state };
}
