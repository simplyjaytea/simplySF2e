// sf2e drift check (tools only; never ships).
//
// The module hard-codes the sf2e pack ids it reads (scripts/compendium.mjs
// DEFAULT_PACKS). A system update that renames or drops a pack makes those
// lookups fail quietly, so a scheduled job compares the ids we rely on with the
// live `system.sf2e.json` on the PF2e v14-dev branch.
//
//   node tools/drift-check.mjs [--ref v14-dev] [--json]
//
// Exit 1 when an expected pack is gone. A new pack is reported, not failed:
// the module does not need to use every pack the system ships.
import { pathToFileURL } from "node:url";
import { DEFAULT_PACKS } from "../scripts/compendium.mjs";

export const DEFAULT_REF = "v14-dev";
const MANIFEST_URL = (ref) =>
  `https://raw.githubusercontent.com/foundryvtt/pf2e/${ref}/system.sf2e.json`;

/** Every pack collection id the module expects, as `sf2e.<name>`. */
export function expectedPackIds(packs = DEFAULT_PACKS) {
  const ids = new Set();
  for (const value of Object.values(packs)) {
    for (const id of Array.isArray(value) ? value : [value]) {
      if (typeof id === "string" && id.startsWith("sf2e.")) ids.add(id);
    }
  }
  return [...ids].sort();
}

/**
 * Compare a live `system.sf2e.json` manifest with the ids the module expects.
 * Pure: no network, no globals.
 * @param {{version?: string, packs?: {name?: string}[]}} manifest
 * @param {string[]} expected collection ids (`sf2e.<name>`)
 */
export function comparePacks(manifest, expected) {
  const live = new Set(
    (Array.isArray(manifest?.packs) ? manifest.packs : [])
      .map((pack) => (typeof pack?.name === "string" ? `sf2e.${pack.name}` : null))
      .filter(Boolean)
  );
  const want = [...new Set(expected)].sort();
  return {
    version: typeof manifest?.version === "string" ? manifest.version : null,
    present: want.filter((id) => live.has(id)),
    missing: want.filter((id) => !live.has(id)),
    added: [...live].filter((id) => !want.includes(id)).sort()
  };
}

/** One human-readable report; `ok` is false when an expected pack is missing. */
export function formatReport(result, { ref = DEFAULT_REF } = {}) {
  const lines = [
    `sf2e drift check (${ref})`,
    `system version: ${result.version ?? "unknown"}`,
    `expected packs: ${result.present.length + result.missing.length}`,
    `present: ${result.present.length}`,
    `missing: ${result.missing.length}`,
    `unused by the module: ${result.added.length}`
  ];
  if (result.missing.length) {
    lines.push("", "MISSING (the module reads these; a rename breaks lookups silently):");
    for (const id of result.missing) lines.push(`  - ${id}`);
  }
  if (result.added.length) {
    lines.push("", "New in the live system (informational; not read by the module yet):");
    for (const id of result.added) lines.push(`  - ${id}`);
  }
  return { ok: result.missing.length === 0, text: lines.join("\n") };
}

async function main(argv) {
  const json = argv.includes("--json");
  const refIndex = argv.indexOf("--ref");
  const ref = refIndex >= 0 && argv[refIndex + 1] ? argv[refIndex + 1] : DEFAULT_REF;
  const url = MANIFEST_URL(ref);

  let manifest;
  try {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) {
      console.error(`sf2e drift check: ${url} returned HTTP ${response.status}`);
      return 2;
    }
    manifest = await response.json();
  } catch (err) {
    console.error(`sf2e drift check: could not read ${url}: ${err?.message ?? err}`);
    return 2;
  }

  const result = comparePacks(manifest, expectedPackIds());
  const report = formatReport(result, { ref });
  if (json) {
    console.log(JSON.stringify({ ref, ok: report.ok, ...result }, null, 2));
  } else {
    console.log(report.text);
  }
  return report.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
