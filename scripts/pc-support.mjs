import { slugify } from "./text.mjs";

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
 * witchwarper-anchor. Solarian Solar Manifestations is GrantItem/Strike REs,
 * not an item:tag ChoiceSet — nothing to stage.
 *
 * Operative stays locked: every specialization option carries a non-static
 * `item:category:skill` + `item:level:1` ChoiceSet (and a templated GrantItem).
 * Empty is better than unlocking a path that throws at create or invents a
 * skill-feat resolver.
 */
export const COMPLETE_PC_CLASS_SLUGS = new Set([
  "envoy", "mystic", "solarian", "soldier", "witchwarper"
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
 * PF2e exposes feat prerequisites as display text, not a general actor
 * eligibility API. Free Archetype starts granting additional feats at level
 * 2, so a complete-only build must stop before provider spend until its
 * staged prerequisite graph can be checked. Level 1 has no variant slot and
 * remains unaffected.
 */
export function freeArchetypeNeedsPrerequisiteValidation(level, enabled) {
  const characterLevel = Math.min(Math.max(Math.round(Number(level) || 1), 1), 20);
  return enabled === true && characterLevel >= 2;
}
