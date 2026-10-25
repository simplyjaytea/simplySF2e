#!/usr/bin/env node
// Downloads the sf2e Item packs from the PF2e monorepo (branch v14-dev) into
// tools/class-bench/cache/<pack>/..., pinned to one commit SHA.
//   node tools/class-bench/fetch.mjs [--sha <sha>] [--concurrency 24]
// Resumable: files already on disk for the same SHA are skipped. A different
// SHA wipes the cache first. GITHUB_TOKEN (optional) lifts the API rate limit
// for the two api.github.com calls; raw.githubusercontent.com is not API-limited.
import { mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "foundryvtt/pf2e";
const BRANCH = "v14-dev";
const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, "cache");

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

const sha = flag("sha") ?? (await api(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`)).sha;
console.log(`${REPO}@${BRANCH} = ${sha}`);

const marker = join(CACHE, "SOURCE.txt");
if (await exists(marker)) {
  const old = (await readFile(marker, "utf8")).split("\n")[0].trim();
  if (old !== sha) {
    console.log(`cache was ${old}; wiping`);
    await rm(CACHE, { recursive: true, force: true });
  }
}
await mkdir(CACHE, { recursive: true });

// 1 API request: the whole tree.
const tree = await api(`https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`);
if (tree.truncated) throw new Error("git tree was truncated; cannot enumerate packs");

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
console.log(`${itemPacks.length} Item packs, ${wanted.length} files, concurrency ${CONCURRENCY}`);

let done = 0;
let skipped = 0;
const failures = [];
const queue = [...wanted];
async function worker() {
  for (;;) {
    const entry = queue.shift();
    if (!entry) return;
    const dest = join(CACHE, entry.path.replace(/^packs\/sf2e\//, ""));
    try {
      if (await exists(dest)) skipped++;
      else {
        const text = await raw(sha, entry.path);
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, text);
      }
    } catch (err) {
      failures.push(`${entry.path}: ${err.message}`);
    }
    if (++done % 500 === 0) console.log(`  ${done}/${wanted.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

if (failures.length) {
  console.error(`${failures.length} file(s) failed:\n${failures.slice(0, 20).join("\n")}`);
  process.exit(1);
}
// SOURCE.txt only after a complete fetch, so a half-finished cache is re-run.
await writeFile(marker, `${sha}\nsystem.sf2e.json version ${system.version}\npacks: ${itemPacks.join(", ")}\n`);
console.log(`done: ${done - skipped} fetched, ${skipped} already cached. SOURCE.txt = ${sha}`);
