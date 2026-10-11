/**
 * Pure Treasure hoard rules. The AI names the hoard and picks catalog IDs;
 * every item is a real `sf2e.equipment` document at its own price. The budget
 * is a cited GM Core number, never an AI number. No Foundry globals, so this
 * file is node-testable.
 */
import { esc, toHtml } from "./text.mjs";
import { gpToCredits } from "./currency.mjs";
import { TREASURE_BY_LEVEL, treasureBudget, lookup } from "./tables.mjs";
import { shopTypesFor } from "./shop.mjs";

/**
 * Party levels the table covers: GM Core's Treasure by Level table is
 * published for levels 1-20 (tables.mjs TREASURE_BY_LEVEL).
 */
export const TREASURE_MIN_LEVEL = 1;
export const TREASURE_MAX_LEVEL = 20;
export const TREASURE_MIN_PARTY = 1;
export const TREASURE_MAX_PARTY = 8;

/** The only two budget choices; both come from TREASURE_BY_LEVEL. */
export const TREASURE_AMOUNTS = Object.freeze(["encounter", "level"]);

/**
 * How many distinct items the AI is asked for. A module default (no SF2e rule
 * sets it): the module keeps picks in the AI's order until the budget is
 * spent, so the AI is asked for more than will fit.
 */
export const TREASURE_PICKS = Object.freeze({ encounter: 12, level: 24 });

export const TREASURE_RARITIES = Object.freeze(["common", "uncommon", "rare"]);

const text = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export const clampTreasureLevel = (value, fallback = 1) =>
  clampInt(value, TREASURE_MIN_LEVEL, TREASURE_MAX_LEVEL, fallback);

export const clampPartySize = (value, fallback = 4) =>
  clampInt(value, TREASURE_MIN_PARTY, TREASURE_MAX_PARTY, fallback);

/**
 * Budget in credits. "encounter" is the per-encounter share of the level's
 * total (tables.mjs treasureBudget: TREASURE_BY_LEVEL total / ENCOUNTERS_PER_LEVEL);
 * "level" is the whole TREASURE_BY_LEVEL total. gp becomes credits via the
 * cited rate in currency.mjs. Party size never changes it: the table is
 * already per party.
 */
export function treasureBudgetCredits(level, amount = "encounter") {
  const lv = clampTreasureLevel(level);
  if (amount === "level") return gpToCredits(lookup(TREASURE_BY_LEVEL, lv, "total", []));
  return gpToCredits(treasureBudget(lv, "common", "standard"));
}

/** Display-only per-character share. Never feeds the budget. */
export function creditsEach(budget, partySize) {
  return Math.round((Number(budget) || 0) / clampPartySize(partySize));
}

/** Flavor only: hoard name, description, keywords and category slugs. */
export function normalizeTreasureConcept(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const keywords = [...new Set((Array.isArray(source.keywords) ? source.keywords : [])
    .map((keyword) => text(keyword, 40).toLowerCase())
    .filter(Boolean))].slice(0, 12);
  const { categories } = shopTypesFor(source.categories);
  return {
    name: text(source.name, 80) || "Unnamed Hoard",
    description: String(source.description ?? "").trim().slice(0, 2000),
    keywords,
    categories
  };
}

/** Match the AI's raw picks against the issued catalog. Pure; shared with the app. */
export function resolveIssuedPicks(picks, candidates) {
  const byId = new Map((Array.isArray(candidates) ? candidates : []).map((candidate) => [candidate.id, candidate]));
  const byName = new Map();
  for (const candidate of byId.values()) {
    const key = String(candidate.name ?? "").toLocaleLowerCase();
    byName.set(key, byName.has(key) ? null : candidate);
  }
  const issued = [];
  const unknown = [];
  for (const pick of Array.isArray(picks) ? picks : []) {
    const id = String(pick && typeof pick === "object" ? pick.id ?? "" : pick ?? "").trim();
    if (!id) continue;
    // Some providers echo the displayed name in the id field: accept only an
    // exact, unambiguous name from this run's catalog.
    const candidate = byId.get(id) ?? byName.get(id.toLocaleLowerCase()) ?? null;
    if (candidate) issued.push(candidate);
    else unknown.push(id);
  }
  return { issued, unknown };
}

/**
 * Fill the hoard: issued IDs only, in AI order, quantity 1, no repeats, and an
 * item is added only when its credit price fits the remaining budget. A
 * candidate without a finite `credits` price is dropped (never guessed).
 * Leftover budget is returned as credits for a Credstick row.
 * @param {unknown[]} picks raw `ids` array from the AI
 * @param {{id: string, name: string, credits: number}[]} candidates issued catalog, priced
 * @param {number} budgetCredits
 */
export function fillHoard(picks, candidates, budgetCredits) {
  const budget = Math.max(Math.floor(Number(budgetCredits) || 0), 0);
  const { issued, unknown } = resolveIssuedPicks(picks, candidates);
  const items = [];
  const overBudget = [];
  const unpriced = [];
  const seen = new Set();
  let remaining = budget;
  for (const candidate of issued) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    const price = Number(candidate.credits);
    if (!Number.isFinite(price) || price < 0) {
      unpriced.push(candidate.name);
      continue;
    }
    if (price > remaining) {
      overBudget.push(candidate.name);
      continue;
    }
    remaining -= price;
    items.push({ ...candidate, quantity: 1 });
  }
  return { items, unknown, overBudget, unpriced, leftover: remaining, budget };
}

/** Credits not spent on items (removing a row hands its price back). */
export function hoardLeftover(budget, items) {
  const spent = (Array.isArray(items) ? items : [])
    .reduce((sum, row) => sum + (Number(row.credits) || 0) * (Number(row.quantity) || 1), 0);
  return Math.max(Math.floor(Number(budget) || 0) - spent, 0);
}

/** The loot sheet description: escaped AI prose. */
export function treasureDescriptionHtml(concept) {
  return toHtml(concept?.description ?? "") || `<p>${esc(concept?.name ?? "")}</p>`;
}

/**
 * Creation data for a hoard: a native loot actor in Loot mode (v14-dev
 * `actor/loot/data.ts`: `lootSheetType` "Loot" | "Merchant",
 * `details.description`, `details.level.value`).
 * @param {object} concept normalized treasure concept
 * @param {number} level party level
 * @param {object[]} items embedded item source data (compendium clones + Credstick)
 */
export function treasureActorData(concept, level, items) {
  return {
    name: concept.name,
    type: "loot",
    system: {
      details: {
        description: treasureDescriptionHtml(concept),
        level: { value: clampTreasureLevel(level, 1) }
      },
      lootSheetType: "Loot"
    },
    items
  };
}
