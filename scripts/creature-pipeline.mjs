/**
 * The NPC/monster generation chain: first-draft concept → grounded spells,
 * abilities, feats, equipment and loot → exact resolve → completion manifest,
 * plus the per-member body encounter mode runs for each creature.
 *
 * Pure module: no UI, no app state, no Foundry Application classes. GeneratorApp
 * owns the progress bar, token display and render; this module reports through
 * callbacks (`onStep`, `onProgress`, `onTokens`) and honours one AbortSignal.
 * AI calls default to the real ai.mjs exports and can be replaced via `ai`.
 */
import {
  generateConcept, designEncounter, chooseSpellFocus, selectSpells, selectCreatureAbilities,
  selectCreatureFeats, selectEquipment, selectLoot
} from "./ai.mjs";
import { MODULE_ID } from "./settings.mjs";
import {
  getSpellCandidates, getFocusSpellCandidates, getAbilityCandidates, getFeatCandidates,
  getEquipmentCandidates, getLootCandidates, getScrollSpellCandidates
} from "./compendium.mjs";
import {
  normalizeConcept, normalizeLoot, resolveConcept, applyTreasureBudget, lootValueGp, parseCoins, parseScroll,
  narrativeHasMechanics
} from "./builder.mjs";
import { treasureBudget } from "./tables.mjs";
import { assertComplete, completionManifest } from "./completion.mjs";
import { runPool, encounterConcurrency } from "./pool.mjs";
import { inheritRunBudget } from "./run-budget.mjs";

const DEFAULT_AI = {
  generateConcept, designEncounter, chooseSpellFocus, selectSpells, selectCreatureAbilities,
  selectCreatureFeats, selectEquipment, selectLoot
};

/**
 * Normalize one run's context. `labels` holds already-localized strings for
 * token rows and progress detail; a missing label stays undefined, so a
 * headless caller can omit them.
 */
function makeContext({ ai, labels, onStep, onDraft, onProgress, onTokens, signal } = {}) {
  return {
    ai: { ...DEFAULT_AI, ...ai },
    labels: labels ?? {},
    onStep,
    onDraft,
    onProgress: onProgress ?? (() => {}),
    onTokens: onTokens ?? (() => {}),
    signal
  };
}

/** Throw the cancellation error the app already classifies (`err.cancelled`). */
function throwIfCancelled(ctx) {
  if (!ctx.signal?.aborted) return;
  const err = new Error(ctx.labels.cancelled ?? "Cancelled");
  err.cancelled = true;
  throw err;
}

/** Progress callback for one AI call; `call` sub-labels the detail line when given. */
function progressFor(ctx, call) {
  if (call === undefined) return ctx.onProgress;
  return (p) => ctx.onProgress({ ...p, call });
}

function recordUsage(ctx, label, usage, timing) {
  ctx.onTokens(usage, { label, timing });
}

/**
 * Draft a first-pass creature from the AI. The spellcasting block is dropped
 * here when the mode forbids it: a non-compliant model can still return a
 * valid tradition, and every later step re-checks `concept.spellcasting`.
 */
async function draftConcept(ctx, { prompt, level, rarity, allowSpellcasting, preset, amount, intent, label, signal }) {
  const { concept: raw, usage } = await ctx.ai.generateConcept({
    prompt, level, rarity, allowSpellcasting, preset, amount, intent,
    onProgress: progressFor(ctx), signal
  });
  recordUsage(ctx, label, usage);
  const concept = normalizeConcept(raw, { level, rarity });
  if (!allowSpellcasting) {
    concept.spellcasting = null;
    concept.focusSpells = [];
  }
  return concept;
}

/**
 * Caster spells: a focus pass (optional, fails open to the draft names), then
 * a grounded candidate list and selection. Fail closed: no candidates or an AI
 * failure drops the spellcasting block unless a known class plan must stay visible.
 */
export async function refineSpells(concept, ctxIn) {
  const ctx = makeContext(ctxIn);
  const spellcasting = concept?.spellcasting;
  if (!spellcasting) return;
  try {
    // Two AI calls share the "Spell selection" step. Sub-labels distinguish
    // them in the detail line; the bar stays on phase fill, not extra steps.
    let keywords = [];
    try {
      const focusLabel = ctx.labels.spellFocus;
      const focus = await ctx.ai.chooseSpellFocus({
        concept,
        tradition: spellcasting.tradition,
        onProgress: progressFor(ctx, focusLabel), signal: ctx.signal
      });
      keywords = focus.keywords;
      recordUsage(ctx, focusLabel, focus.usage);
    } catch (err) {
      if (err?.cancelled) throw err;
      console.warn(`${MODULE_ID} | spell focus selection failed, using first-draft spell names only`, err);
    }
    const selectionPicks = spellcasting.selectionPicks ?? spellcasting.plannedPicks;
    const candidates = await getSpellCandidates(
      spellcasting.tradition,
      spellcasting.maxRank,
      [...spellcasting.spells.map((spell) => spell.name), ...keywords],
      selectionPicks
    );
    const focusCandidates = await getFocusSpellCandidates(
      spellcasting.maxRank,
      [...concept.focusSpells.map((spell) => spell.name), ...keywords]
    );
    if (!candidates.length) {
      console.warn(`${MODULE_ID} | no spell candidates found, dropping spellcasting (unconstrained first-draft spells discarded)`);
      spellcasting.spells = [];
    } else {
      const { spells, focusSpells, usage, timing } = await ctx.ai.selectSpells({
        concept,
        candidates,
        focusCandidates,
        maxRank: spellcasting.maxRank,
        plannedPicks: selectionPicks,
        preparationMode: spellcasting.preparationMode,
        signatureRanks: spellcasting.signatureRanks,
        database: spellcasting.database === true,
        onProgress: progressFor(ctx, ctx.labels.spells), signal: ctx.signal
      });
      recordUsage(ctx, ctx.labels.spells, usage, timing);
      spellcasting.spells = spells;
      concept.focusSpells = focusSpells;
    }
  } catch (err) {
    if (err?.cancelled) throw err;
    console.warn(`${MODULE_ID} | grounded spell selection failed, dropping spellcasting (unconstrained first-draft spells discarded)`, err);
    spellcasting.spells = [];
    concept.focusSpells = [];
  }
  if (spellcasting.spells.length) return;
  // A known class spell plan stays visible as empty: completionManifest()
  // records every missing module-owned pick and blocks actor creation.
  if (spellcasting.plannedPicks) return;
  concept.spellcasting = null;
}

/** Resolve published abilities by opaque ID; unlisted concept flavor stays narrative-only. */
export async function refineCreatureAbilities(concept, ctxIn) {
  const ctx = makeContext(ctxIn);
  if (!concept?.specialAbilities?.length) return;
  const draft = concept.specialAbilities;
  const narratives = draft.filter((ability) => !ability.glossary)
    .filter((ability) => {
      if (!narrativeHasMechanics(ability.description)) return true;
      console.warn(`${MODULE_ID} | dropped narrative ability "${ability.name}": its text names dice, a DC or Hit Points`);
      return false;
    })
    .map((ability) => ({ ...ability, narrative: true }));
  try {
    const keywords = draft.flatMap((ability) => [ability.glossary, ability.name])
      .map((name) => String(name ?? "").toLowerCase()).filter(Boolean);
    const candidates = await getAbilityCandidates(keywords);
    if (!candidates.length) {
      concept.specialAbilities = [...draft.filter((ability) => ability.glossary), ...narratives].slice(0, 6);
      return;
    }
    const { abilities, usage, timing } = await ctx.ai.selectCreatureAbilities({
      concept, candidates, onProgress: progressFor(ctx), signal: ctx.signal
    });
    recordUsage(ctx, ctx.labels.abilities, usage, timing);
    concept.specialAbilities = [...abilities, ...narratives].slice(0, 6);
  } catch (err) {
    if (err?.cancelled) throw err;
    console.warn(`${MODULE_ID} | grounded creature ability selection failed; unresolved glossary abilities will block creation`, err);
    concept.specialAbilities = [...draft.filter((ability) => ability.glossary), ...narratives].slice(0, 6);
  }
}

/** Ground a creature's class-like feats against an issued, level-capped list. */
export async function refineCreatureFeats(concept, ctxIn) {
  const ctx = makeContext(ctxIn);
  if (!concept?.feats?.length) return;
  try {
    const candidates = await getFeatCandidates({
      level: Math.max(concept.level, 1), category: "class",
      preferredNames: concept.feats.map((feat) => typeof feat === "string" ? feat : feat.name)
    });
    if (!candidates.length) return;
    const { feats, omitted, usage, timing } = await ctx.ai.selectCreatureFeats({
      concept, candidates, onProgress: progressFor(ctx), signal: ctx.signal
    });
    recordUsage(ctx, ctx.labels.feats, usage, timing);
    // An explicit empty selection is allowed for this optional wishlist;
    // invalid picks/provider failures must not silently erase requirements.
    if (feats.length || omitted === true) concept.feats = feats;
  } catch (err) {
    if (err?.cancelled) throw err;
    console.warn(`${MODULE_ID} | grounded creature feat selection failed; unresolved draft feats will block creation`, err);
  }
}

/**
 * Grounded equipment selection: fetch real, level-capped items from the
 * equipment compendium (narrowed by keywords drawn from the first-draft
 * gear names and strikes — no separate AI focus pass needed, unlike spells)
 * and let the AI pick the creature's carried gear from that list. The
 * final creation resolver accepts only retained candidate references.
 * Creatures designed to carry nothing (beasts, mindless) are skipped.
 */
export async function refineEquipment(concept, ctxIn) {
  const ctx = makeContext(ctxIn);
  if (!concept?.equipment?.length) return;
  try {
    const draftNames = [...concept.equipment.map((e) => e.name), ...concept.strikes.map((s) => s.name)]
      .map((name) => String(name).toLowerCase()).filter(Boolean);
    const keywords = [...new Set([
      ...draftNames,
      ...draftNames.flatMap((name) => name.split(/[^a-z0-9]+/)).filter((token) => token.length > 2)
    ])];
    const candidates = await getEquipmentCandidates(concept.level, keywords);
    if (!candidates.length) return;
    const { equipment, omitted, usage, timing } = await ctx.ai.selectEquipment({
      concept,
      candidates,
      onProgress: progressFor(ctx), signal: ctx.signal
    });
    recordUsage(ctx, ctx.labels.equipment, usage, timing);
    if (equipment.length || omitted === true) concept.equipment = equipment;
  } catch (err) {
    if (err?.cancelled) throw err;
    console.warn(`${MODULE_ID} | grounded equipment selection failed; draft equipment with no published match will be skipped`, err);
  }
}

/**
 * Grounded loot selection: fetch real compendium items (treasure included)
 * and have the AI re-pick the first-draft haul from that list. Without it, a
 * pre-Remaster name the model recalls ("Bag of Holding") never fuzzy-matches
 * its Remaster item ("Spacious Pouch") and silently becomes a wrong-named
 * custom treasure item. Coins stay module-built, while spell gems select from
 * a bounded exact spell slice in the same AI request. A haul of only coins
 * skips the request. The final creation resolver accepts only retained
 * candidate references for all non-coin loot.
 */
export async function refineLoot(concept, ctxIn) {
  const ctx = makeContext(ctxIn);
  if (!concept?.loot?.length) return;
  if (concept.loot.every((l) => parseCoins(l.name))) return;
  try {
    const draftNames = concept.loot.map((loot) => String(loot.name).toLowerCase()).filter(Boolean);
    const keywords = [...new Set([
      ...draftNames,
      ...draftNames.flatMap((name) => name.split(/[^a-z0-9]+/)).filter((token) => token.length > 2)
    ])];
    const scrollKeywords = concept.loot
      .map((loot) => parseScroll(loot.name)?.spellName)
      .filter(Boolean);
    const [candidates, scrollCandidates] = await Promise.all([
      getLootCandidates(concept.level, keywords),
      scrollKeywords.length ? getScrollSpellCandidates(10, scrollKeywords) : []
    ]);
    if (!candidates.length && !scrollCandidates.length) return;
    const { loot, omitted, usage, timing } = await ctx.ai.selectLoot({
      concept,
      candidates,
      scrollCandidates,
      onProgress: progressFor(ctx), signal: ctx.signal
    });
    recordUsage(ctx, ctx.labels.loot, usage, timing);
    if (loot.length || omitted === true) {
      const coins = concept.loot.filter((item) => parseCoins(item.name));
      concept.loot = normalizeLoot([...coins, ...loot]);
    }
  } catch (err) {
    if (err?.cancelled) throw err;
    console.warn(`${MODULE_ID} | grounded loot selection failed; draft loot with no published match will be skipped`, err);
  }
}

/**
 * One creature from first draft to a checked manifest (single NPC/monster
 * mode). Resolves the exact content, applies the module-owned treasure budget
 * and throws through assertComplete() when a required pick is unresolved.
 *
 * @returns {Promise<{concept: object, resolved: object, manifest: object}>}
 */
export async function generateCreature(input) {
  const ctx = makeContext(input);
  const { mode, prompt, level, rarity, allowSpellcasting, adjustment = null, preset = null, treasureAmount } = input;
  // Each step hands the live concept to the caller, so a render between steps
  // shows what has been drafted so far.
  const step = (id, concept) => ctx.onStep?.(id, { concept });

  await step("concept");
  const concept = {
    ...await draftConcept(ctx, {
      prompt, level, rarity, allowSpellcasting, preset, amount: treasureAmount, intent: mode,
      label: ctx.labels.concept, signal: ctx.signal
    }),
    adjustment,
    gmPrompt: prompt
  };
  // The draft is shown as soon as it exists, before its grounding steps.
  ctx.onDraft?.(concept);
  // Gate on the SAME condition the step list was built from: the "spells" step
  // key only exists when allowSpellcasting was true.
  if (allowSpellcasting && concept.spellcasting) await step("spells", concept);
  await refineSpells(concept, ctx);
  if (concept.specialAbilities.length) await step("abilities", concept);
  await refineCreatureAbilities(concept, ctx);
  if (concept.feats.length) await step("feats", concept);
  await refineCreatureFeats(concept, ctx);
  if (concept.equipment.length) await step("equipment", concept);
  await refineEquipment(concept, ctx);
  if (concept.loot.length) await step("loot", concept);
  await refineLoot(concept, ctx);
  await step("match", concept);

  const resolved = await resolveConcept(concept, { exactContent: true });
  // Treasure budget: the module owns the numbers (level + rarity from the
  // tables, scaled by the Treasure amount control); only coins flex.
  resolved.loot = await applyTreasureBudget(
    resolved.loot,
    concept.loot.length ? treasureBudget(concept.level, concept.rarity, treasureAmount) : 0
  );
  const manifest = completionManifest({ mode, concept, resolved });
  throwIfCancelled(ctx);
  assertComplete(manifest);
  const eq = resolved.equipment;
  const misses = (resolved.skippedGear ?? []).filter((g) => g.category === "equipment").map((g) => g.name);
  if (eq.length || misses.length) {
    console.debug(`${MODULE_ID} | equipment matches: ${eq.length}/${eq.length + misses.length}`,
      misses.length ? { skipped: misses } : "");
  }
  return { concept, resolved, manifest };
}

/**
 * Encounter mode: the composition is already fixed (composeEncounter), the AI
 * names the encounter and briefs each slot, then every member runs the
 * creature chain (draft + grounding, without the single-creature match step)
 * a few at a time. Treasure is split per group, then each member is resolved
 * and checked the same way as a single creature.
 *
 * @returns {Promise<{name, budget, spent, treasureBudget, treasureSpent, members}>}
 */
export async function generateEncounter(input) {
  const { composition, theme, partyLevel, rarity, allowSpellcasting, preset = null, treasureAmount, local = false } = input;
  const ctx = makeContext(input);
  await ctx.onStep?.("design", {});
  const design = await ctx.ai.designEncounter({
    theme,
    partyLevel,
    slots: composition.members,
    onProgress: progressFor(ctx), signal: ctx.signal
  });
  recordUsage(ctx, ctx.labels.design, design.usage);

  // Creatures are independent, so build a few at once (pool.mjs). The first
  // failure aborts the rest instead of paying for creatures that will be
  // thrown away.
  const memberAbort = new AbortController();
  const memberSignal = AbortSignal.any([ctx.signal, memberAbort.signal].filter(Boolean));
  inheritRunBudget(ctx.signal, memberSignal); // encounter members share the encounter run's budget
  // Several creatures run at once, so the progress list counts finished
  // creatures: step N is active until N creatures are done.
  let finished = 0;
  await ctx.onStep?.("member0", {});
  const members = await runPool(composition.members.length, encounterConcurrency({ local }), async (i) => {
    const slot = composition.members[i];
    throwIfCancelled(ctx);
    const memberCtx = { ...ctx, signal: memberSignal };
    const label = ctx.labels.member?.(i);
    const concept = await draftConcept(memberCtx, {
      prompt: `${design.briefs[i]} (Part of the encounter "${design.name}": ${theme})`,
      level: slot.level,
      rarity,
      allowSpellcasting,
      // The preset row is a stable slot in every mode: a selected preset
      // shapes each member the same way it shapes a single creature (and,
      // matching the Single dice button, Random ignores it).
      preset,
      amount: treasureAmount,
      intent: "monster",
      label,
      signal: memberSignal
    });
    concept.gmPrompt = theme;
    await refineSpells(concept, memberCtx);
    await refineCreatureAbilities(concept, memberCtx);
    await refineCreatureFeats(concept, memberCtx);
    await refineEquipment(concept, memberCtx);
    await refineLoot(concept, memberCtx);
    finished++;
    if (finished < composition.members.length) await ctx.onStep?.(`member${finished}`, {});
    return { ...slot, concept };
  }, { onError: () => memberAbort.abort() });

  await ctx.onStep?.("match", {});
  for (const member of members) {
    member.resolved = await resolveConcept(member.concept, { exactContent: true });
    // Treasure is calibrated to the PARTY level and the WHOLE encounter:
    // treasureBudget() returns one encounter's total, split evenly across
    // groups. A group keeps its constant share (treasureGroupBudget)
    // regardless of copy count — only the per-copy split changes
    // (#stepMemberCount recomputes it the same way).
    member.treasureGroupBudget =
      member.concept.loot.length ? treasureBudget(partyLevel, member.concept.rarity, treasureAmount) / members.length : 0;
    member.treasureBudgetEach = member.treasureGroupBudget / Math.max(member.count, 1);
    member.resolved.loot = await applyTreasureBudget(member.resolved.loot, member.treasureBudgetEach);
    member.manifest = completionManifest({ mode: "monster", concept: member.concept, resolved: member.resolved });
    assertComplete(member.manifest);
    member.treasureEach = lootValueGp(member.resolved.loot);
  }
  const allEq = members.flatMap((m) => m.resolved.equipment);
  const misses = members.flatMap((m) => m.resolved.skippedGear ?? [])
    .filter((g) => g.category === "equipment").map((g) => g.name);
  if (allEq.length || misses.length) {
    console.debug(`${MODULE_ID} | equipment matches: ${allEq.length}/${allEq.length + misses.length}`,
      misses.length ? { skipped: misses } : "");
  }
  throwIfCancelled(ctx);
  return {
    name: design.name,
    budget: composition.budget,
    spent: composition.spent,
    treasureBudget: members.reduce((sum, m) => sum + m.count * (m.treasureBudgetEach ?? 0), 0),
    treasureSpent: members.reduce((sum, m) => sum + m.count * (m.treasureEach ?? 0), 0),
    members
  };
}
