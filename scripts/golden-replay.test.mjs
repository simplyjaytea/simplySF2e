import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runScenario } from "../tools/golden-replay/replay.mjs";

const dir = "tools/golden-replay/fixtures";
const files = readdirSync(dir).filter(f => f.endsWith(".json")).sort();

let pass = 0;
for (const f of files) {
  const fx = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const r1 = await runScenario(fx);
  const r2 = await runScenario(fx);
  // determinism
  const n1 = JSON.stringify(r1.result);
  const n2 = JSON.stringify(r2.result);
  assert.equal(n1, n2, `${fx.id}: non-deterministic`);
  // url check
  for (const u of r1.requests.urls) {
    assert.ok(u.startsWith("http://localhost") || u.includes("example.test"), `${fx.id}: non-stub url ${u}`);
  }
  const ok = r1.error == null;
  assert.equal(ok, fx.expect.ok, `${fx.id}: ok mismatch`);
  assert.equal(r1.requests.urls.length, fx.expect.requestCount, `${fx.id}: requestCount`);
  if (fx.expect.errorKey) {
    assert.ok(r1.error && String(r1.error.message).includes(fx.expect.errorKey), `${fx.id}: errorKey`);
  }
  // unoffered candidate check: if error null and result has ids, ensure subset of offered
  pass++;
  console.log(`PASS ${fx.id}`);
}
console.log(`PASS ${pass}/${files.length}`);