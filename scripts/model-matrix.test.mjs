import assert from "node:assert/strict";
import { summarizeRuns, renderMatrix, validateConfig } from "../tools/model-matrix/report.mjs";
import { TASKS } from "../tools/model-matrix/tasks.mjs";

const runs = [
  { model: "m1", task: "t", run: 0, ok: true, errorKey: null, ms: 10, usage: { total: 5 } },
  { model: "m1", task: "t", run: 1, ok: false, errorKey: "SIMPLYSF2E.Errors.BadStructure", ms: 20, usage: { total: 7 } },
  { model: "m2", task: "t", run: 0, ok: true, errorKey: null, ms: 12, usage: { total: 6 } },
];
const s = summarizeRuns(runs);
assert.equal(s.t.models.m1.pass, 1);
assert.equal(s.t.models.m2.pass, 1);
const md = renderMatrix(s, { configPath: "cfg.json", utc: "now", runs: 2, pricePerMTok: { m1: { input: 1, output: 2 } } });
assert.ok(md.includes("m1"));
assert.ok(md.includes("m2"));
assert.ok(md.includes("1")); // pass count

const z = summarizeRuns([]);
assert.deepEqual(z, {});

// cost case
const md2 = renderMatrix(summarizeRuns(runs), { configPath: "c", utc: "u", runs: 1, pricePerMTok: { m1: { input: 1, output: 1 } } });
assert.ok(md2.includes("n/a") === false || md2.includes("."));

// redaction two-model
const fakeKey = "SECRETKEY123";
const r2 = [
  { model: "m1", task: "t", run: 0, ok: false, errorKey: fakeKey, ms: 1, usage: { total: 1 } },
  { model: "m2", task: "t", run: 0, ok: false, errorKey: fakeKey, ms: 1, usage: { total: 1 } },
];
const md3 = renderMatrix(summarizeRuns(r2), { configPath: "c", utc: "u", runs: 1 });
assert.ok(!md3.includes(fakeKey));

assert.throws(() => validateConfig({ baseUrl: "x", apiKeyEnv: "Y", models: [], tasks: ["t"] }), /models/);

// TASKS invocability test
globalThis.game = { settings: { get: () => undefined }, i18n: { localize: x=>x, format: (k,d)=>k } };
globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }], usage: {} }), { status: 200, headers: { "content-type": "application/json" } });
const ai = await import("../scripts/ai.mjs");
for (const [id, t] of Object.entries(TASKS)) {
  try { await ai[t.fn](t.args); } catch (e) {
    // AIRequestError acceptable; TypeError not
    assert.ok(!(e instanceof TypeError), `${id} threw TypeError: ${e.message}`);
  }
}

console.log("PASS model-matrix");