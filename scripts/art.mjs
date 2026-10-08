import { MODULE_ID } from "./settings.mjs";
import { getPacksFor } from "./compendium.mjs";

/**
 * Creature art: borrow token art from the bestiary creature that best
 * matches the concept's creature-type traits, size and level.
 */

/**
 * True when an image path is a placeholder rather than creature art. Every
 * NPC in the sf2e 1.5.1 creature packs ships `systems/sf2e/icons/default-icons/npc.svg`;
 * real art arrives through an art module's compendium art mapping.
 */
export function isPlaceholderArt(img) {
  return !img || /mystery-man|\/default-icons\//.test(img);
}

/* Art an installed module maps onto a compendium actor (Foundry `game.compendiumArt`), if any. */
function mappedArt(uuid) {
  try {
    const art = game.compendiumArt?.enabled === false ? null : game.compendiumArt?.get?.(uuid);
    const src = art?.actor ?? art?.token?.texture?.src ?? art?.token;
    return typeof src === "string" ? src : null;
  } catch {
    return null;
  }
}

/** Choose one exact bestiary actor to supply established token structure/art. */
export async function findBestiaryScaffold(concept) {
  try {
    const conceptTraits = new Set(concept.traits);
    let best = null;
    let bestScore = -Infinity;
    for (const packId of getPacksFor("bestiaryActors")) {
      const pack = game.packs.get(packId);
      if (!pack) continue;
      const index = await pack.getIndex({
        fields: ["img", "type", "system.traits.value", "system.traits.size.value", "system.details.level.value"]
      });
      for (const entry of index) {
        if (entry.type !== "npc") continue;
        const traits = entry.system?.traits?.value ?? [];
        const shared = traits.filter((trait) => conceptTraits.has(trait)).length;
        const levelGap = Math.abs((entry.system?.details?.level?.value ?? 0) - concept.level);
        const sizeBonus = entry.system?.traits?.size?.value === concept.size ? 1 : 0;
        const uuid = entry.uuid ?? `Compendium.${packId}.Actor.${entry._id}`;
        const art = !isPlaceholderArt(mappedArt(uuid) ?? entry.img) ? 1 : 0;
        // A real creature scaffold is mandatory for complete-only creature
        // creation. Prefer trait similarity, then a creature with real art,
        // then size and level, but retain the closest level-and-size actor as
        // an exact fallback for an unusual yet valid trait combination instead
        // of silently dropping scaffolds. Level gaps never exceed 49, so art
        // only decides between creatures with the same shared-trait count.
        const score = shared * 100 + art * 50 + sizeBonus * 10 - levelGap;
        const tie = best && `${packId}:${entry._id}`.localeCompare(`${best.packId}:${best.entry._id}`);
        if (score > bestScore || (score === bestScore && tie < 0)) {
          bestScore = score;
          best = { pack, packId, entry };
        }
      }
    }
    const actor = best ? await best.pack.getDocument(best.entry._id) : null;
    return actor?.toObject?.() ?? null;
  } catch (err) {
    console.warn(`${MODULE_ID} | bestiary scaffold lookup failed`, err);
    return null;
  }
}

/**
 * Find the bestiary creature that best matches this concept's
 * creature-type traits, size and level, and reuse its artwork.
 * @returns {Promise<string|null>}
 */
export async function findBestiaryArt(concept) {
  const scaffold = await findBestiaryScaffold(concept);
  return isPlaceholderArt(scaffold?.img) ? null : scaffold.img;
}
