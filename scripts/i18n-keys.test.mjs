// Fails when a literal translation key used in a template or script is missing
// from lang/en.json (the player would see the raw key). Keys used nowhere only
// warn: some are built dynamically (e.g. `SIMPLYSF2E.Threat.${…}`).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function flatten(obj, prefix = "", out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out.add(key);
  }
  return out;
}

const known = flatten(JSON.parse(readFileSync(join(root, "lang/en.json"), "utf8")));
const KEY = "[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)+";
const TEMPLATE_RE = new RegExp(`\\blocalize\\s+["'](${KEY})["']`, "g");
const SCRIPT_RE = new RegExp(`\\bi18n\\??\\.(?:localize|format)\\(\\s*["'](${KEY})["']`, "g");

function collect(dir, ext, re, test = () => true) {
  const used = new Map();
  for (const file of readdirSync(join(root, dir)).filter((f) => f.endsWith(ext) && test(f))) {
    const text = readFileSync(join(root, dir, file), "utf8");
    for (const m of text.matchAll(re)) {
      if (!used.has(m[1])) used.set(m[1], []);
      used.get(m[1]).push(`${dir}/${file}`);
    }
  }
  return used;
}

const used = new Map([
  ...collect("templates", ".hbs", TEMPLATE_RE),
  ...collect("scripts", ".mjs", SCRIPT_RE, (f) => !f.endsWith(".test.mjs")),
]);
assert.ok(used.size > 50, `expected to find many literal keys, found ${used.size}; is the regex stale?`);

const missing = [...used].filter(([key]) => !known.has(key));
assert.deepEqual(
  missing.map(([key, files]) => `${key} (${[...new Set(files)].join(", ")})`),
  [],
  "translation keys used in code but missing from lang/en.json",
);

// Looser pass for the warning only: any quoted key literal (settings, wrappers, lookup tables).
const looseUsed = new Set([
  ...collect("templates", ".hbs", new RegExp(`["'](${KEY})["']`, "g")).keys(),
  ...collect("scripts", ".mjs", new RegExp(`["'](${KEY})["']`, "g"), (f) => !f.endsWith(".test.mjs")).keys(),
]);
const unused = [...known].filter((key) => !used.has(key) && !looseUsed.has(key));
if (unused.length) {
  console.warn(`i18n-keys: ${unused.length} en.json keys not used by a literal lookup (may be built dynamically):`);
  for (const key of unused) console.warn(`  ${key}`);
}
console.log(`i18n-keys: ${used.size} literal keys all present in en.json`);
