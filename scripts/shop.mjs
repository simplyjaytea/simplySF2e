/**
 * Pure Shop generator rules. The AI names the shop and picks catalog IDs;
 * everything sold is a real `sf2e.equipment` document, and its price is that
 * document's own price. No Foundry globals, so this file is node-testable.
 */
import { esc, toHtml } from "./text.mjs";

/** Shop level range: a PC level, like the Item Forge and Character mode. */
export const SHOP_MIN_LEVEL = 0;
export const SHOP_MAX_LEVEL = 20;

/**
 * How many distinct items the AI is asked to stock. A module default (no SF2e
 * rule sets a shop's inventory size); the GM picks the size, never a number.
 */
export const SHOP_SIZES = Object.freeze({ small: 8, standard: 16, large: 24 });

/**
 * What a shop may sell, as the AI's enum slugs, mapped to real sf2e item types
 * (compendium.mjs EQUIPMENT_TYPES). Treasure is loot, not shop stock.
 */
export const SHOP_CATEGORIES = Object.freeze({
  weapons: ["weapon", "ammo"],
  armor: ["armor", "shield"],
  // No "kit": a kit is not physical, and a loot actor only holds physical
  // items (v14-dev actor/loot/document.ts `allowedItemTypes`).
  gear: ["equipment", "backpack"],
  consumables: ["consumable"]
});

/**
 * Stack size for a stocked item, by item type. A module default: shops sell
 * consumables and ammunition by the handful, everything else singly. The GM
 * edits quantities on the merchant sheet.
 */
export const SHOP_STACK = Object.freeze({ consumable: 3, ammo: 3 });

export const SHOP_RARITIES = Object.freeze(["common", "uncommon", "rare"]);

const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, unique: 3 };

const text = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Clamp a level to the shop range; non-numbers fall back. */
export function clampShopLevel(value, fallback = 1) {
  const level = Math.round(Number(value));
  if (!Number.isFinite(level)) return fallback;
  return Math.min(SHOP_MAX_LEVEL, Math.max(SHOP_MIN_LEVEL, level));
}

/** The item types a set of category slugs allows. Unknown slugs are dropped; none valid means all. */
export function shopTypesFor(categories) {
  const valid = (Array.isArray(categories) ? categories : [])
    .map((slug) => String(slug ?? "").trim().toLowerCase())
    .filter((slug) => Object.hasOwn(SHOP_CATEGORIES, slug));
  const slugs = valid.length ? [...new Set(valid)] : Object.keys(SHOP_CATEGORIES);
  return { categories: slugs, types: new Set(slugs.flatMap((slug) => SHOP_CATEGORIES[slug])) };
}

/** True when an item's rarity is at or below the GM's cap. Missing rarity counts as common. */
export function withinShopRarity(rarity, maxRarity = "common") {
  const rank = RARITY_RANK[rarity ?? "common"] ?? RARITY_RANK.unique;
  return rank <= (RARITY_RANK[maxRarity] ?? RARITY_RANK.common);
}

/**
 * Coerce the AI's shop concept into a safe shape. Flavor only: name, keeper,
 * description, search keywords and category slugs. Nothing here is a number.
 */
export function normalizeShopConcept(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const keywords = [...new Set((Array.isArray(source.keywords) ? source.keywords : [])
    .map((keyword) => text(keyword, 40).toLowerCase())
    .filter(Boolean))].slice(0, 12);
  const { categories } = shopTypesFor(source.categories);
  return {
    name: text(source.name, 80) || "Unnamed Shop",
    shopkeeper: text(source.shopkeeper, 120),
    blurb: text(source.blurb, 200),
    description: String(source.description ?? "").trim().slice(0, 2000),
    keywords,
    categories
  };
}

/**
 * Turn the AI's picked IDs into stock rows. Only IDs from this run's issued
 * catalog survive; repeats are dropped; the list stops at the requested size.
 * Dropped picks are reported, never guessed at.
 * @param {unknown[]} picks raw `ids` array from the AI
 * @param {{id: string, name: string, type: string}[]} candidates the issued catalog
 * @param {number} count requested stock size
 */
export function pickShopStock(picks, candidates, count) {
  const byId = new Map((Array.isArray(candidates) ? candidates : []).map((candidate) => [candidate.id, candidate]));
  const byName = new Map();
  for (const candidate of byId.values()) {
    const key = String(candidate.name ?? "").toLocaleLowerCase();
    byName.set(key, byName.has(key) ? null : candidate);
  }
  const limit = Math.max(Math.floor(Number(count) || 0), 0);
  const stock = [];
  const unknown = [];
  const seen = new Set();
  for (const pick of Array.isArray(picks) ? picks : []) {
    const id = String(pick && typeof pick === "object" ? pick.id ?? "" : pick ?? "").trim();
    if (!id) continue;
    // Some providers echo the displayed name in the id field: accept only an
    // exact, unambiguous name from this run's catalog.
    const candidate = byId.get(id) ?? byName.get(id.toLocaleLowerCase()) ?? null;
    if (!candidate) {
      unknown.push(id);
      continue;
    }
    if (seen.has(candidate.id) || stock.length >= limit) continue;
    seen.add(candidate.id);
    stock.push({ ...candidate, quantity: SHOP_STACK[candidate.type] ?? 1 });
  }
  return { stock, unknown };
}

/** Sum of the stock's credit prices (each row: unit credits × quantity). */
export function shopStockValue(rows) {
  return (Array.isArray(rows) ? rows : [])
    .reduce((sum, row) => sum + (Number(row.credits) || 0) * (Number(row.quantity) || 0), 0);
}

/** The merchant's sheet description: escaped AI prose plus the keeper line. */
export function shopDescriptionHtml(concept, { shopkeeperLabel = "Shopkeeper" } = {}) {
  const parts = [];
  if (concept?.blurb) parts.push(`<p><em>${esc(concept.blurb)}</em></p>`);
  if (concept?.shopkeeper) parts.push(`<p><strong>${esc(shopkeeperLabel)}:</strong> ${esc(concept.shopkeeper)}</p>`);
  const body = toHtml(concept?.description ?? "");
  if (body) parts.push(body);
  return parts.join("\n");
}

/**
 * Creation data for a merchant: a native loot actor in Merchant mode
 * (v14-dev `actor/loot/data.ts`: `lootSheetType` "Loot" | "Merchant",
 * `details.description`, `details.level.value` min 0).
 * @param {object} concept normalized shop concept
 * @param {number} level shop level
 * @param {object[]} items embedded item source data (compendium clones)
 */
export function shopActorData(concept, level, items, { shopkeeperLabel } = {}) {
  return {
    name: concept.name,
    type: "loot",
    system: {
      details: {
        description: shopDescriptionHtml(concept, { shopkeeperLabel }),
        level: { value: clampShopLevel(level, 0) }
      },
      lootSheetType: "Merchant"
    },
    items
  };
}
