/**
 * Re-level: move a copied NPC's numbers to another level with the Starfinder
 * GM Core Building Creatures tables (tables.mjs, GM Core pp. 116-128).
 *
 * Each number keeps how strong it was. The module finds the printed scale
 * (extreme/high/moderate/low/terrible) closest to the value at the old level
 * and moves the value by that scale's step to the new level, so a creature
 * one point above "high" stays one point above "high". HP scales by the
 * scale's ratio instead of its step. Nothing here is AI output.
 *
 * Source fields cited against foundryvtt/pf2e v14-dev:
 * - actor/npc/data.ts NPCSystemSource: `abilities` (Abilities, `.mod`),
 *   `attributes.ac.value`, `attributes.hp` (`value`, `max`),
 *   `perception.mod`, `saves.<save>.value`, `skills.<slug>.base`
 *   (`number | null`, null defers to the attribute) and `.special[].base`,
 *   `details.level.value`.
 * - actor/creature/data.ts: `attributes.resistances[]`/`weaknesses[]` `.value`.
 * - item/melee/data.ts: `bonus.value`, `damageRolls.<id>.damage`.
 * - item/spellcasting-entry/data.ts: `spelldc.value` (attack), `spelldc.dc`.
 * - item/lore.ts: an NPC lore item's `system.mod.value` is its skill base.
 *
 * Left unchanged (and said so in the preview): spells and their ranks, DCs
 * and damage written into ability text, items and gear, Elite/Weak.
 *
 * Pure module (no Foundry globals), node-testable.
 */
import * as T from "./tables.mjs";

export const RELEVEL_MIN = T.MIN_LEVEL;
export const RELEVEL_MAX = T.MAX_LEVEL;

const SCALE_ORDER = ["extreme", "high", "moderate", "low", "terrible", "maximum", "minimum"];

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const column = (level) => Math.min(Math.max(Math.round(level), T.MIN_LEVEL), T.MAX_LEVEL) + 1;

/** Clamp a requested level to the tables' range; non-numbers fall back. */
export function clampRelevel(value, fallback = 1) {
  const level = Math.round(Number(value));
  if (!Number.isFinite(level)) return fallback;
  return Math.min(RELEVEL_MAX, Math.max(RELEVEL_MIN, level));
}

/**
 * The printed scale whose value at `level` is closest to `value` (ties go to
 * the stronger scale). `measure` turns a table cell into a number (dice
 * formulas use their average). Null when the table prints nothing usable.
 */
export function nearestScale(table, level, value, measure = (cell) => cell) {
  const i = column(level);
  let best = null;
  let bestGap = Infinity;
  for (const scale of SCALE_ORDER) {
    const cell = table[scale]?.[i];
    const number = cell === null || cell === undefined ? null : measure(cell);
    if (!isNumber(number)) continue;
    const gap = Math.abs(number - value);
    if (gap < bestGap) {
      best = scale;
      bestGap = gap;
    }
  }
  return best;
}

function cell(table, scale, level) {
  const value = table[scale]?.[column(level)];
  return value === null || value === undefined ? null : value;
}

/** Move a modifier/AC/DC by its scale's step. Returns {value, scale} or null. */
export function shiftStat(table, value, from, to) {
  if (!isNumber(value)) return null;
  const scale = nearestScale(table, from, value);
  const before = scale && cell(table, scale, from);
  const after = scale && cell(table, scale, to);
  if (!isNumber(before) || !isNumber(after)) return null;
  return { value: value + (after - before), scale };
}

/** Scale HP by its scale's ratio; never below 1. */
export function scaleHp(value, from, to) {
  if (!isNumber(value) || value <= 0) return null;
  const scale = nearestScale(T.HP, from, value);
  const before = scale && cell(T.HP, scale, from);
  const after = scale && cell(T.HP, scale, to);
  if (!isNumber(before) || !isNumber(after) || before <= 0) return null;
  return { value: Math.max(1, Math.round(value * after / before)), scale };
}

const DICE_RE = /^(\d+)d(\d+)([+-]\d+)?$/;

/**
 * Move one plain damage formula ("2d8+9") to the new level: the nearest
 * scale's formula at the new level, plus the old formula's distance from
 * that scale's average. Anything other than one dice term and a flat bonus
 * is returned as null and left unchanged.
 */
export function shiftDamage(formula, from, to) {
  const text = String(formula ?? "").replaceAll(" ", "");
  if (!DICE_RE.test(text)) return null;
  if (from === to) return { value: text, scale: null };
  const average = T.averageDamage(text);
  const scale = nearestScale(T.STRIKE_DAMAGE, from, average, (f) => T.averageDamage(f));
  const before = scale && cell(T.STRIKE_DAMAGE, scale, from);
  const after = scale && cell(T.STRIKE_DAMAGE, scale, to);
  if (!before || !after) return null;
  const offset = average - T.averageDamage(before);
  const [, n, faces, flat] = DICE_RE.exec(after);
  const bonus = Number(flat ?? 0) + offset;
  return { value: bonus === 0 ? `${n}d${faces}` : `${n}d${faces}${bonus > 0 ? "+" : ""}${bonus}`, scale };
}

/**
 * Re-level a plain NPC source object (toObject / fromCompendium). Returns a
 * new object; the input is not mutated. `rows` lists every changed number for
 * the preview: {key, label, name?, scale, from, to}. `label` is an i18n key.
 * @param {object} actorData
 * @param {number} level  the new level
 */
export function relevelActorData(actorData, level) {
  const data = structuredClone(actorData ?? {});
  const system = data.system ??= {};
  const from = Number(system.details?.level?.value ?? 0);
  const to = clampRelevel(level, from);
  const rows = [];
  if (!Number.isFinite(from) || from === to) return { data, rows, from, to };

  const note = (key, label, result, before, extra = {}) => {
    if (result && result.value !== before) rows.push({ key, label, scale: result.scale, from: before, to: result.value, ...extra });
  };

  system.details ??= {};
  system.details.level = { ...(system.details.level ?? {}), value: to };

  const ac = system.attributes?.ac;
  if (ac) {
    const result = shiftStat(T.AC, ac.value, from, to);
    note("ac", "SIMPLYSF2E.StatCheck.AC", result, ac.value);
    if (result) ac.value = result.value;
  }

  const hp = system.attributes?.hp;
  if (hp) {
    const result = scaleHp(hp.max, from, to);
    note("hp", "SIMPLYSF2E.StatCheck.HP", result, hp.max);
    if (result) {
      // A copy starts at full health, the same way a new NPC does.
      hp.max = result.value;
      hp.value = result.value;
    }
  }

  if (system.perception) {
    const result = shiftStat(T.PERCEPTION_AND_SAVES, system.perception.mod, from, to);
    note("perception", "SIMPLYSF2E.StatCheck.Perception", result, system.perception.mod);
    if (result) system.perception.mod = result.value;
  }

  for (const save of ["fortitude", "reflex", "will"]) {
    const entry = system.saves?.[save];
    if (!entry) continue;
    const result = shiftStat(T.PERCEPTION_AND_SAVES, entry.value, from, to);
    note(`save-${save}`, `SIMPLYSF2E.StatCheck.${save[0].toUpperCase()}${save.slice(1)}`, result, entry.value);
    if (result) entry.value = result.value;
  }

  for (const entry of Object.values(system.abilities ?? {})) {
    const result = shiftStat(T.ABILITY_MODIFIER, entry?.mod, from, to);
    if (result) entry.mod = result.value;
  }

  for (const skill of Object.values(system.skills ?? {})) {
    const result = shiftStat(T.SKILL, skill?.base, from, to);
    if (!result) continue;
    const step = result.value - skill.base;
    skill.base = result.value;
    for (const special of skill.special ?? []) {
      if (isNumber(special?.base)) special.base += step;
    }
  }

  for (const key of ["resistances", "weaknesses"]) {
    for (const entry of system.attributes?.[key] ?? []) {
      const result = shiftStat(T.RESISTANCE, entry?.value, from, to);
      if (result) entry.value = Math.max(1, result.value);
    }
  }

  for (const item of data.items ?? []) {
    const itemSystem = item?.system;
    if (!itemSystem) continue;
    if (item.type === "melee") {
      const bonus = shiftStat(T.STRIKE_ATTACK, itemSystem.bonus?.value, from, to);
      note(`strike-${item._id}`, "SIMPLYSF2E.StatCheck.Strike", bonus, itemSystem.bonus?.value, { name: item.name });
      if (bonus) itemSystem.bonus.value = bonus.value;
      // Only the first damage instance: the extra ones (persistent, added
      // energy) are riders, the same instance Elite/Weak adjusts
      // (item/melee/document.ts).
      const first = Object.values(itemSystem.damageRolls ?? {})[0];
      const damage = first && shiftDamage(first.damage, from, to);
      note(`damage-${item._id}`, "SIMPLYSF2E.Relevel.Damage", damage, first?.damage, { name: item.name });
      if (damage) first.damage = damage.value;
    } else if (item.type === "lore") {
      const result = shiftStat(T.SKILL, itemSystem.mod?.value, from, to);
      if (result) itemSystem.mod.value = result.value;
    } else if (item.type === "spellcastingEntry" && itemSystem.spelldc) {
      const dc = shiftStat(T.SPELL_DC, itemSystem.spelldc.dc, from, to);
      note(`spelldc-${item._id}`, "SIMPLYSF2E.StatCheck.SpellDC", dc, itemSystem.spelldc.dc);
      if (dc) itemSystem.spelldc.dc = dc.value;
      const attack = shiftStat(T.SPELL_ATTACK, itemSystem.spelldc.value, from, to);
      if (attack) itemSystem.spelldc.value = attack.value;
    }
  }

  return { data, rows, from, to };
}
