// Row mappers shared by the generator's creature and character previews, and the
// aggregate match summary. Moved out of generator-app.mjs unchanged (T-P4); pure
// functions of the resolved data, using only the `game.i18n` and `CONFIG` globals
// the app already used.
//
// The three preview shapes (mapNamed, mapSpells, mapGear) are identical for
// creatures and characters, so both preview builders share them. Each returns rows
// carrying `found`, which drives both the per-row checkmark and matchSummary's
// aggregate.

/** Rows for a plain {name, entry} list (feats). */
export function mapNamed(list) {
  return (list ?? []).map(({ name, entry }) => ({ name: entry?.name ?? name, found: Boolean(entry) }));
}

/** Rows for resolved spells, which carry their cast rank. */
export function mapSpells(list) {
  return (list ?? []).map(({ spell, entry }) => ({
    name: entry?.name ?? spell.name,
    rank: spell.rank,
    signature: spell.signature === true,
    found: Boolean(entry)
  }));
}

/**
 * Rows for equipment or loot. A runed name is shown as the AI wrote it (the
 * entry is only the base item), a spell gem as the item it will be built into,
 * and a stack gets its ×N suffix. Skipped gear of this category (no
 * published match, so it will not be created) follows as unfound rows.
 */
export function mapGear(list, skipped = [], category = null) {
  return [
    ...(list ?? []).map(({ name, quantity, runes, entry, scroll }) => ({
      name: (scroll && entry?.name
        ? `Spell Gem of ${entry.name} (Rank ${scroll.rank})`
        : (runes?.potency ? name : entry?.name ?? name)) + (quantity > 1 ? ` ×${quantity}` : ""),
      found: Boolean(entry)
    })),
    ...(skipped ?? []).filter((item) => item.category === category).map(({ name, quantity }) => ({
      name: name + (quantity > 1 ? ` ×${quantity}` : ""),
      found: false
    }))
  ];
}

/**
 * Aggregate "found vs. total" across every generated category — issue #52:
 * the GM had no summary of how much of a generation actually grounded
 * against the real compendium vs. fell back to AI-estimated custom items,
 * only a per-item warning icon buried in each list. Each argument is an
 * array of objects carrying a `found` boolean (a single ABC/heritage pick
 * is wrapped in a 1-element array by the caller so it can be flattened the
 * same way as the list categories).
 * @returns {{matched: number, total: number, text: string}|null}
 */
export function matchSummary(...groups) {
  const items = groups.flat().filter((item) => item && !item.narrative);
  const total = items.length;
  if (!total) return null;
  const matched = items.filter((i) => i.found).length;
  return { matched, total, text: game.i18n.format("SIMPLYSF2E.Preview.MatchSummary", { matched, total }) };
}

/** PC feat rows. An empty slot (no legal feat left) is shown as empty, not as a miss;
 * a rejected fill is still a miss. */
export function pcFeatRows(list) {
  return (list ?? []).map((feat) => feat.entry
    ? { name: feat.entry.name ?? feat.name, found: true }
    : { name: featSlotLabel(feat), found: false, empty: feat.placement !== "rejected" });
}

/** Labels such as "general 19" for character feat slots left empty. A
 * rejected fill is unresolved, not empty, so it is not listed here. */
export function emptyFeatSlots(resolved) {
  return (resolved?.feats ?? [])
    .filter((feat) => !feat.entry && feat.placement !== "rejected")
    .map((feat) => featSlotLabel(feat));
}

export function featSlotLabel(feat) {
  return `${feat.archetype ? "archetype " : ""}${feat.type} ${feat.level}`;
}

export function skillName(slug) {
  return game.i18n.localize(globalThis.CONFIG?.PF2E?.skills?.[slug]?.label ?? slug);
}
