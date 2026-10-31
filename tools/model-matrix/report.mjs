// Pure aggregation and rendering for the provider/model matrix. No network, no
// Foundry: the runner hands in recorded runs, the test hands in synthetic ones.

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/**
 * One row per task per model. Token averages keep the prompt/completion split so
 * cost can be priced per side; `usage.total` alone cannot.
 * @param {{model: string, task: string, ok: boolean, errorKey?: string|null, ms: number, usage?: object|null}[]} runs
 */
export function summarizeRuns(runs) {
  const byTask = {};
  for (const run of Array.isArray(runs) ? runs : []) {
    if (!run?.task || !run?.model) continue;
    ((byTask[run.task] ??= {})[run.model] ??= []).push(run);
  }
  const summary = {};
  for (const [task, models] of Object.entries(byTask)) {
    const rows = {};
    for (const [model, rs] of Object.entries(models)) {
      const passes = rs.filter((r) => r.ok).length;
      const failKeys = {};
      for (const r of rs) {
        if (r.ok || !r.errorKey) continue;
        // Never carry provider text into a report: a module error key or the
        // harness's own "crash" marker survives, anything else is redacted.
        const raw = String(r.errorKey);
        const key = raw === "crash"
          ? "crash"
          : raw.startsWith("SIMPLYSF2E.Errors.") ? raw : "redacted";
        failKeys[key] = (failKeys[key] ?? 0) + 1;
      }
      rows[model] = {
        runs: rs.length,
        pass: passes,
        fail: rs.length - passes,
        failKeys,
        medianMs: median(rs.map((r) => Number(r.ms) || 0)),
        avgTokens: mean(rs.map((r) => Number(r.usage?.total) || 0)),
        avgPrompt: mean(rs.map((r) => Number(r.usage?.prompt) || 0)),
        avgCompletion: mean(rs.map((r) => Number(r.usage?.completion) || 0))
      };
    }
    summary[task] = { models: rows };
  }
  return summary;
}

/**
 * Estimated cost of one run, from the provider's own prompt/completion counts and
 * a USD-per-million-token price. Null when the model has no price entry; never
 * guesses a price.
 */
export function estimateRunCost(row, price) {
  if (!price || typeof price.input !== "number" || typeof price.output !== "number") return null;
  return (row.avgPrompt / 1e6) * price.input + (row.avgCompletion / 1e6) * price.output;
}

/** Markdown table with one row per model under each task heading. */
export function renderMatrix(summary, meta = {}) {
  const price = meta.pricePerMTok ?? {};
  const lines = [
    "# Model matrix",
    "",
    `Config: ${meta.configPath ?? "(unknown)"}`,
    `UTC: ${meta.utc ?? "(unknown)"}`,
    `Runs per model per task: ${meta.runs ?? "?"}`,
    "",
    "Pass means the production function returned without throwing; it validates its own shape."
  ];
  for (const [task, info] of Object.entries(summary)) {
    lines.push("", `## ${task}`, "", "| model | runs | pass | fail | fail keys | median ms | avg tokens | est. cost/run |");
    lines.push("|---|---|---|---|---|---|---|---|");
    for (const [model, row] of Object.entries(info.models)) {
      const cost = estimateRunCost(row, price[model]);
      lines.push([
        `| ${model}`,
        row.runs,
        row.pass,
        row.fail,
        Object.entries(row.failKeys).map(([key, n]) => `${key} x${n}`).join(", "),
        Math.round(row.medianMs),
        row.avgTokens.toFixed(0),
        cost == null ? "n/a" : `$${cost.toFixed(6)}`
      ].join(" | ") + " |");
    }
  }
  return `${lines.join("\n")}\n`;
}

/**
 * The one place a failure is classified for the report. `crash` means the
 * harness itself broke (not an AIRequestError); a module error key is kept, and
 * any other message is dropped so provider text cannot reach an artifact.
 */
export function errorKeyFor(error, { isAiError = false } = {}) {
  if (!isAiError) return "crash";
  const message = String(error?.message ?? "");
  return message.match(/SIMPLYSF2E\.Errors\.\w+/)?.[0] ?? "SIMPLYSF2E.Errors.Unknown";
}

/** The API key from the configured env var; throws before any request if unset. */
export function requireApiKey(env, apiKeyEnv) {
  const key = apiKeyEnv && env ? env[apiKeyEnv] : "";
  if (!key) throw new Error(`API key env var ${apiKeyEnv} is unset or empty; nothing was requested`);
  return key;
}

/** Reject a config that would silently produce a meaningless matrix. */export function validateConfig(cfg) {
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) throw new Error("config must be an object");
  if (typeof cfg.baseUrl !== "string" || !cfg.baseUrl.trim()) throw new Error("missing baseUrl");
  if (typeof cfg.apiKeyEnv !== "string" || !cfg.apiKeyEnv.trim()) throw new Error("missing apiKeyEnv");
  if (!Array.isArray(cfg.models) || cfg.models.length === 0) throw new Error("models must be a non-empty array");
  for (const model of cfg.models) {
    if (typeof model?.id !== "string" || !model.id.trim()) throw new Error("every model needs a non-empty id");
  }
  if (!Array.isArray(cfg.tasks) || cfg.tasks.length === 0) throw new Error("tasks must be a non-empty array");
  for (const task of cfg.tasks) {
    if (typeof task !== "string" || !task.trim()) throw new Error("every task must be a non-empty string");
  }
  if (cfg.runs != null && (!Number.isInteger(cfg.runs) || cfg.runs < 1)) throw new Error("runs must be a positive integer");
  if (cfg.pricePerMTok != null) {
    if (typeof cfg.pricePerMTok !== "object" || Array.isArray(cfg.pricePerMTok)) throw new Error("pricePerMTok must be an object");
    for (const [model, price] of Object.entries(cfg.pricePerMTok)) {
      if (typeof price?.input !== "number" || typeof price?.output !== "number") {
        throw new Error(`pricePerMTok.${model} needs numeric input and output`);
      }
    }
  }
  return true;
}
