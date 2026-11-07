// The matrix run loop, separated from the CLI so it can be tested offline.
// It never touches the network directly: `ai` is the production module (or a
// stub in tests) and `setModel` points the fake settings at one model.
import { errorKeyFor, requireApiKey } from "./report.mjs";
import { TASKS } from "./tasks.mjs";

/**
 * The API key for this run. Local mode (an Ollama server) takes no key and never
 * reads one, so a local run cannot send a key to the local server.
 * @returns {string} the key, or "" in local mode
 */
export function resolveKey({ local = false, env = process.env, apiKeyEnv } = {}) {
  if (local) return "";
  return requireApiKey(env, apiKeyEnv);
}

/**
 * The installed model ids of a local OpenAI-compatible server (Ollama's /v1/models).
 * Sends no Authorization header. Every failure is a clear message; nothing is guessed.
 * @returns {Promise<string[]>}
 */
export async function discoverLocalModels({ url, fetchImpl = globalThis.fetch } = {}) {
  const base = String(url ?? "").replace(/\/+$/, "");
  if (!base) throw new Error("local mode needs a --local-url");
  let response;
  try {
    response = await fetchImpl(`${base}/models`, { headers: { Accept: "application/json" } });
  } catch (err) {
    throw new Error(`no local server answered at ${base} (${err?.message ?? err}); start it with \`ollama serve\` or check --local-url`);
  }
  if (!response.ok) throw new Error(`local server at ${base} answered HTTP ${response.status}; check --local-url`);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`local server at ${base} did not return JSON from /models`);
  }
  const ids = (Array.isArray(body?.data) ? body.data : []).map((model) => String(model?.id ?? "").trim()).filter(Boolean);
  if (!ids.length) throw new Error(`local server at ${base} lists no models; pull one first (for example \`ollama pull <name>\`)`);
  return [...new Set(ids)];
}

/**
 * Run every task against every model once per requested run.
 *
 * Refuses before the first call when the configured key env var is empty, so a
 * mistyped variable can never produce a matrix of failures that look like model
 * problems.
 *
 * @returns {Promise<{model: string, task: string, run: number, ok: boolean,
 *   errorKey: string|null, crash: boolean, ms: number, usage: object|null}[]>}
 */
export async function runMatrix({ cfg, tasks, runs = 1, ai, env = process.env, local = false, setModel, onRun } = {}) {
  resolveKey({ local, env, apiKeyEnv: cfg?.apiKeyEnv });
  if (!ai) throw new Error("runMatrix: the ai module is required");
  const results = [];
  for (const model of cfg.models) {
    setModel?.(model.id);
    for (const task of tasks) {
      const definition = TASKS[task];
      if (!definition) throw new Error(`unknown task ${task}; known: ${Object.keys(TASKS).join(", ")}`);
      for (let run = 0; run < runs; run++) {
        // A fresh argument object per run: a production call may attach to it.
        const taskArgs = structuredClone(definition.args);
        const startedAt = Date.now();
        let ok = false;
        let errorKey = null;
        let crash = false;
        let usage = null;
        try {
          const result = await ai[definition.fn](taskArgs);
          ok = true;
          usage = result?.usage ?? null;
        } catch (err) {
          // A failed attempt still spent tokens; requestJSON attaches the summed
          // usage to the error, and a cost table that hides it lies. A non-AI
          // error is a harness bug, reported as a crash rather than a redaction.
          const isAiError = err instanceof ai.AIRequestError;
          crash = !isAiError;
          errorKey = errorKeyFor(err, { isAiError });
          usage = isAiError ? (err.usage ?? null) : null;
        }
        const record = { model: model.id, task, run, ok, errorKey, crash, ms: Date.now() - startedAt, usage };
        results.push(record);
        onRun?.(record);
      }
    }
  }
  return results;
}
