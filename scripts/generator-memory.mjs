// Remembers the GM's last Generator settings per browser. Pure: the app reads
// and writes the Foundry setting; this module only decides what is kept.
import { THREATS } from "./encounter.mjs";
import { TREASURE_AMOUNT_MULTIPLIER } from "./tables.mjs";

export const REMEMBERED_FIELDS = ["mode", "level", "rarity", "adjustment", "allowSpellcasting", "preset", "partySize", "threat", "treasureAmount", "rarityCap"];

// Reskin is left out: its dropped source is never remembered.
const MODES = ["monster", "npc", "encounter", "character"];
const RARITIES = ["common", "uncommon", "rare", "unique"];
const ADJUSTMENTS = ["elite", "weak"];
const THREAT_KEYS = Object.keys(THREATS);
const TREASURE_KEYS = Object.keys(TREASURE_AMOUNT_MULTIPLIER);

/** The subset of the Generator input that is safe to remember. The prompt is never stored. */
export function rememberedInput(input) {
  const out = {};
  for (const field of REMEMBERED_FIELDS) out[field] = input?.[field];
  return out;
}

/**
 * Apply saved settings over defaults. Each field is kept only when valid;
 * anything else falls back to the default. `prompt` is never read.
 */
export function restoreGeneratorInput(saved, defaults) {
  const out = { ...defaults };
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return out;

  if (MODES.includes(saved.mode)) out.mode = saved.mode;

  if (typeof saved.level === "number" && Number.isFinite(saved.level)) {
    const [min, max] = ["monster", "npc"].includes(out.mode) ? [-1, 24] : [1, 20];
    out.level = Math.min(max, Math.max(min, Math.round(saved.level)));
  }

  if (RARITIES.includes(saved.rarity)) out.rarity = saved.rarity;
  if (RARITIES.includes(saved.rarityCap)) out.rarityCap = saved.rarityCap;
  if (ADJUSTMENTS.includes(saved.adjustment) || saved.adjustment === null) out.adjustment = saved.adjustment;
  if (typeof saved.allowSpellcasting === "boolean") out.allowSpellcasting = saved.allowSpellcasting;
  if (typeof saved.preset === "string" && saved.preset.length <= 200) out.preset = saved.preset;

  if (typeof saved.partySize === "number" && Number.isFinite(saved.partySize)) {
    out.partySize = Math.min(8, Math.max(1, Math.round(saved.partySize)));
  }

  if (THREAT_KEYS.includes(saved.threat)) out.threat = saved.threat;
  if (TREASURE_KEYS.includes(saved.treasureAmount)) out.treasureAmount = saved.treasureAmount;

  return out;
}
