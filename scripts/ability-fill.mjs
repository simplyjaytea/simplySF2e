// Fill the blank values of the seven held-back glossary abilities (FIX-B).
// A glossary ability whose published text still has placeholders is cloned
// only after these rules replace the blanks with values for the creature's
// level and size. Only the placeholder tokens change; the rest of the text is
// the published text.
//
// CITED / APPROVED (JT, 2026-11-05):
// R1 DC: lookup(SPELL_DC, level, scale). Scale = the ability's dcScale from the
//    AI when it is "moderate" or "high", else the default: moderate for
//    frightful-presence, stench and engulf; high for constrict,
//    greater-constrict and trample. Source: Starfinder GM Core pg. 126 (SPELL_DC),
//    pg. 128 (creature ability DCs use it), pg. 129 (an aura's DC is usually moderate).
// R2 Engulf escape: dc=0 -> the same DC as R1.
// R3 Damage: dice = lookup(AREA_DAMAGE, level, "unlimited"), Source GM Core pg. 128.
//    Type: the glossary type; engulf's literal "damageType" becomes the AI's
//    damageType when valid, else bludgeoning; greater-constrict takes the AI's
//    damageType when valid, else keeps the glossary type.
// R4 Distance (approved constants): frightful-presence "0 feet." -> "90 feet."
//    and its Aura rule radius 0 -> 90 (published copies: 12/12 radius 90, D-FILL.md);
//    stench "0 feet." -> "30 feet." and its Aura rule radius 0 -> 30.
// R5 Size: swallow-whole "[Listed Size]" -> the label one size smaller than the
//    creature; trample "[Size]" -> "<label one size smaller> or smaller". Size
//    order: tiny, sm, med, lg, huge, grg. A tiny creature cannot be filled (null).
// R6 Trample strike: "[Listed Strike]" -> the name of the creature's melee Strike
//    with the highest average damage (averageDamage). No melee Strike -> null.
// R7 Rupture: "Rupture [0]" -> lookup(AREA_DAMAGE_AVERAGE, level, "unlimited").
//
// Published sf2e NPCs use the same shapes (foundryvtt/pf2e v14-dev 52dfeee,
// sf2e 1.7.0); see /root/sf2e-wt/reports/D-FILL.md for the fit analysis.
//
// After filling, the text must pass hasPlaceholderValues; otherwise null.

import { lookup, SPELL_DC, AREA_DAMAGE, AREA_DAMAGE_AVERAGE, averageDamage, MIN_LEVEL, MAX_LEVEL } from "./tables.mjs";
import { esc, slugify } from "./text.mjs";

/** Glossary abilities that FIX-B fills, keyed by system.slug (or the slugified name). */
export const FILLABLE_ABILITIES = Object.freeze({
  constrict: { dc: "high", damage: "glossary" },
  "greater-constrict": { dc: "high", damage: "ai-or-glossary" },
  "swallow-whole": { damage: "glossary", rupture: true, size: "smaller" },
  engulf: { dc: "moderate", damage: "ai-or-bludgeoning", rupture: true, escape: true },
  trample: { dc: "high", size: "smaller-or-smaller", strike: true },
  "frightful-presence": { dc: "moderate", distance: 90, aura: true },
  stench: { dc: "moderate", distance: 30, aura: true }
});

/** Damage types the AI may choose (R3). Anything else is ignored. */
export const ABILITY_DAMAGE_TYPES = Object.freeze([
  "bludgeoning", "piercing", "slashing", "acid", "cold", "electricity", "fire", "sonic", "poison"
]);

/** DC scales the AI may choose (R1). Anything else falls back to the default. */
export const ABILITY_DC_SCALES = Object.freeze(["moderate", "high"]);

const SIZE_ORDER = ["tiny", "sm", "med", "lg", "huge", "grg"];
const SIZE_LABEL = { tiny: "Tiny", sm: "Small", med: "Medium", lg: "Large", huge: "Huge", grg: "Gargantuan" };

/**
 * Blank placeholder values left in published glossary text (I-ZERO): a damage
 * roll of (0), an inline check with no DC, a dc=0 link, a bare [0], a
 * paragraph that opens with "0 feet." (the placeholder distance), or a
 * bracketed fill-in such as [Listed Size]. Patterns, not a list of names.
 */
const PLACEHOLDER_TEXT = [
  /@Damage\[\(0\)/,
  /\|dc:(?=[|\]])/,
  /\bdc=0\b/,
  /\[0\]/,
  /<p>0 feet\.(?=\s|@)/,
  /\[Listed [A-Za-z ]+\]|\[(?:Size|Strike)\]/
];

/**
 * True when a published ability document still has blank placeholder text, so
 * cloning it would put blank numbers on the sheet. Pure. Rules are not read:
 * a published Aura of radius 0 can carry filled text (Stench, crest-eater).
 */
export function hasPlaceholderValues(doc) {
  const text = String(doc?.system?.description?.value ?? "");
  return PLACEHOLDER_TEXT.some((pattern) => pattern.test(text));
}

/** system.slug when present (index or document), else the slugified name. */
export function fillableSlug(item) {
  return String(item?.system?.slug || slugify(String(item?.name ?? "")) || "");
}

/** True for a blank glossary entry that FIX-B can fill. */
export function isFillableEntry(entry) {
  return Object.hasOwn(FILLABLE_ABILITIES, fillableSlug(entry));
}

/**
 * Fill the blank tokens of one glossary ability for a creature.
 * @param {object} itemData   item data (toObject of the glossary document); not mutated
 * @param {{level: number, size: string, strikes?: {name: string, damage: string, type?: string}[],
 *          dcScale?: string|null, damageType?: string|null}} creature
 * @returns {object|null} new item data, or null when the ability cannot be filled
 */
export function fillPlaceholderAbility(itemData, { level, size, strikes = [], dcScale = null, damageType = null } = {}) {
  const slug = fillableSlug(itemData);
  if (!Object.hasOwn(FILLABLE_ABILITIES, slug)) return null;
  const rule = FILLABLE_ABILITIES[slug];
  const lv = Number(level);
  if (!Number.isInteger(lv) || lv < MIN_LEVEL || lv > MAX_LEVEL) return null;

  let text = String(itemData?.system?.description?.value ?? "");
  // Replace every match of `pattern` and report whether exactly `expected` matched.
  const fill = (pattern, replacer, expected) => {
    let count = 0;
    text = text.replace(pattern, (...args) => {
      count += 1;
      return replacer(...args);
    });
    return count === expected;
  };
  let ok = true;

  // R1 DC and R2 escape DC.
  if (rule.dc) {
    const scale = ABILITY_DC_SCALES.includes(dcScale) ? dcScale : rule.dc;
    const dc = lookup(SPELL_DC, lv, scale, []);
    ok = fill(/dc:(?=[|\]])/g, () => `dc:${dc}`, 1) && ok;
    if (rule.escape) ok = fill(/dc=0\b/g, () => `dc=${dc}`, 1) && ok;
  }

  // R3 damage dice and type.
  if (rule.damage) {
    const dice = lookup(AREA_DAMAGE, lv, "unlimited", []);
    const aiType = ABILITY_DAMAGE_TYPES.includes(damageType) ? damageType : null;
    ok = fill(/@Damage\[\(0\)\[([a-zA-Z]+)\]\]/g, (_match, glossType) => {
      let type = glossType;
      if (rule.damage === "ai-or-bludgeoning") type = aiType ?? "bludgeoning";
      else if (rule.damage === "ai-or-glossary") type = aiType ?? glossType;
      return `@Damage[(${dice})[${type}]]`;
    }, 1) && ok;
  }

  // R7 rupture.
  if (rule.rupture) {
    const average = lookup(AREA_DAMAGE_AVERAGE, lv, "unlimited", []);
    ok = fill(/Rupture \[0\]/g, () => `Rupture ${average}`, 1) && ok;
  }

  // R4 distance.
  if (rule.distance) {
    ok = fill(/^<p>0 feet\./, () => `<p>${rule.distance} feet.`, 1) && ok;
  }

  // R5 size.
  if (rule.size) {
    const index = SIZE_ORDER.indexOf(size);
    if (index <= 0) return null;
    const smaller = SIZE_LABEL[SIZE_ORDER[index - 1]];
    ok = rule.size === "smaller"
      ? fill(/\[Listed Size\]/g, () => smaller, 1) && ok
      : fill(/\[Size\]/g, () => `${smaller} or smaller`, 1) && ok;
  }

  // R6 trample strike.
  if (rule.strike) {
    const melee = strikes.filter((s) => s?.name && s?.damage && s.type !== "ranged");
    const best = melee.reduce((top, s) => (!top || averageDamage(s.damage) > averageDamage(top.damage) ? s : top), null);
    if (!best) return null;
    ok = fill(/\[Listed Strike\]/g, () => esc(best.name), 1) && ok;
  }

  // R4 aura radius (stench only).
  let rules = itemData?.system?.rules ?? [];
  if (rule.aura) {
    const auras = rules.filter((r) => r?.key === "Aura" && Number(r.radius) === 0);
    if (auras.length !== 1) return null;
    rules = rules.map((r) => (r === auras[0] ? { ...r, radius: rule.distance } : r));
  }

  if (!ok) return null;
  if (hasPlaceholderValues({ system: { description: { value: text } } })) return null;

  const out = structuredClone(itemData);
  out.system.description = { ...(out.system.description ?? {}), value: text };
  if (rule.aura) out.system.rules = rules;
  return out;
}
