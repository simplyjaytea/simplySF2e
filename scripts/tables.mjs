/**
 * SF2e provenance (verified against Starfinder GM Core Chapter 2 "Building Games"
 * pp. 116–128 and foundryvtt/pf2e v14-dev compendiums):
 * - CITED SF2e: LEVEL_DC (+RARITY_DC_ADJUSTMENT), TREASURE_BY_LEVEL L1-20
 *   totals, identificationDC mapping, Moderate 80 XP input.
 * - CITED SF2e: Building Creatures stat arrays (ABILITY_MODIFIER,
 *   PERCEPTION_AND_SAVES, SKILL, AC, HP, STRIKE_ATTACK, STRIKE_DAMAGE,
 *   SPELL_DC, SPELL_ATTACK, RESISTANCE) verified against Starfinder GM Core
 *   pp. 116–128 (Rules 989–1025). Values calibrated for SF2e Alien Core.
 * Every array is indexed by creature level, from -1 to 24 (use `idx(level)`).
 *
 * Rules data used under the ORC License; see README for attribution.
 */

export const MIN_LEVEL = -1;
export const MAX_LEVEL = 24;

/** Convert a creature level (-1..24) into a table row index. */
function idx(level) {
  const lv = Math.clamp ? Math.clamp(level, MIN_LEVEL, MAX_LEVEL) : Math.min(Math.max(level, MIN_LEVEL), MAX_LEVEL);
  return lv + 1;
}

/* ------------------------------------------------------------------ */
/* CITED SF2e (Starfinder GM Core pg. 118 "Attribute Modifier Scales") —
 * Extreme is unavailable below level 1 (falls back to high). */
export const ABILITY_MODIFIER = {
  //        lvl -1  0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24
  extreme:  [null, null, 5,  5,  5,  6,  6,  7,  7,  7,  7,  8,  8,  8,  9,  9,  9, 10, 10, 10, 11, 11, 11, 12, 12, 13],
  high:     [3,  3,  4,  4,  4,  5,  5,  5,  6,  6,  6,  7,  7,  7,  8,  8,  8,  9,  9,  9, 10, 10, 10, 10, 10, 12],
  moderate: [2,  2,  3,  3,  3,  3,  4,  4,  4,  4,  4,  5,  5,  5,  5,  5,  6,  6,  6,  6,  6,  7,  7,  8,  8,  9],
  low:      [0,  0,  1,  1,  1,  2,  2,  2,  2,  3,  3,  3,  3,  4,  4,  4,  4,  5,  5,  5,  5,  6,  6,  6,  6,  7]
};

/* CITED SF2e (Starfinder GM Core pg. 119 "Perception", pg. 122 "Saving Throws") —
 * Perception and saving throws share the same benchmark numbers. */
export const PERCEPTION_AND_SAVES = {
  extreme:  [9, 10, 11, 12, 14, 15, 17, 18, 20, 21, 23, 24, 26, 27, 29, 30, 32, 33, 35, 36, 38, 39, 41, 43, 44, 46],
  high:     [8,  9, 10, 11, 12, 14, 15, 17, 18, 19, 21, 22, 24, 25, 26, 28, 29, 30, 32, 33, 35, 36, 38, 39, 40, 42],
  moderate: [5,  6,  7,  8,  9, 11, 12, 14, 15, 16, 18, 19, 21, 22, 23, 25, 26, 28, 29, 30, 32, 33, 35, 36, 37, 38],
  low:      [2,  3,  4,  5,  6,  8,  9, 11, 12, 13, 15, 16, 18, 19, 20, 22, 23, 25, 26, 27, 29, 30, 32, 33, 34, 36],
  terrible: [0,  1,  2,  3,  4,  6,  7,  8, 10, 11, 12, 14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32]
};

/* CITED SF2e (Starfinder GM Core pg. 120 "Skills") — Skill benchmarks. */
export const SKILL = {
  extreme:  [8,  9, 10, 11, 13, 15, 16, 18, 20, 21, 23, 25, 26, 28, 30, 31, 33, 35, 36, 38, 40, 41, 43, 45, 46, 48],
  high:     [5,  6,  7,  8, 10, 12, 13, 15, 17, 18, 20, 22, 23, 25, 27, 28, 30, 32, 33, 35, 37, 38, 40, 42, 43, 45],
  moderate: [4,  5,  6,  7,  9, 10, 12, 13, 15, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 37, 38, 40],
  low:      [2,  3,  4,  5,  7,  8, 10, 11, 13, 14, 16, 17, 19, 20, 22, 23, 25, 26, 28, 29, 31, 32, 34, 35, 36, 38]
};

/* CITED SF2e (Starfinder GM Core pg. 121 "Armor Class") — Armor Class benchmarks. */
export const AC = {
  extreme:  [18, 19, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 37, 39, 40, 42, 43, 45, 46, 48, 49, 51, 52, 54],
  high:     [15, 16, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 37, 39, 40, 42, 43, 45, 46, 48, 49, 51],
  moderate: [14, 15, 15, 17, 18, 20, 21, 23, 24, 26, 27, 29, 30, 32, 33, 35, 36, 38, 39, 41, 42, 44, 45, 47, 48, 50],
  low:      [12, 13, 13, 15, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 37, 39, 40, 42, 43, 45, 46, 48]
};

/* CITED SF2e (Starfinder GM Core pg. 122 "Hit Points") — Hit points use the
 * midpoint of each printed range. */
export const HP = {
  high:     [9, 18, 25, 38, 56, 75, 94, 119, 144, 169, 194, 219, 244, 269, 294, 319, 344, 369, 394, 419, 444, 469, 500, 538, 575, 625],
  moderate: [7, 15, 20, 30, 45, 60, 75,  95, 115, 135, 155, 175, 195, 215, 235, 255, 275, 295, 315, 335, 355, 375, 400, 430, 460, 500],
  low:      [5, 12, 15, 23, 34, 45, 56,  71,  86, 101, 116, 131, 146, 161, 176, 191, 206, 221, 236, 251, 266, 281, 300, 323, 345, 375]
};

/* CITED SF2e (Starfinder GM Core pg. 124 "Strike Attack Bonus") — Strike attack bonuses. */
export const STRIKE_ATTACK = {
  extreme:  [10, 10, 11, 13, 14, 16, 17, 19, 20, 22, 23, 25, 27, 28, 29, 31, 32, 34, 35, 37, 38, 40, 41, 43, 44, 46],
  high:     [8,  8,  9, 11, 12, 14, 15, 17, 18, 20, 21, 23, 24, 26, 27, 29, 30, 32, 33, 35, 36, 38, 39, 41, 43, 45],
  moderate: [6,  6,  7,  9, 10, 12, 13, 15, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 37, 39, 40, 42],
  low:      [4,  4,  5,  7,  8,  9, 11, 12, 13, 15, 16, 17, 19, 20, 21, 23, 24, 25, 27, 28, 29, 31, 32, 33, 35, 36]
};

/* CITED SF2e (Starfinder GM Core pg. 124 "Strike Damage") — Strike damage expressed
 * as ready-to-roll dice formulas. */
export const STRIKE_DAMAGE = {
  extreme: [
    "1d6+1", "1d6+3", "1d8+4", "1d12+4", "1d12+8", "2d10+7", "2d12+7", "2d12+10",
    "2d12+12", "2d12+15", "2d12+17", "2d12+20", "2d12+22", "3d12+19", "3d12+21",
    "3d12+24", "3d12+26", "3d12+29", "3d12+31", "3d12+34", "4d12+29", "4d12+32",
    "4d12+34", "4d12+37", "4d12+39", "4d12+42"
  ],
  high: [
    "1d4+1", "1d6+2", "1d6+3", "1d10+4", "1d10+6", "2d8+5", "2d8+7", "2d8+9",
    "2d10+9", "2d10+11", "2d10+13", "2d12+13", "2d12+15", "3d10+14", "3d10+16",
    "3d10+18", "3d12+17", "3d12+18", "3d12+19", "3d12+20", "4d10+20", "4d10+22",
    "4d10+24", "4d10+26", "4d10+27", "4d12+26"
  ],
  moderate: [
    "1d4", "1d4+2", "1d6+2", "1d8+4", "1d8+6", "2d6+5", "2d6+6", "2d6+8",
    "2d8+8", "2d8+9", "2d8+11", "2d10+11", "2d10+12", "3d8+12", "3d8+14",
    "3d8+15", "3d10+14", "3d10+15", "3d10+16", "3d10+17", "4d8+17", "4d8+19",
    "4d8+20", "4d8+22", "4d8+23", "4d10+22"
  ],
  low: [
    "1d4", "1d4+1", "1d4+2", "1d6+3", "1d6+5", "2d4+4", "2d4+6", "2d4+7",
    "2d6+6", "2d6+8", "2d6+9", "2d6+10", "2d8+10", "3d6+10", "3d6+11",
    "3d6+13", "3d6+14", "3d6+15", "3d6+16", "3d6+17", "4d6+14", "4d6+15",
    "4d6+17", "4d6+18", "4d6+19", "4d6+21"
  ]
};

/* CITED SF2e (Starfinder GM Core pg. 126 "Spell DCs") — Spell DC benchmarks. */
export const SPELL_DC = {
  extreme:  [19, 19, 20, 22, 23, 25, 26, 27, 29, 30, 32, 33, 34, 36, 37, 39, 40, 41, 43, 44, 46, 47, 48, 50, 51, 52],
  high:     [16, 16, 17, 18, 20, 21, 22, 24, 25, 26, 28, 29, 30, 32, 33, 34, 36, 37, 38, 40, 41, 42, 44, 45, 46, 48],
  moderate: [13, 13, 14, 15, 17, 18, 19, 21, 22, 23, 25, 26, 27, 29, 30, 31, 33, 34, 35, 37, 38, 39, 41, 42, 43, 45]
};

/* CITED SF2e (Starfinder GM Core pg. 126 "Spell Attack Roll") — Spell attack benchmarks. */
export const SPELL_ATTACK = {
  extreme:  [11, 11, 12, 14, 15, 17, 18, 19, 21, 22, 24, 25, 26, 28, 29, 31, 32, 33, 35, 36, 38, 39, 40, 42, 43, 44],
  high:     [8,  8,  9, 10, 12, 13, 14, 16, 17, 18, 20, 21, 22, 24, 25, 26, 28, 29, 30, 32, 33, 34, 36, 37, 38, 40],
  moderate: [5,  5,  6,  7,  9, 10, 11, 13, 14, 15, 17, 18, 19, 21, 22, 23, 25, 26, 27, 29, 30, 31, 33, 34, 35, 37]
};
/* Level-based DCs — CITED SF2e (verified 2026-09-26): GM Screen "DCs by Level"
 * page (pBS3DUjlzVuFgapv, Starfinder GM Core pg 53), programmatic diff L0-24
 * zero mismatches; src/module/dc.ts dcByLevel agrees (plus L-1=13, L25=50).
 * Rarity adjustments CITED: "DC Adjustments" page (7zHsWW9q6YqiMIwy, pg 53)
 * + dc.ts dcAdjustments map agree exactly. Used for Recall Knowledge checks. */
export const LEVEL_DC = {
  dc: [13, 14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 38, 39, 40, 42, 44, 46, 48]
};

export const RARITY_DC_ADJUSTMENT = { common: 0, uncommon: 2, rare: 5, unique: 10 };

/** CITED SF2e skill mapping: "Creature Identification" page (oEyx39yADr2OjfTz,
 * pg 54); SF2e journal is a superset (adds Robot row). The DC to
 * identify/recall knowledge about a creature of this level+rarity. */
export function identificationDC(level, rarity = "common") {
  return lookup(LEVEL_DC, level, "dc", []) + (RARITY_DC_ADJUSTMENT[rarity] ?? 0);
}

/* CITED SF2e (Starfinder GM Core pg. 123 "Resistances and Weaknesses") — Resistance benchmarks. */
export const RESISTANCE = {
  maximum: [1, 3, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 23, 24, 25, 26],
  minimum: [1, 1, 2, 2, 3, 4, 4, 5,  5,  6,  6,  7,  7,  8,  8,  9,  9,  9, 10, 10, 10, 11, 11, 12, 12, 13]
};

/* ------------------------------------------------------------------ */
/* Treasure budgets — CITED SF2e for L1-20 totals (verified 2026-09-26).
 * GM Screen "Treasure" page (Dae8LHdXZuBv06Jk, Starfinder GM Core pg 59/61),
 * "Party Treasure by Level" table in credits; programmatic diff L1-20 totals
 * vs TREASURE_BY_LEVEL x 10 zero mismatches (e.g. L10 80,000 = 8,000x10).
 * Consistent with cited 1 gp = 10 credits mapping. Unit differs: this file
 * stores gp, SF2e prints credits. SF2e permanent-item / consumable /
 * party-currency split columns have no counterpart here.
 *
 * The published table covers CHARACTER levels 1-20 only (this is a
 * party-progression table, not a creature table): it is the total treasure a
 * party should accumulate across a whole level of play. The -1/0 and 21-24
 * rows are OUR extrapolation so the table indexes like every other table in
 * this file: level 0 ≈ half of level 1, level -1 ≈ half of level 0; levels
 * 21-24 continue the late-game compounding curve at ~1.45x per level
 * (consistent with the 17-19 trend). These edge rows are a reasoned
 * assumption, not published data.
 *
  * Verified 2026-09-26: L1-20 totals match the SF2e Party Treasure table at
 * x10 exactly, including the 19→20 step (355,000 → 490,000 gp;
 * 3,550,000 → 4,900,000 credits). Shape anomaly retained as printed source
 * data, not a transcription error.
 *
 * ORC-licensed reference data — see README attribution section. */
export const TREASURE_BY_LEVEL = {
  //      lvl  -1   0    1    2    3    4     5     6     7     8     9    10
  total: [    45,  90, 175, 300, 500, 850, 1350, 2000, 2900, 4000, 5700, 8000,
  //      lvl  11     12     13     14     15     16      17      18      19      20
          11500, 16500, 25000, 36500, 54500, 82500, 128000, 208000, 355000, 490000,
  //      lvl     21       22       23       24   (extrapolated, see above)
          710000, 1030000, 1500000, 2200000]
};

/* NO SF2e SOURCE — module design choice, not published data, layered on top
 * of the level baseline: uncommon/rare/unique creatures carry above-average
 * treasure for their level. */
export const RARITY_TREASURE_MULTIPLIER = { common: 1, uncommon: 1.5, rare: 2.5, unique: 4 };

/* How many encounters a party plays per level: Moderate = 80 XP CITED via
 * GM Screen "Encounter Budget" page (WZgFEMDSP9TvYc4u, pg 75); per-creature
 * XP ladder CITED via "XP Awards" page (ZcddTU02joqYuuoV, pg 56). The
 * "1,000 XP to level" premise is UNVERIFIED against an SF2e source — derivation
  * 1000/80 = 12.5 stays as stated assumption. This converts the per-level
 * treasure total above into a per-encounter (per-creature) share. Previously
 * hardcoded to 4 as a "reasoned pacing assumption", which overpaid treasure
 * per encounter by ~3x — bug caught in live play testing. CAVEAT: GM Core
 * also publishes a "Treasure by Encounter" table directly (not derived); an
 * independent audit recalled it running maybe 20-25% richer than this /12.5
 * derivation, since not all 1,000 XP/level comes from treasure-bearing
 * fights. Medium confidence, unverified against the book — if loot still
 * feels thin after this fix, check that table before nudging this constant
 * back up. */
export const ENCOUNTERS_PER_LEVEL = 1000 / 80;

/* NO SF2e SOURCE — module design choice, not published data. The
 * per-generation "Treasure amount"
 * control (Stingy/Standard/Generous), applied on top of level + rarity budget. */
export const TREASURE_AMOUNT_MULTIPLIER = { stingy: 0.5, standard: 1, generous: 1.5 };

/**
 * Expected gp value of one creature's carried treasure: the per-encounter
 * share of the level's total, scaled by creature rarity and the GM's
 * per-generation Treasure amount setting. In encounter mode, pass the PARTY
 * level (treasure is calibrated to the players receiving it), not each
 * member's own creature level.
 */
export function treasureBudget(level, rarity = "common", amount = "standard") {
  const perEncounter = lookup(TREASURE_BY_LEVEL, level, "total", []) / ENCOUNTERS_PER_LEVEL;
  return Math.round(
    perEncounter
    * (RARITY_TREASURE_MULTIPLIER[rarity] ?? 1)
    * (TREASURE_AMOUNT_MULTIPLIER[amount] ?? 1)
  );
}

/* ------------------------------------------------------------------ */

/**
 * Look up a benchmark value.
 * @param {object} table   One of the exported table objects.
 * @param {number} level   Creature level (-1..24).
 * @param {string} scale   Scale name (extreme/high/moderate/low/terrible).
 * @param {string[]} fallbacks  Scales to try if the requested one is missing.
 */
export function lookup(table, level, scale, fallbacks = ["high", "moderate", "low"]) {
  const i = idx(level);
  const chain = [scale, ...fallbacks];
  for (const s of chain) {
    const column = table[s];
    if (column && column[i] !== null && column[i] !== undefined) return column[i];
  }
  const first = Object.values(table)[0];
  return first[i];
}

/** Average value of a dice formula like "2d8+9" (for preview display). */
export function averageDamage(formula) {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(formula.replaceAll(" ", ""));
  if (!m) return null;
  const [, n, faces, mod] = m;
  return Math.floor(Number(n) * (Number(faces) + 1) / 2 + Number(mod ?? 0));
}
