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
