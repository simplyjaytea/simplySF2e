import { normalizePrices, parsePrice } from "./cost.mjs";

export const MODULE_ID = "simplysf2e";

export const SETTINGS = {
  apiBaseUrl: "apiBaseUrl",
  apiKey: "apiKey",
  apiKeyBaseUrl: "apiKeyBaseUrl",
  jevApiKey: "jevApiKey",
  jevSource: "jevSource",
  jevTypeSafeEndpoint: "jevTypeSafeEndpoint",
  model: "model",
  providerBank: "providerBank",
  temperature: "temperature",
  maxTokens: "maxTokens",
  requestTimeout: "requestTimeout",
  runTokenBudget: "runTokenBudget",
  runDeadline: "runDeadline",
  sourcePacks: "sourcePacks",
  customPresets: "customPresets",
  freeArchetype: "freeArchetype",
  welcomeDismissed: "welcomeDismissed",
  whatsNewSeen: "whatsNewSeen",
  whatsNewDisabled: "whatsNewDisabled",
  generatorInput: "generatorInput",
  settingsSchema: "settingsSchema"
};

/** Version of the stored world settings layout. Bump with a new SETTINGS_MIGRATIONS step. */
export const SETTINGS_SCHEMA = 1;

/**
 * Ordered upgrades: { version, run }, where `run` upgrades stored settings to
 * `version`. Empty today: schema 1 is the first versioned layout.
 * Each step must be safe to run more than once: a failed run is retried on the next GM load.
 */
export const SETTINGS_MIGRATIONS = [];

/**
 * Steps still to run for a world stored at `stored`, up to `current`, in
 * ascending version order. Pure, so it can be tested without Foundry.
 */
export function pendingSettingsMigrations(stored, current, steps = SETTINGS_MIGRATIONS) {
  const from = Number.isFinite(stored) ? stored : 0;
  return steps
    .filter((step) => step.version > from && step.version <= current)
    .sort((a, b) => a.version - b.version);
}

/**
 * GM only, on ready: run pending steps, then record the current schema.
 * A world already newer than this code is left alone (never downgraded).
 */
export async function migrateSettings(steps = SETTINGS_MIGRATIONS) {
  if (!game.user?.isGM) return;
  const stored = Number(game.settings.get(MODULE_ID, SETTINGS.settingsSchema)) || 0;
  if (stored >= SETTINGS_SCHEMA) return;
  for (const step of pendingSettingsMigrations(stored, SETTINGS_SCHEMA, steps)) {
    await step.run();
  }
  await game.settings.set(MODULE_ID, SETTINGS.settingsSchema, SETTINGS_SCHEMA);
}

export function registerSettings(SourcesConfigApp, ProviderSetupApp, WelcomeApp, WhatsNewApp) {
  if (WelcomeApp) {
    game.settings.registerMenu(MODULE_ID, "welcomeMenu", {
      name: "SIMPLYSF2E.Welcome.MenuName",
      label: "SIMPLYSF2E.Welcome.MenuLabel",
      hint: "SIMPLYSF2E.Welcome.MenuHint",
      icon: "fa-solid fa-rocket",
      type: WelcomeApp,
      restricted: true
    });
  }
  if (WhatsNewApp) {
    game.settings.registerMenu(MODULE_ID, "whatsNewMenu", {
      name: "SIMPLYSF2E.WhatsNew.MenuName",
      label: "SIMPLYSF2E.WhatsNew.MenuLabel",
      hint: "SIMPLYSF2E.WhatsNew.MenuHint",
      icon: "fa-solid fa-bolt",
      type: WhatsNewApp,
      restricted: true
    });
  }
  if (ProviderSetupApp) {
    game.settings.registerMenu(MODULE_ID, "providerSetupMenu", {
      name: "SIMPLYSF2E.ProviderSetup.MenuName",
      label: "SIMPLYSF2E.ProviderSetup.MenuLabel",
      hint: "SIMPLYSF2E.ProviderSetup.MenuHint",
      icon: "fa-solid fa-plug-circle-check",
      type: ProviderSetupApp,
      restricted: true
    });
  }
  game.settings.registerMenu(MODULE_ID, "sourcesMenu", {
    name: "SIMPLYSF2E.Sources.MenuName",
    label: "SIMPLYSF2E.Sources.MenuLabel",
    hint: "SIMPLYSF2E.Sources.MenuHint",
    icon: "fa-solid fa-book-atlas",
    type: SourcesConfigApp,
    restricted: true
  });

  // Per-category pack selection, managed by the Compendium Sources menu.
  // An unset or empty category means "use the scaffold's system pack defaults".
  game.settings.register(MODULE_ID, SETTINGS.sourcePacks, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    // compendium.mjs imports this file, so it cannot be imported back here;
    // simplysf2e.mjs listens for this hook and clears the compendium caches.
    onChange: () => Hooks.callAll("simplysf2e.sourcePacksChanged")
  });

  // "Don't show this again" on the first-run welcome. Client scope: the AI
  // connection the welcome checks is itself per browser, so each GM browser
  // decides for itself.
  game.settings.register(MODULE_ID, SETTINGS.welcomeDismissed, {
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

  // What's new: ids of release notes this browser has seen. null = never run
  // (fresh install: ready seeds it silently). Per browser, like the welcome.
  game.settings.register(MODULE_ID, SETTINGS.whatsNewSeen, {
    scope: "client",
    config: false,
    // Nullable so "never run" (null) differs from "seen nothing" ([]).
    type: globalThis.foundry?.data?.fields
      ? new foundry.data.fields.ArrayField(new foundry.data.fields.StringField(), {
        required: false,
        nullable: true,
        initial: null
      })
      : Array,
    default: null
  });

  // "Don't show for updates" on the What's new window. Manual opens ignore it.
  game.settings.register(MODULE_ID, SETTINGS.whatsNewDisabled, {
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

  // Layout version of the world settings; migrateSettings() (ready) keeps it current.
  game.settings.register(MODULE_ID, SETTINGS.settingsSchema, {
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  // Last Generator settings (never the prompt), restored on the next open.
  game.settings.register(MODULE_ID, SETTINGS.generatorInput, {
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });

  // GM-created generation presets, managed from the generator dialog.
  game.settings.register(MODULE_ID, SETTINGS.customPresets, {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  // Named connection profiles, including each profile's key and exact-URL
  // binding. Client-scoped so secrets stay in this browser and are never
  // world-synced. The ordinary settings form never renders this object.
  game.settings.register(MODULE_ID, SETTINGS.providerBank, {
    scope: "client",
    config: false,
    type: Object,
    default: { activeId: "", connections: [] }
  });

  // Security binding for the client-scoped key. This is deliberately a new,
  // hidden setting rather than an automatic migration: existing keys have no
  // trustworthy record of which endpoint they belonged to, so they stay
  // unbound until the user authorizes it for the current endpoint.
  game.settings.register(MODULE_ID, SETTINGS.apiKeyBaseUrl, {
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, SETTINGS.apiBaseUrl, {
    name: "SIMPLYSF2E.Settings.ApiBaseUrl.Name",
    hint: "SIMPLYSF2E.Settings.ApiBaseUrl.Hint",
    scope: "world",
    // ProviderSetupApp owns this value alongside the key and model. Keeping
    // it registered but hidden preserves saved worlds and script access
    // without presenting two competing configuration surfaces.
    config: false,
    restricted: true,
    type: String,
    default: "https://api.deepseek.com/v1",
    onChange: clearApiKeyBindingForChangedBaseUrl
  });

  // Client scope on purpose: a world-scope setting syncs to every connected
  // client, letting any player read the key via game.settings.get. A changed
  // key stays disabled until the user confirms the exact rendered endpoint.
  game.settings.register(MODULE_ID, SETTINGS.apiKey, {
    name: "SIMPLYSF2E.Settings.ApiKey.Name",
    hint: "SIMPLYSF2E.Settings.ApiKey.Hint",
    scope: "client",
    // The ordinary settings form renders String values as visible text.
    // Keep credentials editable only through ProviderSetupApp, which uses a
    // password input and requires explicit endpoint authorization.
    config: false,
    restricted: true,
    type: String,
    default: "",
    onChange: clearApiKeyBindingForChangedKey
  });

  // Jev key: a key-only field on a fixed System One endpoint, kept outside the
  // connection bank because it is not a chat connection. jevSource picks which
  // fixed endpoint (JEV_SOURCES in jev.mjs: OpenRouter or TypeSafe AI); Provider
  // Setup clears the key when the source changes without a new key, so a key is
  // never sent to the other service.
  game.settings.register(MODULE_ID, SETTINGS.jevApiKey, {
    name: "SIMPLYSF2E.Settings.JevApiKey.Name",
    hint: "SIMPLYSF2E.Settings.JevApiKey.Hint",
    scope: "client",
    config: false,
    restricted: true,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, SETTINGS.jevSource, {
    name: "SIMPLYSF2E.Settings.JevSource.Name",
    hint: "SIMPLYSF2E.Settings.JevSource.Hint",
    scope: "client",
    config: false,
    restricted: true,
    type: String,
    default: "openrouter"
  });

  // Where a TypeSafe Jev key is sent: the official endpoint, or a CORS proxy the
  // GM runs. Provider Setup clears the key when this changes without a new key.
  game.settings.register(MODULE_ID, SETTINGS.jevTypeSafeEndpoint, {
    name: "SIMPLYSF2E.Settings.JevTypeSafeEndpoint.Name",
    hint: "SIMPLYSF2E.Settings.JevTypeSafeEndpoint.Hint",
    scope: "client",
    config: false,
    restricted: true,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, SETTINGS.model, {
    name: "SIMPLYSF2E.Settings.Model.Name",
    hint: "SIMPLYSF2E.Settings.Model.Hint",
    scope: "world",
    // See apiBaseUrl above: provider identity is configured together in the
    // guided provider dialog, not piecemeal in ordinary module settings.
    config: false,
    restricted: true,
    type: String,
    default: "deepseek-v4-flash"
  });

  game.settings.register(MODULE_ID, SETTINGS.temperature, {
    name: "SIMPLYSF2E.Settings.Temperature.Name",
    hint: "SIMPLYSF2E.Settings.Temperature.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: Number,
    range: { min: 0, max: 2, step: 0.1 },
    default: 0.8
  });

  game.settings.register(MODULE_ID, SETTINGS.maxTokens, {
    name: "SIMPLYSF2E.Settings.MaxTokens.Name",
    hint: "SIMPLYSF2E.Settings.MaxTokens.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: Number,
    default: 8000
  });

  game.settings.register(MODULE_ID, SETTINGS.requestTimeout, {
    name: "SIMPLYSF2E.Settings.RequestTimeout.Name",
    hint: "SIMPLYSF2E.Settings.RequestTimeout.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: Number,
    default: 90
  });

  game.settings.register(MODULE_ID, SETTINGS.runTokenBudget, {
    name: "SIMPLYSF2E.Settings.RunTokenBudget.Name",
    hint: "SIMPLYSF2E.Settings.RunTokenBudget.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: Number,
    default: 60000
  });
  game.settings.register(MODULE_ID, SETTINGS.runDeadline, {
    name: "SIMPLYSF2E.Settings.RunDeadline.Name",
    hint: "SIMPLYSF2E.Settings.RunDeadline.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: Number,
    default: 5
  });

  // Free Archetype is a GM campaign-rule choice, so it is world-scoped and
  // restricted. Archetype slots are validated staged (candidate-time
  // prerequisite filtering plus post-resolution placement checks via
  // validateArchetypeSlotPlacement); unprovable fills fail closed into the
  // completion manifest. Level 1 has no variant slot and is unaffected.
  game.settings.register(MODULE_ID, SETTINGS.freeArchetype, {
    name: "SIMPLYSF2E.Settings.FreeArchetype.Name",
    hint: "SIMPLYSF2E.Settings.FreeArchetype.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: Boolean,
    default: false
  });
}

export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

const SECRET_QUERY_NAMES = new Set([
  "key", "apikey", "api-key", "token", "access-token", "auth", "authorization", "secret",
  "password", "subscription-key", "ocp-apim-subscription-key", "sig", "signature", "code"
]);

/** Name of the first key-like query parameter ("-" and "_" alike, any case), or "". */
function findSecretQueryName(url) {
  for (const name of url.searchParams.keys()) {
    const folded = name.toLowerCase().replace(/_/g, "-");
    if (SECRET_QUERY_NAMES.has(folded) || /-(key|token|secret)$/.test(folded)) return name;
  }
  return "";
}

/**
 * Why an API Base URL must not be saved, or null. "userinfo" = user:pass@ in the
 * URL; "query-secret" = a key-like query parameter name. The world setting is
 * readable by every player, so credentials belong in the client-scoped API key.
 * Unparseable input returns null (the protocol check reports it).
 */
export function apiBaseUrlCredentialReason(value) {
  let url;
  try { url = new URL(String(value ?? "").trim()); }
  catch { return null; }
  if (url.username || url.password) return "userinfo";
  return findSecretQueryName(url) ? "query-secret" : null;
}

/**
 * Throw a localized Error naming the cause (never the secret value) when the URL
 * carries a credential. Used by every path that writes apiBaseUrl.
 */
export function assertApiBaseUrlHasNoCredential(value) {
  const reason = apiBaseUrlCredentialReason(value);
  if (!reason) return;
  const i18n = globalThis.game?.i18n;
  if (reason === "userinfo") {
    throw new Error(i18n?.localize?.("SIMPLYSF2E.ProviderSetup.BaseUrlHasUserinfo") ?? "BaseUrlHasUserinfo");
  }
  const name = findSecretQueryName(new URL(String(value).trim()));
  throw new Error(
    i18n?.format?.("SIMPLYSF2E.ProviderSetup.BaseUrlHasSecret", { name }) ?? `BaseUrlHasSecret ${name}`
  );
}

/**
 * Normalize the configured API root for both requests and key binding.
 * The path remains significant: two gateways on one origin must not share a
 * credential merely because their host is the same.
 */
export function normalizeApiBaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.href.replace(/\/+$/, "");
  } catch {
    // Preserve compatibility with the old free-form setting. fetch() will
    // still surface a useful network error if the value is not a valid URL.
    return raw.replace(/\/+$/, "");
  }
}

/**
 * Resolve the configured API root (or an already-complete Chat Completions
 * endpoint) to the exact request URL. URL.pathname is changed instead of
 * concatenating strings so gateway query parameters remain in the right
 * place. The configured value itself remains the key-binding identity.
 */
export function chatCompletionsUrl(value) {
  const normalized = normalizeApiBaseUrl(value);
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    const path = url.pathname.replace(/\/+$/, "");
    if (!path.endsWith("/chat/completions")) {
      url.pathname = `${path}/chat/completions`;
    }
    url.hash = "";
    return url.href;
  } catch {
    // Preserve the old free-form setting's useful fetch error while avoiding
    // an obvious duplicate suffix when possible.
    return normalized.endsWith("/chat/completions")
      ? normalized
      : `${normalized}/chat/completions`;
  }
}

/** Resolve an API root or full Chat Completions endpoint to its model list. */
export function modelsUrl(value) {
  const normalized = normalizeApiBaseUrl(value);
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    let path = url.pathname.replace(/\/+$/, "");
    if (path.endsWith("/chat/completions")) {
      path = path.slice(0, -"/chat/completions".length);
    }
    if (!path.endsWith("/models")) url.pathname = `${path}/models`;
    url.hash = "";
    return url.href;
  } catch {
    return normalized.endsWith("/models") ? normalized : `${normalized}/models`;
  }
}

/** True only for DeepSeek's first-party API hostname. */
export function isOfficialDeepSeekEndpoint(value) {
  try {
    const host = new URL(normalizeApiBaseUrl(value)).hostname.toLowerCase().replace(/\.$/, "");
    return host === "api.deepseek.com";
  } catch {
    return false;
  }
}

/** True only for OpenAI's first-party API hostname. */
export function isOfficialOpenAIEndpoint(value) {
  try {
    const host = new URL(normalizeApiBaseUrl(value)).hostname.toLowerCase().replace(/\.$/, "");
    return host === "api.openai.com";
  } catch {
    return false;
  }
}

/**
 * Preserve existing worlds after DeepSeek retired its legacy model aliases.
 * Custom gateways keep their configured identifiers unchanged because those
 * aliases may still be meaningful outside DeepSeek's first-party API.
 */
export function resolveProviderModel(baseUrl, value) {
  const model = String(value ?? "").trim();
  if (
    isOfficialDeepSeekEndpoint(baseUrl)
    && (model === "deepseek-chat" || model === "deepseek-reasoner")
  ) {
    return "deepseek-v4-flash";
  }
  return model;
}

/** True for common keyless Ollama/LM Studio and local gateway addresses. */
export function isLikelyKeylessLocalEndpoint(value) {
  try {
    const url = new URL(normalizeApiBaseUrl(value));
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
    if (host === "::1" || (host.includes(":") && /^(?:fc|fd|fe80:)/.test(host))) return true;
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
    const match172 = /^172\.(\d{1,3})\./.exec(host);
    return Boolean(match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31);
  } catch {
    return false;
  }
}

/**
 * True when a key may be sent to this address: https anywhere, or plain http
 * only to this computer or a private home-network address (the same hosts
 * `isLikelyKeylessLocalEndpoint` treats as local). Plain http to an internet
 * host would carry the key unencrypted, so the key is withheld there.
 */
export function isKeySafeEndpoint(value) {
  try {
    const url = new URL(normalizeApiBaseUrl(value));
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    // Unlike the keyless heuristic, an IPv4 range only counts for a full
    // address: a DNS name such as 10.evil.com or 192.168.1.1.nip.io resolves
    // anywhere and must not receive a key over plain http.
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (/^\d+\./.test(host) && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
    return isLikelyKeylessLocalEndpoint(url.href);
  } catch {
    return false;
  }
}

/**
 * Compact provider metadata for the generator header. This is deliberately
 * inferred from the endpoint instead of stored as a second provider setting,
 * so custom OpenAI-compatible gateways remain first-class and cannot drift
 * out of sync with the URL that actually receives requests.
 */
export function describeProvider(baseUrl, model = "") {
  const normalized = normalizeApiBaseUrl(baseUrl);
  const configuredModel = String(model ?? "").trim();
  if (!normalized) {
    return { id: "missing", name: "Not configured", local: false, model: configuredModel };
  }
  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    if (host === "api.openai.com") return { id: "openai", name: "OpenAI", local: false, model: configuredModel };
    if (host === "api.deepseek.com") return { id: "deepseek", name: "DeepSeek", local: false, model: configuredModel };
    if (host === "openrouter.ai") return { id: "openrouter", name: "OpenRouter", local: false, model: configuredModel };
    const local = isLikelyKeylessLocalEndpoint(normalized);
    if (local && port === "11434") return { id: "ollama", name: "Ollama", local: true, model: configuredModel };
    if (local && port === "1234") return { id: "lmstudio", name: "LM Studio", local: true, model: configuredModel };
    return {
      id: local ? "local" : "custom",
      name: local ? "Local provider" : "Custom provider",
      local,
      model: configuredModel
    };
  } catch {
    return { id: "custom", name: "Custom provider", local: false, model: configuredModel };
  }
}

function newConnectionId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `conn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function snapshotLiveProviderSettings() {
  return {
    apiBaseUrl: normalizeApiBaseUrl(getSetting(SETTINGS.apiBaseUrl)),
    model: String(getSetting(SETTINGS.model) ?? "").trim(),
    apiKey: String(getSetting(SETTINGS.apiKey) ?? "").trim(),
    apiKeyBaseUrl: normalizeApiBaseUrl(getSetting(SETTINGS.apiKeyBaseUrl))
  };
}

/** Display name inferred from the endpoint, used for the first migrated profile. */
export function defaultConnectionName(baseUrl, model = "") {
  const provider = describeProvider(baseUrl, model);
  return provider.id === "missing" ? "Default" : provider.name;
}

function normalizeProviderConnection(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id ?? "").trim();
  if (!id) return null;
  const apiBaseUrl = normalizeApiBaseUrl(raw.apiBaseUrl);
  const model = String(raw.model ?? "").trim();
  const name = String(raw.name ?? "").trim() || defaultConnectionName(apiBaseUrl, model);
  return {
    id,
    name,
    apiBaseUrl,
    model,
    apiKey: String(raw.apiKey ?? "").trim(),
    apiKeyBaseUrl: normalizeApiBaseUrl(raw.apiKeyBaseUrl),
    ...normalizePrices(raw)
  };
}

function readProviderBank() {
  let raw;
  try { raw = getSetting(SETTINGS.providerBank); }
  catch { raw = null; }
  const connections = Array.isArray(raw?.connections)
    ? raw.connections.map(normalizeProviderConnection).filter(Boolean)
    : [];
  let activeId = String(raw?.activeId ?? "").trim();
  if (!connections.some((connection) => connection.id === activeId)) {
    activeId = connections[0]?.id ?? "";
  }
  return { activeId, connections };
}

async function persistProviderBank(bank) {
  await game.settings.set(MODULE_ID, SETTINGS.providerBank, {
    activeId: bank.activeId,
    connections: bank.connections.map((connection) => ({
      id: connection.id,
      name: connection.name,
      apiBaseUrl: connection.apiBaseUrl,
      model: connection.model,
      apiKey: connection.apiKey,
      apiKeyBaseUrl: connection.apiKeyBaseUrl,
      inputPerM: connection.inputPerM ?? null,
      outputPerM: connection.outputPerM ?? null
    }))
  });
}

// One queue for every read-modify-write of the client connection bank and the
// live endpoint/model/key it mirrors. Each task starts only after the previous
// one has persisted the bank and finished applying live settings, so two quick
// switches cannot snapshot one connection's values onto another. A rejected
// task does not block the next one. Not re-entrant: a queued task must call the
// unqueued *Unlocked helpers below, never a queued public function, or it waits
// on itself forever.
let providerBankQueue = Promise.resolve();

export function runProviderBankExclusive(task) {
  const run = providerBankQueue.then(() => task());
  providerBankQueue = run.catch(() => {});
  return run;
}

/**
 * Copy the live key, binding, endpoint and model onto `connection`, but only
 * when the live endpoint and model still equal `expected` (by default the
 * connection's own stored values, i.e. what was last applied or saved for it).
 * A mismatch means the world endpoint/model changed under this browser (another
 * GM client switched or saved): the connection keeps its stored values. Returns
 * true when copied.
 */
function copyLiveSettingsOnto(connection, expected = connection) {
  const live = snapshotLiveProviderSettings();
  const wantBaseUrl = normalizeApiBaseUrl(expected?.apiBaseUrl);
  const wantModel = String(expected?.model ?? "").trim();
  if (live.apiBaseUrl !== wantBaseUrl || live.model !== wantModel) {
    console.warn(
      `${MODULE_ID} | live provider endpoint/model no longer match connection "${connection.name}"; kept its stored values`
    );
    return false;
  }
  Object.assign(connection, live);
  return true;
}

let providerConnectionDepth = 0;

/** True while any withProviderConnectionGuard call is still running. */
export const isApplyingProviderConnection = () => providerConnectionDepth > 0;

// Re-entrant: nested calls share one guard; it lifts only when the outermost call ends.
export async function withProviderConnectionGuard(callback) {
  providerConnectionDepth += 1;
  try { return await callback(); }
  finally { providerConnectionDepth -= 1; }
}

async function applyConnectionToSettings(connection) {
  return withProviderConnectionGuard(async () => {
    await game.settings.set(MODULE_ID, SETTINGS.apiBaseUrl, connection.apiBaseUrl);
    await game.settings.set(MODULE_ID, SETTINGS.model, connection.model);
    await game.settings.set(MODULE_ID, SETTINGS.apiKey, connection.apiKey);
    await game.settings.set(MODULE_ID, SETTINGS.apiKeyBaseUrl, connection.apiKeyBaseUrl);
  });
}

/**
 * Seed the client connection bank from the legacy single endpoint/key/model
 * settings. Existing worlds keep working; the first setup or save creates one
 * named profile instead of inventing a second configuration.
 */
export function ensureProviderBank() {
  return runProviderBankExclusive(ensureProviderBankUnlocked);
}

async function ensureProviderBankUnlocked() {
  const bank = readProviderBank();
  if (bank.connections.length) return bank;
  const snapshot = snapshotLiveProviderSettings();
  const connection = {
    id: newConnectionId(),
    name: defaultConnectionName(snapshot.apiBaseUrl, snapshot.model),
    ...snapshot
  };
  const next = { activeId: connection.id, connections: [connection] };
  await persistProviderBank(next);
  return next;
}

/** Compact named profiles for the setup list and generator header switch. */
export function listProviderConnections() {
  const bank = readProviderBank();
  return bank.connections.map((connection) => ({
    id: connection.id,
    name: connection.name,
    active: connection.id === bank.activeId
  }));
}

/** Manual USD prices per 1M tokens of the active connection: `{ inputPerM, outputPerM }`, each a number or null. */
export function getActiveProviderPrices() {
  const bank = readProviderBank();
  const active = bank.connections.find((connection) => connection.id === bank.activeId);
  return normalizePrices(active);
}

/**
 * Store manual prices on the active connection (empty = unset). Throws an Error
 * whose `field` is "inputPerM" or "outputPerM" on a negative or non-numeric value,
 * before anything is written.
 */
export function setActiveProviderPrices(prices = {}) {
  return runProviderBankExclusive(() => setActiveProviderPricesUnlocked(prices));
}

/** setActiveProviderPrices for code already running inside runProviderBankExclusive. */
export async function setActiveProviderPricesUnlocked({ inputPerM, outputPerM } = {}) {
  const parsed = { inputPerM: parsePrice(inputPerM), outputPerM: parsePrice(outputPerM) };
  for (const field of ["inputPerM", "outputPerM"]) {
    if (!parsed[field].error) continue;
    const err = new Error(game.i18n.localize(`SIMPLYSF2E.ProviderSetup.${field === "inputPerM" ? "PriceInput" : "PriceOutput"}Invalid`));
    err.field = field;
    throw err;
  }
  const bank = await ensureProviderBankUnlocked();
  const active = bank.connections.find((connection) => connection.id === bank.activeId);
  if (!active) return null;
  active.inputPerM = parsed.inputPerM.value;
  active.outputPerM = parsed.outputPerM.value;
  await persistProviderBank(bank);
  return { inputPerM: active.inputPerM, outputPerM: active.outputPerM };
}

/**
 * Write the live key and binding into the active named profile (plus endpoint
 * and model, which must still equal what that profile last applied; see
 * copyLiveSettingsOnto). `patch.name` renames it.
 */
export function upsertActiveProviderConnection(patch = {}) {
  return runProviderBankExclusive(() => upsertActiveProviderConnectionUnlocked(patch));
}

/**
 * upsertActiveProviderConnection for code already running inside
 * runProviderBankExclusive. `applied` is the `{ apiBaseUrl, model }` this browser has just written on
 * purpose (a Provider Setup or Welcome save): the live values are checked
 * against it instead of the profile's stored ones, so a deliberate edit lands.
 */
export async function upsertActiveProviderConnectionUnlocked(patch = {}, applied = null) {
  const bank = await ensureProviderBankUnlocked();
  const active = bank.connections.find((connection) => connection.id === bank.activeId);
  if (!active) return null;
  copyLiveSettingsOnto(active, applied ?? active);
  if (patch.name !== undefined) {
    const name = String(patch.name ?? "").trim();
    if (name) active.name = name;
  }
  await persistProviderBank(bank);
  return active;
}

/**
 * Activate a stored profile. Live settings become that profile's endpoint,
 * model, key, and exact-URL binding; the previous live values are saved onto
 * the profile being left when they still belong to it. Unknown ids fail closed.
 */
export function selectProviderConnection(id) {
  return runProviderBankExclusive(() => selectProviderConnectionUnlocked(id));
}

async function selectProviderConnectionUnlocked(id) {
  const wanted = String(id ?? "").trim();
  if (!wanted) return false;
  const bank = await ensureProviderBankUnlocked();
  const next = bank.connections.find((connection) => connection.id === wanted);
  if (!next) return false;
  if (bank.activeId === next.id) return true;
  const leaving = bank.connections.find((connection) => connection.id === bank.activeId);
  if (leaving) copyLiveSettingsOnto(leaving);
  bank.activeId = next.id;
  await persistProviderBank(bank);
  await applyConnectionToSettings(next);
  return true;
}

/**
 * Add a named profile and make it active. New profiles start with no key —
 * they never copy a secret from a different endpoint.
 */
export function createProviderConnection({ name, apiBaseUrl, model } = {}) {
  return runProviderBankExclusive(async () => {
    // Fail closed before any write: the URL is stored world-scoped.
    assertApiBaseUrlHasNoCredential(apiBaseUrl);
    const bank = await ensureProviderBankUnlocked();
    const leaving = bank.connections.find((connection) => connection.id === bank.activeId);
    if (leaving) copyLiveSettingsOnto(leaving);
    const snapshot = {
      apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
      model: String(model ?? "").trim(),
      apiKey: "",
      apiKeyBaseUrl: ""
    };
    const connection = {
      id: newConnectionId(),
      name: String(name ?? "").trim() || defaultConnectionName(snapshot.apiBaseUrl, snapshot.model),
      ...snapshot
    };
    bank.connections.push(connection);
    bank.activeId = connection.id;
    await persistProviderBank(bank);
    await applyConnectionToSettings(connection);
    return connection;
  });
}

/** Rename a stored profile. Empty names fail closed. */
export function renameProviderConnection(id, name) {
  return runProviderBankExclusive(async () => {
    const wanted = String(id ?? "").trim();
    const nextName = String(name ?? "").trim();
    if (!wanted || !nextName) return false;
    const bank = await ensureProviderBankUnlocked();
    const connection = bank.connections.find((entry) => entry.id === wanted);
    if (!connection) return false;
    connection.name = nextName;
    await persistProviderBank(bank);
    return true;
  });
}

/**
 * Remove a stored profile. The last remaining profile cannot be deleted.
 * Deleting the active profile activates another stored connection.
 */
export function deleteProviderConnection(id) {
  return runProviderBankExclusive(async () => {
    const wanted = String(id ?? "").trim();
    if (!wanted) return false;
    const bank = await ensureProviderBankUnlocked();
    if (bank.connections.length < 2) return false;
    const remaining = bank.connections.filter((connection) => connection.id !== wanted);
    if (remaining.length === bank.connections.length) return false;
    const wasActive = bank.activeId === wanted;
    bank.connections = remaining;
    if (wasActive) {
      bank.activeId = remaining[0].id;
      await persistProviderBank(bank);
      await applyConnectionToSettings(remaining[0]);
    } else {
      await persistProviderBank(bank);
    }
    return true;
  });
}

/**
 * Read provider authentication without exposing an unbound key to callers.
 * `apiKey` is non-empty only when its stored binding exactly matches baseUrl.
 */
export function getProviderRequestConfig() {
  const baseUrl = normalizeApiBaseUrl(getSetting(SETTINGS.apiBaseUrl));
  const model = String(getSetting(SETTINGS.model) ?? "").trim();
  const configuredApiKey = String(getSetting(SETTINGS.apiKey) ?? "").trim();
  const apiKeyBaseUrl = normalizeApiBaseUrl(getSetting(SETTINGS.apiKeyBaseUrl));
  const apiKeyIsBound = Boolean(configuredApiKey && baseUrl && apiKeyBaseUrl === baseUrl);
  // A bound key is still withheld from plain http to an internet host.
  const apiKeyInsecure = Boolean(configuredApiKey && baseUrl && !isKeySafeEndpoint(baseUrl));
  const provider = describeProvider(baseUrl, model);
  const bank = readProviderBank();
  const active = bank.connections.find((connection) => connection.id === bank.activeId) ?? null;
  return {
    baseUrl,
    apiKey: apiKeyIsBound && !apiKeyInsecure ? configuredApiKey : "",
    hasConfiguredApiKey: Boolean(configuredApiKey),
    apiKeyIsBound,
    apiKeyInsecure,
    keylessLocal: isLikelyKeylessLocalEndpoint(baseUrl),
    model,
    provider,
    connectionId: active?.id ?? "",
    connectionName: active?.name || provider.name,
    prices: normalizePrices(active),
    connections: bank.connections.map((connection) => ({
      id: connection.id,
      name: connection.name,
      active: connection.id === bank.activeId
    }))
  };
}

/**
 * The separate Jev key and where it goes (`{ apiKey, source, endpoint }`; key trimmed and
 * "" when unset; source and the TypeSafe endpoint are raw settings, normalized by jev.mjs).
 */
export function getJevRequestConfig() {
  return {
    apiKey: String(getSetting(SETTINGS.jevApiKey) ?? "").trim(),
    source: String(getSetting(SETTINGS.jevSource) ?? "openrouter"),
    endpoint: String(getSetting(SETTINGS.jevTypeSafeEndpoint) ?? "")
  };
}

/** Localization key for a useful provider-auth warning, or null when ready. */
export function getProviderAuthWarningKey(
  state = getProviderRequestConfig(),
  pageProtocol = globalThis.location?.protocol,
  requireModel = true
) {
  if (!state.baseUrl) return "SIMPLYSF2E.Errors.NoBaseUrl";
  if (requireModel && !String(state.model ?? "").trim()) return "SIMPLYSF2E.Errors.NoModel";
  if (state.hasConfiguredApiKey && state.apiKeyInsecure) return "SIMPLYSF2E.Errors.InsecureKeyEndpoint";
  if (state.hasConfiguredApiKey && !state.apiKeyIsBound) {
    return "SIMPLYSF2E.Generator.ApiKeyNotAuthorized";
  }
  if (!state.hasConfiguredApiKey && !state.keylessLocal) {
    return "SIMPLYSF2E.Generator.NoApiKey";
  }
  try {
    if (pageProtocol === "https:" && new URL(state.baseUrl).protocol === "http:") {
      return "SIMPLYSF2E.Errors.MixedContentProvider";
    }
  } catch {
    // Invalid URLs are surfaced by fetch with the ordinary network guidance.
  }
  return null;
}

/**
 * Explicitly authorize the currently stored client key for the endpoint the
 * user was shown. The expected endpoint is checked before and after writing
 * the binding so a concurrent world-setting change fails closed.
 */
export function authorizeApiKeyForCurrentBaseUrl(expectedBaseUrl) {
  return runProviderBankExclusive(async () => {
    const result = await bindApiKeyToCurrentBaseUrlUnlocked(expectedBaseUrl);
    if (result === null) return false;
    await upsertActiveProviderConnectionUnlocked();
    return result;
  });
}

/**
 * The binding half of authorizeApiKeyForCurrentBaseUrl, without the bank write,
 * for code already running inside runProviderBankExclusive. Returns null when
 * nothing was written, false when the endpoint moved and the binding was
 * cleared again, true when bound.
 */
export async function bindApiKeyToCurrentBaseUrlUnlocked(expectedBaseUrl) {
  const apiKey = String(getSetting(SETTINGS.apiKey) ?? "").trim();
  const baseUrl = normalizeApiBaseUrl(getSetting(SETTINGS.apiBaseUrl));
  const expected = normalizeApiBaseUrl(expectedBaseUrl);
  if (!apiKey || !baseUrl || !expected || baseUrl !== expected) return null;
  await game.settings.set(MODULE_ID, SETTINGS.apiKeyBaseUrl, baseUrl);
  if (normalizeApiBaseUrl(getSetting(SETTINGS.apiBaseUrl)) !== expected) {
    await game.settings.set(MODULE_ID, SETTINGS.apiKeyBaseUrl, "");
    return false;
  }
  return true;
}

async function clearApiKeyBindingForChangedKey() {
  if (isApplyingProviderConnection()) return;
  if (getSetting(SETTINGS.apiKeyBaseUrl)) {
    await game.settings.set(MODULE_ID, SETTINGS.apiKeyBaseUrl, "");
  }
}

async function clearApiKeyBindingForChangedBaseUrl(value) {
  if (isApplyingProviderConnection()) return;
  const nextBaseUrl = normalizeApiBaseUrl(value);
  const boundBaseUrl = normalizeApiBaseUrl(getSetting(SETTINGS.apiKeyBaseUrl));
  if (boundBaseUrl && boundBaseUrl !== nextBaseUrl) {
    await game.settings.set(MODULE_ID, SETTINGS.apiKeyBaseUrl, "");
  }
}
