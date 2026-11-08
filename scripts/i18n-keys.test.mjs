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
  ...collect("scripts/generator-context", ".mjs", SCRIPT_RE),
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
  ...collect("scripts/generator-context", ".mjs", new RegExp(`["'](${KEY})["']`, "g")).keys(),
]);
// Keys built at runtime (a template string, or a small map of names). Each family
// names the line that builds it, so the warning lists only keys nothing can reach.
const RUNTIME_FAMILIES = [
  /^SIMPLYSF2E\.ProviderSetup\.(Price(Input|Output)Invalid|JevTest[A-Za-z]+)$/, // settings.mjs:646, provider-setup-app.mjs:37-49,315
  /^SIMPLYSF2E\.Threat\.[A-Za-z]+$/, // generator-app.mjs:303 (THREATS, encounter.mjs:10)
  /^SIMPLYSF2E\.Role\.[A-Za-z]+$/, // generator-app.mjs:667 (encounter.mjs:54,66)
  /^SIMPLYSF2E\.TreasureAmount\.[A-Za-z]+$/, // generator-app.mjs:308, manage-presets-app.mjs:28 (tables.mjs:223)
  /^SIMPLYSF2E\.Treasure\.Amount[A-Za-z]+$/, // treasure-app.mjs:105 (treasure.mjs:22)
  /^SIMPLYSF2E\.Shop\.(Size|Category)[A-Za-z]+$/, // shop-app.mjs:100,126 (shop.mjs:22)
  /^SIMPLYSF2E\.Skills\.[A-Za-z0-9]+$/, // generator-app.mjs:536-542 (Rank${n}, warningKeys map)
  /^SIMPLYSF2E\.Loadout\.[A-Za-z]+$/, // generator-app.mjs:546-551 (literal map)
  /^SIMPLYSF2E\.Tokens\.Cost[A-Za-z]*$/, // app-base.mjs:330-334
  /^SIMPLYSF2E\.Preview\.PerceptionShort$/, // generator-app.mjs:671 (t() in the statline)
  /^SIMPLYSF2E\.StatCheck\.(Fortitude|Reflex|Will)$/, // stat-check.mjs:135 (save-${save})
];
const unused = [...known].filter((key) => !used.has(key) && !looseUsed.has(key) && !RUNTIME_FAMILIES.some((re) => re.test(key)));
if (unused.length) {
  console.warn(`i18n-keys: ${unused.length} en.json keys not used by a literal lookup (may be built dynamically):`);
  for (const key of unused) console.warn(`  ${key}`);
}
console.log(`i18n-keys: ${used.size} literal keys all present in en.json`);
