// Provider/model matrix: pure reporting, config validation, and an offline proof
// that every task entry is invocable with the real production signature.
// No network: the provider is stubbed. Run: node scripts/model-matrix.test.mjs
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";
import {
  errorKeyFor, estimateRunCost, renderMatrix, requireApiKey, summarizeRuns, validateConfig
} from "../tools/model-matrix/report.mjs";
import { TASKS } from "../tools/model-matrix/tasks.mjs";

// --- Aggregation is per task AND per model --------------------------------
const runs = [
  { model: "m1", task: "t", run: 0, ok: true, ms: 10, usage: { prompt: 100, completion: 20, total: 120 } },
  { model: "m1", task: "t", run: 1, ok: false, errorKey: "SIMPLYSF2E.Errors.BadStructure", ms: 30, usage: { prompt: 100, completion: 0, total: 100 } },
  { model: "m1", task: "t", run: 2, ok: true, ms: 20, usage: { prompt: 100, completion: 40, total: 140 } },
  { model: "m2", task: "t", run: 0, ok: false, errorKey: "SIMPLYSF2E.Errors.RunDeadline", ms: 50, usage: null },
  { model: "m2", task: "t", run: 1, ok: true, ms: 40, usage: { prompt: 200, completion: 30, total: 230 } }
];
const summary = summarizeRuns(runs);
assert.deepEqual(Object.keys(summary), ["t"]);
assert.deepEqual(Object.keys(summary.t.models).sort(), ["m1", "m2"], "a row per model, not one aggregate row");
assert.equal(summary.t.models.m1.runs, 3);
assert.equal(summary.t.models.m1.pass, 2);
assert.equal(summary.t.models.m1.fail, 1);
assert.deepEqual(summary.t.models.m1.failKeys, { "SIMPLYSF2E.Errors.BadStructure": 1 });
assert.equal(summary.t.models.m1.medianMs, 20, "odd count median is the middle value");
assert.equal(summary.t.models.m2.medianMs, 45, "even count median averages the two middles");
assert.equal(summary.t.models.m1.avgTokens, (120 + 100 + 140) / 3);
assert.equal(summary.t.models.m1.avgPrompt, 100);
assert.equal(summary.t.models.m1.avgCompletion, 20);

// A run missing its model/task cannot silently land in a row.
assert.deepEqual(summarizeRuns([{ task: "t", ok: true }, { model: "m", ok: true }, null]), {});
assert.deepEqual(summarizeRuns([]), {});
assert.deepEqual(summarizeRuns(undefined), {});

// --- Rendering: per-model rows, cost from the prompt/completion split ------
const meta = { configPath: "cfg.json", utc: "2026-11-01T00:00:00Z", runs: 3, pricePerMTok: { m1: { input: 10, output: 30 } } };
const md = renderMatrix(summary, meta);
assert.match(md, /\| m1 \| 3 \| 2 \| 1 \|/, "m1 has its own row");
assert.match(md, /\| m2 \| 2 \| 1 \| 1 \|/, "m2 has its own row");
assert.ok(!md.includes("| (all) |"), "no aggregate row replaces the per-model rows");
// 100 prompt @ $10/M + 20 completion @ $30/M. The old (input+output)/2 x total
// formula would give 0.0024, so this also guards the pricing split.
assert.equal(estimateRunCost(summary.t.models.m1, { input: 10, output: 30 }), 0.0016);
const costLine = md.split("\n").find((line) => line.startsWith("| m1 "));
assert.ok(costLine.includes("$0.001600"), `cost uses prompt and completion prices separately: ${costLine}`);
const m2Line = md.split("\n").find((line) => line.startsWith("| m2 "));
assert.ok(m2Line.includes("n/a"), "a model with no price entry reports n/a, never a guess");
assert.equal(estimateRunCost(summary.t.models.m1, null), null);
assert.equal(estimateRunCost(summary.t.models.m1, { input: 1 }), null);

// A provider string that is not a module error key never reaches the report.
const fakeKey = "sk-live-SECRETKEY123";
const redacted = renderMatrix(summarizeRuns([{ model: "m", task: "t", ok: false, errorKey: fakeKey, ms: 1 }]), { configPath: "c", utc: "u", runs: 1 });
assert.ok(!redacted.includes(fakeKey), "the raw provider text must not be rendered");
assert.ok(redacted.includes("redacted"), "an unknown failure is labelled redacted");
// A harness crash must stay visible: it is a bug in the tool, not provider text.
const crashMd = renderMatrix(summarizeRuns([{ model: "m", task: "t", ok: false, errorKey: "crash", ms: 1 }]), { configPath: "c", utc: "u", runs: 1 });
assert.ok(crashMd.includes("crash"), "a crash is reported as crash, not folded into redacted");

// The classification helpers are importable, so deleting either guard fails here.
assert.equal(requireApiKey({ KEY: "abc" }, "KEY"), "abc");
assert.throws(() => requireApiKey({}, "KEY"), /unset or empty/);
assert.throws(() => requireApiKey({ KEY: "" }, "KEY"), /unset or empty/);
assert.equal(errorKeyFor(new Error("wrapped SIMPLYSF2E.Errors.BadStructure detail"), { isAiError: true }), "SIMPLYSF2E.Errors.BadStructure");
assert.equal(errorKeyFor(new Error("403 for key sk-SECRET"), { isAiError: true }), "SIMPLYSF2E.Errors.Unknown", "provider text never becomes a key");
assert.equal(errorKeyFor(new TypeError("boom"), { isAiError: false }), "crash");

// --- Config validation -----------------------------------------------------
const base = { baseUrl: "https://example.test/v1", apiKeyEnv: "KEY", models: [{ id: "m" }], tasks: ["t"] };
assert.equal(validateConfig(base), true);
assert.throws(() => validateConfig({ ...base, models: [] }), /models/);
assert.throws(() => validateConfig({ ...base, models: [{}] }), /non-empty id/);
assert.throws(() => validateConfig({ ...base, tasks: [] }), /tasks/);
assert.throws(() => validateConfig({ ...base, tasks: [""] }), /non-empty string/);
assert.throws(() => validateConfig({ ...base, baseUrl: "" }), /baseUrl/);
assert.throws(() => validateConfig({ ...base, apiKeyEnv: "" }), /apiKeyEnv/);
assert.throws(() => validateConfig({ ...base, runs: 0 }), /positive integer/);
assert.throws(() => validateConfig({ ...base, pricePerMTok: { m: { input: 1 } } }), /numeric input and output/);
assert.throws(() => validateConfig([]), /object/);

// --- Every task entry matches its production signature --------------------
// A wrong argument shape throws a TypeError before any provider request; a
// missing keys/bad shape throws AIRequestError. Only the latter is a pass here.
const settings = new Map([
  [SETTINGS.apiBaseUrl, "https://example.test/v1"],
  [SETTINGS.apiKey, ""],
  [SETTINGS.apiKeyBaseUrl, ""],
  [SETTINGS.model, "test-model"],
  [SETTINGS.temperature, 0.8],
  [SETTINGS.maxTokens, 8000],
  [SETTINGS.requestTimeout, 90]
]);
globalThis.game = {
  settings: { get: (_moduleId, key) => settings.get(key) },
  i18n: { localize: (key) => key, format: (key) => key }
};
let requests = 0;
const requestedUrls = [];
globalThis.fetch = async (url) => {
  requests += 1;
  requestedUrls.push(String(url));
  return new Response(JSON.stringify({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }], usage: {} }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
};

const ai = await import("./ai.mjs");
const { SHOP_CATEGORIES } = await import("./shop.mjs");

// Task values must match the real production enums, not just avoid a TypeError:
// an invalid availableKinds silently empties the effect schema, and a category
// slug the module does not know would make every model look bad.
assert.deepEqual(TASKS.shopConcept.args.categories, Object.keys(SHOP_CATEGORIES));
assert.deepEqual(TASKS.treasureConcept.args.categories, Object.keys(SHOP_CATEGORIES));
assert.ok(TASKS.magicItemConcept.args.availableKinds.length > 0);
for (const kind of TASKS.magicItemConcept.args.availableKinds) {
  assert.ok(Object.hasOwn(ai.ITEM_EFFECT_DOCS, kind), `availableKinds "${kind}" must be an ITEM_EFFECT_DOCS key`);
}
assert.ok(TASKS.magicItemConcept.args.usageOptions.length > 0);
assert.ok(TASKS.magicItemConcept.args.usageOptions.every((usage) => typeof usage === "string" && usage));
assert.equal(TASKS.magicItemConcept.args.kind, "wondrous");
for (const slot of TASKS.encounterDesign.args.slots) {
  assert.equal(typeof slot.level, "number");
  assert.equal(typeof slot.count, "number");
  assert.equal(typeof slot.role, "string");
}
for (const task of Object.values(TASKS)) {
  assert.equal(typeof task.fn, "string");
  assert.equal(typeof task.args, "object");
}

for (const [id, task] of Object.entries(TASKS)) {
  const before = requests;
  let error = null;
  try {
    await ai[task.fn](structuredClone(task.args));
  } catch (err) {
    error = err;
  }
  assert.ok(!(error instanceof TypeError), `${id}: args do not match ${task.fn} (TypeError: ${error?.message})`);
  assert.ok(error instanceof ai.AIRequestError, `${id}: expected the shape check to reject "{}", got ${error ?? "no error"}`);
  assert.ok(requests > before, `${id}: no provider request was made, so the task never reached the pipeline`);
}
assert.ok(requestedUrls.every((url) => url === "https://example.test/v1/chat/completions"), "the matrix must hit the configured chat path");

console.log("model-matrix.test.mjs passed");
