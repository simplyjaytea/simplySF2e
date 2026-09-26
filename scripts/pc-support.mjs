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
 * witchwarper-anchor, operative-specialization. Solarian Solar
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
  "envoy", "mystic", "operative", "solarian", "soldier", "witchwarper"
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
