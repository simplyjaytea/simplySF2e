import { CORE_SKILLS } from "./pc-skills.mjs";
import { slugify } from "./text.mjs";

/**
 * Fail-closed ordinary feat-prerequisite evaluator against a staged PC plan.
 *
 * PF2e 8.4.1 stores prerequisites as display text, not an eligibility API:
 * `FeatSystemSchema.prerequisites.value` is `Array<{ value: string }>`
 * (`src/module/item/feat/data.ts`). `FeatPF2e.embedHTMLString` joins those
 * strings for display (`src/module/item/feat/document.ts`); `_onCreate`
 * warns about `onlyLevel1` / `maxTakable`, never the prerequisite text.
 *
 * ABC grants that a staged class/ancestry/background will embed are the
 * `system.items` record of `{ uuid, img, name, level }` entries
 * (`src/module/item/abc/data.ts` `ABCFeatureEntryField`). Class items use
 * the same field (`src/module/item/class/data.ts`).
 *
 * Unreadable, malformed, mixed, or unproven clauses are ineligible. Exact
 * slug identity only — no substring or fuzzy name matching.
 */

const RANK = Object.freeze({ trained: 1, expert: 2, master: 3, legendary: 4 });
const ABILITY = Object.freeze({
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha"
});

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampLevel(value) {
  const level = Math.min(Math.max(Math.round(Number(value) || 1), 1), 20);
  return Number.isInteger(level) ? level : 1;
}

function validRank(rank) {
  return Number.isInteger(rank) && rank >= 0 && rank <= 4;
}

/** Published ABC grant names at or below the character level. Unreadable
 * entries are skipped rather than inferred. */
export function grantedAbcFeatures(system, level) {
  const items = system?.items;
  if (!isObject(items)) return [];
  const characterLevel = clampLevel(level);
  const names = [];
  for (const entry of Object.values(items)) {
    if (!isObject(entry) || typeof entry.name !== "string" || !entry.name.trim()) continue;
    if (!Number.isInteger(entry.level) || entry.level < 0 || entry.level > characterLevel) continue;
    names.push(entry.name.trim());
  }
  return names;
}

function collectNames(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => typeof value === "string" ? value.trim() : typeof value?.name === "string" ? value.name.trim() : "")
    .filter(Boolean);
}

function skillKey(name) {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const slug = slugify(trimmed);
  if (CORE_SKILLS.includes(slug)) return slug;
  if (/\slore$/i.test(trimmed) && slug.endsWith("-lore") && slug !== "lore") return slug;
  return null;
}

function splitList(text, conjunction) {
  const joiner = conjunction === "or" ? "or" : "and";
  const pattern = new RegExp(`\\s*,\\s*(?:${joiner}\\s+)?|\\s+${joiner}\\s+`, "i");
  const parts = text.split(pattern).map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts : null;
}

function skillTargets(rest) {
  const text = rest.trim();
  if (/^at least one skill$/i.test(text)) return { any: true };
  const hasAnd = /\band\b/i.test(text);
  const hasOr = /\bor\b/i.test(text);
  if (hasAnd && hasOr) return null;
  if (hasOr || hasAnd) {
    const parts = splitList(text, hasOr ? "or" : "and");
    if (!parts) return null;
    const skills = parts.map(skillKey);
    return skills.every(Boolean) ? { op: hasOr ? "or" : "and", skills } : null;
  }
  const skill = skillKey(text);
  return skill ? { op: "and", skills: [skill] } : null;
}

function hasSkillRank(skills, slug, rank) {
  return validRank(skills[slug]) && skills[slug] >= rank;
}

function skillClauseMet(rank, rest, context, allowedSkills = null) {
  const target = skillTargets(rest);
  if (!target) return false;
  const skills = context.skills;
  if (target.any) return !allowedSkills && Object.values(skills).some((value) => validRank(value) && value >= rank);
  const check = (slug) => (!allowedSkills || allowedSkills.has(slug)) && hasSkillRank(skills, slug, rank);
  return target.op === "or" ? target.skills.some(check) : target.skills.every(check);
}

function nameParts(text, conjunction) {
  const parts = splitList(text, conjunction);
  if (!parts) return null;
  const slugs = parts.map((part) => slugify(part)).filter(Boolean);
  return slugs.length === parts.length ? slugs : null;
}

function nameClauseMet(text, context) {
  const hasAnd = /\band\b/i.test(text);
  const hasOr = /\bor\b/i.test(text);
  if (hasAnd && hasOr) return false;
  if (hasOr || hasAnd) {
    const slugs = nameParts(text, hasOr ? "or" : "and");
    if (!slugs) return false;
    return hasOr ? slugs.some((slug) => context.names.has(slug)) : slugs.every((slug) => context.names.has(slug));
  }
  const slug = slugify(text);
  return Boolean(slug) && context.names.has(slug);
}

function clauseMet(entry, context) {
  if (!isObject(entry) || typeof entry.value !== "string") return false;
  const text = entry.value.trim();
  if (!text) return false;
  const skill = /^(trained|expert|master|legendary)\s+in\s+(.+)$/i.exec(text);
  if (skill) return skillClauseMet(RANK[skill[1].toLowerCase()], skill[2], context);
  const ability = /^(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+(\d+)$/i.exec(text);
  if (ability) {
    const score = context.abilities[ABILITY[ability[1].toLowerCase()]];
    return Number.isFinite(score) && score >= Number(ability[2]);
  }
  return nameClauseMet(text, context);
}

/**
 * Snapshot of the generation plan used to prove ordinary prerequisite text.
 * Only names and ranks the caller can already document belong here.
 * `allowedSkillFeats` optionally narrows a published restricted skill slot
 * to explicit, proven rank prerequisites for the supplied skill slugs.
 */
export function stagedActorContext({
  level, ancestry = null, heritage = null, background = null, class: classItem = null,
  feats = [], features = [], skills = {}, abilities = {}, allowedSkillFeats = null
} = {}) {
  const characterLevel = clampLevel(level);
  const possessed = [
    ...collectNames([ancestry, heritage, background, classItem]),
    ...grantedAbcFeatures(ancestry?.system, characterLevel),
    ...grantedAbcFeatures(heritage?.system, characterLevel),
    ...grantedAbcFeatures(background?.system, characterLevel),
    ...grantedAbcFeatures(classItem?.system, characterLevel),
    ...collectNames(features),
    ...collectNames(feats)
  ];
  const skillRanks = {};
  if (isObject(skills)) {
    for (const [slug, rank] of Object.entries(skills)) {
      if (typeof slug === "string" && slug && validRank(rank) && rank > 0) skillRanks[slug] = rank;
    }
  }
  const abilityScores = {};
  if (isObject(abilities)) {
    for (const [key, score] of Object.entries(abilities)) {
      if (Object.values(ABILITY).includes(key) && Number.isFinite(score)) abilityScores[key] = Number(score);
    }
  }
  return {
    level: characterLevel,
    names: new Set(possessed.map(slugify).filter(Boolean)),
    skills: skillRanks,
    abilities: abilityScores,
    allowedSkillFeats: allowedSkillFeats === null ? null
      : new Set((Array.isArray(allowedSkillFeats) ? allowedSkillFeats : [])
        .filter((skill) => typeof skill === "string" && skillKey(skill.replaceAll("-", " "))))
  };
}

/**
 * True only when every published prerequisite clause is both readable and
 * proven against the staged context. Missing data never passes.
 */
export function featPrerequisitesMet(feat, context) {
  const list = feat?.system?.prerequisites?.value;
  if (!Array.isArray(list) || !context?.names) return false;
  if (!list.every((entry) => clauseMet(entry, context))) return false;
  if (context.allowedSkillFeats == null) return true;
  // A restricted skill feat needs an explicit, satisfied rank prerequisite
  // for an allowed skill. Merely naming a mental skill in an unsatisfied OR
  // branch does not qualify; generic "at least one skill" cannot prove which
  // skill the feat is for. Unknown/methodology-dependent cases stay closed.
  if (!(context.allowedSkillFeats instanceof Set)) return false;
  return list.some((entry) => {
    const skill = /^(trained|expert|master|legendary)\s+in\s+(.+)$/i.exec(entry.value.trim());
    return skill && skillClauseMet(RANK[skill[1].toLowerCase()], skill[2], context, context.allowedSkillFeats);
  });
}

/**
 * Fail-closed archetype-trait probe for one feat in any staged shape: a full
 * compendium/index entry (`system.traits.value`) or an issued candidate
 * record (`traits`). Anything unreadable is not an archetype feat.
 */
export function isArchetypeFeat(value) {
  const traits = Array.isArray(value?.system?.traits?.value)
    ? value.system.traits.value
    : Array.isArray(value?.traits) ? value.traits : null;
  return traits !== null && traits.includes("archetype");
}

function readableFeatLevel(value) {
  const raw = Number.isInteger(value?.system?.level?.value)
    ? value.system.level.value
    : value?.level;
  const level = Math.round(Number(raw));
  return Number.isInteger(level) && level >= 1 && level <= 20 ? level : null;
}

function readableSlotLevel(slot) {
  const level = Math.round(Number(slot?.level));
  return Number.isInteger(level) && level >= 1 && level <= 20 ? level : null;
}

/**
 * Chronological Free Archetype slot-placement validation without a grant
 * graph. `slots` and `feats` are parallel archetype-only arrays: each slot
 * is `{ type, level, archetype: true, candidates? }` and each feat is the
 * resolved fill for that slot (`{ name, entry }`, where entry may be an
 * issued candidate ref, a candidate record, or a full feat entry).
 *
 * Each fill is accepted only when every readable dimension proves slot fit,
 * in slot order, with earlier accepted archetype names accumulated into the
 * prerequisite context — so a later feat naming an earlier-placed dedication
 * proves its chain without any new grant data. Unresolvable chains (a name
 * clause no staged or earlier-placed feat proves) fail closed here exactly
 * as they do at candidate time.
 *
 * Evidence joins the slot's own candidate list first (by ref identity, then
 * by name); a fill with no entry is already unresolved upstream and passes
 * through untouched. Prerequisite text is re-proven only when the fill
 * carries a readable `system.prerequisites.value` array alongside a staged
 * `context` — issued candidate records carry no such text because candidate
 * time already proved it, so a null context checks placement only
 * (trait, level, order, duplicates). Callers with skill data must pass an
 * unrestricted context; a restricted skill-feat context cannot prove
 * archetype placement and fails its fills closed.
 *
 * Never throws on malformed input: every rejection warns and lands in
 * `dropped` for the caller to leave unresolved.
 * @returns {{placed: number[], dropped: {index: number, name: string, reason: string}[]}}
 */
export function validateArchetypeSlotPlacement(slots, feats, context = null) {
  const placed = [];
  const dropped = [];
  const drop = (index, name, reason) => {
    console.warn(`simplysf2e | Free Archetype placement for "${name}" rejected: ${reason} — slot left unresolved`);
    dropped.push({ index, name, reason });
  };
  if (!Array.isArray(slots) || !Array.isArray(feats)) {
    console.warn("simplysf2e | Free Archetype placement needs parallel slot and feat lists — nothing validated");
    return { placed, dropped };
  }
  if (slots.length !== feats.length) {
    console.warn(`simplysf2e | Free Archetype placement lists diverge (${slots.length} slots, ${feats.length} fills) — validating their overlap only`);
  }
  const accepted = new Set();
  let names = context?.names instanceof Set ? new Set(context.names) : null;
  if (context && names === null) {
    console.warn("simplysf2e | Free Archetype placement given an unusable staged context — checking placement only");
  }
  const count = Math.min(slots.length, feats.length);
  for (let index = 0; index < count; index++) {
    const slot = slots[index];
    const fill = feats[index];
    const slotLevel = readableSlotLevel(slot);
    const label = typeof fill?.name === "string" && fill.name.trim() ? fill.name.trim() : `slot ${slotLevel ?? "?"}`;
    if (slot?.archetype !== true || slot?.type !== "class" || slotLevel === null) {
      drop(index, label, "not a readable archetype class slot");
      continue;
    }
    if (!fill || fill.entry == null) {
      // A fill with no entry is already unresolved upstream; a bare full
      // entry carries its own evidence below.
      if (!(fill && typeof fill === "object" && (fill.system || fill.traits))) continue;
    }
    const candidate = (Array.isArray(slot.candidates) ? slot.candidates : [])
      .find((item) => item?.ref === fill.entry)
      ?? (Array.isArray(slot.candidates) ? slot.candidates : [])
        .find((item) => typeof item?.name === "string" && typeof fill?.name === "string"
          && slugify(item.name) === slugify(fill.name))
      ?? null;
    const direct = fill && typeof fill === "object" && (fill.system || fill.traits) ? fill : null;
    const evidence = (fill.entry && typeof fill.entry === "object" && (fill.entry.system || fill.entry.traits))
      ? fill.entry : direct ?? candidate;
    const name = typeof fill?.name === "string" && fill.name.trim()
      ? fill.name.trim()
      : typeof candidate?.name === "string" ? candidate.name : label;
    const slug = slugify(name);
    if (!slug) {
      drop(index, label, "no readable feat name");
      continue;
    }
    if (!isArchetypeFeat(evidence)) {
      drop(index, name, "no readable archetype trait on this slot's evidence");
      continue;
    }
    const level = readableFeatLevel(evidence) ?? readableFeatLevel(fill);
    if (level === null) {
      drop(index, name, "no readable feat level");
      continue;
    }
    if (level > slotLevel) {
      drop(index, name, `feat level ${level} exceeds its level-${slotLevel} archetype slot`);
      continue;
    }
    if (accepted.has(slug)) {
      drop(index, name, "already placed in an earlier archetype slot");
      continue;
    }
    const prerequisites = evidence?.system?.prerequisites?.value ?? null;
    if (names !== null && Array.isArray(prerequisites)) {
      const proof = { ...context, names: new Set(names) };
      if (!featPrerequisitesMet({ system: { prerequisites: { value: prerequisites } } }, proof)) {
        drop(index, name, "published prerequisites unproven by staged feats and earlier archetype placements");
        continue;
      }
    }
    accepted.add(slug);
    if (names !== null) names.add(slug);
    placed.push(index);
  }
  return { placed, dropped };
}
