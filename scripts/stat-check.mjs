// Stat check after Create: compare a newly created NPC's prepared sheet with
// what the preview promised and with the Starfinder GM Core range for its
// level. Report only; nothing here writes to the actor. Pure apart from the
// actor object passed in, so node-testable.
import * as T from "./tables.mjs";
import { computeStats, adjustedStats, hpAdjustment } from "./builder.mjs";
import { capitalized } from "./text.mjs";

/** GM Core table per checked stat (tables.mjs, GM Core pp. 119-126). */
const STAT_TABLES = {
  ac: T.AC,
  hp: T.HP,
  perception: T.PERCEPTION_AND_SAVES,
  save: T.PERCEPTION_AND_SAVES,
  strike: T.STRIKE_ATTACK,
  spellDC: T.SPELL_DC
};

/** Scale names from best to worst; a table only uses the ones it prints. */
const SCALE_ORDER = ["extreme", "high", "moderate", "low", "terrible"];

/**
 * The numbers the sheet should show: computeStats() plus the stored
 * Elite/Weak adjustment, exactly as the preview displays them.
 */
export function expectedSheetStats(concept, { spellEntry = true } = {}) {
  const stats = adjustedStats(computeStats(concept), concept);
  const adjustment = concept.adjustment === "elite" || concept.adjustment === "weak" ? concept.adjustment : null;
  return {
    level: stats.level,
    baseLevel: concept.level,
    adjustment,
    ac: stats.ac,
    hp: stats.hp,
    perception: stats.perception,
    saves: { ...stats.saves },
    // createActor names each melee item capitalized(strike.name).
    strikes: stats.strikes.map((strike) => ({ name: capitalized(strike.name), bonus: strike.bonus })),
    // createActor builds a spellcasting entry only when a spell resolved, so
    // the caller says whether one exists; no entry means no Spell DC row.
    spellDC: spellEntry ? stats.spellDC : null
  };
}

const finite = (value) => (Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : null);

/**
 * Read prepared values from an sf2e NPC. Accessors cited against
 * foundryvtt/pf2e v14-dev:
 * - AC: npc/document.ts `this.armorClass = armorStatistic.dc` (StatisticDifficultyClass.value)
 * - HP: npc/document.ts `system.attributes.hp = stat` with `stat.max = stat.max + stat.totalModifier`
 * - Perception: creature/document.ts `this.perception = new PerceptionStatistic(...)` (.mod)
 * - Saves: npc/document.ts `this.saves = new CreatureSaves(saves)` (Statistic.mod)
 * - Strikes: npc/document.ts `system.actions.push(attackFromMeleeItem(item))`; actor/helpers.ts
 *   strikeFromMeleeItem merges a StatisticModifier (totalModifier) with `type: "strike"`, `item`
 * - Spell DC: item/spellcasting-entry/document.ts `this.statistic` (.dc.value)
 * Anything missing reads as null and is reported as unreadable, never guessed.
 */
export function readSheetStats(actor) {
  const system = actor?.system ?? {};
  const strikes = (Array.isArray(system.actions) ? system.actions : [])
    .filter((action) => action?.type === "strike")
    .map((action) => ({ name: String(action.item?.name ?? action.label ?? ""), bonus: finite(action.totalModifier) }));
  const entries = Array.from(actor?.spellcasting?.regular ?? actor?.spellcasting ?? []);
  const spellDCs = entries.map((entry) => finite(entry?.statistic?.dc?.value)).filter((value) => value !== null);
  return {
    level: finite(actor?.level ?? system.details?.level?.value),
    ac: finite(actor?.armorClass?.value ?? system.attributes?.ac?.value),
    hp: finite(system.attributes?.hp?.max),
    perception: finite(actor?.perception?.mod ?? system.perception?.mod),
    saves: {
      fortitude: finite(actor?.saves?.fortitude?.mod),
      reflex: finite(actor?.saves?.reflex?.mod),
      will: finite(actor?.saves?.will?.mod)
    },
    strikes,
    spellDC: spellDCs.length ? Math.max(...spellDCs) : null
  };
}

/**
 * Which GM Core scale a value reaches at a level: the best scale whose
 * benchmark it meets, "above" when it beats the top printed scale, or
 * "below" when it is under the lowest one.
 */
export function scaleBand(table, level, value) {
  if (value === null || !Number.isFinite(level)) return null;
  const i = Math.min(Math.max(Math.round(level), T.MIN_LEVEL), T.MAX_LEVEL) + 1;
  const scales = SCALE_ORDER.filter((scale) => Number.isFinite(table[scale]?.[i]));
  if (!scales.length) return null;
  if (value > table[scales[0]][i]) return "above";
  for (const scale of scales) {
    if (value >= table[scale][i]) return scale;
  }
  return "below";
}

/**
 * The value the GM Core band is read from. Elite/Weak shift each number by
 * +/-2 (HP by getHpAdjustment), which is not one level's step, so an adjusted
 * creature's numbers are mapped back to its base level before banding.
 */
function baseValue(key, value, expected) {
  if (value === null || !expected.adjustment) return value;
  if (key === "hp") return value - hpAdjustment(expected.baseLevel, expected.adjustment);
  return value - (expected.adjustment === "elite" ? 2 : -2);
}

function row(key, label, table, expectedStats, expected, actual) {
  const level = expectedStats.adjustment ? expectedStats.baseLevel : (expectedStats.sheetLevel ?? expectedStats.level);
  const band = scaleBand(table, level, baseValue(key, actual, expectedStats));
  const status = actual === null ? "unreadable"
    : expected !== null && actual !== expected ? "differs"
    : band === "above" || band === "below" ? "outOfRange"
    : "ok";
  return { key, label, expected, actual, band, status };
}

/**
 * Compare expected and actual stats. `label` values are i18n keys (strikes
 * and saves carry a `name`/`save` for formatting). Strikes match by name;
 * a strike the sheet lacks is "unreadable".
 * @returns {{level:number|null, rows:object[], problems:number}}
 */
export function checkStats(expected, actual) {
  const level = actual.level ?? expected.level;
  const ctx = { ...expected, sheetLevel: level };
  const rows = [
    row("ac", "SIMPLYSF2E.StatCheck.AC", STAT_TABLES.ac, ctx, expected.ac, actual.ac),
    row("hp", "SIMPLYSF2E.StatCheck.HP", STAT_TABLES.hp, ctx, expected.hp, actual.hp),
    row("perception", "SIMPLYSF2E.StatCheck.Perception", STAT_TABLES.perception, ctx, expected.perception, actual.perception)
  ];
  for (const save of ["fortitude", "reflex", "will"]) {
    rows.push({
      ...row(`save-${save}`, `SIMPLYSF2E.StatCheck.${save[0].toUpperCase()}${save.slice(1)}`, STAT_TABLES.save, ctx,
        expected.saves?.[save] ?? null, actual.saves?.[save] ?? null)
    });
  }
  const remaining = [...actual.strikes];
  for (const strike of expected.strikes) {
    const wanted = strike.name.toLowerCase();
    const index = remaining.findIndex((candidate) => candidate.name.toLowerCase() === wanted);
    const found = index >= 0 ? remaining.splice(index, 1)[0] : null;
    rows.push({ ...row(`strike-${strike.name}`, "SIMPLYSF2E.StatCheck.Strike", STAT_TABLES.strike, ctx, strike.bonus, found?.bonus ?? null), name: strike.name });
  }
  if (expected.spellDC !== null && expected.spellDC !== undefined) {
    rows.push(row("spellDC", "SIMPLYSF2E.StatCheck.SpellDC", STAT_TABLES.spellDC, ctx, expected.spellDC, actual.spellDC));
  }
  return { level, rows, problems: rows.filter((r) => r.status !== "ok").length };
}

/** Expected-vs-sheet check for one created NPC. */
export function statCheckForActor(concept, actor, { spellEntry = true } = {}) {
  return checkStats(expectedSheetStats(concept, { spellEntry }), readSheetStats(actor));
}

/** Whether createActor built a spellcasting entry for these resolved picks (builder.mjs createActor). */
export function hasSpellEntry(concept, resolved) {
  return Boolean(concept?.spellcasting && resolved?.spells?.some((spell) => spell.entry));
}

const BAND_KEYS = {
  extreme: "SIMPLYSF2E.StatCheck.BandExtreme",
  high: "SIMPLYSF2E.StatCheck.BandHigh",
  moderate: "SIMPLYSF2E.StatCheck.BandModerate",
  low: "SIMPLYSF2E.StatCheck.BandLow",
  terrible: "SIMPLYSF2E.StatCheck.BandTerrible",
  above: "SIMPLYSF2E.StatCheck.BandAbove",
  below: "SIMPLYSF2E.StatCheck.BandBelow"
};

/**
 * Display text for one creature's check. `i18n` is `{ localize, format }`
 * (game.i18n in Foundry), so this stays testable.
 * @returns {{name:string, level:number|null, total:number, problems:number, summary:string, rows:{text:string, status:string}[]}}
 */
export function describeStatCheck(name, result, i18n) {
  const rows = result.rows.map((r) => {
    const label = r.name ? i18n.format(r.label, { name: r.name }) : i18n.localize(r.label);
    const band = r.band ? i18n.localize(BAND_KEYS[r.band]) : "";
    const data = { label, actual: r.actual, expected: r.expected, band };
    const key = {
      ok: "SIMPLYSF2E.StatCheck.RowOk",
      differs: "SIMPLYSF2E.StatCheck.RowDiffers",
      outOfRange: "SIMPLYSF2E.StatCheck.RowOutOfRange",
      unreadable: "SIMPLYSF2E.StatCheck.RowUnreadable"
    }[r.status];
    return { text: i18n.format(key, data), status: r.status };
  });
  const total = rows.length;
  const summary = result.problems
    ? i18n.format("SIMPLYSF2E.StatCheck.Problems", { name, problems: result.problems, total })
    : i18n.format("SIMPLYSF2E.StatCheck.AllOk", { name, total, level: result.level });
  return { name, level: result.level, total, problems: result.problems, summary, rows };
}
