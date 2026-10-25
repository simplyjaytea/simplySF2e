import { esc, slugify } from "./text.mjs";
import { ARCHETYPE_CASTER_DEDICATIONS } from "./pc-tables.mjs";

/**
 * Classes whose native feature/casting path has an end-to-end one-click plan.
 *
 * Cited v14-dev L1 bridges use the same ChoiceSet
 * `choices.filter: ["item:tag:<tag>"]` + GrantItem
 * `{item|flags.system.rulesSelections.<flag>}` shape that `stageClassPaths`
 * already stages. Class `system.items` is a dict of `{img, level, name, uuid}`
 * grants to `Compendium.sf2e.class-features.Item.*` (sample:
 * `packs/sf2e/classes/soldier.json` → Soldier Fighting Style →
 * `packs/sf2e/class-features/soldier/soldier-fighting-style.json`
 * filter `item:tag:soldier-fighting-style`). Same shape:
 * envoy-leadership-style, mystic-connection, witchwarper-paradox,
 * witchwarper-anchor, operative-specialization, and (sf2e-1.6)
 * `packs/sf2e/class-features/` Exocortex (`mechanic-exocortex`, flag
 * `exocortex`) and Programming Language (`technomancer-programming-language`,
 * flag `programmingLanguage`). Solarian Solar
 * Manifestations is GrantItem/Strike REs, not an item:tag ChoiceSet —
 * nothing to stage.
 *
 * Operative's specializations
 * (`packs/sf2e/class-features/operative/specializations/*.json`) each carry
 * an `item:category:skill` + `item:level:1` feat ChoiceSet and a templated
 * GrantItem; Sniper adds a `class:operative`-gated `bonusFeat` uuid choice.
 * `stageClassPaths` closes both before create: skill feats come only from
 * enabled `feats` packs whose prerequisites the specialization's own
 * skill-rank upgrade proves, and every reachable grant must be choice-free.
 * A specialization it cannot close fails the build rather than opening a
 * native dialog.
 */
export const COMPLETE_PC_CLASS_SLUGS = new Set([
  "envoy", "mechanic", "mystic", "operative", "solarian", "soldier", "technomancer", "witchwarper"
]);

export function supportedClassCandidates(candidates) {
  return (Array.isArray(candidates) ? candidates : []).filter((candidate) =>
    COMPLETE_PC_CLASS_SLUGS.has(slugify(candidate?.name))
  );
}

export function isCompletePCClass(value) {
  return COMPLETE_PC_CLASS_SLUGS.has(slugify(typeof value === "string" ? value : value?.name));
}

/**
 * Starfinder 2e multiclass dedication archetype slugs (published in sf2e.feats
 * with traits ['archetype', 'dedication', 'multiclass']).
 */
export const SF2E_MULTICLASS_DEDICATIONS = {
  envoy: "envoy-dedication",
  mechanic: "mechanic-dedication",
  mystic: "mystic-dedication",
  operative: "operative-dedication",
  solarian: "solarian-dedication",
  soldier: "soldier-dedication",
  technomancer: "technomancer-dedication",
  witchwarper: "witchwarper-dedication"
};

/**
 * Technomancer's initial magic hack per Programming Language, keyed by the
 * language class feature's `_id` (packs/sf2e/class-features, tag
 * `technomancer-programming-language`). Each language's description reads
 * "Magic Hack initial: @UUID[Compendium.sf2e.spells.Item.<name>]"; the hack is
 * NOT granted by data, so the builder embeds it. Spells are rank 1 focus
 * spells with traits focus + technomancer, in
 * packs/sf2e/spells/focus/technomancer/<language>/*.json.
 * DPS++ msU9FRYDZwkYvLNH, FORTRUN 7yxVnWzTynBvFVjr, Servoshell KVc89RjerouF0wo1,
 * Viper KWVSfZLZIW4zCW7K.
 */
export const TECHNOMANCER_INITIAL_HACKS = {
  msU9FRYDZwkYvLNH: { language: "DPS++", spellId: "5kzAMtSSpGDJTIWV", spell: "A-Stellar Targetfinder Algorithm" },
  "7yxVnWzTynBvFVjr": { language: "FORTRUN", spellId: "1Wp3rkKJQef7K8Tn", spell: "Force-FieldPGA" },
  KVc89RjerouF0wo1: { language: "Servoshell", spellId: "xNU0CX0Wt0MwOHes", spell: "Repair Protocols" },
  KWVSfZLZIW4zCW7K: { language: "Viper", spellId: "FfkyvwVrY3sx9NOQ", spell: "Amplify Vulnerability" }
};

/**
 * Each Programming Language's spell cache, by rank 1-9 (the language
 * description's "Spell Cache 1st: @UUID[...] 2nd: ..." lines, sf2e-1.6.1
 * packs/sf2e/class-features, same language `_id`s as TECHNOMANCER_INITIAL_HACKS).
 * A cache spell is added to the spell database when the Technomancer gains
 * spell slots of that rank; it is looked up by exact name in sf2e.spells.
 */
export const TECHNOMANCER_LANGUAGE_CACHE = {
  msU9FRYDZwkYvLNH: { language: "DPS++", spells: [
    "Supercharge Weapon", "Caustic Conversion", "Electrotether", "Hydraulic Torrent", "Impaling Spike",
    "Disintegrate", "True Target", "Arctic Rift", "Implosion"
  ] },
  "7yxVnWzTynBvFVjr": { language: "FORTRUN", spells: [
    "Protection", "Resist Energy", "Haste", "Unfettered Movement", "Scouting Eye",
    "Repulsion", "Energy Aegis", "Gravity Field", "Foresight"
  ] },
  KVc89RjerouF0wo1: { language: "Servoshell", spells: [
    "Summon Robot", "Illusory Creature", "Discharge", "Speak with Computers", "Control Machine",
    "Dominate", "Wall of Steel", "Phantasmal Fleet", "Telekinetic Tantrum"
  ] },
  KWVSfZLZIW4zCW7K: { language: "Viper", spells: [
    "Delete", "Translate", "Locate", "Creation", "Truespeech",
    "Truesight", "Contingency", "Pinpoint", "Foresight"
  ] }
};

/**
 * Cache spell names for a staged Programming Language, keyed by rank, for the
 * ranks in `ranks` only. Returns `[]` with a warning when no language is staged
 * or it is not one of the cited four, so the database is built without them.
 * @returns {{rank: number, name: string}[]}
 */
export function technomancerCacheSpells(stagedItems, ranks) {
  const languageId = stagedPathSelectionId(stagedItems, TECHNOMANCER_LANGUAGE_FLAG);
  const cache = languageId && Object.hasOwn(TECHNOMANCER_LANGUAGE_CACHE, languageId)
    ? TECHNOMANCER_LANGUAGE_CACHE[languageId] : null;
  if (!cache) {
    console.warn("simplysf2e | no known Programming Language — technomancer spell cache not added");
    return [];
  }
  return [...new Set(ranks)].filter((rank) => Number.isInteger(rank) && rank >= 1 && rank <= 9)
    .sort((a, b) => a - b).map((rank) => ({ rank, name: cache.spells[rank - 1] }));
}

/** Spell traditions a caster class's choice option may declare. */
const CASTER_TRADITIONS = new Set(["arcane", "divine", "occult", "primal"]);

/**
 * Tradition a Connection (Mystic) or Paradox (Witchwarper) option declares: the
 * value of its `ActiveEffectLike` override on `flags.system.<class>.tradition`,
 * read from the option's own rules, never from a table. `chosenOption` is the
 * option document the build pre-answered for the dedication's granted choice.
 * @returns {string|null} the tradition, or null when no such override exists
 */
export function traditionFromChoiceOption(chosenOption, classSlug) {
  const path = `flags.system.${classSlug}.tradition`;
  const rules = Array.isArray(chosenOption?.system?.rules) ? chosenOption.system.rules : [];
  const overrides = rules.filter((rule) => rule?.key === "ActiveEffectLike" && rule.mode === "override" && rule.path === path);
  if (overrides.length !== 1 || !CASTER_TRADITIONS.has(overrides[0].value)) return null;
  return overrides[0].value;
}

/**
 * Archetype caster tradition. The Technomancer Dedication is arcane by its own
 * text. Mystic (Connection) and Witchwarper (Paradox) take their tradition from
 * the option the build pre-answered for the dedication's granted choice; with no
 * pre-answered option the tradition is unproven, so the caller skips the entry
 * and warns (fail closed). Nothing is guessed from an id.
 * @returns {string|null}
 */
export function archetypeTraditionFor(dedicationSlug, chosenOption = null) {
  const profile = Object.hasOwn(ARCHETYPE_CASTER_DEDICATIONS, dedicationSlug) ? ARCHETYPE_CASTER_DEDICATIONS[dedicationSlug] : null;
  if (!profile) return null;
  if (profile.tradition) return profile.tradition;
  const tradition = traditionFromChoiceOption(chosenOption, dedicationSlug.replace(/-dedication$/, ""));
  if (!tradition) console.warn(`simplysf2e | ${dedicationSlug}: spell tradition not proven from its ${profile.traditionFrom} — archetype spellcasting skipped`);
  return tradition;
}

export const TECHNOMANCER_LANGUAGE_FLAG = "programmingLanguage";
export const MECHANIC_EXOCORTEX_FLAG = "exocortex";
/** Mechanic exocortex options (packs/sf2e/class-features): Drone has rules []
 * and no data-side companion; Mine and Turret grant their own actions. */
export const MECHANIC_DRONE_ID = "UCilslXlrd7ihsgY";
export const DRONE_MANUAL_KEY = "SIMPLYSF2E.PC.DroneManual";

const ITEM_UUID_ID = /^Compendium\.[^.]+\.[^.]+\.Item\.([A-Za-z0-9]+)$/;

/** The compendium `_id` a staged bridge's ChoiceSet selected, or null. */
export function stagedPathSelectionId(stagedItems, flag) {
  for (const item of Array.isArray(stagedItems) ? stagedItems : []) {
    for (const rule of Array.isArray(item?.system?.rules) ? item.system.rules : []) {
      if (rule?.key !== "ChoiceSet" || rule.flag !== flag || typeof rule.selection !== "string") continue;
      const id = ITEM_UUID_ID.exec(rule.selection)?.[1];
      if (id) return id;
    }
  }
  return null;
}

/**
 * Technomancer's initial hack for the staged Programming Language, or null.
 * Fails closed: no staged language, or one outside the four cited languages,
 * warns and yields no hack.
 */
export function technomancerInitialHack(stagedItems) {
  const languageId = stagedPathSelectionId(stagedItems, TECHNOMANCER_LANGUAGE_FLAG);
  if (!languageId) {
    console.warn("simplysf2e | no staged Programming Language — no initial magic hack added");
    return null;
  }
  const hack = Object.hasOwn(TECHNOMANCER_INITIAL_HACKS, languageId) ? TECHNOMANCER_INITIAL_HACKS[languageId] : null;
  if (!hack) console.warn(`simplysf2e | Programming Language ${languageId} has no known initial magic hack — none added`);
  return hack;
}

/** Lang keys for GM-facing manual follow-ups implied by the staged class paths. */
export function classManualNotes(stagedItems) {
  return stagedPathSelectionId(stagedItems, MECHANIC_EXOCORTEX_FLAG) === MECHANIC_DRONE_ID ? [DRONE_MANUAL_KEY] : [];
}

/**
 * Put the language's initial hack first in the focus list, dropping any AI
 * pick of the same spell (by compendium id or name). Capped at the focus
 * pool ceiling of 3 (PLAYBOOK §7); the pool max itself is system-derived.
 * @param {{name: string, entry: object|null}[]} focusSpells
 * @param {{name: string, entry: {packId: string, _id: string}}|null} hack
 */
export function withInitialFocusSpell(focusSpells, hack) {
  const list = Array.isArray(focusSpells) ? focusSpells : [];
  if (!hack?.entry) return list;
  const same = (spell) => (spell?.entry?._id && spell.entry._id === hack.entry._id)
    || (spell?.name && slugify(spell.name) === slugify(hack.name));
  return [hack, ...list.filter((spell) => spell?.entry && !same(spell))].slice(0, 3);
}

/** GM whisper body for manual follow-ups; `localize` is `game.i18n.localize`. */
export function manualNotesContent(actorName, keys, localize) {
  if (!keys?.length) return "";
  return `<p><strong>${esc(actorName)}</strong></p><ul>${keys.map((key) => `<li>${esc(localize(key))}</li>`).join("")}</ul>`;
}

/** Check if a class slug has an official multiclass dedication in SF2e. */
export function getMulticlassDedicationSlug(classSlug) {
  return SF2E_MULTICLASS_DEDICATIONS[slugify(classSlug)] ?? null;
}

/**
 * PF2e exposes feat prerequisites as display text, not a general actor
 * eligibility API. Free Archetype starts granting additional feats at level
 * 2; those archetype slots are now covered by the staged-actor evaluator
 * (`stagedActorContext`/`featPrerequisitesMet` filter every slot's candidate
 * list at resolve time, and `validateArchetypeSlotPlacement` re-checks trait,
 * level, order, and readable prerequisite chains after picks resolve).
 * Chains beyond provable text still fail closed per slot, and no archetype
 * grant graph is built. Level 1 has no variant slot and remains unaffected.
 */
export function freeArchetypeNeedsPrerequisiteValidation(level, enabled) {
  void level;
  void enabled;
  return false;
}
