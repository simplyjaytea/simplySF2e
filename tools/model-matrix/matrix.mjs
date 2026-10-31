// Provider/model matrix: run every task against every configured model and
// report pass rate per task per model. MANUAL tool — it needs a live key, does
// not run in CI, and is never included in the release zip.
//
//   node tools/model-matrix/matrix.mjs --config my-config.json [--task <id>] [--runs N] [--out out]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { SETTINGS } from "../../scripts/settings.mjs";
import { validateConfig, summarizeRuns, renderMatrix, requireApiKey, errorKeyFor } from "./report.mjs";
import { TASKS } from "./tasks.mjs";

function parseArgs(argv) {
  const out = { runs: null, task: null, out: "out", config: null };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--config") out.config = argv[++i];
    else if (flag === "--task") out.task = argv[++i];
    else if (flag === "--runs") out.runs = Number(argv[++i]);
    else if (flag === "--out") out.out = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.config) {
  console.error("usage: node tools/model-matrix/matrix.mjs --config <path> [--task <id>] [--runs N] [--out <dir>]");
  process.exit(1);
}

let cfg;
try {
  cfg = JSON.parse(readFileSync(args.config, "utf8"));
} catch (err) {
  console.error(`could not read ${args.config}: ${err?.message ?? err}`);
  process.exit(1);
}
try {
  validateConfig(cfg);
} catch (err) {
  console.error(`invalid config: ${err.message}`);
  process.exit(1);
}

let apiKey;
try {
  apiKey = requireApiKey(process.env, cfg.apiKeyEnv);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const tasks = args.task ? [args.task] : cfg.tasks;
for (const task of tasks) {
  if (!TASKS[task]) {
    console.error(`unknown task ${task}; known: ${Object.keys(TASKS).join(", ")}`);
    process.exit(1);
  }
}
const runs = Number.isInteger(args.runs) ? args.runs : (cfg.runs ?? 1);

// One fake settings map for the whole process; the model changes per loop.
const settings = new Map([
  [SETTINGS.apiBaseUrl, cfg.baseUrl],
  [SETTINGS.apiKey, apiKey],
  [SETTINGS.apiKeyBaseUrl, cfg.baseUrl],
  [SETTINGS.model, ""],
  [SETTINGS.temperature, 0.8],
  [SETTINGS.maxTokens, 8000],
  [SETTINGS.requestTimeout, 120],
  [SETTINGS.runTokenBudget, 0],
  [SETTINGS.runDeadline, 0]
]);
globalThis.game = {
  settings: { get: (_moduleId, key) => settings.get(key) },
  i18n: { localize: (key) => key, format: (key) => key }
};

const ai = await import("../../scripts/ai.mjs");
const allRuns = [];

for (const model of cfg.models) {
  settings.set(SETTINGS.model, model.id);
  console.log(`model: ${model.id}`);
  for (const task of tasks) {
    const definition = TASKS[task];
    let passes = 0;
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
        // usage to the error, and a cost table that hides it lies.
        const isAiError = err instanceof ai.AIRequestError;
        crash = !isAiError;
        errorKey = errorKeyFor(err, { isAiError });
        usage = isAiError ? (err.usage ?? null) : null;
      }
      if (ok) passes += 1;
      allRuns.push({ model: model.id, task, run, ok, errorKey, crash, ms: Date.now() - startedAt, usage });
    }
    console.log(`  ${task}: ${passes}/${runs}`);
  }
}

mkdirSync(args.out, { recursive: true });
writeFileSync(`${args.out}/matrix.json`, `${JSON.stringify(allRuns, null, 2)}\n`);
const summary = summarizeRuns(allRuns);
const markdown = renderMatrix(summary, {
  configPath: args.config,
  utc: new Date().toISOString(),
  runs,
  pricePerMTok: cfg.pricePerMTok
});
writeFileSync(`${args.out}/MATRIX.md`, markdown);

const failures = allRuns.filter((run) => !run.ok).length;
const crashes = allRuns.filter((run) => run.crash).length;
console.log(`done: ${allRuns.length} runs, ${failures} failed, ${crashes} crashed`);
console.log(`reports: ${args.out}/matrix.json and ${args.out}/MATRIX.md`);
// A crash is a harness bug (bad task shape, a production TypeError), not a model
// result; make a scripted run notice it.
process.exitCode = crashes ? 1 : 0;
