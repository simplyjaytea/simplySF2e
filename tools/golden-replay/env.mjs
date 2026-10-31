// Foundry + provider environment stub for the golden replay suite. Nothing here
// talks to a network: `fetch` is replaced by a scripted queue of provider
// payloads, and every call is captured so a test can assert on it.
import { SETTINGS } from "../../scripts/settings.mjs";

const settingsMap = new Map();
let fetchQueue = [];
const captured = { urls: [], bodies: [], headers: [], contentTypes: [] };
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
  captured.contentTypes = [];

  globalThis.fetch = async (url, options) => {
    captured.urls.push(String(url));
    captured.bodies.push(options?.body ? JSON.parse(options.body) : null);
    captured.headers.push(options?.headers ?? null);
    const reply = fetchQueue.shift();
    if (!reply) throw new Error(`golden-replay: unscripted provider request to ${url}`);

    if (Array.isArray(reply.sse)) {
      captured.contentTypes.push("text/event-stream");
      return sseResponse(reply.sse);
    }

    captured.contentTypes.push(reply.contentType ?? "application/json");
    const body = Object.hasOwn(reply, "rawBody") ? reply.rawBody : JSON.stringify(reply.body ?? reply);
    return new Response(body, {
      status: reply.httpStatus ?? 200,
      headers: { "content-type": reply.contentType ?? "application/json" }
    });
  };
}

// Serve SSE records in small groups so the producer's buffering and the
// reader's final-unterminated-line handling are actually exercised.
function sseResponse(records) {
  const lines = records.map((record) => (typeof record === "string" ? record : `data: ${JSON.stringify(record)}`));
  if (!lines.some((line) => line.includes("[DONE]"))) lines.push("data: [DONE]");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < lines.length; i += 2) {
        controller.enqueue(encoder.encode(`${lines.slice(i, i + 2).join("\n\n")}\n\n`));
      }
      controller.close();
    }
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" }
  });
}

/**
 * Build an SSE queue entry from a normal provider payload. The content string is
 * split into 3 deltas; the finish reason rides the last text chunk and usage
 * arrives in its own final chunk.
 */
export function sse(payload) {
  const choice = payload.choices?.[0] ?? {};
  const content = choice.message?.content ?? "";
  const size = Math.max(1, Math.ceil(content.length / 3));
  const parts = [];
  for (let i = 0; i < content.length; i += size) parts.push(content.slice(i, i + size));
  if (!parts.length) parts.push("");
  const chunks = parts.map((part, index) => ({
    choices: [{
      delta: { content: part },
      finish_reason: index === parts.length - 1 ? (choice.finish_reason ?? "stop") : null
    }]
  }));
  if (payload.usage) chunks.push({ choices: [], usage: payload.usage });
  return { sse: chunks };
}

/** Queue the provider payloads this scenario is allowed to consume, in order. */
export function queueResponses(payloads) {
  for (const payload of payloads) fetchQueue.push(payload);
}

/** Everything the stubbed provider was asked for during the current scenario. */
export function capturedRequests() {
  return {
    urls: captured.urls,
    bodies: captured.bodies,
    headers: captured.headers,
    contentTypes: captured.contentTypes
  };
}

/** Content type of the last response the stub served. */
export function lastServedContentType() {
  return captured.contentTypes[captured.contentTypes.length - 1] ?? null;
}

/** Put back whatever globals existed before installEnv(). */
export function restoreEnv() {
  if (hadGame) globalThis.game = prevGame;
  else delete globalThis.game;
  if (hadFetch) globalThis.fetch = prevFetch;
  else delete globalThis.fetch;
}
