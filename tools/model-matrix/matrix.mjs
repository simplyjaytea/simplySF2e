import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { validateConfig } from "./report.mjs";
import { TASKS } from "./tasks.mjs";
import { SETTINGS } from "../../scripts/settings.mjs";

function parseArgs(argv) {
  const out = { runs: null, task: null, out: "out" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config") out.config = argv[++i];
    else if (argv[i] === "--task") out.task = argv[++i];
    else if (argv[i] === "--runs") out.runs = Number(argv[++i]);
    else if (argv[i] === "--out") out.out = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.config) { console.error("missing --config"); process.exit(1); }
const cfg = JSON.parse(readFileSync(args.config, "utf8"));
try { validateConfig(cfg); } catch (e) { console.error(e.message); process.exit(1); }
const key = process.env[cfg.apiKeyEnv];
if (!key) { console.error(`API key env var ${cfg.apiKeyEnv} is unset or empty`); process.exit(1); }

const tasks = args.task ? [args.task] : cfg.tasks;
const runs = args.runs || cfg.runs || 1;

const settingsMap = new Map();
globalThis.game = { settings: { get: (_m, k) => settingsMap.get(k) }, i18n: { localize: x=>x, format: (k,d)=>k } };
settingsMap.set(SETTINGS.apiBaseUrl, cfg.baseUrl);
settingsMap.set(SETTINGS.apiKey, key);
settingsMap.set(SETTINGS.apiKeyBaseUrl, cfg.baseUrl);
settingsMap.set(SETTINGS.model, "");
settingsMap.set(SETTINGS.temperature, 0.8);
settingsMap.set(SETTINGS.maxTokens, 8000);
settingsMap.set(SETTINGS.requestTimeout, 90);

const ai = await import("../../scripts/ai.mjs");

const allRuns = [];
for (const model of cfg.models) {
  settingsMap.set(SETTINGS.model, model.id);
  console.log(`model: ${model.id}`);
  for (const task of tasks) {
    const t = TASKS[task];
    if (!t) { console.error(`unknown task ${task}`); continue; }
    for (let r = 0; r < runs; r++) {
      const start = Date.now();
      let ok = false, errorKey = null, usage = null;
      try {
        const res = await ai[t.fn](t.args);
        ok = true;
        usage = res?.usage || null;
      } catch (e) {
        errorKey = (e?.message || "").match(/SIMPLYSF2E\.Errors\.\w+/)?.[0] || "crash";
      }
      const ms = Date.now() - start;
      const run = { model: model.id, task, run: r, ok, errorKey, ms, usage };
      allRuns.push(run);
    }
  }
}

mkdirSync(args.out, { recursive: true });
writeFileSync(`${args.out}/matrix.json`, JSON.stringify(allRuns, null, 2));
const { summarizeRuns, renderMatrix } = await import("./report.mjs");
const summary = summarizeRuns(allRuns);
const md = renderMatrix(summary, { configPath: args.config, utc: new Date().toISOString(), runs });
writeFileSync(`${args.out}/MATRIX.md`, md);
console.log("done");