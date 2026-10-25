#!/usr/bin/env node
// Downloads the sf2e Item packs from the PF2e monorepo (branch v14-dev) into
// tools/class-bench/cache/<pack>/..., pinned to one commit SHA.
//   node tools/class-bench/fetch.mjs [--sha <sha>] [--concurrency 24]
// Resumable: files already on disk for the same SHA are skipped. A different
// SHA wipes the cache first. GITHUB_TOKEN (optional) lifts the API rate limit
// for the two api.github.com calls; raw.githubusercontent.com is not API-limited.
//
// The sf2e build also copies PF2e documents into sf2e packs (build/duplicates.json,
// build/lib/compendium-pack.ts). Those copies are fetched too, edited the same way,
// and stored under the sf2e pack they land in. README.md "Duplicated PF2e content".
import { mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "foundryvtt/pf2e";
const BRANCH = "v14-dev";
const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, "cache");
// Bump when the cache layout changes, so an older cache at the same SHA is rebuilt.
const LAYOUT = "layout: sf2e Item packs + build/duplicates.json copies";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const CONCURRENCY = Math.max(1, Number(flag("concurrency", 24)) || 24);

const apiHeaders = { "User-Agent": "simplysf2e-class-bench", Accept: "application/vnd.github+json" };
if (process.env.GITHUB_TOKEN) apiHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function api(url) {
  const res = await fetch(url, { headers: apiHeaders });
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const wait = reset ? Math.max(0, reset * 1000 - Date.now()) : 0;
    throw new Error(`GitHub API rate limited (${res.status}); resets in ${Math.ceil(wait / 1000)}s. Set GITHUB_TOKEN or pass --sha <sha> plus wait.`);
  }
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function raw(sha, path) {
  const url = `https://raw.githubusercontent.com/${REPO}/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
      if (res.status === 404) throw new Error(`404 ${path}`);
    } catch (err) {
      if (String(err.message).startsWith("404")) throw err;
    }
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
  }
  throw new Error(`gave up on ${path}`);
}

const exists = (p) => access(p).then(() => true, () => false);

// src/util/misc.ts sluggify() with camel = null, the slug build/lib/helpers.ts
// uses for file names. Copied so a copy is found by the same file name the build uses.
const LOWER = String.raw`\p{Lowercase_Letter}`;
const UPPER = String.raw`\p{Uppercase_Letter}`;
const WORD = String.raw`[\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]`;
const NON_WORD = String.raw`[^\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]`;
const NON_WORD_BOUNDARY = String.raw`(?=^|$|${WORD})`;
const LOWER_THEN_UPPER = new RegExp(`(${LOWER})(${UPPER}${NON_WORD_BOUNDARY})`, "gu");
const NON_WORD_RE = new RegExp(NON_WORD, "gu");
function sluggify(text) {
  if (text === "-") return text;
  return text
    .replace(LOWER_THEN_UPPER, "$1-$2")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(NON_WORD_RE, " ")
    .trim()
    .replace(/[-\s]+/g, "-");
}

// getFolderPath() from build/lib/helpers.ts: "a/b/c" from the folder's ancestry.
function folderPath(folders, folder, parts = []) {
  if (parts.length > 3) throw new Error(`Maximum folder depth exceeded for "${folder.name}"`);
  parts.unshift(sluggify(folder.name));
  if (folder.folder) {
    const parent = folders.find((f) => f._id === folder.folder);
    if (!parent) throw new Error(`Unknown parent folder id [${folder.folder}]`);
    return folderPath(folders, parent, parts);
  }
  return parts.join("/");
}

// adjustPF2eDocumentForSF2e() from build/lib/compendium-pack.ts, applied to a copied document.
function adjustCopy(source, { publication }, sf2eRemap) {
  if ("img" in source && source.img === "icons/sundries/books/book-red-exclamation.webp") {
    source.img = "systems/sf2e/icons/default-icons/feats-sf2e.webp";
  }
  if ("system" in source && publication && "publication" in source.system) {
    source.system.publication.license = "ORC";
    source.system.publication.remaster = true;
    source.system.publication.title = publication;
  }
  if (source.flags?.pf2e) {
    source.flags.sf2e = source.flags.pf2e;
    delete source.flags.pf2e;
  }
  const replaceString = (s) => {
    s = s.replaceAll("systems/pf2e", "systems/sf2e").replace(/\bflags\.pf2e\./g, "flags.sf2e.");
    for (const [pf2eName, sf2eName] of sf2eRemap) s = s.replaceAll(`Compendium.pf2e.${pf2eName}`, `Compendium.sf2e.${sf2eName}`);
    return s;
  };
  const walk = (value) => {
    if (typeof value === "string") return replaceString(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value !== null && typeof value === "object") {
      for (const [key, inner] of Object.entries(value)) value[key] = walk(inner);
    }
    return value;
  };
  return walk(source);
}

const sha = flag("sha") ?? (await api(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`)).sha;
console.log(`${REPO}@${BRANCH} = ${sha}`);

const marker = join(CACHE, "SOURCE.txt");
if (await exists(marker)) {
  const old = (await readFile(marker, "utf8")).split("\n");
  if (old[0].trim() !== sha || !old.includes(LAYOUT)) {
    console.log(`cache was ${old[0].trim()} (${old.includes(LAYOUT) ? "same layout" : "older layout"}); wiping`);
    await rm(CACHE, { recursive: true, force: true });
  }
}
await mkdir(CACHE, { recursive: true });

// 1 API request: the whole tree.
const tree = await api(`https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`);
if (tree.truncated) throw new Error("git tree was truncated; cannot enumerate packs");
const blobPaths = tree.tree.filter((e) => e.type === "blob").map((e) => e.path);
const blobs = new Set(blobPaths);

// Pack list straight from the system manifest (quoted in the report).
const systemJson = await raw(sha, "system.sf2e.json");
await writeFile(join(CACHE, "system.sf2e.json"), systemJson);
const system = JSON.parse(systemJson);
const itemPacks = system.packs.filter((p) => p.type === "Item").map((p) => p.name);

// Every Item pack, because the pipeline resolves grants with fromUuid across
// packs (ancestry-features, feat-effects, equipment, ...), not only the ones in
// DEFAULT_PACKS. Actor packs (bestiaries) are not used by the PC pipeline.
const wanted = tree.tree.filter((e) => {
  if (e.type !== "blob" || !e.path.endsWith(".json")) return false;
  const m = /^packs\/sf2e\/([^/]+)\//.exec(e.path);
  return m && itemPacks.includes(m[1]) && !e.path.endsWith("/_folders.json");
});

// build/duplicates.json: [{ publication, entries: { <sf2e pack dir>: [<document name>] } }].
// compendium-pack.ts loadJSON() reads groups by the pack directory name, which is the
// same name the PF2e copy is looked up under (packs/pf2e/<pack>/**).
const duplicatesJson = await raw(sha, "build/duplicates.json");
await writeFile(join(CACHE, "duplicates.json"), duplicatesJson);
const duplicates = JSON.parse(duplicatesJson);
if (!Array.isArray(duplicates)) throw new Error("build/duplicates.json is not an array");

// sf2eCompendiumRemap: PF2e pack name -> sf2e pack name, matched by manifest `path`.
const pf2eSystemJson = await raw(sha, "system.pf2e.json");
await writeFile(join(CACHE, "system.pf2e.json"), pf2eSystemJson);
const pf2eSystem = JSON.parse(pf2eSystemJson);
const sf2eRemap = new Map();
for (const { name, path } of pf2eSystem.packs) {
  const match = system.packs.find((p) => p.path === path);
  if (match) sf2eRemap.set(name, match.name);
}

const copies = [];
const skippedGroups = {};
for (const group of duplicates) {
  for (const [pack, names] of Object.entries(group.entries ?? {})) {
    if (!itemPacks.includes(pack)) {
      skippedGroups[pack] = (skippedGroups[pack] ?? 0) + names.length;
      continue;
    }
    for (const name of names) copies.push({ pack, name, publication: group.publication ?? null });
  }
}

// Locate each copy the way the build does: file name = sluggify(name).json under
// packs/pf2e/<pack>/**. Fail closed on a missing or ambiguous match, and on a name
// the sf2e pack already has as a file (the bench cannot hold two files of one name).
const pf2eByName = new Map();
for (const pack of new Set(copies.map((c) => c.pack))) {
  const byName = new Map();
  for (const path of blobPaths) {
    if (!path.startsWith(`packs/pf2e/${pack}/`) || !path.endsWith(".json") || path.endsWith("/_folders.json")) continue;
    const base = path.slice(path.lastIndexOf("/") + 1);
    byName.set(base, [...(byName.get(base) ?? []), path]);
  }
  pf2eByName.set(pack, byName);
}
const jobsCopy = [];
const problems = [];
for (const copy of copies) {
  const file = `${sluggify(copy.name)}.json`;
  const matches = pf2eByName.get(copy.pack).get(file) ?? [];
  if (matches.length === 0) {
    problems.push(`Duplicate item ${copy.name} could not be found in pf2e pack ${copy.pack}`);
    continue;
  }
  if (matches.length > 1) {
    problems.push(`Duplicate item ${copy.name} matches ${matches.length} pf2e files: ${matches.join(", ")}`);
    continue;
  }
  const native = blobPaths.find((p) => p.startsWith(`packs/sf2e/${copy.pack}/`) && p.endsWith(`/${file}`));
  if (native) {
    problems.push(`Duplicate item ${copy.name} collides with sf2e file ${native}`);
    continue;
  }
  jobsCopy.push({ ...copy, file, from: matches[0] });
}
if (problems.length) {
  console.error(`${problems.length} duplicate(s) could not be placed:\n${problems.slice(0, 20).join("\n")}`);
  process.exit(1);
}

// Folder maps for the copies (sf2e folder ids replace the pf2e ones, as the build does).
const folderMaps = new Map();
async function loadFolders(side, pack) {
  const path = `packs/${side}/${pack}/_folders.json`;
  return blobs.has(path) ? JSON.parse(await raw(sha, path)) : [];
}
for (const pack of new Set(jobsCopy.map((j) => j.pack))) {
  const pf2eFolders = await loadFolders("pf2e", pack);
  const sf2eFolders = await loadFolders("sf2e", pack);
  folderMaps.set(pack, {
    pf2eFolderPaths: new Map(pf2eFolders.map((f) => [f._id, folderPath(pf2eFolders, f)])),
    sf2eFolderIds: new Map(sf2eFolders.map((f) => [folderPath(sf2eFolders, f), f._id])),
    sf2eFolders,
  });
}
for (const job of jobsCopy) {
  const { pf2eFolderPaths, sf2eFolderIds, sf2eFolders } = folderMaps.get(job.pack);
  job.remapFolder = (doc) => {
    if (!doc.folder) return doc;
    const path = pf2eFolderPaths.get(doc.folder);
    doc.folder = sf2eFolderIds.get(path) ?? sf2eFolders.find((f) => f._id === doc.folder)?._id;
    if (!doc.folder) console.warn(`Failed to find folder ${path} for item ${job.name} in pack ${job.pack}`);
    return doc;
  };
}

console.log(`${itemPacks.length} Item packs, ${wanted.length} files + ${jobsCopy.length} PF2e duplicates, concurrency ${CONCURRENCY}`);

const jobs = [
  ...wanted.map((entry) => ({
    from: entry.path,
    dest: join(CACHE, entry.path.replace(/^packs\/sf2e\//, "")),
  })),
  ...jobsCopy.map((job) => ({
    from: job.from,
    dest: join(CACHE, job.pack, job.file),
    transform: (text) => {
      const doc = job.remapFolder(JSON.parse(text));
      return `${JSON.stringify(adjustCopy(doc, job, sf2eRemap), null, 2)}\n`;
    },
  })),
];

let done = 0;
let skipped = 0;
const failures = [];
const queue = [...jobs];
async function worker() {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    try {
      if (await exists(job.dest)) skipped++;
      else {
        const text = await raw(sha, job.from);
        await mkdir(dirname(job.dest), { recursive: true });
        await writeFile(job.dest, job.transform ? job.transform(text) : text);
      }
    } catch (err) {
      failures.push(`${job.from}: ${err.message}`);
    }
    if (++done % 500 === 0) console.log(`  ${done}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

if (failures.length) {
  console.error(`${failures.length} file(s) failed:\n${failures.slice(0, 20).join("\n")}`);
  process.exit(1);
}

// Per-pack counts: native files and copied PF2e documents.
const nativeCount = new Map(itemPacks.map((p) => [p, 0]));
for (const entry of wanted) {
  const pack = entry.path.split("/")[2];
  nativeCount.set(pack, nativeCount.get(pack) + 1);
}
const copyCount = new Map(itemPacks.map((p) => [p, 0]));
for (const job of jobsCopy) copyCount.set(job.pack, copyCount.get(job.pack) + 1);
const copyPacks = [...copyCount.values()].filter((n) => n > 0).length;
const skippedText = Object.entries(skippedGroups).map(([p, n]) => `${p} ${n}`).join(", ") || "none";

// SOURCE.txt only after a complete fetch, so a half-finished cache is re-run.
const markerText = [
  sha,
  `system.sf2e.json version ${system.version}`,
  `system.pf2e.json version ${pf2eSystem.version}`,
  `packs: ${itemPacks.join(", ")}`,
  LAYOUT,
  `build/duplicates.json: ${jobsCopy.length} PF2e documents copied into ${copyPacks} sf2e Item packs; not copied (not Item packs): ${skippedText}`,
  ...itemPacks.map((p) => `  ${p}: ${nativeCount.get(p)} sf2e files, ${copyCount.get(p)} PF2e duplicates`),
  "",
].join("\n");
await writeFile(marker, markerText);
console.log(`done: ${done - skipped} fetched, ${skipped} already cached (${jobsCopy.length} PF2e duplicates in the set). SOURCE.txt = ${sha}`);
