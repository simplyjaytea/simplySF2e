// The matrix run loop, separated from the CLI so it can be tested offline.
// It never touches the network directly: `ai` is the production module (or a
// stub in tests) and `setModel` points the fake settings at one model.
import { errorKeyFor, requireApiKey } from "./report.mjs";
import { TASKS } from "./tasks.mjs";

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
export async function runMatrix({ cfg, tasks, runs = 1, ai, env = process.env, setModel, onRun } = {}) {
  requireApiKey(env, cfg?.apiKeyEnv);
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
