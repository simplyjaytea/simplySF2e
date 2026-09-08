import { slugify } from "./text.mjs";

/**
 * Classes whose native feature/casting path has an end-to-end one-click plan.
 * Empty until an SF2e class is proven to share the existing staging path
 * without inventing class-feature schemas. All six published classes
 * (envoy, mystic, operative, solarian, soldier, witchwarper) grant a
 * mandatory level-1 path (Leadership Style, Connection, Specialization,
 * Solar Manifestations, Fighting Style, Paradox) — none are Fighter-shaped.
 * Fail closed: better empty than claiming PF2e Fighter/Rogue/Investigator.
 */
export const COMPLETE_PC_CLASS_SLUGS = new Set();

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
