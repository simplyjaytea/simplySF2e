// Jev-backed equipment and loot picks (J2). Jev only chooses among real catalog
// candidates this run already issued, keyed by their short ids; it never names
// content or emits a number. Every function returns `equipment`/`loot: null`
// (the caller then runs the chat-model call) on any doubt, so a step never
// changes kind because Jev was used.
import { JEV_MIN_CONFIDENCE, buildChoiceQuestion, requestJevDecision } from "./jev.mjs";
import { estimateTokens, normalizeJevUsage } from "./tokens.mjs";
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
  const started = Date.now();
  const result = await request({ ...jevConfig, state, questions, signal });
  // Wall time is measured here so a timed-out or failed request still shows its cost.
  return { result, ms: Date.now() - started, usage: result ? normalizeJevUsage(result.usage) : null };
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
  if (!first.result) return { equipment: null, ms, usage, attempted: true };
  const answers = first.result.answers;

  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const picked = [];
  const seen = new Set();
  for (const key of draftKeys) {
    const answer = answers[key];
    // One doubtful draft item sends the whole step to the chat model (simple, predictable).
    if (!confident(answer) || !byId.has(answer.choice)) return { equipment: null, ms, usage, attempted: true };
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
    // Quantity is not a pick: an unreadable or missing answer just means 1 (answer confidence is not checked).
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
  return { equipment, ms, usage, attempted: true };
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
  if (!result) return { loot: null, ms, usage, attempted: true };

  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const merged = new Map();
  for (const [index, entry] of plain.entries()) {
    const answer = result.answers[`loot${index}`];
    if (!confident(answer) || !byId.has(answer.choice)) return { loot: null, ms, usage, attempted: true };
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
  return { loot: [...merged.values()], ms, usage, attempted: true };
}

/** Cap on first-draft entries Jev answers for, matching the chat-model prompts' "up to N". */
const CREATURE_FEAT_CAP = 3;
const CREATURE_ABILITY_CAP = 6;

/**
 * One Choice per draft entry over the issued catalog plus a `none` key
 * ("no published option fits"). Returns `{ picks: (candidate|null)[], allNone, ms,
 * usage }`, or `null` (with `ms`/`usage`) when Jev cannot answer: the caller then
 * runs the chat model. A `none` or low-confidence answer is a null pick, not a
 * failure, because "fewer picks" is valid here.
 */
async function pickPerDraftEntry({ concept, entries, candidates, jevConfig, signal, request, describe }) {
  const none = { ms: 0, usage: null };
  if (!jevConfig || !entries.length || !candidates?.length) return none;
  const questions = {};
  for (const [index, entry] of entries.entries()) {
    const question = buildChoiceQuestion({
      instructions: describe(entry),
      candidates: [...asCandidates(candidates), { id: JEV_NONE_KEY, name: "No published option fits" }]
    });
    if (!question) return none;
    questions[`entry${index}`] = question;
  }
  const { result, ms, usage } = await ask({ jevConfig, state: buildJevState(concept), questions, signal, request });
  if (!result) return { ms, usage, attempted: true };
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  let allNone = true;
  const picks = entries.map((_, index) => {
    const answer = result.answers[`entry${index}`];
    if (answer?.choice === JEV_NONE_KEY && confident(answer)) return null;
    allNone = false;
    return confident(answer) ? byId.get(answer.choice) ?? null : null;
  });
  return { picks, allNone, ms, usage, attempted: true };
}

const distinct = (picks) => {
  const seen = new Set();
  return picks.filter((candidate) => candidate && !seen.has(candidate.id) && seen.add(candidate.id));
};

/**
 * Pick class-like creature feats through Jev. `omitted` is true only when every
 * draft entry confidently answers `none`: that is the explicit "nothing fits" the
 * caller treats as declining the wishlist. All-dropped with any doubt is not that,
 * so it returns `feats: null` and the chat model decides. Returns
 * `{ feats|null, omitted, ms, usage, attempted? }`.
 */
export async function jevPickCreatureFeats({ concept, candidates, jevConfig, signal, request = requestJevDecision }) {
  const entries = (Array.isArray(concept?.feats) ? concept.feats : []).slice(0, CREATURE_FEAT_CAP)
    .map((feat) => (typeof feat === "string" ? feat : feat?.name)).filter(Boolean);
  const out = await pickPerDraftEntry({
    concept, entries, candidates, jevConfig, signal, request,
    describe: (name) => `Which listed published class feat best fits the draft feat idea "${name}" for this creature's role and tactics? Choose "${JEV_NONE_KEY}" when no listed feat fits.`
  });
  if (!out.picks) return { feats: null, omitted: false, ms: out.ms, usage: out.usage, ...(out.attempted ? { attempted: true } : {}) };
  const feats = distinct(out.picks).map((candidate) => ({ name: candidate.name, ...(candidate.ref ? { candidate: candidate.ref } : {}) }));
  if (!feats.length && !out.allNone) return { feats: null, omitted: false, ms: out.ms, usage: out.usage, attempted: true };
  return { feats, omitted: feats.length === 0, ms: out.ms, usage: out.usage, attempted: true };
}

/**
 * Pick published bestiary actions for the draft special abilities through Jev.
 * A dropped entry stays narrative-only for the caller, as with the chat model.
 * Returns `{ abilities|null, ms, usage, attempted? }`.
 */
export async function jevPickCreatureAbilities({ concept, candidates, jevConfig, signal, request = requestJevDecision }) {
  const entries = (Array.isArray(concept?.specialAbilities) ? concept.specialAbilities : []).slice(0, CREATURE_ABILITY_CAP)
    .map((ability) => ability?.glossary ?? ability?.name).filter(Boolean);
  const out = await pickPerDraftEntry({
    concept, entries, candidates, jevConfig, signal, request,
    describe: (name) => `Which listed published bestiary action best matches the draft ability "${name}" for this creature? Choose "${JEV_NONE_KEY}" when no listed action fits.`
  });
  if (!out.picks) return { abilities: null, ms: out.ms, usage: out.usage, ...(out.attempted ? { attempted: true } : {}) };
  const abilities = distinct(out.picks).map((candidate) => ({ name: candidate.name, ...(candidate.ref ? { candidate: candidate.ref } : {}) }));
  return { abilities, ms: out.ms, usage: out.usage, attempted: true };
}

/** Module default, not a rules number: half of Jev's ~64k request limit (docs/next-steps.md J5), leaving headroom. */
export const JEV_REQUEST_TOKEN_BUDGET = 32000;
/** More requests than this sends the whole step to the chat model instead. */
const JEV_MAX_BATCHES = 4;

/** The PC concept summary Jev reads as `state`. Plain text, bounded. */
export function buildJevPcState(concept) {
  const feats = (Array.isArray(concept?.feats) ? concept.feats : []).map((feat) => (typeof feat === "string" ? feat : feat?.name)).filter(Boolean);
  return [
    concept.gmPrompt ? `Original GM request: ${clip(concept.gmPrompt)}` : null,
    `Character: ${concept.name} (level ${concept.level}${concept.class ? `, ${concept.class}` : ""})`,
    concept.ancestry ? `Ancestry: ${concept.ancestry}${concept.heritage ? ` (${concept.heritage})` : ""}` : null,
    concept.background ? `Background: ${concept.background}` : null,
    concept.keyAbility ? `Key ability: ${concept.keyAbility}` : null,
    concept.blurb ? `Blurb: ${clip(concept.blurb)}` : null,
    feats.length ? `First-draft feat wishlist (inspiration only): ${feats.join(", ")}` : null,
    concept.equipment?.length ? `Equipment: ${concept.equipment.map((item) => item.name).join(", ")}` : null
  ].filter(Boolean).join("\n");
}

/** Split `{ key: question }` entries into requests whose state + questions stay under the token budget; null when too many. */
function batchQuestions(entries, state) {
  const batches = [];
  let current = {};
  let used = estimateTokens(state);
  for (const [key, question] of entries) {
    const cost = estimateTokens(JSON.stringify(question));
    if (Object.keys(current).length && used + cost > JEV_REQUEST_TOKEN_BUDGET) {
      batches.push(current);
      current = {};
      used = estimateTokens(state);
    }
    current[key] = question;
    used += cost;
  }
  if (Object.keys(current).length) batches.push(current);
  return batches.length <= JEV_MAX_BATCHES ? batches : null;
}

/** Run batches in parallel; null when any fails. `ms` is the wall time of the whole round. */
async function askBatches({ jevConfig, state, batches, signal, request }) {
  const started = Date.now();
  const rounds = await Promise.all(batches.map((questions) => ask({ jevConfig, state, questions, signal, request })));
  let usage = null;
  for (const round of rounds) usage = mergeUsage(usage, round.usage);
  const ms = Date.now() - started;
  if (rounds.some((round) => !round.result)) return { answers: null, ms, usage };
  return { answers: Object.assign({}, ...rounds.map((round) => round.result.answers)), ms, usage };
}

/**
 * Pick one feat per slot through Jev: one Choice per slot over that slot's own
 * allowed ids (`encoded` is encodeFeatCandidateSlots output). Slots that share an
 * allowed list get the same top answer, so slots are walked in order and each
 * takes its highest-probability id not already used, still at JEV_MIN_CONFIDENCE.
 * A slot with more than 255 ids, a failed request, or no confident unused id sends
 * the whole call to the chat model, because a feat slot must not end up empty
 * (CLAUDE.md invariant 5). Returns `{ picks: {slot,id}[]|null, ms, usage, attempted? }`.
 */
export async function jevPickFeats({ concept, encoded, jevConfig, signal, request = requestJevDecision }) {
  const none = { picks: null, ms: 0, usage: null };
  const slots = (encoded?.slots ?? []).filter((slot) => slot.ids.length);
  if (!jevConfig || !slots.length) return none;
  const nameById = new Map(encoded.catalog.map(({ id, name }) => [id, name]));
  const entries = [];
  for (const slot of slots) {
    const question = buildChoiceQuestion({
      instructions: `Which listed feat best fits this character for ${slot.type} slot ${slot.number} (character level ${slot.level})?`,
      candidates: slot.ids.map((id) => ({ id, name: nameById.get(id) ?? id }))
    });
    if (!question) return none;
    entries.push([`slot${slot.number}`, question]);
  }
  const state = buildJevPcState(concept);
  const batches = batchQuestions(entries, state);
  if (!batches) return none;
  const { answers, ms, usage } = await askBatches({ jevConfig, state, batches, signal, request });
  if (!answers) return { picks: null, ms, usage, attempted: true };

  const usedIds = new Set();
  const usedNames = new Set();
  const picks = [];
  for (const slot of slots) {
    const answer = answers[`slot${slot.number}`];
    if (answer?.type !== "choice") return { picks: null, ms, usage, attempted: true };
    const probability = (id) => Number(answer.probabilities?.[id]) || 0;
    const ranked = [...slot.ids].sort((a, b) => probability(b) - probability(a));
    const id = ranked.find((candidate) => !usedIds.has(candidate) && !usedNames.has(String(nameById.get(candidate)).toLowerCase()));
    if (!id || probability(id) < JEV_MIN_CONFIDENCE) return { picks: null, ms, usage, attempted: true };
    usedIds.add(id);
    usedNames.add(String(nameById.get(id)).toLowerCase());
    picks.push({ slot: slot.number, id });
  }
  return { picks, ms, usage, attempted: true };
}

/**
 * Pick native character-choice options through Jev: one Choice per group over its
 * option ids. `catalog` is `[{ id, item, prompt, options: [{ id, label }] }]`
 * (already localized). Any miss sends the whole batch to the chat model.
 * Returns `{ picks: {choice, option}[]|null, ms, usage, attempted? }`.
 */
export async function jevPickCharacterChoices({ concept, catalog, jevConfig, signal, request = requestJevDecision }) {
  const none = { picks: null, ms: 0, usage: null };
  if (!jevConfig || !catalog?.length) return none;
  const entries = [];
  for (const [index, group] of catalog.entries()) {
    const question = buildChoiceQuestion({
      instructions: `${group.prompt || "Choose an option"} (granted by ${group.item}). Which option best fits this character?`,
      candidates: group.options.map(({ id, label }) => ({ id, name: label }))
    });
    if (!question) return none;
    entries.push([`group${index}`, question]);
  }
  const state = buildJevPcState(concept);
  const batches = batchQuestions(entries, state);
  if (!batches) return none;
  const { answers, ms, usage } = await askBatches({ jevConfig, state, batches, signal, request });
  if (!answers) return { picks: null, ms, usage, attempted: true };
  const picks = [];
  for (const [index, group] of catalog.entries()) {
    const answer = answers[`group${index}`];
    if (!confident(answer) || !group.options.some((option) => option.id === answer.choice)) {
      return { picks: null, ms, usage, attempted: true };
    }
    picks.push({ choice: group.id, option: answer.choice });
  }
  return { picks, ms, usage, attempted: true };
}

/** Scale words Jev scores each spell candidate against (docs/next-steps.md J5: 4 levels). */
export const JEV_SPELL_FIT_WORDS = Object.freeze(["poor", "fair", "good", "excellent"]);
/** A focus spell is taken only at the top fit level, because "otherwise return []" is valid for focus spells. */
const FOCUS_FIT_INDEX = JEV_SPELL_FIT_WORDS.length - 1;
const FOCUS_SPELL_CAP = 3;

/**
 * Pick a PC's spells through Jev: one Score question per candidate ("how well does
 * this spell fit"), then the module takes the top `plannedPicks[rank]` per rank.
 * Only the module-owned PC slot plan is handled; the creature path keeps the chat
 * model because its counts are the model's own choice. Details, all fail-closed
 * (any miss returns `spells: null`, so the whole step runs on the chat model,
 * because an empty PC spell list is worse than an approximate one):
 * - A slot's spell is a candidate whose base rank equals the slot rank (no
 *   heightening); a rank with fewer eligible candidates than slots falls back.
 *   Rank-ten spontaneous slots take common spells only, as the chat prompt requires.
 * - Only readable answers at JEV_MIN_CONFIDENCE compete; picks are distinct per rank.
 * - Signature spells (module-owned eligibility): the best-scored selected spell at
 *   each signature rank. Module default, not guidance on which spell heightens well.
 * - Focus spells: up to 3 candidates scored at the top level; none is valid.
 * Returns `{ spells|null, focusSpells, ms, usage, attempted? }`.
 */
export async function jevPickSpells({
  concept, candidates, focusCandidates = [], maxRank, plannedPicks, preparationMode,
  signatureRanks = [], jevConfig, signal, request = requestJevDecision
}) {
  const none = { spells: null, focusSpells: [], ms: 0, usage: null };
  if (!jevConfig || plannedPicks == null || !candidates?.length) return none;
  const ranks = Object.entries(plannedPicks)
    .map(([rank, count]) => [Number(rank), count])
    .filter(([rank, count]) => count > 0 && rank <= maxRank)
    .sort(([a], [b]) => a - b);
  if (!ranks.length) return none;

  const pools = new Map();
  for (const [rank, count] of ranks) {
    const pool = candidates.filter((candidate) => candidate.id && candidate.rank === rank
      && (!(preparationMode === "spontaneous" && rank === 10) || candidate.rarity === "common"));
    if (pool.length < count) return none;
    pools.set(rank, pool);
  }

  const tradition = concept.spellcasting?.tradition;
  const draft = (concept.spellcasting?.spells ?? []).map((spell) => spell.name).filter(Boolean);
  const state = [
    buildJevPcState(concept),
    tradition ? `Spell tradition: ${tradition}` : null,
    draft.length ? `First-draft spell ideas (inspiration only): ${draft.join(", ")}` : null
  ].filter(Boolean).join("\n");

  const entries = [];
  const questionFor = (key, candidate, kind) => entries.push([key, {
    type: "score",
    instructions: `How well does the ${kind} "${candidate.name}" (rank ${candidate.rank}) fit this character's concept and tactics?`,
    criteria: [...JEV_SPELL_FIT_WORDS]
  }]);
  for (const pool of pools.values()) for (const candidate of pool) questionFor(`spell_${candidate.id}`, candidate, "spell");
  const focusPool = focusCandidates.filter((candidate) => candidate.id);
  for (const candidate of focusPool) questionFor(`focus_${candidate.id}`, candidate, "focus spell");

  const batches = batchQuestions(entries, state);
  if (!batches) return none;
  const { answers, ms, usage } = await askBatches({ jevConfig, state, batches, signal, request });
  if (!answers) return { ...none, ms, usage, attempted: true };

  // Readable, confident answers only; best raw score first, then confidence, then name for a stable order.
  const scored = (key, candidate) => {
    const answer = answers[key];
    const index = jevScoreIndex(answer, JEV_SPELL_FIT_WORDS);
    if (index == null || !(answer.confidence >= JEV_MIN_CONFIDENCE)) return null;
    return { candidate, index, score: answer.score, confidence: answer.confidence };
  };
  const ranked = (list) => list.filter(Boolean)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.candidate.name.localeCompare(b.candidate.name));

  const spells = [];
  for (const [rank, count] of ranks) {
    const top = ranked(pools.get(rank).map((candidate) => scored(`spell_${candidate.id}`, candidate))).slice(0, count);
    if (top.length < count) return { ...none, ms, usage, attempted: true };
    const rows = top.map(({ candidate }) => ({
      name: candidate.name, ...(candidate.ref ? { candidate: candidate.ref } : {}), rank
    }));
    if (signatureRanks.includes(rank)) rows[0].signature = true;
    spells.push(...rows);
  }
  const focusSpells = ranked(focusPool.map((candidate) => scored(`focus_${candidate.id}`, candidate)))
    .filter(({ index }) => index >= FOCUS_FIT_INDEX)
    .slice(0, FOCUS_SPELL_CAP)
    .map(({ candidate }) => ({ name: candidate.name, ...(candidate.ref ? { candidate: candidate.ref } : {}) }));
  return { spells, focusSpells, ms, usage, attempted: true };
}
