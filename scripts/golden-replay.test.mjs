// Golden replay gate: every fixture under tools/golden-replay/fixtures is replayed
// through the PRODUCTION pipeline against a scripted provider. Offline: no API key,
// no network, no Foundry. Adding a fixture file is enough to add coverage.
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
// `lengths` / `equals` keys may be dotted paths: generateConcept returns {concept, usage}.
const getPath = (value, path) => path.split(".").reduce((node, key) => node?.[key], value);

const providerReply = (content, finishReason = "stop", total = 900) => ({
  choices: [{ message: { content }, finish_reason: finishReason }],
  usage: { prompt_tokens: 600, completion_tokens: 40, total_tokens: total }
});

// A negative fixture can name a `base` fixture and then patch/remove exactly one
// key. That keeps each case honest — one difference from a payload that is known
// to pass — instead of a hand-written object that trips several checks at once.
const raw = new Map();
for (const file of files) {
  const fixture = JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8"));
  assert.ok(fixture.id, `${file}: fixture has no id`);
  assert.ok(!raw.has(fixture.id), `${file}: duplicate fixture id ${fixture.id}`);
  raw.set(fixture.id, fixture);
}

function resolveFixture(fixture) {
  if (!fixture.base) return fixture;
  const base = raw.get(fixture.base);
  assert.ok(base, `${fixture.id}: unknown base fixture ${fixture.base}`);
  const payload = JSON.parse(base.responses[0].choices[0].message.content);
  for (const key of fixture.remove ?? []) {
    assert.ok(Object.hasOwn(payload, key), `${fixture.id}: base payload has no key ${key}`);
    delete payload[key];
  }
  Object.assign(payload, fixture.patch ?? {});
  const content = JSON.stringify(payload);
  const count = fixture.responses?.length ?? 2;
  return {
    ...fixture,
    responses: Array.from({ length: count }, () => providerReply(content))
  };
}

let passed = 0;
for (const fixture of [...raw.values()]) {
  const scenario = resolveFixture(fixture);
  const id = scenario.id;
  assert.ok(scenario.task, `${id}: fixture has no task`);
  assert.ok(scenario.expect, `${id}: fixture has no expect block`);

  const first = await runScenario(scenario);
  const second = await runScenario(scenario);
  assert.equal(stableJson(first.result), stableJson(second.result), `${id}: replay is not deterministic`);

  // Offline guarantee: every request went to the stubbed endpoint's chat path.
  for (const url of first.requests.urls) {
    assert.ok(
      String(url).startsWith(`${BASE_URL}/chat/completions`),
      `${id}: unexpected request ${url}`
    );
  }

  const expect = scenario.expect;
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
    for (const [path, expected] of Object.entries(expect.equals ?? {})) {
      assert.deepEqual(getPath(first.result, path), expected, `${id}: ${path} mismatch`);
    }
    for (const [path, length] of Object.entries(expect.lengths ?? {})) {
      assert.equal(getPath(first.result, path)?.length, length, `${id}: ${path} length`);
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

console.log(`PASS ${passed}/${raw.size}`);
