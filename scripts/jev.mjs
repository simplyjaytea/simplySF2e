// Jev client: TypeSafe's "System One" decision model, reached through OpenRouter.
// Jev answers typed questions with calibrated probabilities; it never writes text.
// Request/response shapes are cited from:
//   https://openrouter.ai/docs/api/api-reference/systemone/submit-a-system-one-request
//   https://docs.typesafe.ai/introduction/quickstart
// Call sites and UI arrive in later steps (J1b, J2-J5); nothing here calls the network on import.
import { getProviderRequestConfig, getJevRequestConfig } from "./settings.mjs";

/**
 * One fixed endpoint. TypeSafe's own endpoint (api.typesafe.ai) fails the browser
 * CORS preflight, and the pinned model id below is OpenRouter's naming.
 */
export const JEV_ENDPOINT = "https://openrouter.ai/api/v1/systemone";

/** Pinned (not `latest`) so behavior does not drift between Jev releases. */
export const JEV_MODEL = "typesafe/jev-1.13";

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
 * The only gate J2-J5 use. Returns `{ endpoint, apiKey }` or `null` (use the chat LLM).
 * Order: a dedicated Jev key, else the active connection's key when that connection
 * is OpenRouter. Never returns an empty key.
 *
 * Reusing a key bound to `https://openrouter.ai/api/v1` for the sibling `/systemone`
 * path stays inside the binding's intent: same host, same account. The binding exists
 * to stop a key going to a *different* endpoint.
 *
 * `provider` and `dedicated` are injected because Node ESM cannot stub named imports.
 */
export function resolveJevConfig({ provider = getProviderRequestConfig, dedicated = getJevRequestConfig } = {}) {
  try {
    const dedicatedKey = String(dedicated()?.apiKey ?? "").trim();
    if (dedicatedKey) return { endpoint: JEV_ENDPOINT, apiKey: dedicatedKey };
    const state = provider();
    // `apiKey` is already "" unless bound to the exact base URL (settings.mjs); never read raw settings.
    const apiKey = String(state?.apiKey ?? "").trim();
    if (state?.provider?.id === "openrouter" && apiKey) return { endpoint: JEV_ENDPOINT, apiKey };
  } catch {
    // A broken settings read means "Jev unavailable", never an error for the caller.
  }
  return null;
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
 * POST one System One request. Resolves `{ answers, usage, model, ms }` or `null`;
 * never throws and never logs the key. Aborts after JEV_TIMEOUT_MS or when `signal` aborts.
 */
export async function requestJevDecision({
  endpoint = JEV_ENDPOINT,
  apiKey,
  state,
  questions,
  signal,
  timeoutMs = JEV_TIMEOUT_MS,
  fetchImpl = globalThis.fetch
} = {}) {
  const key = String(apiKey ?? "").trim();
  if (!key || typeof fetchImpl !== "function" || !isRecord(questions) || !Object.keys(questions).length) return null;
  const started = Date.now();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal?.aborted) return null;
  signal?.addEventListener?.("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: JEV_MODEL, state, questions }),
      signal: controller.signal
    });
    if (!response?.ok) {
      console.warn(`simplysf2e | Jev request failed (HTTP ${response?.status ?? "?"}); using the chat model.`);
      return null;
    }
    const json = await response.json();
    const answers = parseJevAnswers(json, questions);
    if (!answers) {
      console.warn("simplysf2e | Jev response had an unexpected shape; using the chat model.");
      return null;
    }
    return {
      answers,
      usage: isRecord(json.usage) ? json.usage : null,
      model: typeof json.model === "string" ? json.model : JEV_MODEL,
      ms: Date.now() - started
    };
  } catch {
    console.warn(`simplysf2e | Jev request ${controller.signal.aborted ? "timed out or was cancelled" : "errored"}; using the chat model.`);
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}
