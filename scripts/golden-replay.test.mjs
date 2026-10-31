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
  assert.equal(JSON.stringify(r1.result), JSON.stringify(r2.result), `${fx.id}: non-deterministic`);
  for (const u of r1.requests.urls) {
    assert.ok(u.startsWith("http://localhost") && u.includes("/chat/completions"), `${fx.id}: bad url ${u}`);
  }
  const ok = r1.error == null;
  assert.equal(ok, fx.expect.ok, `${fx.id}: ok mismatch`);
  assert.equal(r1.requests.urls.length, fx.expect.requestCount, `${fx.id}: requestCount`);
  if (fx.expect.errorKey) {
    assert.ok(r1.error && String(r1.error.message).includes(fx.expect.errorKey), `${fx.id}: errorKey`);
  }
  // content assertion: result carries expected ids if present
  if (fx.expect.ok && fx.expect.picked) {
    for (const id of fx.expect.picked) {
      const s = JSON.stringify(r1.result);
      assert.ok(s.includes(id), `${fx.id}: missing ${id}`);
    }
  }
  // prompt text in body
  const bodyStr = JSON.stringify(r1.requests.bodies);
  if (fx.args && fx.args.prompt) assert.ok(bodyStr.includes(fx.args.prompt), `${fx.id}: prompt not in body`);
  pass++;
  console.log(`PASS ${fx.id}`);
}
// forged candidate check
console.log(`PASS ${pass}/${files.length}`);