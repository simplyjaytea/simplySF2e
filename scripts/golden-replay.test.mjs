// Golden replay gate: every fixture under tools/golden-replay/fixtures is replayed
// through the PRODUCTION AI pipeline against a scripted provider. Offline: no API
// key, no network, no Foundry. Adding a fixture file is enough to add coverage.
// Run: node scripts/golden-replay.test.mjs
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runScenario } from "../tools/golden-replay/replay.mjs";

const FIXTURE_DIR = fileURLToPath(new URL("../tools/golden-replay/fixtures/", import.meta.url));
const BASE_URL = "http://localhost:11434/v1";
// Result keys that carry grounded picks; `nothingPicked` asserts all of them stay empty.
const PICK_KEYS = ["abilities", "feats", "equipment", "spells", "loot", "picks"];

const files = readdirSync(FIXTURE_DIR).filter((name) => name.endsWith(".json")).sort();
assert.ok(files.length > 0, "golden-replay: no fixtures found");

const asJson = (value) => JSON.stringify(value ?? null);
// Timing is wall-clock and therefore not reproducible; drop `ms` keys before
// comparing a result with itself. Every other field must match exactly.
const stableJson = (value) => JSON.stringify(value ?? null, (key, item) => (key === "ms" ? undefined : item));
// `lengths` keys may be dotted paths: generateConcept returns {concept, usage}.
const getPath = (value, path) => path.split(".").reduce((node, key) => node?.[key], value);
const seenIds = new Set();
let passed = 0;

for (const file of files) {
  const fixture = JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8"));
  const id = fixture.id ?? file;
  assert.ok(!seenIds.has(id), `${file}: duplicate fixture id ${id}`);
  seenIds.add(id);
  assert.ok(fixture.task, `${id}: fixture has no task`);
  assert.ok(fixture.expect, `${id}: fixture has no expect block`);

  const first = await runScenario(fixture);
  const second = await runScenario(fixture);
  assert.equal(stableJson(first.result), stableJson(second.result), `${id}: replay is not deterministic`);

  // Offline guarantee: every request went to the stubbed endpoint's chat path.
  for (const url of first.requests.urls) {
    assert.ok(
      String(url).startsWith(`${BASE_URL}/chat/completions`),
      `${id}: unexpected request ${url}`
    );
  }

  const expect = fixture.expect;
  assert.equal(
    first.error == null,
    Boolean(expect.ok),
    `${id}: ok mismatch (${first.error?.message ?? "no error thrown"})`
  );
  if (typeof expect.requestCount === "number") {
    assert.equal(first.requests.urls.length, expect.requestCount, `${id}: provider request count`);
  }
  if (expect.errorKey) {
    assert.ok(first.error, `${id}: expected a fail-closed error`);
    assert.ok(
      String(first.error.message).includes(expect.errorKey),
      `${id}: expected ${expect.errorKey}, got ${first.error.message}`
    );
  }

  if (expect.ok) {
    const text = asJson(first.result);
    for (const fragment of expect.contains ?? []) {
      assert.ok(text.includes(fragment), `${id}: result is missing "${fragment}"`);
    }
    for (const fragment of expect.excludes ?? []) {
      assert.ok(!text.includes(fragment), `${id}: result must not contain "${fragment}"`);
    }
    for (const [key, length] of Object.entries(expect.lengths ?? {})) {
      assert.equal(getPath(first.result, key)?.length, length, `${id}: ${key} length`);
    }
    if (expect.nothingPicked) {
      for (const key of PICK_KEYS) {
        const value = first.result?.[key];
        if (Array.isArray(value)) {
          assert.equal(value.length, 0, `${id}: ${key} must stay empty, not be invented`);
        }
      }
    }
  }

  // The scenario really ran: its own prompt or catalog reached the provider.
  const bodyText = asJson(first.requests.bodies);
  for (const fragment of expect.bodyContains ?? []) {
    assert.ok(bodyText.includes(fragment), `${id}: request body is missing "${fragment}"`);
  }

  passed += 1;
  console.log(`PASS ${id}`);
}

console.log(`PASS ${passed}/${files.length}`);
