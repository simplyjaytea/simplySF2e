/**
 * Item forge assembly: turns a magic-item concept from the AI into real
 * Foundry item data. Two grounding rules keep it honest:
 *
 * 1. Every Rule Element in the output is a CLONE of a real published rule
 *    found on published equipment at or below the chosen level, unchanged
 *    — never an RE authored from memory (Foundry fails
 *    silently on malformed REs, so recall is not trusted here).
 * 2. The price is an empirical benchmark: the median real compendium price
 *    of items at the concept's level, not a remembered price table.
 */

import {
  getPacksFor, EQUIPMENT_TYPES, findEntry, getDocument, toItemData, getEquipmentIndex,
  priceToGp, RARITY_RANK
} from "./compendium.mjs";
import { slugify, capitalized, esc } from "./text.mjs";
import {
  RUNED_ITEM_KINDS, SECONDARY_ADJECTIVE, SECONDARY_RUNE_FIELD, propertyRuneKey, propertyRuneFitsBase,
  findFundamentalRune, getBaseItemCandidates, getPropertyRuneCandidates, getFundamentalRuneTiers,
  EQUIPMENT_GRADES, GRADE_LEVELS, GRADE_CREDITS_DELTA, parseUpgradeCapacity, getGradeTiers, getUpgradeCandidates
} from "./runes.mjs";

/* Re-exported: the item forge UI imports its whole surface from this module. */
export {
  getBaseItemCandidates, getPropertyRuneCandidates, getFundamentalRuneTiers,
  SECONDARY_ADJECTIVE, RUNED_ITEM_KINDS,
  EQUIPMENT_GRADES, GRADE_LEVELS, GRADE_CREDITS_DELTA, parseUpgradeCapacity, getGradeTiers, getUpgradeCandidates
} from "./runes.mjs";
import {
  RARITY_TREASURE_MULTIPLIER, MAX_LEVEL, lookup,
  STRIKE_DAMAGE, SPELL_DC, RARITY_DC_ADJUSTMENT
} from "./tables.mjs";
import { EFFECT_KINDS, DAMAGE_TYPES, ITEM_BONUS_STATISTICS, SENSE_TYPES, SPEED_TYPES } from "./rule-templates.mjs";
export { DAMAGE_TYPES, ITEM_BONUS_STATISTICS, SENSE_TYPES, SPEED_TYPES } from "./rule-templates.mjs";

const RARITIES = new Set(["common", "uncommon", "rare", "unique"]);

/* Item levels the forge accepts (items start at 1; creature MAX_LEVEL caps it). */
export const MIN_ITEM_LEVEL = 1;
export const MAX_ITEM_LEVEL = MAX_LEVEL;

/** Item Forge kinds built from an AI concept (not from a real base item). */
export const CONCEPT_ITEM_KINDS = new Set(["wondrous", "augmentation", "crystal"]);

/*
 * Real sf2e shapes, from foundryvtt/pf2e v14-dev packs/sf2e/equipment:
 * - augmentations/{tech,biotech,magitech,necrograft,apex}/*.json are type
 *   "equipment" with system.usage.value "implanted" and exactly one category
 *   trait (magitech items also carry "magical"). There is no "augmentation"
 *   or "cybernetic" trait (src/scripts/config/traits.ts equipmentTraits).
 *   Apex augmentations are level-17 attribute items, so the forge leaves them out.
 * - solarian-crystals/*.json are type "equipment", usage "other", traits ["magical"].
 *   There is no "solarian" equipment trait and no "crystal" trait.
 */
export const AUGMENTATION_CATEGORIES = Object.freeze(["tech", "biotech", "magitech", "necrograft"]);
export const KIND_USAGE = Object.freeze({ augmentation: "implanted", crystal: "other" });
const UNSUPPORTED_KIND_TRAITS = new Set(["augmentation", "cybernetic", "apex", "solarian", "crystal"]);

/* -------------------- activation (Phase 2) -------------------- */

/* The four activated-effect templates the macro builder knows how to emit. */
export const ACTIVATION_TEMPLATES = new Set(["damage", "heal", "condition", "selfBuff"]);

/* Action costs an activation may declare. */
const ACTION_COSTS = { single: 1, two: 2, three: 3, reaction: "reaction", free: "free" };
const ACTIVATION_DURATIONS = { round: { rounds: 1, label: "1 round" }, minute: { minutes: 1, label: "1 minute" }, "ten-minutes": { minutes: 10, label: "10 minutes" } };
const BULK_VALUES = { negligible: 0, light: 0.1, one: 1, two: 2 };
const POTENCY_CHOICES = { single: 1, double: 2, triple: 3 };
const SECONDARY_CHOICES = { none: 0, standard: 1, greater: 2, major: 3 };

/* The three PF2e saving throws an activation may call for. */
export const SAVE_TYPES = new Set(["fortitude", "reflex", "will"]);

/* Conditions an activation may inflict — the standard PF2e condition slugs.
 * Kept to conditions that apply cleanly to a creature via increaseCondition /
 * toggleCondition; excludes book-keeping conditions (dying, wounded via death)
 * that need special handling. */
export const CONDITION_SLUGS = new Set([
  "blinded", "clumsy", "confused", "controlled", "dazzled", "deafened", "doomed",
  "drained", "enfeebled", "fascinated", "fatigued", "fleeing", "frightened",
  "grabbed", "immobilized", "off-guard", "paralyzed", "petrified", "prone",
  "quickened", "restrained", "sickened", "slowed", "stunned", "stupefied",
  "unconscious", "wounded"
]);

/* Conditions that carry a numeric value (badge). Others are on/off. */
const VALUED_CONDITIONS = new Set([
  "clumsy", "doomed", "drained", "enfeebled", "frightened", "sickened",
  "slowed", "stunned", "stupefied", "wounded"
]);

/** Strip a strike-damage formula down to its dice ("1d8+6" -> "1d8"). */
function diceOnly(formula) {
  return String(formula).match(/^\d+d\d+/)?.[0] ?? "1d6";
}

/**
 * A level-appropriate damage-dice suggestion for an activated item, taken
 * from the GM Core moderate Strike Damage row (dice only, no ability mod).
 * This fixed module default is independent of every model-provided value.
 */
export function damageDiceForLevel(level) {
  return diceOnly(lookup(STRIKE_DAMAGE, level, "moderate"));
}

/**
 * A level-appropriate save DC for an activated item: the GM Core moderate
 * Spell DC benchmark for the level, adjusted for rarity (same shape the
 * creature spell DCs use). This is a module default, not a published item DC.
 */
export function saveDcForLevel(level, rarity = "common") {
  return Math.round(lookup(SPELL_DC, level, "moderate") + (RARITY_DC_ADJUSTMENT[rarity] ?? 0));
}

/* -------------------- shared pack index -------------------- */

/* Types that carry meaningful market prices (EQUIPMENT_TYPES minus treasure —
 * coins and valuables ARE value, they don't have one). */
const PRICED_TYPES = new Set([...EQUIPMENT_TYPES].filter((t) => t !== "treasure"));

/* -------------------- empirical pricing -------------------- */

/* All priced items across the equipment packs, as {level, gp}. Cached. */
let priceSamplesPromise = null;

async function getPriceSamples() {
  priceSamplesPromise ??= (async () => {
    const samples = [];
    const seen = new Set();
    for (const packId of getPacksFor("equipment")) {
      for (const entry of await getEquipmentIndex(packId)) {
        if (!PRICED_TYPES.has(entry.type)) continue;
        const key = slugify(entry.name);
        if (seen.has(key)) continue;
        const gp = priceToGp(entry.system?.price?.value);
        if (gp <= 0) continue;
        seen.add(key);
        samples.push({ level: entry.system?.level?.value ?? 0, gp });
      }
    }
    return samples;
  })();
  return priceSamplesPromise;
}

const MIN_PRICE_SAMPLES = 5;

/* level -> median gp of real items at (or near) that level. */
const medianCache = new Map();

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Empirical gp price benchmark for an item of this level and rarity: the
 * median real compendium price of items at the level, times a rarity
 * multiplier (the same one the treasure budget uses — rarer items carry
 * above-baseline value).
 *
 * When a level has fewer than MIN_PRICE_SAMPLES priced items, the window
 * widens symmetrically (±1, ±2 as the normal sparse-level path, and keeps
 * widening as a documented fallback until enough samples exist) — an
 * extrapolation from the nearest levels with real data, never an invented
 * price table. Returns 0 only when the packs hold no priced items at all.
 */
export async function priceForLevel(level, rarity = "common") {
  const lv = Math.min(Math.max(Math.round(Number(level) || 0), MIN_ITEM_LEVEL), MAX_ITEM_LEVEL);
  if (!medianCache.has(lv)) {
    const samples = await getPriceSamples();
    let base = 0;
    for (let window = 0; window <= MAX_ITEM_LEVEL; window++) {
      const inWindow = samples.filter((s) => Math.abs(s.level - lv) <= window).map((s) => s.gp);
      if (inWindow.length >= MIN_PRICE_SAMPLES) {
        base = median(inWindow);
        if (window > 2) {
          console.log(`simplysf2e | itemforge: few priced items near level ${lv}; price benchmark widened to ±${window} levels`);
        }
        break;
      }
    }
    medianCache.set(lv, base);
  }
  return Math.round(medianCache.get(lv) * (RARITY_TREASURE_MULTIPLIER[rarity] ?? 1));
}

/* -------------------- runed weapons/armor (Phase 3) -------------------- */

/**
 * Coerce a raw AI runed-item concept into a safe shape. Every name is
 * matched back against the real candidate lists the AI was shown — an
 * unmatched property rune is dropped (with a warning), never invented.
 */
/**
 * Coerce a raw AI graded/runed item concept into a safe SF2e shape.
 * In SF2e, weapons and armor scale through `system.grade` (commercial..paragon)
 * and accept installed upgrade modules into `system.subitems`.
 */
export function normalizeRunedItemConcept(raw, {
  kind, rarity, baseCandidates, runeCandidates = [],
  potencyTiers = [], secondaryTiers = [], grades = []
}) {
  const c = typeof raw === "object" && raw !== null ? raw : {};
  const findByName = (list, name) => list.find((x) => slugify(x.name) === slugify(name)) ?? null;

  const base = findByName(baseCandidates, c.baseItemName);
  if (!base) {
    console.warn(`simplysf2e | itemforge: unresolved base ${kind} "${c.baseItemName}"`);
    throw new Error(`The selected base ${kind} could not be matched to the offered compendium items. Generate a new plan.`);
  }

  // Resolve equipment grade (SF2e primary scaling)
  const gradeChoice = slugify(c.grade ?? "");
  const availableGrades = grades.length ? grades : EQUIPMENT_GRADES;
  let grade = "commercial";
  if (availableGrades.includes(gradeChoice)) {
    grade = gradeChoice;
  } else {
    if (c.grade) {
      const why = EQUIPMENT_GRADES.includes(gradeChoice) ? "not offered at this level" : "unknown";
      console.warn(`simplysf2e | itemforge: grade "${c.grade}" ${why}, using ${availableGrades[0] ?? "commercial"}`);
    }
    grade = availableGrades[0] ?? "commercial";
  }

  // Upgrade slots come from the base candidate (see runes.parseUpgradeCapacity).
  const maxSlots = base.upgradeSlots ?? 0;
  const propertyRunes = [];
  const seen = new Set();
  const requestedUpgrades = Array.isArray(c.upgrades) ? c.upgrades
    : Array.isArray(c.propertyRunes) ? c.propertyRunes : [];

  for (const name of requestedUpgrades) {
    if (propertyRunes.length >= maxSlots) break;
    const match = findByName(runeCandidates, name);
    if (!match) {
      if (name) console.warn(`simplysf2e | itemforge: dropped unmatched upgrade/rune "${name}"`);
      continue;
    }
    if (!propertyRuneFitsBase(kind, match.usage)) {
      console.warn(`simplysf2e | itemforge: dropped upgrade "${match.name}" (${match.usage}) — not installable in ${kind} "${base.name}"`);
      continue;
    }
    const key = slugify(match.name);
    if (seen.has(key)) continue;
    seen.add(key);
    propertyRunes.push(match.name);
  }

  return {
    kind,
    baseItemName: base?.name ?? null,
    grade,
    propertyRunes,
    upgrades: propertyRunes,
    rarity: RARITIES.has(rarity) ? rarity : RARITIES.has(c.rarity) ? c.rarity : "common",
    description: String(c.description ?? "").slice(0, 800)
  };
}

/**
 * Assemble the Foundry item data for a normalized runed-item concept: the
 * REAL base item document with the chosen system.grade, legacy runes zeroed,
 * the chosen upgrades installed as system.subitems, a transient preview
 * price (base + grade credits + upgrades, like the system's assetValue), a
 * transient preview level (max of base and grade level), and a
 * "Base (Grade: upgrades)" name.
 * @returns {Promise<{itemData: object, preview: {priceGp: number, level: number}}>}
 * source data for Item.create() plus derived preview metadata
 */
export async function buildRunedItem(concept) {
  const packs = getPacksFor("equipment");

  const baseEntry = await findEntry(packs, concept.baseItemName, (e) => e.type === concept.kind);
  const baseDoc = await getDocument(baseEntry);
  if (!baseDoc) {
    throw new Error(`Base ${concept.kind} "${concept.baseItemName}" could not be resolved against the compendium.`);
  }

  const grade = concept.grade ?? "commercial";
  const upgradeDocs = [];
  const upgradeNames = concept.upgrades ?? concept.propertyRunes ?? [];
  for (const name of upgradeNames) {
    const entry = await findEntry(packs, name, (e) => e.type === "equipment");
    const doc = await getDocument(entry);
    // The fuzzy match may land on a different item; install it only if the
    // graded base would accept it.
    if (doc && !propertyRuneFitsBase(concept.kind, doc.system?.usage?.value)) {
      console.warn(`simplysf2e | itemforge: upgrade "${doc.name}" (${doc.system?.usage?.value}) cannot be installed in a ${concept.kind} — dropped`);
      continue;
    }
    if (doc) upgradeDocs.push(doc);
    else console.warn(`simplysf2e | itemforge: upgrade/rune "${name}" could not be resolved — dropped`);
  }

  const data = toItemData(baseDoc);
  // Set native SF2e equipment grade (CTASEUP)
  data.system.grade = grade;
  // Zero runes per SF2e Migration942EquipmentGrade standard
  data.system.runes = {
    potency: 0,
    [SECONDARY_RUNE_FIELD[concept.kind]]: 0,
    property: []
  };
  // Install upgrades as embedded subitems, ensuring each retains a valid unique _id
  data.system.subitems = upgradeDocs.map((doc) => {
    const sub = toItemData(doc);
    sub._id = doc.id ?? doc._id ?? foundry.utils.randomID(16);
    return sub;
  });

  // Compute preview credits & level
  const gradeCreditDelta = (GRADE_CREDITS_DELTA[concept.kind] && GRADE_CREDITS_DELTA[concept.kind][grade]) ?? 0;
  const baseGp = priceToGp(baseDoc.system.price?.value) || 0;
  const upgradeGpSum = upgradeDocs.reduce((sum, d) => sum + priceToGp(d.system.price?.value), 0);
  const totalGp = baseGp + (gradeCreditDelta / 10) + upgradeGpSum;
  const totalCredits = (baseGp * 10) + gradeCreditDelta + (upgradeGpSum * 10);

  // Same as the system's computeLevelRarityPrice: max of item and grade
  // level. Installed upgrades do not raise the item's level.
  const gradeLevel = (GRADE_LEVELS[concept.kind] && GRADE_LEVELS[concept.kind][grade]) ?? 0;
  const level = Math.max(data.system.level?.value ?? 0, gradeLevel);

  // SF2e published naming convention: "{Base Name} ({Grade})" or with upgrades
  const gradeLabel = capitalized(grade);
  const nameParts = [baseDoc.name];
  if (grade !== "commercial") {
    nameParts.push(`(${gradeLabel})`);
  }
  if (upgradeDocs.length) {
    const upgradeSummary = upgradeDocs.map((d) => d.name).join(", ");
    data.name = `${baseDoc.name} (${gradeLabel}: ${upgradeSummary})`;
  } else {
    data.name = nameParts.join(" ");
  }

  const baseRarity = data.system.traits?.rarity ?? "common";
  const rarity = (RARITY_RANK[concept.rarity] ?? 0) > (RARITY_RANK[baseRarity] ?? 0) ? concept.rarity : baseRarity;
  const traits = new Set(data.system.traits?.value ?? []);
  // SF2e grade preparation natively supports both 'analog' and 'tech' items.
  // Preserve the base item's published classification; only default to tech if neither is present.
  if (!traits.has("analog") && !traits.has("tech")) {
    traits.add("tech");
  }
  data.system.traits = { ...(data.system.traits ?? {}), value: [...traits], rarity };

  const paragraphs = String(concept.description ?? "")
    .split(/\n{2,}/).map((p) => `<p>${esc(p.trim())}</p>`).filter((p) => p !== "<p></p>");
  const specList = [`Grade: ${gradeLabel}`];
  if (upgradeDocs.length) {
    specList.push(`Installed Upgrades: ${upgradeDocs.map((d) => d.name).join(", ")}`);
  }
  paragraphs.push(`<hr /><p><strong>${game.i18n.localize("SIMPLYSF2E.ItemForge.RunesHeading")}</strong> ${specList.join("; ")}.</p>`);
  data.system.description = { value: paragraphs.join("\n") };

  return {
    itemData: data,
    preview: {
      priceGp: totalGp,
      priceCredits: totalCredits,
      level,
      grade,
      upgrades: upgradeDocs.map((d) => d.name)
    }
  };
}

/* -------------------- grounded usage strings -------------------- */

/* Fallback when the AI's usage doesn't match anything harvested. */
const DEFAULT_USAGE = "worn";

let usageOptionsPromise = null;

/**
 * The most common `system.usage.value` strings among real magical equipment
 * items, so the AI picks a usage that actually exists ("wornshoes",
 * "held-in-one-hand", ...) instead of inventing a format. Harvested at
 * runtime from the configured equipment packs; falls back to ["worn"] if
 * nothing harvests (pathological — no equipment packs).
 * @returns {Promise<string[]>} up to 14 usage strings, most common first
 */
export async function getUsageOptions(kind = "wondrous") {
  if (KIND_USAGE[kind]) return [KIND_USAGE[kind]];
  usageOptionsPromise ??= (async () => {
    const counts = new Map();
    for (const packId of getPacksFor("equipment")) {
      for (const entry of await getEquipmentIndex(packId)) {
        if (entry.type !== "equipment") continue;
        const traits = entry.system?.traits?.value ?? [];
        if (!traits.includes("magical")) continue;
        const usage = entry.system?.usage?.value;
        if (typeof usage !== "string" || !usage) continue;
        counts.set(usage, (counts.get(usage) ?? 0) + 1);
      }
    }
    const options = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([usage]) => usage);
    return options.length ? options : [DEFAULT_USAGE];
  })();
  return usageOptionsPromise;
}

/** Match the AI's usage answer to a real harvested string (format-tolerant). */
function normalizeUsage(raw, options) {
  const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const query = norm(raw);
  if (query) {
    const hit = options.find((o) => norm(o) === query);
    if (hit) return hit;
  }
  return options.includes(DEFAULT_USAGE) ? DEFAULT_USAGE : options[0] ?? DEFAULT_USAGE;
}

/* -------------------- concept normalization -------------------- */

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};

/**
 * Coerce a raw AI magic-item concept into a safe, well-formed shape —
 * the item-forge counterpart of normalizeConcept(). Effects whose kind has
 * no exemplar in this world, or whose fields fail validation, are dropped
 * with a console warning rather than crashing or passing garbage through.
 *
 * @param {object} raw                      parsed AI JSON
 * @param {object} args
 * @param {number} args.level               GM-chosen item level (wins over the AI's)
 * @param {string} args.rarity              GM-chosen rarity
 * @param {string[]} args.availableKinds    kinds rule-templates found exemplars for
 * @param {string[]} args.usageOptions      harvested real usage strings
 * @param {object[]} args.effectCatalog     issued published equipment rules
 */
export function normalizeMagicItemConcept(raw, { level, rarity, availableKinds, usageOptions, effectCatalog = [], kind = "wondrous" }) {
  const c = typeof raw === "object" && raw !== null ? raw : {};
  const clampedLevel = clampInt(level, MIN_ITEM_LEVEL, MAX_ITEM_LEVEL, 1);
  if (!CONCEPT_ITEM_KINDS.has(kind)) kind = "wondrous";
  const usage = KIND_USAGE[kind] ?? normalizeUsage(c.usage, usageOptions ?? [DEFAULT_USAGE]);
  const resolvedRarity = RARITIES.has(rarity) ? rarity : RARITIES.has(c.rarity) ? c.rarity : "common";
  // Only worn items are invested in PF2e; held/affixed gear never is.
  let invested = Boolean(c.invested) && usage.startsWith("worn");

  const bulk = Object.hasOwn(BULK_VALUES, c.bulk) ? BULK_VALUES[c.bulk] : 0;

  const available = new Set(availableKinds ?? EFFECT_KINDS);
  const effects = (Array.isArray(c.effects) ? c.effects : [])
    .map((e) => normalizeEffect(e, { level: clampedLevel, rarity: resolvedRarity, usage, available, effectCatalog }))
    .filter(Boolean)
    .slice(0, 3);

  const activation = normalizeActivation(c.activation, {
    level: clampedLevel, rarity: resolvedRarity, usage, available, effectCatalog
  });
  const appliedEffects = [...effects, ...(activation?.params?.ruleEffectKinds ?? [])];
  invested ||= appliedEffects.some((effect) => effect.exemplar.requiresInvestment);
  const traits = new Set((Array.isArray(c.traits) ? c.traits : []).map(slugify).filter(Boolean));
  for (const trait of UNSUPPORTED_KIND_TRAITS) traits.delete(trait);
  // Model-written traits must be real equipment traits (CONFIG.PF2E.equipmentTraits,
  // pf2e v14-dev src/scripts/config/traits.ts), the same live check creature
  // traits get. Outside Foundry there is no list to check against.
  const knownTraits = typeof CONFIG !== "undefined" ? CONFIG.PF2E?.equipmentTraits : null;
  if (knownTraits) {
    const dropped = [...traits].filter((trait) => !(trait in knownTraits));
    for (const trait of dropped) traits.delete(trait);
    if (dropped.length) console.warn(`simplysf2e | itemforge: dropped invalid item traits: ${dropped.join(", ")}`);
  }
  if (kind === "augmentation") {
    // Exactly one augmentation category, as on every published augmentation.
    const category = AUGMENTATION_CATEGORIES.find((cat) => cat === slugify(c.category ?? ""))
      ?? AUGMENTATION_CATEGORIES.find((cat) => traits.has(cat))
      ?? "tech";
    for (const cat of AUGMENTATION_CATEGORIES) traits.delete(cat);
    traits.add(category);
    if (category === "magitech") traits.add("magical");
    else traits.delete("magical");
  } else {
    traits.add("magical");
  }
  if (invested) traits.add("invested");
  else traits.delete("invested");

  return {
    name: String(c.name || "Unnamed Item").slice(0, 120),
    description: String(c.description ?? ""),
    level: clampedLevel,
    rarity: resolvedRarity,
    kind,
    usage,
    traits: [...traits],
    bulk,
    invested,
    effects,
    activation
  };
}

/**
 * Validate and clamp the optional `activation` field into one of the four
 * known macro templates, or null when absent/unrecognizable. Every numeric
 * parameter is supplied locally and every model choice is an enum. These
 * activation benchmarks are module defaults, not published-item balance.
 */
function normalizeActivation(raw, { level, rarity, usage, available, effectCatalog }) {
  if (!raw || typeof raw !== "object") return null;
  const template = raw.template;
  if (!ACTIVATION_TEMPLATES.has(template)) {
    if (template) console.warn(`simplysf2e | itemforge: dropped activation of unknown template "${template}"`);
    return null;
  }

  const actionCost = Object.hasOwn(ACTION_COSTS, raw.actionCost) ? ACTION_COSTS[raw.actionCost] : 1;

  const p = raw.params && typeof raw.params === "object" ? raw.params : {};
  let params = null;

  switch (template) {
    case "damage": {
      const saveType = SAVE_TYPES.has(p.saveType) ? p.saveType : null;
      params = {
        damageDice: damageDiceForLevel(level),
        damageType: DAMAGE_TYPES.has(slugify(p.damageType)) ? slugify(p.damageType) : "force",
        saveType,
        dc: saveDcForLevel(level, rarity),
        basicSave: saveType ? p.basicSave !== false : false
      };
      break;
    }
    case "heal": {
      params = { healDice: damageDiceForLevel(level) };
      break;
    }
    case "condition": {
      const conditionSlug = slugify(p.conditionSlug);
      if (!CONDITION_SLUGS.has(conditionSlug)) {
        console.warn(`simplysf2e | itemforge: dropped condition activation with unknown condition "${p.conditionSlug}"`);
        return null;
      }
      const saveType = SAVE_TYPES.has(p.saveType) ? p.saveType : null;
      const duration = Object.hasOwn(ACTIVATION_DURATIONS, p.duration) ? ACTIVATION_DURATIONS[p.duration].label : null;
      params = {
        conditionSlug,
        value: VALUED_CONDITIONS.has(conditionSlug) ? 1 : null,
        duration,
        saveType,
        dc: saveType ? saveDcForLevel(level, rarity) : null,
        basicSave: false
      };
      break;
    }
    case "selfBuff": {
      const duration = Object.hasOwn(ACTIVATION_DURATIONS, p.duration) ? ACTIVATION_DURATIONS[p.duration] : ACTIVATION_DURATIONS.minute;
      const ruleEffectKinds = (Array.isArray(p.ruleEffectKinds) ? p.ruleEffectKinds : [])
        .map((e) => normalizeEffect(e, { level, rarity, usage, available, effectCatalog }))
        .filter(Boolean)
        .slice(0, 3);
      if (!ruleEffectKinds.length) {
        console.warn("simplysf2e | itemforge: dropped self-buff without a supported published effect");
        return null;
      }
      // effectName stays raw (it is also the Effect item's name); every HTML
      // sink escapes it itself (description below, macro chat lines).
      // description is concatenated into macro HTML, so it is escaped here.
      params = {
        effectName: String(p.effectName || "Magic Effect").slice(0, 80),
        description: esc(String(p.description ?? "").slice(0, 600)),
        durationRounds: duration.rounds ?? null,
        durationMinutes: duration.minutes ?? null,
        ruleEffectKinds
      };
      break;
    }
  }

  return { template, actionCost, params };
}

/** Resolve one enum/scale effect to an unchanged issued equipment rule. */
function normalizeEffect(e, { level, rarity, usage, available, effectCatalog = [] }) {
  const kind = e?.kind;
  if (!available.has(kind)) {
    if (kind) console.warn(`simplysf2e | itemforge: dropped effect of unavailable kind "${kind}"`);
    return null;
  }
  let field;
  let value;
  switch (kind) {
    case "itemBonus": {
      const statistic = slugify(e.statistic);
      if (!ITEM_BONUS_STATISTICS.has(statistic)) break;
      field = "statistic"; value = statistic; break;
    }
    case "resistance":
    case "weakness": {
      const damageType = slugify(e.damageType);
      if (!DAMAGE_TYPES.has(damageType)) break;
      field = "damageType"; value = damageType; break;
    }
    case "immunity": {
      const damageType = slugify(e.damageType);
      if (!DAMAGE_TYPES.has(damageType)) break;
      field = "damageType"; value = damageType; break;
    }
    case "sense": {
      const type = slugify(e.type);
      if (!SENSE_TYPES.has(type)) break;
      field = "type"; value = type; break;
    }
    case "speed": {
      const type = slugify(e.type);
      if (!SPEED_TYPES.has(type)) break;
      field = "type"; value = type; break;
    }
  }
  const candidates = field ? effectCatalog.filter((candidate) => candidate.kind === kind && candidate[field] === value
    && candidate.exemplar?.sourceLevel <= level
    && Object.hasOwn(RARITY_RANK, candidate.exemplar?.sourceRarity)
    && RARITY_RANK[candidate.exemplar.sourceRarity] <= (RARITY_RANK[rarity] ?? 0)
    && (!candidate.exemplar.requiresInvestment || usage?.startsWith("worn"))) : [];
  const magnitude = (candidate) => candidate.value ?? candidate.range ?? Infinity;
  candidates.sort((a, b) => magnitude(a) - magnitude(b));
  if (!candidates.length) {
    console.warn(`simplysf2e | itemforge: dropped "${kind}" effect without a matching published equipment rule at level ${level}`, e);
    return null;
  }
  const index = e.scale === "low" ? 0 : e.scale === "high" ? candidates.length - 1 : Math.floor((candidates.length - 1) / 2);
  return structuredClone(candidates[index]);
}

/* -------------------- plain-English effect summaries -------------------- */

/** One readable line per effect ("Resistance 5 to fire"), for preview + description. */
export function describeEffect(effect) {
  switch (effect.kind) {
    case "itemBonus":
      return game.i18n.format("SIMPLYSF2E.ItemForge.EffectItemBonus", {
        value: effect.value,
        statistic: effect.statistic === "ac" ? "AC" : capitalized(effect.statistic)
      });
    case "resistance":
      return game.i18n.format("SIMPLYSF2E.ItemForge.EffectResistance", { value: effect.value, type: effect.damageType });
    case "weakness":
      return game.i18n.format("SIMPLYSF2E.ItemForge.EffectWeakness", { value: effect.value, type: effect.damageType });
    case "immunity":
      return game.i18n.format("SIMPLYSF2E.ItemForge.EffectImmunity", { type: effect.damageType });
    case "sense": {
      const parts = [capitalized(effect.type.replaceAll("-", " "))];
      if (effect.acuity) parts.push(`(${effect.acuity}${effect.range ? `, ${effect.range} ft.` : ""})`);
      else if (effect.range) parts.push(`(${effect.range} ft.)`);
      return parts.join(" ");
    }
    case "speed":
      return game.i18n.format("SIMPLYSF2E.ItemForge.EffectSpeed", {
        type: capitalized(effect.type), value: effect.value
      });
    default:
      return effect.kind;
  }
}

/* Plain-English action-cost labels for an activation summary. */
const ACTION_COST_LABEL = {
  1: "1 action", 2: "2 actions", 3: "3 actions",
  reaction: "reaction", free: "free action"
};

/**
 * Plain text (not HTML): callers that insert it into HTML must esc() it.
 * One readable "Activate (2 actions) — deal 4d6 fire damage, DC 22 basic
 * Reflex save (1/day)" line, for the preview and the item description.
 * @param {object} activation  normalized activation
 * @param {object} [opts]
 * @param {boolean} [opts.charged=true]  append the "(1/day)" frequency note
 */
export function describeActivation(activation, { charged = true } = {}) {
  if (!activation) return "";
  const cost = ACTION_COST_LABEL[activation.actionCost] ?? "1 action";
  const p = activation.params ?? {};
  let summary;
  switch (activation.template) {
    case "damage": {
      const save = p.saveType ? `, DC ${p.dc} ${p.basicSave ? "basic " : ""}${p.saveType} save` : "";
      summary = `deal ${p.damageDice} ${p.damageType} damage${save}`;
      break;
    }
    case "heal":
      summary = `restore ${p.healDice} Hit Points`;
      break;
    case "condition": {
      const val = p.value ? ` ${p.value}` : "";
      const dur = p.duration ? ` for ${p.duration}` : "";
      const save = p.saveType && p.dc ? ` (DC ${p.dc} ${p.basicSave ? "basic " : ""}${p.saveType} negates)` : "";
      summary = `inflict ${p.conditionSlug}${val}${dur}${save}`;
      break;
    }
    case "selfBuff": {
      const dur = p.durationRounds ? ` for ${p.durationRounds} round${p.durationRounds === 1 ? "" : "s"}`
        : p.durationMinutes ? ` for ${p.durationMinutes} minute${p.durationMinutes === 1 ? "" : "s"}`
        : "";
      summary = `gain ${p.effectName}${dur}`;
      break;
    }
    default:
      summary = activation.template;
  }
  const freq = charged ? " (1/day)" : "";
  return `${game.i18n.localize("SIMPLYSF2E.ItemForge.Activate")} (${cost}) — ${summary}${freq}`;
}

/* -------------------- rule cloning & item assembly -------------------- */

/**
 * Clone the exact issued published Rule Element for each effect. Shared by the
 * passive item assembly below and the selfBuff activation macro, so the
 * Phase 1 "clone, never hand-author" guarantee holds for activated buffs too.
 * @returns {Promise<{rules: object[], applied: object[]}>}
 */
export async function cloneRulesForEffects(effects) {
  const rules = [];
  const applied = [];
  for (const effect of effects ?? []) {
    try {
      const exemplar = effect.exemplar;
      if (!exemplar) {
        console.warn(`simplysf2e | itemforge: no exemplar for "${effect.kind}" — effect skipped`);
        continue;
      }
      rules.push(structuredClone(exemplar.rule));
      applied.push(effect);
      console.debug(
        `simplysf2e | itemforge: "${effect.kind}" rule cloned from "${exemplar.sourceName}" (${exemplar.sourceUuid})`
      );
    } catch (err) {
      console.warn(`simplysf2e | itemforge: failed to build "${effect.kind}" effect — skipped`, err);
    }
  }
  return { rules, applied };
}

/**
 * Assemble the Foundry item data for a normalized magic-item concept:
 * type "equipment" (the generic wondrous-item type), priced from the
 * empirical level benchmark, with `system.rules` built exclusively from
 * cloned real exemplars. A missing exemplar or a failed clone skips that
 * one effect with a warning — one bad effect never sinks the item.
 * @returns {Promise<object>} plain item data ready for Item.create()
 */
export async function buildMagicItemData(concept) {
  const { rules, applied } = await cloneRulesForEffects(concept.effects);

  const paragraphs = String(concept.description ?? "")
    .split(/\n{2,}/).map((p) => esc(p.trim())).filter(Boolean);
  const descriptionParts = paragraphs.map((p) => `<p>${p}</p>`);
  if (applied.length) {
    // Plain-English mechanical summary so the GM can read what the item
    // does without opening the rules tab.
    descriptionParts.push(
      `<hr /><p><strong>${game.i18n.localize("SIMPLYSF2E.ItemForge.EffectsHeading")}</strong> ${applied.map(describeEffect).join("; ")}.</p>`
    );
  }

  /* Price stays in gp (not credits): the persisted system price unit is
   * gp-denominated — priceForLevel() benchmarks via priceToGp() over real
   * compendium prices, and callers (itemforge-app preview "X gp" plus
   * Item.create) round-trip that unit unchanged. Credits live at the
   * currency edge only (assembleCurrency persists a credit count as
   * price.value.sp per currency.mjs); storing this benchmark as sp would
   * require {sp: benchmarkGp * 10} to stay value-identical through
   * priceToGp (priceToGp({gp:100}) === 100 but priceToGp({sp:100}) === 10),
   * and would break compendium convention
   * and diverge from the runed-item preview path, which likewise reports gp. */
  const traits = new Set(concept.traits ?? []);
  let defaultImg = "icons/svg/item-bag.svg";
  if (concept.kind === "augmentation") defaultImg = "icons/commodities/tech/sensor-red.webp";
  else if (concept.kind === "crystal") defaultImg = "icons/commodities/gems/gem-faceted-round-purple.webp";

  const system = {
    level: { value: concept.level },
    description: { value: descriptionParts.join("\n") },
    traits: { value: [...traits], rarity: concept.rarity },
    usage: { value: concept.usage },
    bulk: { value: concept.bulk },
    price: { value: { gp: await priceForLevel(concept.level, concept.rarity) } },
    rules
  };

  const data = {
    name: capitalized(concept.name),
    type: "equipment",
    img: defaultImg,
    system
  };

  // An activated item carries: a per-copy forgeId (so its companion macro
  // finds THIS actor's copy for charge-tracking), a 1/day charge counter the
  // macro decrements, and a plain-English activation summary in the
  // description. The clickable @UUID[Macro.…]{Activate} link is appended
  // after the macro is created (see macro-templates.createActivationMacro).
  if (concept.activation) {
    descriptionParts.push(
      `<hr /><p><strong>${game.i18n.localize("SIMPLYSF2E.ItemForge.ActivationHeading")}</strong> ${esc(describeActivation(concept.activation))}.</p>`
    );
    system.description.value = descriptionParts.join("\n");
    // Best-effort native frequency (for the sheet's own display); the
    // authoritative per-copy counter lives in the module flag below, which
    // the macro reads and decrements.
    system.frequency = { max: 1, per: "day", value: 1 };
    data.flags = {
      simplysf2e: {
        forge: {
          forgeId: foundry.utils.randomID(),
          template: concept.activation.template,
          uses: { value: 1, max: 1, per: "day" }
        }
      }
    };
  }

  return data;
}
