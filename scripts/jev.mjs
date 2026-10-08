// Jev client: TypeSafe's "System One" decision model, reached through OpenRouter
// or TypeSafe's own API (the GM picks the source for the separate Jev key).
// Jev answers typed questions with calibrated probabilities; it never writes text.
// Request/response shapes are cited from:
//   https://openrouter.ai/docs/api/api-reference/systemone/submit-a-system-one-request
//   https://docs.typesafe.ai/introduction/quickstart
//   https://docs.typesafe.ai/models (versioned model ids)
// Call sites and UI arrive in later steps (J1b, J2-J5); nothing here calls the network on import.
import { getProviderRequestConfig, getJevRequestConfig } from "./settings.mjs";

/**
 * OpenRouter's route. Its pinned model id below is OpenRouter's naming. OpenRouter
 * answers the browser CORS preflight with `access-control-allow-origin: *`.
 */
export const JEV_ENDPOINT = "https://openrouter.ai/api/v1/systemone";

/** Pinned (not `latest`) so behavior does not drift between Jev releases. */
export const JEV_MODEL = "typesafe/jev-1.13";

/**
 * TypeSafe's own route, from the quickstart (`POST https://api.typesafe.ai/v1/systemone`).
 * The models page: "Versioned IDs such as jev-1.13.0 are accepted by the model field",
 * the same release as JEV_MODEL. Probed 2026-10-02, its CORS preflight answers
 * 400 "Disallowed CORS origin", so from Foundry this route fails until TypeSafe
 * allows browser origins; the Test Jev button reports that.
 */
export const TYPESAFE_JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const TYPESAFE_JEV_MODEL = "jev-1.13.0";

/** Where a separate Jev key is sent. Each key goes only to its own source's endpoint. */
export const JEV_SOURCES = Object.freeze({
  openrouter: Object.freeze({ id: "openrouter", label: "OpenRouter", endpoint: JEV_ENDPOINT, model: JEV_MODEL }),
  typesafe: Object.freeze({ id: "typesafe", label: "TypeSafe AI", endpoint: TYPESAFE_JEV_ENDPOINT, model: TYPESAFE_JEV_MODEL })
});

export const DEFAULT_JEV_SOURCE = "openrouter";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The TypeSafe endpoint a GM may point at their own CORS proxy. Empty means the
 * official endpoint. Returns the normalized URL, or `null` when it is not a usable
 * address: not http(s), carries a user name or password, or is plain http to a
 * host other than this machine (a key must not cross the network unencrypted).
 */
export function normalizeTypeSafeEndpoint(value) {
  const text = String(value ?? "").trim();
  if (!text) return TYPESAFE_JEV_ENDPOINT;
  let url;
  try { url = new URL(text); } catch { return null; }
  if (url.username || url.password) return null;
  // The official address typed with a trailing slash or an explicit :443 is still official.
  if (url.protocol === "https:" && url.origin === new URL(TYPESAFE_JEV_ENDPOINT).origin
    && /^\/v1\/systemone\/?$/.test(url.pathname) && !url.search && !url.hash) {
    return TYPESAFE_JEV_ENDPOINT;
  }
  if (url.protocol === "https:") return url.href;
  if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) return url.href;
  return null;
}

/** A known source id, else the default. */
export function normalizeJevSource(value) {
  const id = String(value ?? "").trim();
  return Object.hasOwn(JEV_SOURCES, id) ? id : DEFAULT_JEV_SOURCE;
}

/** Module default, not a rules number: minimum answer confidence to trust a pick (same value the jev-gateway project defaults to, per docs/next-steps.md). */
export const JEV_MIN_CONFIDENCE = 0.7;

/** Module default: give up on Jev and let the caller fall back to the chat LLM. */
export const JEV_TIMEOUT_MS = 4000;

/** Choice question option cap: 255, per the flaviocopes.com summary of TypeSafe docs (docs/next-steps.md). */
export const JEV_MAX_CHOICES = 255;

const ANSWER_TYPES = new Set(["choice", "score", "noul"]);

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isUnit = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

/**
 * The only gate J2-J5 use. Returns `{ source, endpoint, model, apiKey }` or `null`
 * (use the chat LLM). Order: a dedicated Jev key, sent to its chosen source
 * (OpenRouter, or TypeSafe at its saved endpoint, which may be the GM's proxy); else the active connection's key when that connection
 * is OpenRouter, always on OpenRouter's route. Never returns an empty key.
 *
 * Reusing a key bound to `https://openrouter.ai/api/v1` for the sibling `/systemone`
 * path stays inside the binding's intent: same host, same account. The binding exists
 * to stop a key going to a *different* endpoint.
 *
 * `provider` and `dedicated` are injected because Node ESM cannot stub named imports.
 */
export function resolveJevConfig({ provider = getProviderRequestConfig, dedicated = getJevRequestConfig } = {}) {
  try {
    const own = dedicated();
    const dedicatedKey = String(own?.apiKey ?? "").trim();
    if (dedicatedKey) {
      const source = JEV_SOURCES[normalizeJevSource(own?.source)];
      if (source.id !== "typesafe") {
        return { source: source.id, endpoint: source.endpoint, model: source.model, apiKey: dedicatedKey };
      }
      // A GM's own CORS proxy for TypeSafe. An unusable stored address fails
      // closed (Jev off) rather than sending the key somewhere unexpected.
      const endpoint = normalizeTypeSafeEndpoint(own?.endpoint);
      if (!endpoint) return null;
      return { source: source.id, endpoint, model: source.model, apiKey: dedicatedKey };
    }
    const state = provider();
    // `apiKey` is already "" unless bound to the exact base URL (settings.mjs); never read raw settings.
    const apiKey = String(state?.apiKey ?? "").trim();
    if (state?.provider?.id === "openrouter" && apiKey) {
      return { source: "openrouter", endpoint: JEV_ENDPOINT, model: JEV_MODEL, apiKey };
    }
  } catch {
    // A broken settings read means "Jev unavailable", never an error for the caller.
  }
  return null;
}

/**
 * Where Jev would get its key from, for the status-bar row: `"key"` (the separate
 * Jev key on OpenRouter), `"typesafe"` (the separate Jev key on TypeSafe AI),
 * `"connection"` (the active OpenRouter chat connection) or `null` (off).
 * Mirrors `resolveJevConfig`'s order and never exposes the key.
 */
export function jevKeySource(options = {}) {
  const config = resolveJevConfig(options);
  if (!config) return null;
  const { dedicated = getJevRequestConfig } = options;
  try {
    if (!String(dedicated()?.apiKey ?? "").trim()) return "connection";
    return config.source === "typesafe" ? "typesafe" : "key";
  } catch {
    return null;
  }
}

/**
 * Build a Choice question keyed by candidate id (never by array position: positional
 * indexes into long lists are unreliable). `candidates` is `[{ id, name }]`.
 * Returns `null` when it cannot be built (empty, over 255, duplicate or blank ids,
 * blank instructions); the caller then falls back.
 */
export function buildChoiceQuestion({ instructions, candidates } = {}) {
  const text = String(instructions ?? "").trim();
  if (!text || !Array.isArray(candidates)) return null;
  if (candidates.length === 0 || candidates.length > JEV_MAX_CHOICES) return null;
  const criteria = {};
  for (const candidate of candidates) {
    const id = String(candidate?.id ?? "").trim();
    if (!id || Object.hasOwn(criteria, id)) return null;
    criteria[id] = String(candidate?.name ?? id);
  }
  return { type: "choice", instructions: text, criteria };
}

/**
 * Validate a System One response against the cited shape.
 * `questions` is the request's questions object (or just an array of question ids).
 * Returns `{ [id]: answer }` or `null` on any mismatch: missing/extra id, wrong type,
 * a choice that is not one of the question's criteria keys, or bad numbers.
 */
export function parseJevAnswers(json, questions) {
  if (!isRecord(json) || !isRecord(json.answers)) return null;
  const expected = Array.isArray(questions)
    ? Object.fromEntries(questions.map((id) => [String(id), null]))
    : isRecord(questions) ? questions : null;
  if (!expected) return null;
  const ids = Object.keys(expected);
  const got = Object.keys(json.answers);
  if (ids.length === 0 || got.length !== ids.length) return null;

  const answers = {};
  for (const id of ids) {
    const answer = json.answers[id];
    if (!isRecord(answer) || !ANSWER_TYPES.has(answer.type)) return null;
    const asked = expected[id];
    if (isRecord(asked) && asked.type !== answer.type) return null;

    if (answer.type === "choice") {
      if (typeof answer.choice !== "string" || !answer.choice) return null;
      if (!isUnit(answer.confidence) || !isRecord(answer.probabilities)) return null;
      if (isRecord(asked?.criteria) && !Object.hasOwn(asked.criteria, answer.choice)) return null;
      answers[id] = {
        type: "choice",
        choice: answer.choice,
        confidence: answer.confidence,
        probabilities: answer.probabilities
      };
    } else if (answer.type === "score") {
      if (typeof answer.score !== "number" || !Number.isFinite(answer.score)) return null;
      if (!isUnit(answer.confidence) || !isRecord(answer.legend) || !isRecord(answer.probabilities)) return null;
      answers[id] = {
        type: "score",
        score: answer.score,
        confidence: answer.confidence,
        legend: answer.legend,
        probabilities: answer.probabilities
      };
    } else {
      if (typeof answer.noul !== "number" || !Number.isFinite(answer.noul)) return null;
      answers[id] = { type: "noul", noul: answer.noul };
    }
  }
  return answers;
}

/**
 * POST one System One request and say why it failed. Resolves
 * `{ ok: true, answers, usage, model, ms }` or `{ ok: false, reason, status?, ms }`,
 * where `reason` is "nokey", "unusable" (no fetch or no questions), "http", "shape",
 * "timeout", "cancelled" or "network"
 * (a browser reports a CORS refusal as a plain network error). Never throws and
 * never logs the key. Aborts after `timeoutMs` or when `signal` aborts.
 */
export async function callJev({
  endpoint = JEV_ENDPOINT,
  model = JEV_MODEL,
  apiKey,
  state,
  questions,
  signal,
  timeoutMs = JEV_TIMEOUT_MS,
  fetchImpl = globalThis.fetch
} = {}) {
  const started = Date.now();
  const fail = (reason, extra = {}) => ({ ok: false, reason, ms: Date.now() - started, ...extra });
  const key = String(apiKey ?? "").trim();
  if (!key) return fail("nokey");
  if (typeof fetchImpl !== "function" || !isRecord(questions) || !Object.keys(questions).length) return fail("unusable");
  if (signal?.aborted) return fail("cancelled");
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  signal?.addEventListener?.("abort", onAbort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, state, questions }),
      signal: controller.signal
    });
    if (!response?.ok) return fail("http", { status: response?.status ?? 0 });
    const json = await response.json();
    const answers = parseJevAnswers(json, questions);
    if (!answers) return fail("shape");
    return {
      ok: true,
      answers,
      usage: isRecord(json.usage) ? json.usage : null,
      model: typeof json.model === "string" ? json.model : model,
      ms: Date.now() - started
    };
  } catch {
    if (controller.signal.aborted) return fail(timedOut ? "timeout" : "cancelled");
    return fail("network");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}

/**
 * POST one System One request. Resolves `{ answers, usage, model, ms }` or `null`;
 * never throws and never logs the key. Aborts after JEV_TIMEOUT_MS or when `signal` aborts.
 */
export async function requestJevDecision(options = {}) {
  const result = await callJev(options);
  if (result.ok) {
    const { ok: _ok, ...rest } = result;
    return rest;
  }
  if (result.reason === "http") {
    console.warn(`simplysf2e | Jev request failed (HTTP ${result.status || "?"}); using the chat model.`);
  } else if (result.reason === "shape") {
    console.warn("simplysf2e | Jev response had an unexpected shape; using the chat model.");
  } else if (result.reason === "timeout" || result.reason === "cancelled" || result.reason === "network") {
    console.warn(`simplysf2e | Jev request ${result.reason === "network" ? "errored" : "timed out or was cancelled"}; using the chat model.`);
  }
  return null;
}

/** The fixed one-question probe the Test Jev button sends. */
export const JEV_TEST_STATE = "Connection test from the simplySF2e Foundry module.";
export const JEV_TEST_QUESTIONS = Object.freeze({
  ping: Object.freeze({
    type: "choice",
    instructions: "Which word names a color?",
    criteria: Object.freeze({ red: "red", table: "table" })
  })
});

/**
 * Test the Jev route that generation would use right now. Resolves
 * `{ ok, source, reason?, status?, ms, model? }`; `reason` "unconfigured" means no
 * key at all. Uses the longer `timeoutMs` because a first call can be slow.
 */
export async function testJevConnection({ config = resolveJevConfig(), fetchImpl = globalThis.fetch, timeoutMs = 15000, signal } = {}) {
  if (!config) return { ok: false, source: null, reason: "unconfigured", ms: 0 };
  const result = await callJev({
    ...config, state: JEV_TEST_STATE, questions: JEV_TEST_QUESTIONS, fetchImpl, timeoutMs, signal
  });
  return { ...result, source: config.source ?? "openrouter", endpoint: config.endpoint };
}
