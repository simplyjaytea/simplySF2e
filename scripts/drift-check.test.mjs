// sf2e drift check: pure comparison logic. Offline; the live fetch is manual
// (tools/drift-check.mjs) so CI never depends on GitHub raw availability here.
// Run: node scripts/drift-check.test.mjs
import assert from "node:assert/strict";
import { comparePacks, expectedPackIds, formatReport } from "../tools/drift-check.mjs";

const manifest = (names, version = "1.6.1") => ({
  version,
  packs: names.map((name) => ({ name, type: "Item", path: `packs/sf2e/${name}` }))
});

// The module's own list is derived from DEFAULT_PACKS and uses collection ids.
const expected = expectedPackIds();
assert.ok(expected.length >= 10, "the module should expect a real pack list");
assert.ok(expected.every((id) => id.startsWith("sf2e.")), "every expected id is a collection id");
assert.equal(new Set(expected).size, expected.length, "expected ids are unique");
assert.deepEqual(expected, [...expected].sort(), "expected ids are sorted");

// Every expected pack present -> ok, nothing missing.
{
  const names = expected.map((id) => id.slice("sf2e.".length));
  const result = comparePacks(manifest(names), expected);
  assert.deepEqual(result.missing, []);
  assert.equal(result.present.length, expected.length);
  assert.equal(result.version, "1.6.1");
  const report = formatReport(result);
  assert.equal(report.ok, true);
  assert.ok(report.text.includes("system version: 1.6.1"));
}

// A renamed pack is a hard failure for the ids the module reads.
{
  const names = expected.map((id) => id.slice("sf2e.".length));
  names[0] = `${names[0]}-renamed`;
  const result = comparePacks(manifest(names), expected);
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0], expected[0]);
  const report = formatReport(result, { ref: "v14-dev" });
  assert.equal(report.ok, false);
  assert.ok(report.text.includes(`  - ${expected[0]}`), "the report names the missing pack");
}

// An empty or malformed manifest reports everything missing rather than passing.
for (const broken of [{}, { packs: null }, { packs: [] }, null]) {
  const result = comparePacks(broken, expected);
  assert.equal(result.missing.length, expected.length);
  assert.equal(formatReport(result).ok, false);
}

// A pack the module does not read is informational, never a failure.
{
  const names = [...expected, "sf2e.brand-new-pack"].map((id) => id.slice("sf2e.".length));
  const result = comparePacks(manifest(names), expected);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.added, ["sf2e.brand-new-pack"]);
  const report = formatReport(result);
  assert.equal(report.ok, true);
  assert.ok(report.text.includes("sf2e.brand-new-pack"));
}

// A pack entry without a usable name is ignored, not counted as present.
{
  const result = comparePacks({ version: "1.6.1", packs: [{ name: "" }, {}, { name: 42 }] }, expected);
  assert.equal(result.present.length, 0);
  assert.equal(result.missing.length, expected.length);
}

console.log("drift-check.test.mjs passed");
