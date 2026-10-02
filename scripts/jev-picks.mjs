// Jev-backed equipment and loot picks (J2). Jev only chooses among real catalog
// candidates this run already issued, keyed by their short ids; it never names
// content or emits a number. Every function returns `equipment`/`loot: null`
// (the caller then runs the chat-model call) on any doubt, so a step never
// changes kind because Jev was used.
import { JEV_MIN_CONFIDENCE, buildChoiceQuestion, requestJevDecision } from "./jev.mjs";
import { normalizeJevUsage } from "./tokens.mjs";
import { parseCoins } from "./currency.mjs";

/** Key of the extra "no weapon fits this strike" option. Candidate ids never equal it (buildChoiceQuestion rejects a duplicate). */
export const JEV_NONE_KEY = "none";

/** Scale words Jev scores a stackable item's quantity against. */
export const JEV_QUANTITY_WORDS = Object.freeze(["one", "a few", "several"]);
/** Module default, not a rules number: quantity per scale word. The chat-model path likewise says 2-5 for stackables. */
export const JEV_QUANTITY_VALUES = Object.freeze([1, 3, 5]);
/** Same cap the chat-model equipment path applies. */
const EQUIPMENT_QUANTITY_CAP = 10;
const STACKABLE_TYPES = new Set(["ammo", "consumable"]);
const STATE_TEXT_LIMIT = 1200;
// Same test as builder.mjs parseScroll (kept local: builder.mjs pulls in Foundry-only code).
const SPELL_GEM_NAME = /^\s*(?:scroll|spell gem) of\s/i;

const tokensOf = (text) => String(text ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
const clip = (text) => String(text ?? "").slice(0, STATE_TEXT_LIMIT);

/** Sum two normalized usages (either may be null). */
export function mergeUsage(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  const cost = a.cost == null && b.cost == null ? null : (a.cost ?? 0) + (b.cost ?? 0);
  return {
    prompt: (a.prompt || 0) + (b.prompt || 0),
    completion: (a.completion || 0) + (b.completion || 0),
    total: (a.total || 0) + (b.total || 0),
    estimated: Boolean(a.estimated || b.estimated),
    ...(cost == null ? {} : { cost })
  };
}

/** The concept summary Jev reads as `state`. Plain text, bounded. */
export function buildJevState(concept, { includeEquipment = false } = {}) {
  return [
    concept.gmPrompt ? `Original GM request: ${clip(concept.gmPrompt)}` : null,
    `Creature: ${concept.name} (level ${concept.level}${concept.rarity ? `, ${concept.rarity} rarity` : ""})`,
    concept.blurb ? `Blurb: ${clip(concept.blurb)}` : null,
    concept.description ? `Description: ${clip(concept.description)}` : null,
    concept.traits?.length ? `Traits: ${concept.traits.join(", ")}` : null,
    concept.strikes?.length ? `Strikes: ${concept.strikes.map((s) => `${s.name} (${s.type})`).join(", ")}` : null,
    includeEquipment && concept.equipment?.length
      ? `Already carried equipment: ${concept.equipment.map((item) => item.name).join(", ")}`
      : null
  ].filter(Boolean).join("\n");
}

/** Read a Score answer as an index into `words`, confirmed through the answer's own legend. Null when unreadable. */
export function jevScoreIndex(answer, words) {
  if (answer?.type !== "score" || !Number.isFinite(answer.score)) return null;
  const index = Math.min(Math.max(Math.round(answer.score), 0), words.length - 1);
  if (answer.legend && answer.legend[String(index)] !== words[index]) return null;
  return index;
}

const asCandidates = (list) => list.map(({ id, name }) => ({ id, name }));
const confident = (answer) => answer?.type === "choice" && answer.confidence >= JEV_MIN_CONFIDENCE;

/** Ask one batch of questions; `result` is null on any failure. */
async function ask({ jevConfig, state, questions, signal, request }) {
  const result = await request({ ...jevConfig, state, questions, signal });
  return { result, ms: result?.ms ?? 0, usage: result ? normalizeJevUsage(result.usage) : null };
}

/**
 * Pick carried equipment through Jev: one Choice per first-draft item over the
 * full candidate list, plus one weapon Choice (with a `none` key) per strike no
 * draft item already covers. Returns `{ equipment|null, ms, usage }`.
 * `request` is injectable for tests.
 */
export async function jevPickEquipment({ concept, candidates, jevConfig, signal, request = requestJevDecision }) {
  const draft = Array.isArray(concept?.equipment) ? concept.equipment : [];
  const none = { equipment: null, ms: 0, usage: null };
  if (!jevConfig || !draft.length || !candidates?.length) return none;

  const questions = {};
  const draftKeys = [];
  for (const [index, entry] of draft.entries()) {
    const question = buildChoiceQuestion({
      instructions: `Which listed published item best matches the draft gear "${entry.name}" for this creature? Choose the closest equivalent.`,
      candidates: asCandidates(candidates)
    });
    if (!question) return none;
    questions[`draft${index}`] = question;
    draftKeys.push(`draft${index}`);
  }

  // Strikes no draft item mentions get a weapon of their own, as the chat-model prompt does ("match its strikes").
  const draftTokens = new Set(draft.flatMap((entry) => tokensOf(entry.name)));
  const weapons = candidates.filter((candidate) => candidate.type === "weapon");
  const strikeKeys = [];
  if (weapons.length) {
    for (const [index, strike] of (concept.strikes ?? []).entries()) {
      if (tokensOf(strike.name).some((token) => draftTokens.has(token))) continue;
      const question = buildChoiceQuestion({
        instructions: `Does a listed weapon match this creature's strike "${strike.name}" (${strike.type})? Choose "${JEV_NONE_KEY}" for natural attacks or when no weapon fits.`,
        candidates: [...asCandidates(weapons), { id: JEV_NONE_KEY, name: "No listed weapon fits this strike" }]
      });
      if (!question) return none;
      questions[`strike${index}`] = question;
      strikeKeys.push(`strike${index}`);
    }
  }

  const state = buildJevState(concept);
  const first = await ask({ jevConfig, state, questions, signal, request });
  let ms = first.ms;
  let usage = first.usage;
  if (!first.result) return { equipment: null, ms, usage };
  const answers = first.result.answers;

  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const picked = [];
  const seen = new Set();
  for (const key of draftKeys) {
    const answer = answers[key];
    // One doubtful draft item sends the whole step to the chat model (simple, predictable).
    if (!confident(answer) || !byId.has(answer.choice)) return { equipment: null, ms, usage };
    if (seen.has(answer.choice)) continue;
    seen.add(answer.choice);
    picked.push(byId.get(answer.choice));
  }
  for (const key of strikeKeys) {
    const answer = answers[key];
    if (!confident(answer) || !byId.has(answer.choice) || seen.has(answer.choice)) continue;
    seen.add(answer.choice);
    picked.push(byId.get(answer.choice));
  }

  // Quantity: 1, except ammunition and stackable consumables, scored on scale words.
  const quantities = new Map();
  const stackable = picked.filter((candidate) => STACKABLE_TYPES.has(candidate.type));
  if (stackable.length) {
    const quantityQuestions = Object.fromEntries(stackable.map((candidate) => [`qty_${candidate.id}`, {
      type: "score",
      instructions: `How many "${candidate.name}" would this creature carry?`,
      criteria: [...JEV_QUANTITY_WORDS]
    }]));
    const second = await ask({ jevConfig, state, questions: quantityQuestions, signal, request });
    ms += second.ms;
    usage = mergeUsage(usage, second.usage);
    for (const candidate of stackable) {
      const index = jevScoreIndex(second.result?.answers?.[`qty_${candidate.id}`], JEV_QUANTITY_WORDS);
      if (index != null) quantities.set(candidate.id, JEV_QUANTITY_VALUES[index]);
    }
  }

  const equipment = picked.map((candidate) => ({
    name: candidate.name,
    ...(candidate.ref ? { candidate: candidate.ref } : {}),
    quantity: Math.min(Math.max(quantities.get(candidate.id) ?? 1, 1), EQUIPMENT_QUANTITY_CAP),
    value: 0
  }));
  return { equipment, ms, usage };
}

/**
 * Pick dropped loot through Jev: one Choice per plain (non-coin) first-draft
 * entry over the full candidate list, keeping the draft's own quantity. Coins are
 * re-added by the caller, and any spell-gem entry sends the whole step to the chat
 * model because gems pick a spell and rank. Returns `{ loot|null, ms, usage }`.
 */
export async function jevPickLoot({ concept, candidates, jevConfig, signal, request = requestJevDecision }) {
  const none = { loot: null, ms: 0, usage: null };
  const draft = Array.isArray(concept?.loot) ? concept.loot : [];
  if (!jevConfig || !candidates?.length) return none;
  if (draft.some((entry) => SPELL_GEM_NAME.test(String(entry?.name ?? "")))) return none;
  const plain = draft.filter((entry) => !parseCoins(entry.name));
  if (!plain.length) return none;

  const questions = {};
  for (const [index, entry] of plain.entries()) {
    const question = buildChoiceQuestion({
      instructions: `Which listed published item is the closest match for the draft loot "${entry.name}"?`,
      candidates: asCandidates(candidates)
    });
    if (!question) return none;
    questions[`loot${index}`] = question;
  }

  const { result, ms, usage } = await ask({
    jevConfig, state: buildJevState(concept, { includeEquipment: true }), questions, signal, request
  });
  if (!result) return { loot: null, ms, usage };

  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const merged = new Map();
  for (const [index, entry] of plain.entries()) {
    const answer = result.answers[`loot${index}`];
    if (!confident(answer) || !byId.has(answer.choice)) return { loot: null, ms, usage };
    const quantity = Math.max(Math.round(Number(entry.quantity) || 1), 1);
    const existing = merged.get(answer.choice);
    // Two draft entries mapped to one item: keep one row with the combined quantity.
    if (existing) existing.quantity += quantity;
    else {
      const candidate = byId.get(answer.choice);
      merged.set(answer.choice, {
        name: candidate.name,
        ...(candidate.ref ? { candidate: candidate.ref } : {}),
        quantity,
        value: 0
      });
    }
  }
  return { loot: [...merged.values()], ms, usage };
}
