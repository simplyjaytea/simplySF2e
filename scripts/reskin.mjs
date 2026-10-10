/**
 * Reskin: copy an existing NPC and give it new fiction. Numbers, rules,
 * traits, and item links never change. The AI may supply a new name, prose,
 * and new display names for the copy's strikes and abilities; everything it
 * returns is validated here and anything unrecognized is dropped.
 *
 * Pure module (no Foundry globals) so the validation and the copy are
 * node-testable. builder.mjs reskinActor() and the generator's Reskin mode
 * both go through applyReskin().
 */
import { esc, toHtml, capitalized } from "./text.mjs";

/** Item types whose display name Reskin may change (NPC strikes and abilities). */
export const RENAMEABLE_TYPES = Object.freeze(["melee", "action"]);
const MAX_NAME_LENGTH = 80;

// Port of pf2e v14-dev src/util/misc.ts sluggify (camel: null). An item's
// slug falls back to sluggify(name) when system.slug is null
// (item/base/document.ts: `const slug = this.slug ?? sluggify(this.name);`),
// and NPC attack effects and melee base types key off that slug. Renaming
// must therefore pin the original slug first.
const nonWordCharacterRE = /[^\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]/gu;
const lowerCaseThenUpperCaseRE =
  /(\p{Lowercase_Letter})(\p{Uppercase_Letter}(?=^|$|[\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]))/gu;

export function pf2eSluggify(text) {
  if (typeof text !== "string") return "";
  if (text === "-") return text;
  return text
    .replace(lowerCaseThenUpperCaseRE, "$1-$2")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(nonWordCharacterRE, " ")
    .trim()
    .replace(/[-\s]+/g, "-");
}

function cleanName(value) {
  if (typeof value !== "string") return null;
  const name = value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return name && name.length <= MAX_NAME_LENGTH ? name : null;
}

function cleanText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Strikes and abilities the AI may rename, as {id, name, type}. */
export function reskinRenameTargets(actorData) {
  return (actorData?.items ?? [])
    .filter((item) => item?._id && RENAMEABLE_TYPES.includes(item.type) && typeof item.name === "string")
    .map((item) => ({ id: item._id, name: item.name, type: item.type }));
}

/**
 * Validate an AI reskin response against the source creature. Unknown ids,
 * duplicate ids, empty or overlong names, and no-op renames are dropped.
 * @returns {{name: string|null, blurb: string|null, description: string|null,
 *   readAloud: string|null, recallKnowledge: string|null,
 *   renames: {id: string, from: string, name: string}[]}}
 */
export function normalizeReskin(raw, actorData) {
  const targets = new Map(reskinRenameTargets(actorData).map((target) => [target.id, target]));
  const seen = new Set();
  const renames = [];
  for (const entry of Array.isArray(raw?.renames) ? raw.renames : []) {
    const target = targets.get(entry?.id);
    const name = cleanName(entry?.name);
    if (!target || !name || seen.has(target.id) || name === target.name) {
      if (entry?.id && !target) console.warn("simplysf2e | reskin: dropped a rename for an unknown item", entry.id);
      continue;
    }
    seen.add(target.id);
    renames.push({ id: target.id, from: target.name, name });
  }
  return {
    name: cleanName(raw?.name),
    blurb: cleanText(raw?.blurb),
    description: cleanText(raw?.description),
    readAloud: cleanText(raw?.readAloud),
    recallKnowledge: cleanText(raw?.recallKnowledge),
    renames
  };
}

/**
 * The Recall Knowledge block for actor notes: one clickable check per skill
 * the creature's traits name. With no identifying trait the published table
 * names no skill, so only the DC is shown (any applicable Lore can still be
 * rolled against it) instead of guessing one.
 * @param {string|string[]} skills  skill slug(s), possibly empty
 * @param {number} dc
 * @param {string} text  AI flavor text; escaped here
 */
export function recallKnowledgeNote(skills, dc, text) {
  const list = [].concat(skills ?? []).filter(Boolean);
  const checks = list.length
    ? list.map((skill) => `<strong>${esc(capitalized(skill))}</strong> @Check[type:${skill}|dc:${dc}]`).join(" or ")
    : `<strong>DC ${dc}</strong>`;
  return `<h3>Recall Knowledge</h3><p>${checks}: ${esc(text)}</p>`;
}

/**
 * Return creation data for the reskinned copy. `actorData` is the source
 * actor's plain data (toObject / fromCompendium); it is not mutated.
 * @param {object} [options]
 * @param {(traits: string[]) => string|string[]} [options.recallSkill]  Recall Knowledge skill slug(s)
 * @param {(level: number, rarity: string) => number} [options.recallDC]
 */
export function applyReskin(actorData, flavor = {}, { recallSkill = null, recallDC = null } = {}) {
  const data = structuredClone(actorData);
  delete data._id;
  if (flavor.name) {
    data.name = capitalized(flavor.name);
    if (data.prototypeToken) data.prototypeToken.name = data.name;
  }

  const notes = [];
  if (flavor.readAloud) notes.push(`<blockquote class="spf-read-aloud"><em>${esc(flavor.readAloud)}</em></blockquote>`);
  if (flavor.description) notes.push(toHtml(flavor.description));
  if (flavor.recallKnowledge && recallSkill && recallDC) {
    const traits = data.system?.traits?.value ?? [];
    const dc = recallDC(data.system?.details?.level?.value ?? 1, data.system?.traits?.rarity ?? "common");
    notes.push(recallKnowledgeNote(recallSkill(traits), dc, flavor.recallKnowledge));
  }
  data.system ??= {};
  data.system.details ??= {};
  // Plain text: the v14-dev NPC sheet header renders the blurb as an escaped
  // input value, and builder.mjs stores it the same way.
  if (flavor.blurb) data.system.details.blurb = flavor.blurb;
  if (notes.length) data.system.details.publicNotes = notes.join("\n");

  const renames = new Map((flavor.renames ?? []).map((rename) => [rename.id, rename.name]));
  for (const item of data.items ?? []) {
    const name = renames.get(item._id);
    if (!name || !RENAMEABLE_TYPES.includes(item.type)) continue;
    item.system ??= {};
    item.system.slug ||= pf2eSluggify(item.name);
    item.name = name;
  }
  return data;
}
