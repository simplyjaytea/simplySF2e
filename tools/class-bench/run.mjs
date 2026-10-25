#!/usr/bin/env node
// Offline class bench: runs the REAL PC pipeline (scripts/pc-builder.mjs,
// compendium.mjs, class-paths.mjs, choice-set.mjs, pc-tables.mjs, pc-skills.mjs,
// pc-prerequisites.mjs) against the cached real sf2e packs and prints a
// class x level x Free Archetype findings matrix. Run fetch.mjs first.
//   node tools/class-bench/run.mjs [--classes soldier,mystic] [--levels 1,5]
//        [--ancestry Human] [--heritage "Versatile Human"] [--background Athlete]
//        [--priorities athletics,medicine,nature] [--abilities wis] [--path Striker] [--multiclass envoy] [--verbose]
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPacks, installFoundry } from "./env.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, "cache");
const SCRIPTS = join(HERE, "..", "..", "scripts");
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const LEVELS = (flag("levels", "1,2,5,10,20")).split(",").map(Number);
const ANCESTRY = flag("ancestry", "Human");
const HERITAGE = flag("heritage", "Urbanite Human");
const BACKGROUND = flag("background", "Athlete");
// Skill slugs as the AI's concept.skillPriorities carries them; none means the key-ability default.
const PRIORITIES = (flag("priorities", "")).split(",").map((s) => s.trim()).filter(Boolean);
// Ability keys as the AI's concept.abilityPriorities carries them (free-boost preference); none means the class key only.
const ABILITIES = (flag("abilities", "")).split(",").map((s) => s.trim()).filter(Boolean);
// Class path (e.g. Operative specialization "Striker") the path choice must select; none means the first candidate.
const PATH = flag("path", "").trim();
// Second class (complete slug, not the main class): pins its dedication to the first archetype slot.
// Multiclass needs Free Archetype, so the run uses Free Archetype on only.
const MULTICLASS = flag("multiclass", "").trim().toLowerCase();
const MODES = MULTICLASS ? [true] : [false, true];
const ONLY = flag("classes")?.split(",");
const VERBOSE = args.includes("--verbose");

const { system, packs } = await loadPacks(CACHE);
const state = { freeArchetype: false };
installFoundry({ packs, state });
const source = (await readFile(join(CACHE, "SOURCE.txt"), "utf8")).split("\n")[0];

const load = (name) => import(pathToFileURL(join(SCRIPTS, name)).href);
const compendium = await load("compendium.mjs");
const pcBuilder = await load("pc-builder.mjs");
const pcTables = await load("pc-tables.mjs");
const pcSupport = await load("pc-support.mjs");
const pcPrereq = await load("pc-prerequisites.mjs");
const choiceSet = await load("choice-set.mjs");
const { slugify } = await load("text.mjs");

// Console capture: every console.warn the pipeline emits lands in the current run.
let warnings = [];
const realWarn = console.warn;
console.warn = (...parts) => { warnings.push(parts.map((p) => (p instanceof Error ? p.message : String(p))).join(" ").replace(/^simplysf2e \| /, "")); };
console.log = console.info = console.debug = () => {};

/** Deterministic stand-in for the AI ChoiceSet callback: first option of every group, or the --path option where one is offered. */
const selectChoices = async (groups) => ({
  picks: groups.map((g) => {
    const wanted = PATH ? g.options.find((o) => slugify(o.label) === slugify(PATH)) : null;
    return { choice: g.id, option: (wanted ?? g.options[0]).id };
  })
});

const classDocs = packs.get("sf2e.classes").docs.slice().sort((a, b) => a.name.localeCompare(b.name));
const classes = classDocs.filter((c) => !ONLY || ONLY.includes(slugify(c.name)));

const find = async (list, name) => (await list).find((c) => slugify(c.name) === slugify(name)) ?? null;

/** Walk ABC/class grant entries and report open ChoiceSets the module cannot pre-answer
 * (ABC `system.items` are re-fetched by the system, so they always prompt natively). */
async function nativePrompts(items, level) {
  const found = [];
  const seen = new Set();
  const visit = async (uuid, via, depth) => {
    if (seen.has(uuid) || depth > 3) return;
    seen.add(uuid);
    const doc = await globalThis.fromUuid(uuid);
    if (!doc) { found.push({ via, feature: uuid, flag: "(grant target missing)", missing: true }); return; }
    for (const rule of doc.system?.rules ?? []) {
      if (rule.key === "ChoiceSet" && rule.selection == null && !rule.allowNoSelection) {
        found.push({ via, feature: doc.name, flag: rule.flag ?? null, predicated: Boolean(rule.predicate), filter: Array.isArray(rule.choices?.filter) ? rule.choices.filter.join(" & ") : typeof rule.choices === "string" ? rule.choices : Array.isArray(rule.choices) ? "literal" : Object.keys(rule.choices ?? {}).join(",") });
      }
      if (rule.key === "GrantItem" && typeof rule.uuid === "string" && !rule.uuid.includes("{") && rule.uuid.startsWith("Compendium.")) await visit(rule.uuid, `${via} > ${doc.name}`, depth + 1);
    }
  };
  for (const item of items) {
    for (const entry of Object.values(item.system?.items ?? {})) {
      if (typeof entry?.uuid === "string" && Number(entry.level ?? 0) <= level) await visit(entry.uuid, item.name, 0);
    }
  }
  return found;
}

async function runOne(classData, level, freeArchetype) {
  warnings = [];
  state.freeArchetype = freeArchetype;
  const rec = {
    class: classData.name, level, freeArchetype, complete: pcSupport.isCompletePCClass(classData.name),
    stages: {}, throws: null, throwStage: null, slotsTotal: 0, unresolvedSlots: [], zeroCandidateSlots: [],
    pathPlan: null, pathBypassed: false, casting: null, choiceSets: [], nativePrompts: [], skill: null, warnings: [], multiclass: null
  };
  const stage = async (name, fn) => {
    try { const value = await fn(); rec.stages[name] = "ok"; return value; }
    catch (err) {
      rec.stages[name] = "throw";
      rec.throws ??= String(err?.message ?? err).replace(/^simplysf2e \| /, "");
      rec.throwStage ??= name;
      if (VERBOSE) realWarn(`[${classData.name} L${level}${freeArchetype ? " FA" : ""}] ${name}:`, err?.stack ?? err);
      return null;
    }
  };

  const keyAbility = classData.system.keyAbility.value[0];
  const concept = await stage("normalize", async () => pcBuilder.normalizePCConcept({
    name: `Bench ${classData.name} ${level}`, ancestry: ANCESTRY, heritage: HERITAGE, background: BACKGROUND,
    class: classData.name, keyAbility, abilityPriorities: ABILITIES, skillPriorities: PRIORITIES, feats: [],
    multiclass: MULTICLASS || null
  }, { level }));
  if (!concept) return rec;

  // Candidates as the generator issues them (resolvePCConcept then takes the exact-ref branch).
  const issue = async (label, candidates, name) => {
    const hit = await find(candidates, name);
    if (!hit) throw new Error(`${label} "${name}" is not offered by the module's candidate list`);
    return hit.ref;
  };
  await stage("candidates", async () => {
    concept.ancestryCandidate = await issue("ancestry", compendium.getAncestryCandidates(), ANCESTRY);
    concept.heritageCandidate = await issue("heritage", compendium.getHeritageCandidates(), HERITAGE);
    concept.backgroundCandidate = await issue("background", compendium.getBackgroundCandidates(), BACKGROUND);
    concept.classCandidate = await issue("class", compendium.getClassCandidates(), classData.name);
  });
  if (rec.throws) return rec;

  // resolvePCConcept -> planClassPaths -> getFeatCandidates for every slot.
  let resolved = await stage("resolve", () => pcBuilder.resolvePCConcept(concept, { selectChoices }));
  if (!resolved && /class path/.test(rec.throws ?? "")) {
    // Keep going with an empty path plan so later stages still get exercised.
    rec.pathBypassed = true;
    resolved = await stage("resolve(no-path-plan)", () => pcBuilder.resolvePCConcept(concept, { selectChoices, pathPlan: {} }));
  }
  if (!resolved) { rec.warnings = warnings; return rec; }
  rec.pathPlan = Object.fromEntries(Object.entries(resolved.pathPlan ?? {}).map(([tag, p]) => [tag, p.name]));
  // The pinned dedication, or "not pinned" when --multiclass was asked for and the dedication is not provable here.
  rec.multiclass = MULTICLASS ? (resolved.multiclass ? `${resolved.multiclass.class}: ${resolved.multiclass.dedication}` : "not pinned") : null;
  // Fail closed: a requested path that the choice did not select is a FAIL, not a silent first-candidate run.
  if (PATH && !Object.values(rec.pathPlan).some((name) => slugify(name) === slugify(PATH))) {
    rec.throws = `--path "${PATH}" was not selected (plan: ${Object.values(rec.pathPlan).join(", ") || "none"})`;
    rec.throwStage = "path";
  }
  // The module's own projection (what the feat prerequisites see). The fake Actor's final ranks are not used: its clone/update merge by Math.max.
  const projected = resolved.skillPlan;
  rec.skillPlan = projected ? { training: projected.training, events: projected.events, source: projected.sourceRanks } : null;
  rec.slotsTotal = resolved.featSlots.length;
  rec.zeroCandidateSlots = resolved.featSlots.filter((s) => !s.candidates.length).map((s) => `${s.archetype ? "archetype-" : ""}${s.type}-${s.level}`);
  rec.slots = resolved.featSlots.map((s) => ({ slot: `${s.archetype ? "archetype-" : ""}${s.type}-${s.level}`, candidates: s.candidates.length, names: s.candidates.map((c) => c.name) }));

  // Feats are not repeatable: a category whose slots outnumber the distinct feats offered to
  // them cannot be filled whatever order the picks are made in.
  rec.pools = {};
  for (const slot of resolved.featSlots) {
    const key = `${slot.archetype ? "archetype-" : ""}${slot.type}`;
    const pool = (rec.pools[key] ??= { slots: 0, names: new Set() });
    pool.slots++;
    for (const c of slot.candidates) pool.names.add(c.name);
  }
  for (const pool of Object.values(rec.pools)) pool.distinct = pool.names.size, delete pool.names;

  // Casting: the real class profile and plan, then deterministic first-N spells per rank.
  const profile = pcTables.pcSpellcastingProfile(resolved.classDoc);
  const isCaster = Number(resolved.classDoc.system?.spellcasting ?? 0) > 0;
  rec.casting = { isCaster, profile: profile ? { mode: profile.mode, tradition: profile.tradition, baseSlots: profile.baseSlots } : null, plan: null, shortfall: [], tradition: null };
  if (isCaster) {
    const plan = pcTables.pcSpellPlan(level, profile);
    rec.casting.plan = { slots: plan.slots, picks: plan.picks };
    let tradition = profile?.tradition ?? null;
    if (!tradition) {
      // Variable-tradition class: read the tradition off the chosen path feature's own rules.
      for (const planned of Object.values(resolved.pathPlan ?? {})) {
        const doc = await globalThis.fromUuid(planned.uuid);
        const rule = (doc?.system?.rules ?? []).find((r) => r.key === "ActiveEffectLike" && /^flags\.system\.[a-z-]+\.tradition$/.test(r.path ?? ""));
        if (rule) { tradition = rule.value; break; }
      }
      rec.casting.traditionSource = tradition ? "path feature rule" : "none found; defaulted to arcane";
      tradition ??= "arcane";
    }
    rec.casting.tradition = tradition;
    const maxRank = Math.max(...Object.entries(plan.slots).filter(([, n]) => n > 0).map(([r]) => Number(r)));
    const candidates = await compendium.getSpellCandidates(tradition, maxRank, [], plan.picks);
    const spells = [];
    for (const [rankText, want] of Object.entries(plan.picks)) {
      const rank = Number(rankText);
      if (!want) continue;
      // Exact base rank first, then lower-rank spells (a spontaneous repertoire may learn
      // them heightened: pc-builder.mjs only requires base rank <= assigned rank).
      const eligible = candidates.filter((c) => (rank === 0 ? c.rank === 0 : c.rank > 0 && c.rank <= rank)
        && !(profile?.mode === "spontaneous" && rank === 10 && c.rarity !== "common"));
      const pool = [...eligible.filter((c) => c.rank === rank), ...eligible.filter((c) => c.rank !== rank).sort((a, b) => b.rank - a.rank)];
      if (pool.length < want) rec.casting.shortfall.push({ rank, want, have: pool.length });
      for (const c of pool.slice(0, want)) spells.push({ name: c.name, rank, candidate: c.ref });
    }
    concept.spellcasting = { tradition, dcScale: "high", maxRank, spells, plannedPicks: plan.picks };
  }

  // Feat picks: first candidate of every slot, exactly as the exact-content flow resolves them.
  // Feats are not repeatable, so "first candidate" means the first one not already
  // picked for an earlier slot (the slot's own first candidate when all are taken,
  // which lets the real dedupe fallback report it).
  const pickedNames = new Set();
  const picks = resolved.featSlots.map((slot, i) => {
    if (!slot.candidates.length) return null;
    const pick = slot.candidates.find((c) => !pickedNames.has(c.name)) ?? slot.candidates[0];
    pickedNames.add(pick.name);
    return { slot: i + 1, name: pick.name, candidate: pick.ref };
  }).filter(Boolean);
  const feats = await stage("featPicks", () => pcBuilder.resolveFeatPicks(resolved.featSlots, picks, { exactContent: true }));
  if (feats) {
    const archetypePositions = [];
    resolved.featSlots.forEach((slot, i) => { if (slot.archetype === true) archetypePositions.push(i); });
    if (archetypePositions.length) {
      const { dropped } = pcPrereq.validateArchetypeSlotPlacement(
        archetypePositions.map((i) => resolved.featSlots[i]), archetypePositions.map((i) => feats[i]), null);
      for (const { index } of dropped) feats[archetypePositions[index]] = { ...feats[archetypePositions[index]], entry: null };
    }
    rec.picked = feats.map((f) => `${f.archetype ? "archetype-" : ""}${f.type}-${f.level}: ${f.name}${f.entry ? "" : " (UNRESOLVED)"}`);
    rec.unresolvedSlots = feats.filter((f) => !f.entry).map((f) => `${f.archetype ? "archetype-" : ""}${f.type}-${f.level}`);
  }

  // Final exact-content resolve (spells now carry their issued candidates), then create.
  const final = await stage("resolveFinal", () => pcBuilder.resolvePCConcept(concept, { exactContent: true, pathPlan: resolved.pathPlan, selectChoices }));
  if (!final || !feats) { rec.warnings = warnings; return rec; }
  const complete = { ...final, feats, pathPlan: resolved.pathPlan };
  const created = await stage("createCharacterActor", () => pcBuilder.createCharacterActor(concept, complete, { selectChoices }));
  if (created) {
    const review = choiceSet.reviewUnresolvedChoices(created.actor._items);
    rec.choiceSets = review.choices.map((c) => ({ item: c.itemName, flag: c.flag, conditional: c.conditional }));
    rec.skill = { warnings: created.skillReport.warnings, trainingBudget: created.skillReport.trainingBudget, unspentTraining: created.skillReport.unspentTraining, unspentIncreases: created.skillReport.unspentIncreases };
    rec.embedded = created.actor._items.length;
    rec.spellItems = created.actor._items.filter((i) => i.type === "spell").length;
    const classItem = created.actor._items.find((i) => i.type === "class");
    rec.nativePrompts = await nativePrompts(
      created.actor._items.filter((i) => ["class", "ancestry", "heritage", "background"].includes(i.type)), level);
    void classItem;
  }
  rec.warnings = warnings;
  return rec;
}

// ---------------------------------------------------------------- run + classify
const SKILL_NOISE = new Set(["grant-timing", "unspent-training", "unspent-increases", "projection-mismatch"]);
const results = [];
for (const classData of classes) {
  for (const freeArchetype of MODES) {
    for (const level of LEVELS) results.push(await runOne(classData, level, freeArchetype));
  }
}

function classify(rec) {
  const issues = [];
  if (rec.throws) return { status: "FAIL", n: 0, issues: [`throw@${rec.throwStage}: ${rec.throws}`], tags: [`throw@${rec.throwStage}: ${rec.throws.replace(/"[^"]*"/g, '"..."')}`] };
  // A feat slot with no legal feat left is created empty and the GM is warned (completion.mjs: never blocking).
  const empty = [];
  const emptyTags = [];
  if (rec.unresolvedSlots.length) {
    const kinds = [...new Set(rec.unresolvedSlots.map((slot) => slot.replace(/-\d+$/, "")))];
    empty.push(`${rec.unresolvedSlots.length} empty feat slot(s), no legal feat available: ${rec.unresolvedSlots.join(", ")}`);
    emptyTags.push(...kinds.map((k) => `empty ${k} feat slot`));
  }
  if (rec.multiclass === "not pinned") issues.push("multiclass dedication not pinned (not provable for this character)");
  if (rec.casting?.isCaster && !rec.casting.profile) issues.push("caster class has no casting profile (legacy spontaneous fallback)");
  for (const s of rec.casting?.shortfall ?? []) issues.push(`spell shortfall rank ${s.rank}: want ${s.want}, have ${s.have}`);
  for (const w of rec.skill?.warnings ?? []) if (!SKILL_NOISE.has(w)) issues.push(`skill review: ${w}`);
  const seen = new Set();
  for (const w of rec.warnings) {
    if (/^character skill review: (grant-timing|unspent-training|unspent-increases|projection-mismatch)$/.test(w)) continue;
    const key = w.replace(/\d+/g, "#");
    if (!seen.has(key)) { seen.add(key); issues.push(`warn: ${w}`); }
  }
  return {
    status: issues.length || empty.length ? "WARN" : "PASS", n: issues.length + empty.length,
    issues: [...empty, ...issues], tags: [...emptyTags, ...issues.map((i) => i.replace(/\d+/g, "#"))]
  };
}
for (const rec of results) Object.assign(rec, { verdict: classify(rec) });

const cell = (rec) => (rec.verdict.status === "WARN" ? `WARN(${rec.verdict.n})` : rec.verdict.status);
const header = ["class", "FA", ...LEVELS.map((l) => `L${l}`), "complete?"];
const rows = [];
for (const classData of classes) for (const fa of MODES) {
  const recs = results.filter((r) => r.class === classData.name && r.freeArchetype === fa);
  rows.push([classData.name, fa ? "on" : "off", ...LEVELS.map((l) => cell(recs.find((r) => r.level === l))), recs[0].complete ? "yes" : "no"]);
}
const table = [header, header.map(() => "---"), ...rows].map((r) => `| ${r.join(" | ")} |`).join("\n");
const tally = results.reduce((t, r) => ((t[r.verdict.status] = (t[r.verdict.status] ?? 0) + 1), t), {});
const summary = `source ${source} (sf2e ${system.version}); ${ANCESTRY} / ${HERITAGE} / ${BACKGROUND}${PRIORITIES.length ? ` / priorities ${PRIORITIES.join(",")}` : ""}${MULTICLASS ? ` / multiclass ${MULTICLASS} (Free Archetype on)` : ""}; ${results.length} runs: ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(", ")}`;

const tagCounts = {};
for (const rec of results) for (const tag of rec.verdict.tags) (tagCounts[`${rec.verdict.status} ${tag}`] ??= []).push(`${rec.class} L${rec.level}${rec.freeArchetype ? " FA" : ""}`);
const breakdown = Object.entries(tagCounts).sort((a, b) => b[1].length - a[1].length)
  .map(([tag, runs]) => `${String(runs.length).padStart(3)} runs  ${tag}`).join("\n");

console.warn = realWarn;
console.log = console.info = console.debug = (...p) => process.stdout.write(`${p.join(" ")}\n`);
console.log(`${table}\n\n${summary}\n\nWhat each non-PASS run hit (a run can hit several):\n${breakdown}`);
await writeFile(join(CACHE, "results.json"), JSON.stringify({ source, system: system.version, ancestry: ANCESTRY, heritage: HERITAGE, background: BACKGROUND, results }, null, 1));
await writeFile(join(CACHE, "matrix.md"), `${table}\n\n${summary}\n\n${breakdown}\n`);
console.log(`\nfull per-run detail: tools/class-bench/cache/results.json`);
