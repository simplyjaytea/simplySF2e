// Provider/model matrix: run every task against every configured model and
// report pass rate per task per model. MANUAL tool — it needs a live key, does
// not run in CI, and is never included in the release zip.
//
//   node tools/model-matrix/matrix.mjs --config my-config.json [--task <id>] [--runs N] [--out out]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { SETTINGS } from "../../scripts/settings.mjs";
import { renderMatrix, requireApiKey, summarizeRuns, validateConfig } from "./report.mjs";
import { runMatrix } from "./runner.mjs";
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

const allRuns = await runMatrix({
  cfg,
  tasks,
  runs,
  ai,
  env: process.env,
  setModel: (id) => {
    settings.set(SETTINGS.model, id);
    console.log(`model: ${id}`);
  },
  onRun: (run) => {
    if (!run.ok) console.log(`  ${run.task} #${run.run + 1}: FAIL ${run.errorKey}`);
  }
});

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

for (const [task, info] of Object.entries(summary)) {
  for (const [model, row] of Object.entries(info.models)) {
    console.log(`  ${task} ${model}: ${row.pass}/${row.runs}`);
  }
}

const failures = allRuns.filter((run) => !run.ok).length;
const crashes = allRuns.filter((run) => run.crash).length;
console.log(`done: ${allRuns.length} runs, ${failures} failed, ${crashes} crashed`);
console.log(`reports: ${args.out}/matrix.json and ${args.out}/MATRIX.md`);
// A crash is a harness bug (bad task shape, a production TypeError), not a model
// result; make a scripted run notice it.
process.exitCode = crashes ? 1 : 0;
