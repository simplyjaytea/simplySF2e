#!/usr/bin/env node
// Offline creature bench: runs the REAL NPC/monster chain (scripts/creature-pipeline.mjs,
// builder.mjs, compendium.mjs, completion.mjs, encounter.mjs, pool.mjs) against the
// cached real sf2e packs and reports, per kind x level x adjustment, what throws,
// what is unresolved, and where a stat leaves the GM Core row for its level and scale.
// It reports findings; it fixes nothing and changes no production file. Run
// tools/class-bench/fetch.mjs first (it fills the cache this bench reads).
//   node tools/pipeline-bench/creature.mjs [--kinds monster,npc] [--levels -1,1,5,12,20,24] [--verbose]
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPacks, installFoundry } from "../class-bench/env.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, "..", "class-bench", "cache");
const SCRIPTS = join(HERE, "..", "..", "scripts");
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const KINDS = flag("kinds", "monster,npc").split(",").map((s) => s.trim()).filter(Boolean);
const LEVELS = flag("levels", "-1,1,5,12,20,24").split(",").map(Number);
const ADJUSTMENTS = ["none", "elite", "weak"];
const VERBOSE = args.includes("--verbose");
// The encounter is "3 creatures at party level 5": severe threat, party of four
// (composeEncounter gives one level-7 boss plus two level-3 minions).
const ENCOUNTER = { threat: "severe", partySize: 4, partyLevel: 5 };

const { packs } = await loadPacks(CACHE);
installFoundry({ packs, state: { freeArchetype: false } });
const source = (await readFile(join(CACHE, "SOURCE.txt"), "utf8")).split("\n")[0];

const load = (name) => import(pathToFileURL(join(SCRIPTS, name)).href);
const pipeline = await load("creature-pipeline.mjs");
const builder = await load("builder.mjs");
const compendium = await load("compendium.mjs");
const encounter = await load("encounter.mjs");
const T = await load("tables.mjs");

// Console capture: every console.warn the pipeline emits lands in the current run.
const realWarn = console.warn;
const realDebug = console.debug;
let captured = [];
const quiet = () => {
  captured = [];
  console.warn = (...parts) => { captured.push(parts.map((p) => (p instanceof Error ? p.message : String(p))).join(" ").replace(/^simplysf2e \| /, "")); };
  console.debug = () => {};
};
const restore = () => { console.warn = realWarn; console.debug = realDebug; };

// ------------------------------------------------------------------ AI stub
// Scale words and enum slugs only: the AI never emits a number (invariant 3).
// Every select step answers with the first offered candidate. Shapes are the
// post-validation shapes ai.mjs returns (the stub skips only the model call).
const SHARED = {
  blurb: "Bench fixture.",
  readAloud: "",
  recallKnowledge: "",
  resistances: [],
  weaknesses: [],
  immunities: [],
  focusSpells: []
};

/** A full generateConcept() payload: every CREATURE_KEYS field ai-response-validation requires. */
function fixture(intent, allowSpellcasting) {
  const npc = intent === "npc";
  return {
    ...SHARED,
    name: npc ? "Bench Sentinel" : "Bench Stalker",
    description: "Offline creature bench fixture.",
    size: npc ? "med" : "lg",
    traits: npc ? ["humanoid"] : ["animal"],
    languages: npc ? ["common"] : [],
    abilityScales: npc
      ? { str: "high", dex: "moderate", con: "moderate", int: "low", wis: "high", cha: "moderate" }
      : { str: "extreme", dex: "high", con: "high", int: "low", wis: "moderate", cha: "low" },
    acScale: "high",
    hpScale: "high",
    perceptionScale: "high",
    saveScales: { fortitude: "high", reflex: "moderate", will: "moderate" },
    speeds: [{ type: "land", value: 25 }],
    senses: npc ? [] : [{ type: "low-light-vision", acuity: null, range: null }],
    skills: npc ? [{ name: "Intimidation", scale: "high" }] : [{ name: "Athletics", scale: "high" }],
    strikes: npc
      ? [
        { name: "Blaster", type: "ranged", attackScale: "high", damageScale: "high", damageType: "fire", traits: [], range: 60, attackEffects: [] },
        { name: "Fist", type: "melee", attackScale: "moderate", damageScale: "moderate", damageType: "bludgeoning", traits: [], range: null, attackEffects: [] }
      ]
      : [{ name: "Bite", type: "melee", attackScale: "high", damageScale: "high", damageType: "piercing", traits: [], range: null, attackEffects: ["knockdown"] }],
    specialAbilities: npc
      ? [{ name: "Suppressing Fire", glossary: "Suppressing Fire", description: "", actionType: "action", actions: 2, traits: [] }]
      : [],
    spellcasting: npc && allowSpellcasting
      ? { tradition: "arcane", dcScale: "high", spells: [{ name: "Force Barrage", rank: 1 }] }
      : null,
    feats: npc ? [{ name: "Sudden Charge" }] : [],
    equipment: npc ? [{ name: "Blaster", quantity: 1, value: 0 }] : [],
    loot: npc ? [{ name: "Spacious Pouch", quantity: 1, value: 0 }] : []
  };
}

const pick = (c, extra = {}) => ({ name: c.name, candidate: c.ref, ...extra });
const first = (list) => list.slice(0, 1);

const AI = {
  generateConcept: async ({ intent, allowSpellcasting }) => ({ concept: fixture(intent, allowSpellcasting), usage: null }),
  chooseSpellFocus: async () => ({ keywords: [], usage: null }),
  selectSpells: async ({ candidates }) => ({
    spells: first(candidates).map((c) => pick(c, { rank: c.rank })),
    focusSpells: [],
    usage: null,
    timing: null
  }),
  selectCreatureAbilities: async ({ candidates }) => ({ abilities: first(candidates).map((c) => pick(c)), usage: null, timing: null }),
  selectCreatureFeats: async ({ candidates }) => ({ feats: first(candidates).map((c) => pick(c)), omitted: false, usage: null, timing: null }),
  selectEquipment: async ({ candidates }) => ({
    equipment: first(candidates).map((c) => pick(c, { quantity: 1, value: 0 })),
    omitted: false, usage: null, timing: null
  }),
  selectLoot: async ({ candidates }) => ({
    loot: first(candidates).map((c) => pick(c, { quantity: 1, value: 0 })),
    omitted: false, usage: null, timing: null
  }),
  designEncounter: async ({ slots }) => ({
    name: "Bench Encounter",
    briefs: slots.map((s) => `Bench ${s.role}`),
    usage: null
  })
};

const LABELS = {
  concept: "concept", spellFocus: "spellFocus", spells: "spells", abilities: "abilities", feats: "feats",
  equipment: "equipment", loot: "loot", design: "design", cancelled: "Cancelled", member: (i) => `member ${i + 1}`
};

// ------------------------------------------------------------------ checks
const ALLOWED_PACKS = new Set(["abilities", "spells", "feats", "equipment"].flatMap((c) => compendium.DEFAULT_PACKS[c]));
const rowOf = (level) => Math.min(Math.max(level, T.MIN_LEVEL), T.MAX_LEVEL) + 1;

/**
 * The GM Core row for a stat at this level and scale. `fallbacks` mirror the
 * documented order used where a table has no column for the scale (for example
 * extreme ability modifiers below level 1). Returns the table value and the
 * column it came from, so a fallback is visible in the detail line.
 */
function expected(table, scale, level, fallbacks = []) {
  for (const column of [scale, ...fallbacks]) {
    const value = table[column]?.[rowOf(level)];
    if (value !== null && value !== undefined) return { value, column };
  }
  return { value: undefined, column: null };
}

/** Compare one stat with its expected row. Records a failed check with both numbers. */
function bandCheck(checks, label, actual, want) {
  const ok = want.value === undefined ? false : actual === want.value;
  checks.push({
    name: `band:${label}`,
    ok,
    detail: `${actual} vs GM Core ${want.value ?? "no row"}${want.column ? ` (${want.column})` : ""}`
  });
}

/** Stats first, then the scale-driven rows. Every number is read back from the table, never recomputed here. */
function bandChecks(concept, stats, level) {
  const checks = [];
  bandCheck(checks, "ac", stats.ac, expected(T.AC, concept.acScale, level));
  bandCheck(checks, "hp", stats.hp, expected(T.HP, concept.hpScale, level, ["moderate", "low"]));
  bandCheck(checks, "perception", stats.perception, expected(T.PERCEPTION_AND_SAVES, concept.perceptionScale, level));
  for (const save of ["fortitude", "reflex", "will"]) {
    bandCheck(checks, `save:${save}`, stats.saves[save], expected(T.PERCEPTION_AND_SAVES, concept.saveScales[save], level));
  }
  for (const [key, scale] of Object.entries(concept.abilityScales)) {
    bandCheck(checks, `ability:${key}`, stats.abilities[key], expected(T.ABILITY_MODIFIER, scale, level, ["high", "moderate", "low"]));
  }
  concept.strikes.forEach((strike, i) => {
    const got = stats.strikes[i];
    bandCheck(checks, `strike:${strike.name}:attack`, got.bonus, expected(T.STRIKE_ATTACK, strike.attackScale, level));
    const damage = expected(T.STRIKE_DAMAGE, strike.damageScale, level);
    checks.push({
      name: `band:strike:${strike.name}:damage`,
      ok: damage.value === got.damage,
      detail: `${got.damage} vs GM Core ${damage.value}`
    });
  });
  if (concept.spellcasting) {
    bandCheck(checks, "spell:dc", stats.spellDC, expected(T.SPELL_DC, concept.spellcasting.dcScale, level, ["high", "moderate"]));
    bandCheck(checks, "spell:attack", stats.spellAttack, expected(T.SPELL_ATTACK, concept.spellcasting.dcScale, level, ["high", "moderate"]));
    const maxRank = Math.min(10, Math.max(1, Math.ceil(level / 2)));
    checks.push({ name: "spell:maxRank", ok: concept.spellcasting.maxRank === maxRank, detail: `${concept.spellcasting.maxRank} vs ${maxRank}` });
  }
  return checks;
}

/** Elite/Weak must be carried once: as the stored adjustment, with the GM level unchanged. */
function adjustmentChecks(concept, stats, level, adjustment) {
  const want = adjustment === "none" ? null : adjustment;
  const delta = adjustment === "elite" ? 2 : adjustment === "weak" ? -2 : 0;
  const adjusted = builder.adjustedStats(stats, concept);
  const hp = Math.max(1, stats.hp + builder.hpAdjustment(level, want));
  return [
    { name: "adjustment:stored", ok: concept.adjustment === want, detail: `${concept.adjustment} vs ${want}` },
    { name: "adjustment:levelUnchanged", ok: concept.level === level, detail: `${concept.level} vs GM ${level}` },
    { name: "adjustment:acOnce", ok: adjusted.ac - stats.ac === delta, detail: `delta ${adjusted.ac - stats.ac} vs ${delta}` },
    { name: "adjustment:hpOnce", ok: adjusted.hp === hp, detail: `${adjusted.hp} vs ${hp}` },
    {
      name: "adjustment:displayLevel",
      ok: adjusted.level === builder.adjustedLevel(level, want),
      detail: `${adjusted.level} vs ${builder.adjustedLevel(level, want)}`
    },
    // Open question, not a band: nothing cited in this repo says where Weak stops.
    { name: "adjustment:levelFloor", advisory: true, ok: adjusted.level >= T.MIN_LEVEL, detail: `display level ${adjusted.level} vs floor ${T.MIN_LEVEL}` }
  ];
}

/** Each resolved line with a pack must point at an allowed pack that holds the document. */
function sourceChecks(resolved) {
  const checks = [];
  const records = [
    ...resolved.abilities.map(({ ability, entry }) => ({ category: "ability", name: ability.name, entry, exempt: ability.narrative === true })),
    ...resolved.spells.map(({ spell, entry }) => ({ category: "spell", name: spell.name, entry })),
    ...resolved.feats.map(({ name, entry }) => ({ category: "feat", name, entry })),
    ...resolved.focusSpells.map((item) => ({ category: "focus-spell", name: item.spell?.name ?? item.name, entry: item.entry ?? item.spell?.entry })),
    ...resolved.equipment.map((item) => ({ category: "equipment", name: item.name, entry: item.entry })),
    ...resolved.loot.map((item) => ({ category: "loot", name: item.name, entry: item.entry, exempt: Boolean(builder.parseCoins(item.name)) }))
  ];
  for (const { category, name, entry, exempt } of records) {
    if (exempt) continue;
    const ok = Boolean(entry?.packId) && ALLOWED_PACKS.has(entry.packId) && packs.has(entry.packId);
    checks.push({ name: `source:${category}:${name}`, ok, detail: ok ? entry.packId : `no allowed source (${entry?.packId ?? "none"})` });
  }
  return checks;
}

/** Advisory checks flag an open question: they make the run WARN, never FAIL. */
function statusOf(checks, warnings) {
  if (checks.some((c) => !c.ok && !c.advisory)) return "FAIL";
  if (warnings.length || checks.some((c) => !c.ok)) return "WARN";
  return "PASS";
}

// ------------------------------------------------------------------ runs
const TREASURE = "standard";

async function runSingle(kind, level, adjustment) {
  const allowSpellcasting = kind === "npc";
  const steps = [];
  const checks = [];
  quiet();
  let result = null;
  let error = null;
  try {
    result = await pipeline.generateCreature({
      mode: kind,
      prompt: "bench concept",
      level,
      rarity: "common",
      allowSpellcasting,
      adjustment: adjustment === "none" ? null : adjustment,
      preset: null,
      treasureAmount: TREASURE,
      ai: AI,
      labels: LABELS,
      signal: new AbortController().signal,
      onStep: (id) => { steps.push(id); }
    });
  } catch (err) {
    error = err;
  } finally {
    restore();
  }
  const warnings = [...captured];
  if (error) {
    checks.push({ name: `no-throw@${steps.at(-1) ?? "start"}`, ok: false, detail: error.message });
    return { kind, level, adjustment, checks, warnings, steps, status: "FAIL" };
  }
  checks.push({ name: "no-throw", ok: true, detail: "" });
  checks.push({ name: "manifest:complete", ok: result.manifest.complete === true, detail: `${result.manifest.unresolved.length} unresolved` });
  checks.push(...sourceChecks(result.resolved));
  const stats = builder.computeStats(result.concept);
  checks.push(...bandChecks(result.concept, stats, level));
  checks.push(...adjustmentChecks(result.concept, stats, level, adjustment));
  return { kind, level, adjustment, checks, warnings, steps, status: statusOf(checks, warnings) };
}

async function runEncounter() {
  const composition = encounter.composeEncounter(ENCOUNTER.threat, ENCOUNTER.partySize, ENCOUNTER.partyLevel);
  const creatures = composition.members.reduce((sum, m) => sum + m.count, 0);
  const checks = [{ name: "encounter:three-creatures", ok: creatures === 3, detail: `${creatures} creatures` }];
  const steps = [];
  quiet();
  let result = null;
  let error = null;
  try {
    result = await pipeline.generateEncounter({
      composition,
      theme: "bench encounter",
      partyLevel: ENCOUNTER.partyLevel,
      rarity: "common",
      allowSpellcasting: false,
      preset: null,
      treasureAmount: TREASURE,
      local: false,
      ai: AI,
      labels: LABELS,
      signal: new AbortController().signal,
      onStep: (id) => { steps.push(id); }
    });
  } catch (err) {
    error = err;
  } finally {
    restore();
  }
  const warnings = [...captured];
  if (error) {
    checks.push({ name: `no-throw@${steps.at(-1) ?? "start"}`, ok: false, detail: error.message });
    return { kind: "encounter", level: ENCOUNTER.partyLevel, adjustment: "none", checks, warnings, steps, status: "FAIL" };
  }
  checks.push({ name: "no-throw", ok: true, detail: "" });
  checks.push({ name: "encounter:members", ok: result.members.length === composition.members.length, detail: `${result.members.length} groups` });
  for (const [i, member] of result.members.entries()) {
    const label = `member${i + 1}`;
    checks.push({ name: `${label}:manifest`, ok: member.manifest.complete === true, detail: `${member.manifest.unresolved.length} unresolved` });
    checks.push({ name: `${label}:level`, ok: member.concept.level === member.level, detail: `${member.concept.level} vs slot ${member.level}` });
    checks.push({ name: `${label}:adjustment`, ok: member.concept.adjustment == null, detail: `${member.concept.adjustment} (encounter members are not Elite/Weak)` });
    checks.push(...sourceChecks(member.resolved).map((c) => ({ ...c, name: `${label}:${c.name}` })));
    checks.push(...bandChecks(member.concept, builder.computeStats(member.concept), member.level).map((c) => ({ ...c, name: `${label}:${c.name}` })));
  }
  return { kind: "encounter", level: ENCOUNTER.partyLevel, adjustment: "none", checks, warnings, steps, status: statusOf(checks, warnings) };
}

// ------------------------------------------------------------------ output
const results = [];
for (const kind of KINDS) {
  for (const level of LEVELS) {
    for (const adjustment of ADJUSTMENTS) {
      results.push(await runSingle(kind, level, adjustment));
    }
  }
}
results.push(await runEncounter());

const rowsByKey = new Map();
for (const r of results) {
  const key = r.kind === "encounter" ? "encounter (3 creatures, party L5)" : `${r.kind} L${r.level}`;
  if (!rowsByKey.has(key)) rowsByKey.set(key, {});
  rowsByKey.get(key)[r.adjustment] = r;
}
const cell = (r) => {
  if (!r) return "-";
  const fails = r.checks.filter((c) => !c.ok).length;
  if (r.status === "FAIL") return `FAIL(${fails})`;
  if (r.status === "WARN") return `WARN(${r.warnings.length + r.checks.filter((c) => !c.ok).length})`;
  return "PASS";
};
const lines = [
  `Creature bench (${source.slice(0, 7)}): ${results.length} runs`,
  "",
  "| kind / level | none | elite | weak |",
  "| --- | --- | --- | --- |"
];
for (const [key, cells] of rowsByKey) {
  lines.push(`| ${key} | ${cell(cells.none)} | ${cell(cells.elite)} | ${cell(cells.weak)} |`);
}
const fails = results.filter((r) => r.status === "FAIL");
const warns = results.filter((r) => r.status === "WARN");
lines.push("", `${results.length - fails.length - warns.length} PASS, ${warns.length} WARN, ${fails.length} FAIL`);
if (VERBOSE || fails.length) {
  for (const r of [...fails, ...(VERBOSE ? warns : [])]) {
    lines.push("", `${r.status} ${r.kind} L${r.level} ${r.adjustment}`);
    for (const c of r.checks.filter((check) => !check.ok)) lines.push(`  - ${c.name}: ${c.detail}`);
    for (const w of r.warnings) lines.push(`  ! ${w}`);
  }
}
const text = `${lines.join("\n")}\n`;
process.stdout.write(text);

const outDir = join(HERE, "..", "class-bench", "cache");
await writeFile(join(outDir, "creature-matrix.md"), text);
await writeFile(join(outDir, "creature-results.json"), `${JSON.stringify(results, null, 2)}\n`);
process.exitCode = fails.length ? 1 : 0;
