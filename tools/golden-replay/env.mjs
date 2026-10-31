import { SETTINGS } from "../../scripts/settings.mjs";

const settingsMap = new Map();
let fetchQueue = [];
const captured = { urls: [], bodies: [], headers: [] };

export function installEnv({ settings = {} } = {}) {
  settingsMap.clear();
  // defaults disable Jev
  settingsMap.set(SETTINGS.apiBaseUrl, "http://localhost:11434/v1");
  settingsMap.set(SETTINGS.apiKey, "");
  settingsMap.set(SETTINGS.apiKeyBaseUrl, "");
  settingsMap.set(SETTINGS.model, "test-model");
  settingsMap.set(SETTINGS.temperature, 0.8);
  settingsMap.set(SETTINGS.maxTokens, 8000);
  settingsMap.set(SETTINGS.requestTimeout, 90);
  for (const [k, v] of Object.entries(settings)) settingsMap.set(k, v);
  // disable jev if settings exist
  globalThis.game = {
    settings: { get: (_moduleId, key) => settingsMap.get(key) },
    i18n: { localize: (key) => key, format: (key, data) => `${key}:${JSON.stringify(data)}` }
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
    if (!reply) throw new Error("no queued response");
    const body = Object.hasOwn(reply, "rawBody") ? reply.rawBody : JSON.stringify(reply.body ?? reply);
    return new Response(body, { status: reply.httpStatus ?? 200, headers: { "content-type": reply.contentType ?? "application/json" } });
  };
}

export function queueResponses(payloads) {
  for (const p of payloads) fetchQueue.push(p);
}

export function capturedRequests() {
  return { urls: captured.urls, bodies: captured.bodies, headers: captured.headers };
}

export function restoreEnv() {
  // no-op; tests process exits
}