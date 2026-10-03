/**
 * Reroll one pick: swap a single spell, feat or published ability in a
 * creature preview for a different compendium entry. Pure helpers only, so
 * the grounding rules are node-testable; the generator supplies the issued
 * candidate catalog and the AI choice.
 *
 * A replacement always comes from the same kind of bounded catalog the first
 * run used. It never duplicates something already on the creature, never
 * returns a pick the GM already rerolled away from in this slot, and a spell
 * keeps its slot: a cantrip is replaced by a cantrip, and a ranked spell by a
 * ranked spell whose own rank fits the slot.
 */

export const REROLL_KINDS = Object.freeze(["spell", "feat", "ability"]);

const nameKey = (value) => String(value ?? "").trim().toLocaleLowerCase();
const refKey = (ref) => (ref?.packId && ref?._id ? `${ref.packId}\u0000${ref._id}` : null);
const pickName = (pick) => (typeof pick === "string" ? pick : pick?.name);

/** The concept list a kind edits, or null when the concept has none. */
function listFor(concept, kind) {
  if (kind === "spell") return concept?.spellcasting?.spells ?? null;
  if (kind === "feat") return concept?.feats ?? null;
  if (kind === "ability") return concept?.specialAbilities ?? null;
  return null;
}

/**
 * The pick at `index`, when it is one that can be rerolled. A narrative-only
 * ability is flavor with no published entry, so it is not a target; an
 * unmatched spell, feat or glossary ability is, since a reroll can fix it.
 * @returns {object|string|null}
 */
export function rerollTarget(concept, kind, index) {
  const list = listFor(concept, kind);
  if (!Array.isArray(list) || !Number.isInteger(index) || index < 0 || index >= list.length) return null;
  const pick = list[index];
  if (!pickName(pick)) return null;
  if (kind === "ability" && pick.narrative) return null;
  return pick;
}

/**
 * Candidates a reroll may offer for one slot.
 * @param {object[]} candidates issued catalog entries ({id, ref, name, rank?})
 * @param {object} args
 * @param {object} args.concept current concept
 * @param {string} args.kind "spell" | "feat" | "ability"
 * @param {number} args.index slot in the concept list
 * @param {string[]} [args.rejected] names already rerolled away from in this slot
 * @returns {object[]}
 */
export function rerollPool(candidates, { concept, kind, index, rejected = [] }) {
  const target = rerollTarget(concept, kind, index);
  if (!target || !Array.isArray(candidates)) return [];
  const takenNames = new Set([...listFor(concept, kind).map(pickName), ...rejected].map(nameKey));
  const takenRefs = new Set(listFor(concept, kind).map((pick) => refKey(pick?.candidate)).filter(Boolean));
  const slot = kind === "spell" ? Number(target.rank) || 0 : null;
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = nameKey(candidate?.name);
    if (!key || !candidate.ref || takenNames.has(key) || takenRefs.has(refKey(candidate.ref)) || seen.has(key)) return false;
    if (kind === "spell") {
      const rank = Number(candidate.rank);
      if (!Number.isInteger(rank)) return false;
      if (slot === 0 ? rank !== 0 : rank < 1 || rank > slot) return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * A new concept with the slot at `index` replaced by `candidate`. Other picks
 * keep their object identity; the concept passed in is not changed.
 */
export function applyRerollPick(concept, { kind, index, candidate }) {
  const target = rerollTarget(concept, kind, index);
  if (!target || !candidate?.ref || !candidate.name) throw new TypeError("Invalid reroll target or replacement");
  const replacement = { name: candidate.name, candidate: candidate.ref };
  if (kind === "spell") {
    const spells = [...concept.spellcasting.spells];
    spells[index] = { ...replacement, rank: target.rank };
    return { ...concept, spellcasting: { ...concept.spellcasting, spells } };
  }
  const key = kind === "feat" ? "feats" : "specialAbilities";
  const list = [...concept[key]];
  list[index] = replacement;
  return { ...concept, [key]: list };
}

/** Search words for the candidate catalog: the slot's current pick plus the creature's traits. */
export function rerollKeywords(concept, kind, index) {
  const target = rerollTarget(concept, kind, index);
  return [pickName(target), target?.glossary, ...(concept?.traits ?? [])]
    .map((word) => nameKey(word)).filter(Boolean);
}
