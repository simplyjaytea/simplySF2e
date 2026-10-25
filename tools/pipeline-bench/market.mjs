#!/usr/bin/env node
// Offline Shop and Treasure bench. Runs the REAL pure modules (scripts/shop.mjs,
// treasure.mjs, currency.mjs, and compendium.mjs getShopCandidates,
// getCandidateDocument, toItemData, priceToGp) against the cached sf2e 1.6.1
// equipment pack, for every shop level x size x category x rarity and every
// hoard level x amount x rarity. The AI is a deterministic stub: the first valid
// candidates in catalog order, preceded by one invented id and followed by a
// repeat, so the module's drop and dedupe paths run too. shop-app.mjs and
// treasure-app.mjs are ApplicationV2 classes that do not load offline, so
// runShop/runHoard mirror their steps one for one (cited at each step). Reports
// findings; changes no production file. Run fetch.mjs (tools/class-bench) first.
//   node tools/pipeline-bench/market.mjs [--verbose]
// Exit 1 when any run fails a check. MARKET-REPORT.md is the hand-written analysis.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadMarketEnv } from "./market-env.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(HERE, "..", "..", "scripts");
const OUT = join(HERE, "out");
const VERBOSE = process.argv.slice(2).includes("--verbose");

const SHOP_LEVELS = [0, 1, 5, 10, 15, 20];
const SHOP_CATEGORY_SLUGS = ["weapons", "armor", "gear", "consumables"];
const SHOP_RARITY_CAPS = ["common", "uncommon", "rare"];
const HOARD_LEVELS = [1, 4, 10, 20];
const HOARD_AMOUNTS = ["encounter", "level"];
const HOARD_RARITY_CAPS = ["common", "uncommon", "rare"];
// The stub's invented id. Every run offers it; the module must drop it and report it.
const INVENTED_ID = "c-bench-invented";
// Budgets printed in docs/qa-checklist.md 13h.3 (party level 4, Common): one encounter 680, whole level 8,500 credits.
const QA_ANCHORS = { "4/encounter": 680, "4/level": 8500 };

// Independent rarity ranking (the module's RARITY_RANK is not imported on purpose).
const RANK = { common: 0, uncommon: 1, rare: 2, unique: 3 };

const env = await loadMarketEnv();
const load = (name) => import(pathToFileURL(join(SCRIPTS, name)).href);
const compendium = await load("compendium.mjs");
const currency = await load("currency.mjs");
const shop = await load("shop.mjs");
const treasure = await load("treasure.mjs");
const tables = await load("tables.mjs");
const { getShopCandidates, getCandidateDocument, toItemData, priceToGp } = compendium;
const { gpToCredits } = currency;

// Console capture: warnings from the pure modules land in the current run.
let warnings = [];
const realWarn = console.warn;
console.warn = (...parts) => { warnings.push(parts.map((p) => (p instanceof Error ? p.message : String(p))).join(" ")); };
console.log = console.info = console.debug = () => {};

/** True when the document is one of the cached pack files (FakeDocument keeps its pack and id). */
const inCache = (doc) => Boolean(env.packs.get(doc.pack)?.byId.has(doc.id));
const rankOf = (rarity) => RANK[rarity ?? "common"] ?? RANK.unique;
const countBy = (rows, key) => rows.reduce((counts, row) => ((counts[key(row)] = (counts[key(row)] ?? 0) + 1), counts), {});

/** The stub AI's pick list: one invented id, the first `count` valid candidates, then a repeat. */
function stubPicks(candidates, count) {
  const first = candidates.slice(0, count).map((c) => c.id);
  return [INVENTED_ID, ...first, ...first.slice(0, 1)];
}

/** Money line for a stocked row, exactly as shop-app.mjs:262 and treasure-app.mjs:284 compute it. */
const creditsOf = (doc) => gpToCredits(priceToGp(doc.system?.price?.value));

// ---------------------------------------------------------------- shop
/**
 * Mirrors shop-app.mjs #onGenerate steps 1-4 (lines 207-276) with the AI stubbed.
 * Returns the rows the app would show and the drop reports.
 */
async function runShop({ level, size, category, rarity }) {
  const count = shop.SHOP_SIZES[size];
  // Step 1 (shop-app.mjs:221-226): concept from the AI, normalized.
  const concept = shop.normalizeShopConcept({
    name: `Bench ${category}`, shopkeeper: "Bench keeper", blurb: "", description: "", keywords: [], categories: [category]
  });
  // Step 2 (shop-app.mjs:230-232): the real catalog for the shop's types, level and rarity cap.
  const { types } = shop.shopTypesFor(concept.categories);
  const candidates = await getShopCandidates(level, concept.keywords, { types, maxRarity: rarity });
  // Step 3 (shop-app.mjs:238-241): the stubbed AI picks IDs; only issued ones survive.
  const { stock, unknown } = shop.pickShopStock(stubPicks(candidates, count), candidates, count);
  // Step 4 (shop-app.mjs:247-262): exact documents, price and item data from the compendium.
  const rows = [];
  const dropped = [];
  for (const pick of stock) {
    const doc = await getCandidateDocument(pick);
    if (!doc) { dropped.push(pick.name); continue; }
    const itemData = toItemData(doc);
    itemData.system ??= {};
    itemData.system.quantity = pick.quantity;
    rows.push({ key: pick.id, name: doc.name, type: doc.type, level: doc.system?.level?.value ?? pick.level,
      rarity: doc.system?.traits?.rarity ?? pick.rarity ?? "common", credits: creditsOf(doc), quantity: pick.quantity, doc, itemData });
  }
  // Create-path data (shop-app.mjs:306-309): the merchant actor the app would create.
  const actorData = shop.shopActorData(concept, level, rows.map((r) => structuredClone(r.itemData)), { shopkeeperLabel: "Shopkeeper" });
  return { count, candidates, types, stock, unknown, dropped, rows, actorData };
}

/** Checks for one shop run. Each problem is {tag, detail}; an empty list passes. */
function checkShop(run, { level, category, rarity }) {
  const problems = [];
  const add = (tag, detail = "") => problems.push({ tag, detail });
  const allowed = new Set(shop.SHOP_CATEGORIES[category]);
  const cap = rankOf(rarity);
  const expectedStock = Math.min(run.count, run.candidates.length);
  if (run.stock.length !== expectedStock) add("stock count short of min(size, offered)", `${run.stock.length} of ${expectedStock}`);
  if (!run.unknown.includes(INVENTED_ID)) add("invented id not reported as dropped");
  const ids = run.stock.map((s) => s.id);
  if (new Set(ids).size !== ids.length) add("duplicate stock id");
  for (const row of run.rows) {
    if (!inCache(row.doc)) add("stock item missing from cache", row.name);
    if ((row.level ?? 0) > level) add("stock above shop level", `${row.name} L${row.level}`);
    if (rankOf(row.rarity) > cap) add("stock above rarity cap", `${row.name} ${row.rarity}`);
    if (!allowed.has(row.type)) add("stock type outside category", `${row.name} ${row.type}`);
    if (!(row.credits > 0)) add("unpriced item stocked at 0 credits", row.name);
    if (row.quantity !== (shop.SHOP_STACK[row.type] ?? 1)) add("quantity off SHOP_STACK", row.name);
  }
  const actor = run.actorData;
  if (actor.type !== "loot" || actor.system.lootSheetType !== "Merchant") add("shop actor not a Merchant loot sheet", `${actor.type}/${actor.system.lootSheetType}`);
  if (actor.system.details.level.value !== level) add("shop actor level off", String(actor.system.details.level.value));
  if (actor.items.length !== run.rows.length) add("shop actor item count off", `${actor.items.length} of ${run.rows.length}`);
  return problems;
}

// ---------------------------------------------------------------- treasure
/** The hoard's budget from the cited tables, computed here without treasure.mjs: total gp x 10 (credits). */
function expectedBudget(level, amount) {
  const total = tables.TREASURE_BY_LEVEL.total[level + 1]; // index 0 is level -1 (tables.mjs:167-171)
  if (amount === "level") return total * 10;
  return Math.round(total / tables.ENCOUNTERS_PER_LEVEL) * 10;
}

/**
 * Mirrors treasure-app.mjs #onGenerate steps 1-4 (lines 240-318) and #onCreateTreasure
 * (lines 344-362) with the AI stubbed.
 */
async function runHoard({ level, amount, rarity }) {
  // Step 1 (treasure-app.mjs:249-255): concept, categories left to the module (all four).
  const concept = treasure.normalizeTreasureConcept({ name: "Bench hoard", description: "", keywords: [], categories: [] });
  const budget = treasure.treasureBudgetCredits(level, amount); // treasure-app.mjs:245
  // Step 2 (treasure-app.mjs:259): real catalog, party level or lower.
  const { types } = shop.shopTypesFor(concept.categories);
  const candidates = await getShopCandidates(level, concept.keywords, { types, maxRarity: rarity });
  // Step 3 (treasure-app.mjs:264-268): stubbed picks.
  const ids = stubPicks(candidates, treasure.TREASURE_PICKS[amount]);
  // Step 4 (treasure-app.mjs:275-291): price each issued document once, then fill the budget.
  const { issued } = treasure.resolveIssuedPicks(ids, candidates);
  const priced = [];
  const docs = new Map();
  for (const candidate of issued) {
    if (docs.has(candidate.id)) continue;
    const doc = await getCandidateDocument(candidate);
    if (!doc) continue;
    docs.set(candidate.id, doc);
    priced.push({ ...candidate, credits: creditsOf(doc) });
  }
  const hoard = treasure.fillHoard(ids, priced, budget);
  const rows = hoard.items.map((pick) => {
    const doc = docs.get(pick.id);
    const itemData = toItemData(doc);
    itemData.system ??= {};
    itemData.system.quantity = 1;
    return { key: pick.id, name: doc.name, type: doc.type, level: doc.system?.level?.value ?? pick.level,
      rarity: doc.system?.traits?.rarity ?? pick.rarity ?? "common", credits: pick.credits, quantity: 1, doc, itemData };
  });
  // Create (treasure-app.mjs:352-355): the leftover is split by CURRENCY_ITEM_MAX, one Credstick per part.
  // A null stick throws, as the app does (its NoItems error).
  const leftover = treasure.hoardLeftover(budget, rows);
  const sticks = currency.splitCurrency(leftover).map((part) => {
    const stick = currency.assembleCurrency("credits", part);
    if (!stick) throw new Error("assembleCurrency returned no Credstick for a hoard part");
    return stick;
  });
  const items = [...rows.map((r) => structuredClone(r.itemData)), ...sticks];
  const actorData = treasure.treasureActorData(concept, level, items); // treasure-app.mjs:360
  return { budget, candidates, types, hoard, rows, sticks, leftover, actorData };
}

/** Checks for one hoard run. */
function checkHoard(run, { level, rarity, amount }) {
  const problems = [];
  const add = (tag, detail = "") => problems.push({ tag, detail });
  const cap = rankOf(rarity);
  if (run.budget !== expectedBudget(level, amount)) add("budget off the cited table", `${run.budget} vs ${expectedBudget(level, amount)}`);
  const anchor = QA_ANCHORS[`${level}/${amount}`];
  if (anchor !== undefined && run.budget !== anchor) add("budget off the QA anchor", `${run.budget} vs ${anchor}`);
  if (!run.hoard.unknown.includes(INVENTED_ID)) add("invented id not reported as dropped");
  const spent = run.rows.reduce((sum, r) => sum + r.credits, 0);
  if (spent > run.budget) add("hoard over budget", `${spent} of ${run.budget}`);
  for (const row of run.rows) {
    if (!inCache(row.doc)) add("hoard item missing from cache", row.name);
    if ((row.level ?? 0) > level) add("hoard item above party level", `${row.name} L${row.level}`);
    if (rankOf(row.rarity) > cap) add("hoard item above rarity cap", `${row.name} ${row.rarity}`);
    if (!(row.credits > 0)) add("unpriced item stocked at 0 credits", row.name);
  }
  const sticks = run.sticks;
  const stickTotal = sticks.reduce((sum, s) => sum + s.system.price.value.sp, 0);
  for (const s of sticks) {
    if (s.type !== "treasure" || s.system.category !== "credstick" || s.system.quantity !== 1) add("credstick template shape wrong", s.name);
    if (s.system.price.value.sp > currency.CURRENCY_ITEM_MAX) add("credstick over CURRENCY_ITEM_MAX", `${s.system.price.value.sp}`);
    if (!(s.system.price.value.sp > 0)) add("credstick holds no credits", s.name);
  }
  if (stickTotal !== run.leftover) add("credstick amount off leftover", `${stickTotal} vs ${run.leftover}`);
  if (spent + stickTotal !== run.budget) add("items + credstick != budget", `${spent} + ${stickTotal} vs ${run.budget}`);
  const actor = run.actorData;
  if (actor.type !== "loot" || actor.system.lootSheetType !== "Loot") add("hoard actor not a Loot sheet", `${actor.type}/${actor.system.lootSheetType}`);
  return problems;
}

// ---------------------------------------------------------------- run everything
const results = [];

for (const level of SHOP_LEVELS) for (const size of Object.keys(shop.SHOP_SIZES))
  for (const category of SHOP_CATEGORY_SLUGS) for (const rarity of SHOP_RARITY_CAPS) {
    const params = { level, size, category, rarity };
    const label = `shop L${level} ${size} ${category} ${rarity}`;
    warnings = [];
    let problems;
    let run = null;
    try {
      run = await runShop(params);
      problems = checkShop(run, params);
    } catch (err) {
      problems = [{ tag: "throw", detail: err.message }];
    }
    const status = problems.length ? "FAIL" : "PASS";
    results.push({ kind: "shop", label, params, status, problems, stock: run?.rows.length ?? 0, offered: run?.candidates.length ?? 0,
      credits: run ? run.rows.reduce((s, r) => s + r.credits * r.quantity, 0) : 0, rarities: run ? countBy(run.rows, (r) => r.rarity) : {},
      offeredRarities: run ? countBy(run.candidates, (c) => c.rarity) : {},
      warnings: [...warnings] });
  }

for (const level of HOARD_LEVELS) for (const amount of HOARD_AMOUNTS) for (const rarity of HOARD_RARITY_CAPS) {
  const params = { level, amount, rarity };
  const label = `hoard L${level} ${amount} ${rarity}`;
  warnings = [];
  let problems;
  let run = null;
  try {
    run = await runHoard(params);
    problems = checkHoard(run, params);
  } catch (err) {
    problems = [{ tag: "throw", detail: err.message }];
  }
  const status = problems.length ? "FAIL" : "PASS";
  results.push({ kind: "treasure", label, params, status, problems, stock: run?.rows.length ?? 0, offered: run?.candidates.length ?? 0,
    budget: run?.budget ?? 0, credits: run ? run.rows.reduce((s, r) => s + r.credits, 0) : 0, leftover: run?.leftover ?? 0,
    credsticks: run?.sticks.length ?? 0, rarities: run ? countBy(run.rows, (r) => r.rarity) : {},
    offeredRarities: run ? countBy(run.candidates, (c) => c.rarity) : {},
    warnings: [...warnings] });
}

console.warn = realWarn;
console.log = console.info = console.debug = (...p) => process.stdout.write(`${p.join(" ")}\n`);

// ---------------------------------------------------------------- matrix
const cell = (rs) => {
  const failing = rs.filter((r) => r.status === "FAIL").length;
  return failing ? `FAIL ${failing}/${rs.length}` : "ok";
};
const shopRows = [];
for (const rarity of SHOP_RARITY_CAPS) {
  const header = ["level", ...SHOP_CATEGORY_SLUGS, "gear stock s/m/l"];
  const body = SHOP_LEVELS.map((level) => {
    const perCat = SHOP_CATEGORY_SLUGS.map((category) => cell(results.filter((r) =>
      r.kind === "shop" && r.params.level === level && r.params.category === category && r.params.rarity === rarity)));
    const stocks = Object.keys(shop.SHOP_SIZES).map((size) => results.find((r) =>
      r.kind === "shop" && r.params.level === level && r.params.size === size && r.params.category === "gear" && r.params.rarity === rarity)?.stock ?? "-");
    return [`L${level}`, ...perCat, stocks.join("/")];
  });
  shopRows.push(`**Shop, rarity cap ${rarity}**\n\n${[header, header.map(() => "---"), ...body].map((r) => `| ${r.join(" | ")} |`).join("\n")}`);
}
const hoardHeader = ["level", ...HOARD_AMOUNTS.flatMap((a) => HOARD_RARITY_CAPS.map((r) => `${a} / ${r}`))];
const hoardBody = HOARD_LEVELS.map((level) => [`L${level}`, ...HOARD_AMOUNTS.flatMap((amount) => HOARD_RARITY_CAPS.map((rarity) => {
  const r = results.find((x) => x.kind === "treasure" && x.params.level === level && x.params.amount === amount && x.params.rarity === rarity);
  return r.status === "FAIL" ? `FAIL (${r.problems.length})` : `ok ${r.stock}i ${r.budget ? Math.round((r.credits / r.budget) * 100) : 0}%`;
}))]);
const hoardTable = [hoardHeader, hoardHeader.map(() => "---"), ...hoardBody].map((r) => `| ${r.join(" | ")} |`).join("\n");

const tally = results.reduce((t, r) => ((t[r.status] = (t[r.status] ?? 0) + 1), t), {});
const summary = `source ${env.source} (sf2e ${env.system.version}); ${results.length} runs: ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(", ")}`;

const tagRuns = {};
for (const r of results) for (const tag of new Set(r.problems.map((p) => p.tag))) {
  const details = r.problems.filter((p) => p.tag === tag).map((p) => p.detail).filter(Boolean);
  (tagRuns[tag] ??= { runs: [], details: new Set() }).runs.push(r.label);
  for (const d of details) tagRuns[tag].details.add(d);
}
const breakdown = Object.entries(tagRuns).sort((a, b) => b[1].runs.length - a[1].runs.length)
  .map(([tag, { runs, details }]) => {
    const examples = [...details].slice(0, 4).join("; ");
    return `${String(runs.length).padStart(3)} runs  ${tag}${examples ? `  (e.g. ${examples})` : ""}`;
  }).join("\n");

const detailLines = VERBOSE
  ? results.filter((r) => r.problems.length).map((r) => `${r.label}: ${r.problems.map((p) => `${p.tag}${p.detail ? ` [${p.detail}]` : ""}`).join("; ")}`).join("\n")
  : "";

console.log(`## Shop\n\n${shopRows.join("\n\n")}\n\n## Treasure hoard (cell: items + % of budget spent in items)\n\n${hoardTable}\n\n${summary}\n\nWhat each failing run hit (a run can hit several):\n${breakdown || "(none)"}${detailLines ? `\n\n${detailLines}` : ""}`);

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, "market.json"), JSON.stringify({ source: env.source, system: env.system.version, results }, null, 1));
await writeFile(join(OUT, "matrix.md"), `${shopRows.join("\n\n")}\n\n${hoardTable}\n\n${summary}\n\n${breakdown}\n`);
console.log(`\nfull per-run detail: tools/pipeline-bench/out/market.json`);
process.exitCode = tally.FAIL ? 1 : 0;
