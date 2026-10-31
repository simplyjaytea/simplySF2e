// Foundry + provider environment stub for the golden replay suite. Nothing here
// talks to a network: `fetch` is replaced by a scripted queue of provider
// payloads, and every call is captured so a test can assert on it.
import { SETTINGS } from "../../scripts/settings.mjs";

const settingsMap = new Map();
let fetchQueue = [];
const captured = { urls: [], bodies: [], headers: [] };
let prevGame;
let prevFetch;
let hadGame = false;
let hadFetch = false;

/**
 * Install the stub for one scenario. Jev is disabled by default: the replay
 * suite exercises the chat pipeline only.
 */
export function installEnv({ settings = {} } = {}) {
  hadGame = Object.prototype.hasOwnProperty.call(globalThis, "game");
  hadFetch = Object.prototype.hasOwnProperty.call(globalThis, "fetch");
  prevGame = globalThis.game;
  prevFetch = globalThis.fetch;

  settingsMap.clear();
  settingsMap.set(SETTINGS.apiBaseUrl, "http://localhost:11434/v1");
  settingsMap.set(SETTINGS.apiKey, "");
  settingsMap.set(SETTINGS.apiKeyBaseUrl, "");
  settingsMap.set(SETTINGS.model, "test-model");
  settingsMap.set(SETTINGS.temperature, 0.8);
  settingsMap.set(SETTINGS.maxTokens, 8000);
  settingsMap.set(SETTINGS.requestTimeout, 90);
  settingsMap.set(SETTINGS.runTokenBudget, 60000);
  settingsMap.set(SETTINGS.runDeadline, 0);
  // No Jev key means resolveJevConfig() returns null and every selector uses the chat model.
  settingsMap.set(SETTINGS.jevApiKey, "");
  settingsMap.set(SETTINGS.jevSource, "");
  settingsMap.set(SETTINGS.jevTypeSafeEndpoint, "");
  for (const [key, value] of Object.entries(settings)) settingsMap.set(key, value);

  globalThis.game = {
    settings: { get: (_moduleId, key) => settingsMap.get(key) },
    i18n: {
      localize: (key) => key,
      format: (key, data) => `${key}:${JSON.stringify(data)}`
    }
  };

  fetchQueue = [];
  captured.urls = [];
  captured.bodies = [];
  captured.headers = [];

  globalThis.fetch = async (url, options) => {
    captured.urls.push(String(url));
    captured.bodies.push(options?.body ? JSON.parse(options.body) : null);
    captured.headers.push(options?.headers ?? null);
    const reply = fetchQueue.shift();
    if (!reply) throw new Error(`golden-replay: unscripted provider request to ${url}`);
    const body = Object.hasOwn(reply, "rawBody") ? reply.rawBody : JSON.stringify(reply.body ?? reply);
    return new Response(body, {
      status: reply.httpStatus ?? 200,
      headers: { "content-type": reply.contentType ?? "application/json" }
    });
  };
}

/** Queue the provider payloads this scenario is allowed to consume, in order. */
export function queueResponses(payloads) {
  for (const payload of payloads) fetchQueue.push(payload);
}

/** Everything the stubbed provider was asked for during the current scenario. */
export function capturedRequests() {
  return { urls: captured.urls, bodies: captured.bodies, headers: captured.headers };
}

/** Put back whatever globals existed before installEnv(). */
export function restoreEnv() {
  if (hadGame) globalThis.game = prevGame;
  else delete globalThis.game;
  if (hadFetch) globalThis.fetch = prevFetch;
  else delete globalThis.fetch;
}
