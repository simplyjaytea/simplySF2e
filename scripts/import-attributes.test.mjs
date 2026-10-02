// No module file may use JSON import attributes (`import x from "./a.json"
// with { type: "json" }`): Foundry supports Firefox, and Firefox ESR 128
// cannot parse them, which would stop the whole module from loading.
// Run: node scripts/import-attributes.test.mjs
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const dir = new URL("./", import.meta.url);
const offenders = [];
for (const file of await readdir(dir, { recursive: true })) {
  if (!file.endsWith(".mjs") || file.endsWith(".test.mjs")) continue;
  const source = await readFile(new URL(file, dir), "utf8");
  if (/^\s*(?:import|export)\b[^\n]*\bwith\s*\{\s*type\s*:/m.test(source)
    || /^\s*(?:import|export)\b[^\n]*\.json["']/m.test(source)) offenders.push(file);
}
assert.deepEqual(offenders, [], `JSON imports found in: ${offenders.join(", ")}`);
console.log("import-attributes.test.mjs: no JSON import attributes in module code");
