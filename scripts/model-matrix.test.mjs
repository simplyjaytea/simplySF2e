import assert from "node:assert/strict";
import { summarizeRuns, renderMatrix, validateConfig } from "../tools/model-matrix/report.mjs";

const runs = [
  { model: "m1", task: "t", run: 0, ok: true, errorKey: null, ms: 10, usage: { total: 5 } },
  { model: "m1", task: "t", run: 1, ok: false, errorKey: "SIMPLYSF2E.Errors.BadStructure", ms: 20, usage: { total: 7 } },
];
const s = summarizeRuns(runs);
assert.equal(s.t.pass, 1);
assert.equal(s.t.fail, 1);
assert.ok(s.t.failKeys["SIMPLYSF2E.Errors.BadStructure"]);
const z = summarizeRuns([]);
assert.deepEqual(z, {});
const md = renderMatrix(s, { configPath: "cfg.json", utc: "now", runs: 2 });
assert.ok(md.includes("m1") || md.includes("t"));
assert.ok(md.includes("1"));

// validateConfig
assert.throws(() => validateConfig({ baseUrl: "x", apiKeyEnv: "Y", models: [], tasks: ["t"] }), /models/);
assert.throws(() => validateConfig({ baseUrl: "x", apiKeyEnv: "Y", models: [], tasks: ["t"] }), /models/);

// redaction
const fakeKey = "SECRETKEY123";
const r2 = [{ model: "m", task: "t", run: 0, ok: false, errorKey: fakeKey, ms: 1, usage: { total: 1 } }];
const md2 = renderMatrix(summarizeRuns(r2), { configPath: "c", utc: "u", runs: 1 });
assert.ok(!md2.includes(fakeKey), "key leaked");

console.log("PASS model-matrix");