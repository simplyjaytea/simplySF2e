/**
 * Starfinder 2e currency for generated loot/wealth.
 *
 * Cited from foundryvtt/pf2e **v14-dev**:
 * - `CURRENCY_DENOMINATIONS` / `DENOMINATION_RATES` in
 *   `src/module/item/physical/values.ts` (credits: 10, upb: 10, same scale as sp)
 * - `ActorInventory.addCurrency` in `src/module/actor/inventory/index.ts`
 *   clones bundled `credstick.json` / `upb.json`; classic coins still resolve
 *   via `coinCompendiumUuids` on **pf2e.equipment-srd**. This module does not
 *   invent sf2e gold-piece UUIDs.
 * - Credits quantity is stored on `system.price.value` (create path writes
 *   `sp: quantity`; `TreasurePF2e#prepareBaseData` then exposes `.credits`).
 * - `TreasurePF2e#isCurrency` is coinage OR slug `upb` OR category `credstick`
 *   (`src/module/item/treasure/document.ts`).
 *
 * Templates below are verbatim copies of those bundled JSON files.
 */

import credstickJSON from "./currency/credstick.json" with { type: "json" };
import upbJSON from "./currency/upb.json" with { type: "json" };

/** v14-dev `DENOMINATION_RATES` in `src/module/item/physical/values.ts`. */
export const DENOMINATION_RATES = Object.freeze({
  cp: 1, sp: 10, gp: 100, pp: 1000, credits: 10, upb: 10
});

export const CREDSTICK_SOURCE = credstickJSON;
export const UPB_SOURCE = upbJSON;

const CANONICAL = {
  credits: "Credstick", credit: "Credstick", credstick: "Credstick", credsticks: "Credstick",
  upb: "UPB", upbs: "UPB",
  gp: "Credstick", gold: "Credstick",
  pp: "Credstick", platinum: "Credstick",
  sp: "Credstick", silver: "Credstick",
  cp: "Credstick", copper: "Credstick"
};

const SOURCE_UNIT = {
  credits: "credits", credit: "credits", credstick: "credits", credsticks: "credits",
  upb: "upb", upbs: "upb",
  gp: "gp", gold: "gp",
  pp: "pp", platinum: "pp",
  sp: "sp", silver: "sp",
  cp: "cp", copper: "cp"
};

const CURRENCY_RE = /^\s*(\d+)?\s*(credsticks?|credits?|upbs?|platinum|gold|silver|copper|pp|gp|sp|cp)\s*(?:coins?|pieces?)?\s*$/i;
const UPB_LONG_RE = /^\s*(\d+)?\s*universal\s+polymer\s+bases?\s*$/i;

/** 1 credit or 1 UPB = 1 sp = 0.1 gp (`DENOMINATION_RATES`). */
export const CREDIT_UNIT_GP = DENOMINATION_RATES.credits / DENOMINATION_RATES.gp;

/** Convert a gp-equivalent amount to credits via cited `DENOMINATION_RATES`. */
export function gpToCredits(gp) {
  const n = Number(gp);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(Math.ceil((n * DENOMINATION_RATES.gp) / DENOMINATION_RATES.credits), 1);
}

export function toCredits(sourceUnit, count) {
  const n = Math.max(Math.round(Number(count) || 0), 0);
  if (n <= 0) return 0;
  if (sourceUnit === "credits" || sourceUnit === "upb") return n;
  const rate = DENOMINATION_RATES[sourceUnit];
  if (!rate) return 0;
  return Math.max(Math.ceil((n * rate) / DENOMINATION_RATES.credits), 1);
}

/**
 * Recognize currency loot. Fantasy coin language (gp/gold/…) maps onto
 * Credstick with a leading count converted through cited denomination rates.
 * UPB stays UPB. Unknown denominations return null — fail closed.
 */
export function parseCoins(name) {
  const raw = String(name ?? "");
  const match = CURRENCY_RE.exec(raw) ?? UPB_LONG_RE.exec(raw);
  if (!match) return null;
  const alias = match[2] ? match[2].toLowerCase() : "upb";
  const canonical = CANONICAL[alias];
  const sourceUnit = SOURCE_UNIT[alias];
  if (!canonical || !sourceUnit) return null;
  const rawCount = match[1] ? Number(match[1]) : null;
  return {
    name: canonical,
    unit: canonical === "UPB" ? "upb" : "credits",
    sourceUnit,
    count: rawCount == null ? null : toCredits(sourceUnit, rawCount)
  };
}

/** Stack size in credits/UPB for a parsed currency line. */
export function currencyQuantity(coins, quantity) {
  const qty = Math.max(Math.round(Number(quantity) || 1), 1);
  const n = coins.count != null ? coins.count * qty : toCredits(coins.sourceUnit, qty);
  return Math.min(Math.max(n, 1), 100000);
}

/**
 * PF2e 8.4.1 / v14-dev TreasurePF2e#isCoinage is `system.category === "coin"`.
 * `stackGroup === "coins"` is the pre-8.4.1 source field.
 */
export function isCoinageDocument(doc) {
  return doc?.type === "treasure"
    && (doc.system?.category === "coin" || doc.system?.stackGroup === "coins");
}

/**
 * v14-dev TreasurePF2e#isCurrency: coinage, UPB (slug), or credstick (category).
 */
export function isCurrencyDocument(doc) {
  return isCoinageDocument(doc)
    || (doc?.type === "treasure" && (doc.system?.slug === "upb" || doc.system?.category === "credstick"));
}

function cloneTemplate(template) {
  return typeof structuredClone === "function" ? structuredClone(template) : JSON.parse(JSON.stringify(template));
}

/**
 * Clone the same bundled templates `addCurrency` uses. Credits store their
 * count on `system.price.value.sp` with quantity locked to 1; UPB uses
 * `system.quantity`. Fail closed if the cited template is the wrong shape.
 */
export function assembleCurrency(unit, quantity) {
  const n = Math.min(Math.max(Math.round(Number(quantity) || 0), 0), 100000);
  if (n <= 0) return null;
  if (unit === "credits") {
    if (CREDSTICK_SOURCE?.type !== "treasure" || CREDSTICK_SOURCE?.system?.category !== "credstick") return null;
    const source = cloneTemplate(CREDSTICK_SOURCE);
    delete source._id;
    source.system ??= {};
    source.system.quantity = 1;
    source.system.price ??= {};
    source.system.price.value = { sp: n };
    return source;
  }
  if (unit === "upb") {
    if (UPB_SOURCE?.type !== "treasure" || UPB_SOURCE?.system?.slug !== "upb") return null;
    const source = cloneTemplate(UPB_SOURCE);
    delete source._id;
    source.system ??= {};
    source.system.quantity = n;
    return source;
  }
  return null;
}

export function resolveCurrencyTemplate(canonicalName) {
  const unit = canonicalName === "UPB" ? "upb" : canonicalName === "Credstick" ? "credits" : null;
  if (!unit) return null;
  const probe = assembleCurrency(unit, 1);
  if (!probe || !isCurrencyDocument(probe)) return null;
  return { unit, entry: { currency: unit }, resolvedValue: CREDIT_UNIT_GP };
}
