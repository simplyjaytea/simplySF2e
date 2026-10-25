// Offline environment for the Shop and Treasure bench (market.mjs). It reuses
// the sf2e pack cache and Foundry fake from tools/class-bench (fetch.mjs must
// run first). Nothing here is a module function: only Foundry globals.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPacks, installFoundry } from "../class-bench/env.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const CLASS_BENCH_CACHE = join(HERE, "..", "class-bench", "cache");

/** Load the cached packs, install the fake Foundry globals and return the pack set. */
export async function loadMarketEnv() {
  const { system, packs } = await loadPacks(CLASS_BENCH_CACHE);
  installFoundry({ packs, state: { freeArchetype: false } });
  const source = (await readFile(join(CLASS_BENCH_CACHE, "SOURCE.txt"), "utf8")).split("\n")[0];
  return { system, packs, source };
}
