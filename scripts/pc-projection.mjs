/**
 * Pre-actor projection of PC attribute modifiers and skill ranks, so feat
 * prerequisites can be proven while slots are planned. Pure functions: no
 * Foundry globals, no live actor. The ABC boost helpers below are shared with
 * pc-builder.mjs, which must apply the same boosts the actor will receive.
 */
import { ABILITY_BOOST_LEVELS } from "./pc-tables.mjs";
import { CORE_SKILLS, initialSkillTraining, allocateCharacterSkills } from "./pc-skills.mjs";

export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

export function normalizeAbilityPriorities(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).filter((ability) => {
    if (!ABILITY_KEYS.includes(ability) || seen.has(ability)) return false;
    seen.add(ability);
    return true;
  });
}

/**
 * Deterministic v1 ability-boost assignment: boost the class's key ability
 * and Constitution at every eligible tier, filling the rest of the 4 free
 * boosts from the remaining abilities in a fixed order. This is a reasonable
 * default build, NOT a real point-buy allocation tailored to the concept —
 * out of scope per the plan (no pre-create edit screen in v1); a GM should
 * sanity-check/adjust it before play, same review step as any other preview.
 */
export function boostPriority(keyAbility, preferences = []) {
  const key = ABILITY_KEYS.includes(keyAbility) ? keyAbility : "str";
  const preferred = normalizeAbilityPriorities(preferences).filter((ability) => ability !== key);
  return [key, ...preferred, ...ABILITY_KEYS.filter((ability) => ability !== key && !preferred.includes(ability))];
}

export function assignAbilityBoosts(keyAbility, preferences) {
  const priority = boostPriority(keyAbility, preferences).slice(0, 4);
  const boosts = {};
  for (const level of ABILITY_BOOST_LEVELS) boosts[level] = [...priority];
  return boosts;
}

/**
 * Pick a legal `selected` for every ability-boost slot on a cloned ancestry or
 * background item, so the PF2e system actually applies each boost. An unset
 * `selected` contributes NOTHING (verified: ancestry/background document
 * prepareActorData only pushes slots whose `selected` is truthy — that's why
 * a freshly-attached ancestry/background gave the character no attribute
 * boosts, issue #50 item 1). Slot rules verified against foundryvtt/pf2e item
 * source (ancestry/background data.ts + ancestry document prepareBaseData):
 *   value.length === 1 -> fixed boost, selected forced to value[0]
 *   value.length  >  1 -> constrained choice, pick from the listed options
 *   value.length === 0 -> not a real boost in modern data (legacy/voluntary
 *                          placeholder, e.g. Human's third slot); left untouched
 * Free boosts within one item are kept distinct (remaster "two different
 * abilities"), preferring the character's key ability then Constitution.
 */
export function assignItemBoosts(system, keyAbility, preferences) {
  const boosts = system?.boosts;
  if (!boosts || typeof boosts !== "object") return;
  const priority = boostPriority(keyAbility, preferences);
  const taken = new Set();
  for (const slot of Object.values(boosts)) {
    if (Array.isArray(slot?.value) && slot.value.length === 1) {
      slot.selected = slot.value[0];
      taken.add(slot.value[0]);
    }
  }
  for (const slot of Object.values(boosts)) {
    if (!Array.isArray(slot?.value) || slot.value.length <= 1) continue;
    const pick = priority.find((a) => slot.value.includes(a) && !taken.has(a))
      ?? slot.value.find((a) => !taken.has(a))
      ?? slot.value[0];
    slot.selected = pick;
    taken.add(pick);
  }
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function cloneSystem(value) {
  if (!isObject(value)) return null;
  try {
    return structuredClone(value);
  } catch {
    return null;
  }
}

/** Selected abilities of one ABC item's boost slots, or null when malformed. Empty slots are not boosts. */
function itemBoostPicks(system) {
  if (!isObject(system.boosts)) return null;
  const picks = [];
  for (const slot of Object.values(system.boosts)) {
    if (!Array.isArray(slot?.value)) return null;
    if (slot.value.length === 0) continue;
    if (!ABILITY_KEYS.includes(slot.selected)) return null;
    picks.push(slot.selected);
  }
  return picks;
}

/** Ancestry flaws: a single fixed `value` entry is a flaw; empty slots are skipped; an unresolved choice fails closed. */
function ancestryFlawPicks(system) {
  if (!isObject(system.flaws)) return null;
  const picks = [];
  for (const slot of Object.values(system.flaws)) {
    if (!Array.isArray(slot?.value)) return null;
    if (slot.value.length === 0) continue;
    if (slot.value.length !== 1 || !ABILITY_KEYS.includes(slot.value[0])) return null;
    picks.push(slot.value[0]);
  }
  return picks;
}

/**
 * Projected ability modifiers at `level`, applied in the system's order and
 * rule (verbatim, PF2e sf2e-1.6.1 src/module/actor/character/document.ts
 * prepareBuildData):
 *   for (const section of ["ancestry", "background", "class", 1, 5, 10, 15, 20] as const) {
 *     const boosts = build.attributes.boosts[section];
 *     if (typeof boosts === "string") {
 *       const ability = this.system.abilities[boosts];
 *       ability.mod += ability.mod >= 4 ? 0.5 : 1;
 *     } else if (Array.isArray(boosts)) {
 *       for (const abbrev of boosts) {
 *         const ability = this.system.abilities[abbrev];
 *         ability.mod += ability.mod >= 4 ? 0.5 : 1;
 *       }
 *     }
 *     // Optional and non-optional flaws only come from the ancestry section
 *     const flaws = section === "ancestry" ? build.attributes.flaws[section] : [];
 *     for (const abbrev of flaws) {
 *       const ability = this.system.abilities[abbrev];
 *       ability.mod -= 1;
 *     }
 *   }
 *   ...
 *   attribute.base = Math.trunc(attribute.mod);
 * Each ABC copy gets assignItemBoosts exactly as createCharacterActor does.
 * Returns null for malformed input so callers prove nothing (fail closed).
 */
export function projectAttributeModifiers({ ancestrySystem, backgroundSystem, keyAbility, preferences = [], level } = {}) {
  if (!Number.isInteger(level) || level < 1 || level > 20 || !ABILITY_KEYS.includes(keyAbility)) return null;
  const ancestry = cloneSystem(ancestrySystem);
  const background = cloneSystem(backgroundSystem);
  if (!ancestry || !background) return null;
  assignItemBoosts(ancestry, keyAbility, preferences);
  assignItemBoosts(background, keyAbility, preferences);
  const ancestryBoosts = itemBoostPicks(ancestry);
  const backgroundBoosts = itemBoostPicks(background);
  const ancestryFlaws = ancestryFlawPicks(ancestry);
  if (!ancestryBoosts || !backgroundBoosts || !ancestryFlaws) return null;

  const tiers = assignAbilityBoosts(keyAbility, preferences);
  const sections = [
    { boosts: ancestryBoosts, flaws: ancestryFlaws },
    { boosts: backgroundBoosts, flaws: [] },
    { boosts: [keyAbility], flaws: [] },
    ...ABILITY_BOOST_LEVELS.filter((tier) => tier <= level).map((tier) => ({ boosts: tiers[tier], flaws: [] }))
  ];
  const mods = Object.fromEntries(ABILITY_KEYS.map((ability) => [ability, 0]));
  for (const section of sections) {
    for (const ability of section.boosts) mods[ability] += mods[ability] >= 4 ? 0.5 : 1;
    for (const ability of section.flaws) mods[ability] -= 1;
  }
  return Object.fromEntries(ABILITY_KEYS.map((ability) => [ability, Math.trunc(mods[ability])]));
}

/**
 * Projected skill ranks through `level`: allocateCharacterSkills over the
 * proven ranks (the floor, never lowered), with the class's own
 * skillIncreaseLevels and trainedSkills.additional. `intelligence` and
 * `initialIntelligence` are the projected Int modifiers at `level` and at
 * level 1 (see projectAttributeModifiers). Returns null when allocation
 * reports native-data. `ranksAt(lvl)` gives { slug: rank } at any level up to
 * `level`.
 */
export function projectSkillRanks({ classSystem, backgroundSystem, provenSkills = {}, intelligence, initialIntelligence, keyAbility, priorities = [], level } = {}) {
  const proven = Object.fromEntries(CORE_SKILLS.map((slug) => [slug, provenSkills?.[slug] ?? 0]));
  const plan = allocateCharacterSkills({
    level, additional: classSystem?.trainedSkills?.additional,
    replacements: initialSkillTraining(classSystem, backgroundSystem).replacements,
    intelligence, initialIntelligence, nativeRanks: proven, initialRanks: proven,
    increaseLevels: classSystem?.skillIncreaseLevels?.value, priorities, keyAbility
  });
  if (plan.warnings.includes("native-data")) return null;
  const ranksAt = (lvl) => Object.fromEntries(CORE_SKILLS.map((slug) => {
    let rank = proven[slug];
    if (plan.training.includes(slug) && (plan.trainingLevels[slug] ?? 1) <= lvl) rank = Math.max(rank, 1);
    for (const event of plan.events) if (event.slug === slug && event.level <= lvl) rank = Math.max(rank, event.rank);
    return [slug, rank];
  }));
  return { plan, ranksAt };
}
