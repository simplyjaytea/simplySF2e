// "Area Blast" ability template (T-BLAST). When the AI describes a bespoke
// breath or blast, the module builds a working 2-action ability from enum words
// and cited tables. The AI never writes numbers.
//
// CITED / APPROVED (JT, 2026-11-05), level = the creature's level:
// B1 distance: cone small 15, medium 30, large 60; line small 30, medium 30, large 60.
//    Shape of published blasts: /root/sf2e-wt/reports/D-BLAST.md (cone and line
//    distances in published copies: cone 15/20/30/40/50/60, line 5/30/60).
// B2 damage dice: AREA_DAMAGE (GM Core pg. 128) limited column when use is limited,
//    else the unlimited column. No "2 levels lower" adjustment.
// B3 DC: SPELL_DC (GM Core pg. 126) at abilityDcScale (default high).
// B4 actions: 2.
// B5 description: the published form (published scaffolds: sf2e 52dfeee,
//    starfinder-society-bestiary nodocite-blaster.json "Lightning Spray", actor
//    TUDnG2r3f2YDF0Jx, item hXL6Fa0LOY42fSFV; alien-core-bestiary host-dragon-young.json
//    "Swarm Breath", item xCKxNit5WWVs9p8f). A limited blast adds the recharge sentence.
//
// The item shape is the published scaffold's (type action, category offensive, no
// rules, no publication data).

import { lookup, SPELL_DC, AREA_DAMAGE, MIN_LEVEL, MAX_LEVEL } from "./tables.mjs";
import { esc, plainAiText } from "./text.mjs";

export const AREA_BLAST_SHAPES = Object.freeze(["cone", "line"]);
export const AREA_BLAST_SIZES = Object.freeze(["small", "medium", "large"]);
export const AREA_BLAST_SAVES = Object.freeze(["reflex", "fortitude", "will"]);
export const AREA_BLAST_USES = Object.freeze(["at-will", "limited"]);
export const AREA_BLAST_DAMAGE_TYPES = Object.freeze([
  "fire", "piercing", "electricity", "poison", "bludgeoning", "acid", "spirit", "mental",
  "sonic", "slashing", "cold", "force", "void"
]);
export const AREA_BLAST_DC_SCALES = Object.freeze(["moderate", "high"]);

/** B1 distances in feet. */
const DISTANCE = Object.freeze({
  cone: Object.freeze({ small: 15, medium: 30, large: 60 }),
  line: Object.freeze({ small: 30, medium: 30, large: 60 })
});

/**
 * The clean template spec from the AI's raw ability, or null. Any invalid enum
 * (or a missing damage type) makes the whole template invalid: the caller then
 * falls back to the narrative-only path. Defaults apply only when a field is absent.
 * @returns {{shape: string, size: string, save: string, use: string, damageType: string, abilityDcScale: string}|null}
 */
export function normalizeAreaBlast(raw) {
  if (raw?.template !== "area-blast") return null;
  const spec = {
    shape: raw.shape ?? null,
    size: raw.size ?? "medium",
    save: raw.save ?? "reflex",
    use: raw.use ?? "at-will",
    damageType: raw.damageType ?? null,
    abilityDcScale: raw.abilityDcScale ?? "high"
  };
  const valid = AREA_BLAST_SHAPES.includes(spec.shape)
    && AREA_BLAST_SIZES.includes(spec.size)
    && AREA_BLAST_SAVES.includes(spec.save)
    && AREA_BLAST_USES.includes(spec.use)
    && AREA_BLAST_DAMAGE_TYPES.includes(spec.damageType)
    && AREA_BLAST_DC_SCALES.includes(spec.abilityDcScale);
  return valid ? spec : null;
}

/**
 * Item data for a 2-action area blast at this level, or null (level outside the
 * tables, or an invalid spec). The description has no placeholder tokens.
 * @param {object} spec    from normalizeAreaBlast
 * @param {{level: number, name?: string, flavor?: string}} creature
 */
export function buildAreaBlast(spec, { level, name, flavor = "" } = {}) {
  const lv = Number(level);
  if (!spec || !Number.isInteger(lv) || lv < MIN_LEVEL || lv > MAX_LEVEL) return null;
  const distance = DISTANCE[spec.shape]?.[spec.size];
  if (!distance) return null;
  const limited = spec.use === "limited";
  const dice = lookup(AREA_DAMAGE, lv, limited ? "limited" : "unlimited", []);
  const dc = lookup(SPELL_DC, lv, spec.abilityDcScale, []);
  // AI text: inline-syntax characters removed (plainAiText), then HTML-escaped.
  // Flavor that still carries enricher or roll syntax is blanked, not escaped into live mechanics.
  const label = plainAiText(name) || "Area Blast";
  const rollName = label;
  const safeName = esc(label);
  const rawFlavor = String(flavor ?? "");
  const text = /[@\[\]{}]/.test(rawFlavor) ? "" : plainAiText(rawFlavor);
  const lead = text ? `${esc(text)} ` : "";
  const recharge = limited ? ` It can't use ${safeName} again for [[/gmr 1d4 #Recharge ${esc(rollName)}]]{1d4 rounds}.` : "";
  const description = `<p>${lead}The creature deals @Damage[${dice}[${spec.damageType}]|options:area-damage] damage in a @Template[type:${spec.shape}|distance:${distance}] (@Check[${spec.save}|dc:${dc}|basic|options:area-effect] save).${recharge}</p>`;
  return {
    name: label,
    type: "action",
    img: "systems/sf2e/icons/default-icons/action.svg",
    system: {
      actionType: { value: "action" },
      actions: { value: 2 },
      category: "offensive",
      rules: [],
      slug: null,
      traits: { value: [] },
      description: { value: description }
    }
  };
}

/* -------------------- Aura (T-AURA) --------------------
 * A1 radius: condition kind small 10, medium 30, large 90; damage kind small 5, medium 10, large 30.
 *    Published aura radii (D-AURA.md §2): condition auras 10/30/90 are common; damaging 5/10/30.
 * A2 DC: SPELL_DC (GM Core pg. 126) at abilityDcScale, default moderate (GM Core pg. 129: an
 *    aura's DC is usually the moderate spell DC unless it is a defining concept; D-AURA.md §3).
 * A3 condition save is fixed by the condition: frightened and stupefied will; sickened and
 *    enfeebled fortitude; clumsy reflex. Damage kind uses the AI's save (default fortitude).
 * A4 condition value: 1 at level <= 7, 2 at 8-13, 3 at level >= 14; capped at 2 for frightened,
 *    clumsy, stupefied and enfeebled (published values, D-AURA.md §5).
 * A5 damage dice: AREA_DAMAGE unlimited (GM Core pg. 128) at max(level - 2, -1); basic save
 *    (published damaging auras sit at or below the unlimited column; D-AURA.md §4).
 * A6 description: published wording (D-AURA.md §6). A creature that succeeds on a condition
 *    save is temporarily immune to the aura for 1 minute.
 * A7 item shape: the published scaffold "Ionizing Presence" (tales-from-the-vast-bestiary
 *    moonside-250-terror/electrovore-nuclear-mummy.json, actor 8mrbCW1egVL4Jg40, item
 *    8gU6KuA7pEPKq2D6, sf2e 52dfeee): passive action with rules [{key: "Aura", radius}] only.
 */
export const AURA_KINDS = Object.freeze(["condition", "damage"]);
export const AURA_CONDITIONS = Object.freeze(["frightened", "sickened", "clumsy", "stupefied", "enfeebled"]);
export const AURA_SAVES = Object.freeze(["fortitude", "reflex", "will"]);
const AURA_RADIUS = Object.freeze({
  condition: Object.freeze({ small: 10, medium: 30, large: 90 }),
  damage: Object.freeze({ small: 5, medium: 10, large: 30 })
});
const AURA_CONDITION_SAVE = Object.freeze({ frightened: "will", stupefied: "will", sickened: "fortitude", enfeebled: "fortitude", clumsy: "reflex" });
const AURA_CAPPED = new Set(["frightened", "clumsy", "stupefied", "enfeebled"]);

/** A4: the condition value for a level. */
export function auraConditionValue(level, condition) {
  const base = level <= 7 ? 1 : level <= 13 ? 2 : 3;
  return AURA_CAPPED.has(condition) ? Math.min(base, 2) : base;
}

/**
 * The clean aura spec from the AI's raw ability, or null (fail closed: any invalid
 * enum, a missing condition, or a missing damage type). Defaults apply when absent.
 * @returns {{kind: string, condition: string|null, size: string, save: string, abilityDcScale: string, damageType: string|null}|null}
 */
export function normalizeAura(raw) {
  if (raw?.template !== "aura") return null;
  const size = raw.size ?? "medium";
  const abilityDcScale = raw.abilityDcScale ?? "moderate";
  if (!AURA_KINDS.includes(raw.kind)) return null;
  if (!AREA_BLAST_SIZES.includes(size) || !AREA_BLAST_DC_SCALES.includes(abilityDcScale)) return null;
  if (raw.kind === "condition") {
    if (!AURA_CONDITIONS.includes(raw.condition)) return null;
    return { kind: "condition", condition: raw.condition, size, save: AURA_CONDITION_SAVE[raw.condition], abilityDcScale, damageType: null };
  }
  const save = raw.save ?? "fortitude";
  if (!AURA_SAVES.includes(save) || !AREA_BLAST_DAMAGE_TYPES.includes(raw.damageType)) return null;
  return { kind: "damage", condition: null, size, save, abilityDcScale, damageType: raw.damageType };
}

/**
 * Item data for an aura at this level, or null (level outside the tables, or an
 * invalid spec). The description has no placeholder tokens. Radius is the single
 * source for the rule and the text (A1).
 * @param {object} spec from normalizeAura
 * @param {{level: number, name?: string, flavor?: string}} creature
 */
export function buildAura(spec, { level, name, flavor = "" } = {}) {
  const lv = Number(level);
  if (!spec || !Number.isInteger(lv) || lv < MIN_LEVEL || lv > MAX_LEVEL) return null;
  const radius = AURA_RADIUS[spec.kind]?.[spec.size];
  if (!radius) return null;
  const dc = lookup(SPELL_DC, lv, spec.abilityDcScale, []);
  const label = plainAiText(name) || "Aura";
  const safeName = esc(label);
  const rawFlavor = String(flavor ?? "");
  const text = /[@\[\]{}]/.test(rawFlavor) ? "" : plainAiText(rawFlavor);
  const lead = text ? `${esc(text)} ` : "";
  let description;
  if (spec.kind === "condition") {
    const value = auraConditionValue(lv, spec.condition);
    description = `<p>${radius} feet. ${lead}A creature that enters or begins its turn in the aura must attempt a @Check[${spec.save}|dc:${dc}] save. On a failure, it becomes ${spec.condition} ${value}. A creature that succeeds is temporarily immune to ${safeName} for 1 minute.</p>`;
  } else {
    const dice = lookup(AREA_DAMAGE, Math.max(lv - 2, -1), "unlimited", []);
    description = `<p>${radius} feet. ${lead}A creature that enters or begins its turn in the aura takes @Damage[${dice}[${spec.damageType}]] damage (@Check[${spec.save}|dc:${dc}|basic] save).</p>`;
  }
  return {
    name: label,
    type: "action",
    img: "systems/sf2e/icons/actions/Passive.webp",
    system: {
      actionType: { value: "passive" },
      actions: { value: null },
      category: "defensive",
      rules: [{ key: "Aura", radius }],
      slug: null,
      traits: { value: ["aura"] },
      description: { value: description }
    }
  };
}

/** True for an ability the module builds as a template (area blast or aura). */
export function isModuleTemplate(ability) {
  return Boolean(ability?.areaBlast || ability?.aura);
}

/** The item for a module-built template at this level, or null (fail closed). */
export function buildModuleTemplate(ability, { level }) {
  if (ability?.areaBlast) return buildAreaBlast(ability.areaBlast, { level, name: ability.name, flavor: ability.description });
  if (ability?.aura) return buildAura(ability.aura, { level, name: ability.name, flavor: ability.description });
  return null;
}
