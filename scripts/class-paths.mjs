import { getClassFeatureCandidates, getFeatCandidates, getPacksFor, toItemData } from "./compendium.mjs";
import { choiceSetOptions, normalizeChoiceFlag, preselectChoiceSets } from "./choice-set.mjs";
import { stagedActorContext } from "./pc-prerequisites.mjs";
import { slugify } from "./text.mjs";

/**
 * Stage the small, mandatory level-one class-path bridge that the system
 * normally re-fetches from `Class.system.items`. Cited SF2e bridges use the
 * same ChoiceSet `item:tag:<tag>` + GrantItem selection uuid as PF2e
 * Racket/Methodology — not a renamed copy of those features. Sample:
 * `packs/sf2e/class-features/soldier/soldier-fighting-style.json`
 * (`item:tag:soldier-fighting-style`). The class remains native and keeps
 * every other grant; only the selected bridge is embedded directly, linked
 * to that class, so its exact enabled-source selection can be resolved
 * before any world write.
 *
 * This is intentionally conservative. A path is eligible only when the
 * bridge's filter is a single `item:tag:<tag>` query and every choice on the
 * selected feature is closed before any world write:
 *   - a static ChoiceSet (literal/CONFIG options, no item grants);
 *   - the published level-one skill-feat query
 *     (`choices.filter: ["item:category:skill", "item:level:1"]`, v14-dev
 *     `packs/sf2e/class-features/operative/specializations/*.json`), narrowed
 *     to enabled `feats` skill feats whose prerequisites the path's own
 *     `ActiveEffectLike` skill-rank upgrade proves;
 *   - a literal array of compendium item uuids (Sniper's `bonusFeat`), whose
 *     rule predicate is absent or exactly the staged class's `class:<slug>`
 *     roll option (ClassPF2e#prepareActorData sets it before the bridge's
 *     preCreate, since the class precedes the bridge in the create batch).
 * Every item such a choice or GrantItem can reach must itself be free of
 * choices. Anything wider remains an unsupported class path rather than
 * opening a native dialog after a one-click build has started.
 */

const SKILL_FEAT_FILTER = ["item:category:skill", "item:level:1"];
const SELECTION_GRANT = /^\{item\|flags\.system\.rulesSelections\.([A-Za-z0-9-]+)\}$/;
const SKILL_RANK_PATH = /^system\.skills\.([a-z0-9-]+)\.rank$/;

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOpenChoiceSet(rule) {
  return isObject(rule) && rule.key === "ChoiceSet"
    && rule.selection == null && !rule.allowNoSelection && !rule.allowedDrops && !rule.ignored
    && Boolean(normalizeChoiceFlag(rule.flag));
}

function isStaticChoice(rule, config) {
  return isOpenChoiceSet(rule) && !rule.predicate && Boolean(choiceSetOptions(rule.choices, config));
}

/** Published operative-specialization shape: any level-one skill feat. */
function isLevelOneSkillFeatQuery(rule) {
  if (!isOpenChoiceSet(rule) || rule.predicate) return false;
  const choices = rule.choices;
  // `pack`, `slugsAsValues`, `ownedItems`, … change what the native query
  // returns; only the exact published two-statement filter is mirrored.
  if (!isObject(choices) || Object.keys(choices).some((key) => key !== "filter" && key !== "itemType")) return false;
  if ((choices.itemType ?? "feat") !== "feat") return false;
  const filter = choices.filter;
  return Array.isArray(filter) && filter.length === SKILL_FEAT_FILTER.length
    && SKILL_FEAT_FILTER.every((statement) => filter.includes(statement));
}

/** Unpredicated, or gated only on the staged class's own `class:<slug>`
 * roll option — the one predicate provably true during this creation. */
function firesForClass(rule, classSlug) {
  if (rule?.predicate == null) return true;
  return Boolean(classSlug) && Array.isArray(rule.predicate) && rule.predicate.length === 1
    && rule.predicate[0] === `class:${classSlug}`;
}

/** A literal compendium-uuid array, unpredicated or gated only on this class. */
function isClassUuidChoice(rule, classSlug) {
  if (!isOpenChoiceSet(rule) || !firesForClass(rule, classSlug)) return false;
  return Array.isArray(rule.choices) && rule.choices.length > 0 && rule.choices.every((choice) =>
    isObject(choice) && choice.predicate == null
    && typeof choice.value === "string" && choice.value.startsWith("Compendium."));
}

function staticGrantUuid(rule) {
  if (!isObject(rule) || rule.key !== "GrantItem" || rule.ignored) return null;
  const uuid = rule.uuid;
  return typeof uuid === "string" && uuid && !uuid.includes("{") ? uuid : null;
}

function selectionGrantFlag(rule) {
  if (!isObject(rule) || rule.key !== "GrantItem" || rule.ignored || typeof rule.uuid !== "string") return null;
  return SELECTION_GRANT.exec(rule.uuid)?.[1] ?? null;
}

function singlePathTag(source) {
  const rules = source?.system?.rules;
  if (!Array.isArray(rules)) return null;
  const selectors = rules.map((rule, index) => ({ rule, index })).filter(({ rule }) => {
    const filter = rule?.key === "ChoiceSet" ? rule.choices?.filter : null;
    return Array.isArray(filter) && filter.length === 1 && typeof filter[0] === "string"
      && filter[0].startsWith("item:tag:") && !rule.predicate && !rule.allowNoSelection && !rule.allowedDrops && !rule.ignored;
  });
  if (selectors.length !== 1) return null;
  const tag = selectors[0].rule.choices.filter[0].slice("item:tag:".length);
  return tag ? { tag, ruleIndex: selectors[0].index } : null;
}

async function documentFromUuid(uuid) {
  try { return await fromUuid(uuid); }
  catch { return null; }
}

async function sourceFromUuid(uuid) {
  const document = await documentFromUuid(uuid);
  return document?.toObject?.() ?? null;
}

function isEnabledClassFeature(document) {
  // Foundry Item documents expose `pack` as the collection-id string; retain
  // the object forms for test doubles and compatible document wrappers.
  const packId = typeof document?.pack === "string" ? document.pack
    : document?.pack?.collection ?? document?.compendium?.collection ?? null;
  return typeof packId === "string" && getPacksFor("classFeatures").includes(packId);
}

/** No native descendants may need a choice. A predicated static grant is
 * still checked: its target is fixed whether or not the predicate fires.
 * Selection-templated grants are skipped only for `resolvedFlags`, whose
 * every reachable target was already proven closed. */
async function descendantsHaveNoChoices(source, seen = new Set(), resolvedFlags = new Set()) {
  const rules = source?.system?.rules;
  if (!Array.isArray(rules)) return true;
  for (const rule of rules) {
    if (rule?.key !== "GrantItem") continue;
    const flag = selectionGrantFlag(rule);
    if (flag && resolvedFlags.has(flag)) continue;
    const uuid = staticGrantUuid(rule);
    if (!uuid) return false;
    if (seen.has(uuid)) return false;
    seen.add(uuid);
    if (!await closedGrantSource(uuid, seen)) return false;
  }
  return true;
}

/** Source of a grant target that carries no choice anywhere below it. */
async function closedGrantSource(uuid, seen = new Set([uuid])) {
  const source = await sourceFromUuid(uuid);
  if (!source) return null;
  if (Array.isArray(source.system?.rules) && source.system.rules.some((entry) => entry?.key === "ChoiceSet")) return null;
  return await descendantsHaveNoChoices(source, seen) ? source : null;
}

/** Skills the path feature itself trains: unpredicated ActiveEffectLike
 * `upgrade` of `system.skills.<slug>.rank` (every operative specialization). */
function upgradedSkillRanks(rules) {
  const skills = {};
  for (const rule of rules) {
    if (!isObject(rule) || rule.key !== "ActiveEffectLike" || rule.mode !== "upgrade" || rule.predicate || rule.ignored) continue;
    const slug = typeof rule.path === "string" ? SKILL_RANK_PATH.exec(rule.path)?.[1] : null;
    if (slug && Number.isInteger(rule.value) && rule.value >= 1 && rule.value <= 4) {
      skills[slug] = Math.max(skills[slug] ?? 0, rule.value);
    }
  }
  return skills;
}

/**
 * Exact uuids and names (by slug) the build already contains. The native
 * compendium query drops feats at `maxTakable`, so offering one of these could
 * miss the native catalog and reopen its dialog.
 */
function exclusionSet(values) {
  const excluded = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== "string" || !value) continue;
    excluded.add(value);
    const slug = slugify(value);
    if (slug) excluded.add(slug);
  }
  return excluded;
}

function isExcluded(excluded, uuid, name) {
  return excluded.has(uuid) || excluded.has(slugify(name));
}

/**
 * Level-one skill feats from enabled `feats` packs whose published
 * prerequisites the path's own skill training proves. A subset of the native
 * all-packs query, so any pick is a legal native preselection.
 */
async function skillFeatOptions(rules, { names, excluded }) {
  const skills = upgradedSkillRanks(rules);
  if (!Object.keys(skills).length) return [];
  const prerequisiteContext = stagedActorContext({ level: 1, skills });
  const candidates = await getFeatCandidates({ level: 1, category: "skill", preferredNames: names, prerequisiteContext });
  const options = [];
  for (const candidate of candidates) {
    if (candidate.level !== 1 || !candidate.ref?.packId || !candidate.ref?._id) continue;
    const uuid = `Compendium.${candidate.ref.packId}.Item.${candidate.ref._id}`;
    if (isExcluded(excluded, uuid, candidate.name)) continue;
    const source = await closedGrantSource(uuid);
    if (source?.type !== "feat" || source.system?.category !== "skill" || source.system?.level?.value !== 1) continue;
    options.push({ value: uuid, label: source.name });
  }
  return options;
}

/** Keep the rule's exact uuid values (native preselection matches them by
 * value); label each from its loaded document, as native inflation does. */
async function uuidChoiceOptions(choices, excluded) {
  const options = [];
  for (const choice of choices) {
    const source = await closedGrantSource(choice.value);
    if (!source?.name || isExcluded(excluded, choice.value, source.name)) continue;
    options.push({ value: choice.value, label: source.name });
  }
  return options;
}

/**
 * Closed, preselection-ready copy of a path candidate, or null. Dynamic
 * choices are replaced by their proven bounded options in the copy only; the
 * native feature is still granted from its compendium source.
 */
async function resolvePathCandidate(candidate, { config, classSlug, names, excluded }) {
  const document = await documentFromUuid(candidate.uuid);
  const source = document?.toObject?.();
  if (!source || !isEnabledClassFeature(document)) return null;
  const rules = source.system?.rules;
  if (!Array.isArray(rules)) return { source, grantFlags: [] };
  const resolvedFlags = new Set();
  const resolvedRules = [];
  for (const rule of rules) {
    if (rule?.key !== "ChoiceSet") {
      resolvedRules.push(rule);
      continue;
    }
    let choices = null;
    if (isClassUuidChoice(rule, classSlug)) choices = await uuidChoiceOptions(rule.choices, excluded);
    else if (isLevelOneSkillFeatQuery(rule)) choices = await skillFeatOptions(rules, { names, excluded });
    else if (isStaticChoice(rule, config)) {
      resolvedRules.push(rule);
      continue;
    }
    if (!choices?.length) return null;
    // The only predicate reaching here is this class's own roll option.
    const { predicate: _classPredicate, ...closed } = rule;
    resolvedRules.push({ ...closed, choices });
    resolvedFlags.add(normalizeChoiceFlag(rule.flag));
  }
  if (!await descendantsHaveNoChoices(source, new Set(), resolvedFlags)) return null;
  // Selection grants that fire for this class create a further native item.
  const grantFlags = rules.filter((rule) => resolvedFlags.has(selectionGrantFlag(rule)) && firesForClass(rule, classSlug))
    .map(selectionGrantFlag);
  return { source: { ...source, system: { ...source.system, rules: resolvedRules } }, grantFlags };
}

/**
 * Plan the level-one class paths from real compendium candidates BEFORE
 * feat-slot planning, so granted skills and specialization identity are
 * known and can constrain restricted skill slots (e.g. Operative Specialized Skill Set).
 * @param {object} classData
 * @param {object} [options]
 * @returns {Promise<Record<string, { tag: string, uuid: string, name: string, skills: Record<string, number>, trainedSkill: string|null }>>}
 */
export async function planClassPaths(classData, {
  context, config = globalThis.CONFIG?.PF2E ?? {}, selectChoices = null, excludeFeats = []
} = {}) {
  const entries = classData?.system?.items;
  if (!isObject(entries)) return {};
  const classSlug = slugify(classData?.system?.slug ?? classData?.name);
  const excluded = exclusionSet(excludeFeats);
  const names = Array.isArray(context?.names) ? context.names : [];
  const plan = {};
  for (const entry of Object.values(entries)) {
    if (Number(entry?.level) !== 1 || typeof entry?.uuid !== "string") continue;
    const document = await documentFromUuid(entry.uuid);
    if (!document) continue;
    const source = toItemData(document);
    const selector = singlePathTag(source);
    if (!selector) continue;
    if (!isEnabledClassFeature(document)) {
      throw new Error(`simplysf2e | required class path source for "${source.name}" is not enabled`);
    }

    const candidates = await getClassFeatureCandidates(selector.tag);
    const closed = [];
    const resolvedByUuid = new Map();
    for (const candidate of candidates) {
      const resolved = await resolvePathCandidate(candidate, { config, classSlug, names, excluded });
      if (!resolved) continue;
      closed.push(candidate);
      resolvedByUuid.set(candidate.uuid, resolved);
    }
    if (!closed.length) {
      throw new Error(`simplysf2e | no fully resolvable enabled class paths for "${source.name}"`);
    }

    source.system.rules[selector.ruleIndex].choices = closed.map((candidate) => ({ value: candidate.uuid, label: candidate.name }));
    await preselectChoiceSets([source], context, config, sourceFromUuid, selectChoices);
    const chosenUuid = source.system.rules[selector.ruleIndex].selection;
    const selected = closed.find((candidate) => candidate.uuid === chosenUuid);
    if (!selected) {
      throw new Error(`simplysf2e | class path "${source.name}" was not selected from the offered catalog`);
    }
    const resolved = resolvedByUuid.get(selected.uuid);
    const skills = upgradedSkillRanks(resolved?.source?.system?.rules ?? []);
    const trainedSkill = Object.keys(skills)[0] ?? null;
    plan[selector.tag] = {
      tag: selector.tag,
      uuid: selected.uuid,
      name: selected.name,
      skills,
      trainedSkill
    };
  }
  return plan;
}

/**
 * Mutate a cloned class source to remove its native bridge entry and return
 * its exact replacement. This must run before Actor.create. It may invoke the
 * existing bounded choice callback; an omitted path is a hard failure, never
 * a later native dialog.
 * @param {object} [options]
 * @param {string[]} [options.excludeFeats] compendium uuids or names of feats
 *   the build already embeds or grants (background, ancestry, planned slots);
 *   never offered for a path's own feat choice.
 * @param {Record<string, { uuid: string }>} [options.pathPlan] optional pre-resolved
 *   class path plan from planClassPaths; forces staging to consume the exact planned candidate.
 */
export async function stageClassPaths(classData, classId, {
  context, config = CONFIG?.PF2E ?? {}, selectChoices = null, excludeFeats = [], pathPlan = null
} = {}) {
  const entries = classData?.system?.items;
  if (!isObject(entries)) return { items: [], expectedPaths: [] };
  const classSlug = slugify(classData?.system?.slug ?? classData?.name);
  const excluded = exclusionSet(excludeFeats);
  const names = Array.isArray(context?.names) ? context.names : [];
  const staged = [];
  const expectedPaths = [];
  for (const [entryId, entry] of Object.entries(entries)) {
    if (Number(entry?.level) !== 1 || typeof entry?.uuid !== "string") continue;
    const document = await documentFromUuid(entry.uuid);
    if (!document) continue;
    const source = toItemData(document);
    const selector = singlePathTag(source);
    if (!selector) continue;
    if (!isEnabledClassFeature(document)) {
      throw new Error(`simplysf2e | required class path source for "${source.name}" is not enabled`);
    }

    const candidates = await getClassFeatureCandidates(selector.tag);
    const closed = [];
    const resolvedByUuid = new Map();
    for (const candidate of candidates) {
      const resolved = await resolvePathCandidate(candidate, { config, classSlug, names, excluded });
      if (!resolved) continue;
      closed.push(candidate);
      resolvedByUuid.set(candidate.uuid, resolved);
    }
    if (!closed.length) {
      throw new Error(`simplysf2e | no fully resolvable enabled class paths for "${source.name}"`);
    }

    // Replace only the runtime query with the exact candidates we just issued.
    // The real ChoiceSet and GrantItem rules stay cloned from PF2e unchanged.
    source.system.location = classId;
    if (pathPlan?.[selector.tag]) {
      const plannedUuid = pathPlan[selector.tag].uuid;
      if (!closed.some((candidate) => candidate.uuid === plannedUuid)) {
        throw new Error(`simplysf2e | planned class path "${pathPlan[selector.tag].name}" is not a valid candidate for "${source.name}"`);
      }
      source.system.rules[selector.ruleIndex].selection = plannedUuid;
    } else {
      source.system.rules[selector.ruleIndex].choices = closed.map((candidate) => ({ value: candidate.uuid, label: candidate.name }));
      await preselectChoiceSets([source], context, config, sourceFromUuid, selectChoices);
    }
    const chosenUuid = source.system.rules[selector.ruleIndex].selection;
    const selected = closed.find((candidate) => candidate.uuid === chosenUuid);
    if (!selected) {
      throw new Error(`simplysf2e | class path "${source.name}" was not selected from the offered catalog`);
    }

    // GrantItem's native `preselectChoices` reaches ChoiceSets on the path
    // feature itself. Build that record using the same bounded chooser rather
    // than authoring any Rule Element or selection values here; the selected
    // feature's dynamic choices are offered from its resolved closed copy.
    const { source: resolved, grantFlags } = resolvedByUuid.get(selected.uuid);
    const bridge = { name: source.name, system: { rules: [{ key: "GrantItem", uuid: selected.uuid }] } };
    await preselectChoiceSets([bridge], context, config,
      async (uuid) => (uuid === selected.uuid ? structuredClone(resolved) : sourceFromUuid(uuid)), selectChoices);
    const targetGrant = source.system.rules.find((rule) => rule?.key === "GrantItem" && typeof rule.uuid === "string" && rule.uuid.includes("rulesSelections"));
    const preselect = bridge.system.rules[0].preselectChoices;
    const selectedChoices = (resolved.system?.rules ?? []).filter((rule) => rule?.key === "ChoiceSet");
    const requiredFlags = selectedChoices.map((rule) => normalizeChoiceFlag(rule.flag));
    if (!requiredFlags.every((flag) => flag && Object.prototype.hasOwnProperty.call(preselect ?? {}, flag))) {
      throw new Error(`simplysf2e | class path "${selected.name}" has an unanswered choice`);
    }
    if (targetGrant && preselect) targetGrant.preselectChoices = preselect;

    delete classData.system.items[entryId];
    staged.push(source);
    // This document is created natively by the bridge's real GrantItem. It
    // was not in the transaction item array, so carry its exact source only
    // for post-create survival verification.
    expectedPaths.push({ name: selected.name, type: selected.type ?? "feat", _stats: { compendiumSource: selected.uuid } });
    // Items the selected feature grants from a preselected uuid choice are
    // native too; verify each one survived creation the same way.
    for (const flag of grantFlags) {
      const granted = await sourceFromUuid(preselect[flag]);
      if (!granted) throw new Error(`simplysf2e | class path "${selected.name}" grant "${flag}" could not be loaded`);
      expectedPaths.push({ name: granted.name, type: granted.type ?? "feat", _stats: { compendiumSource: preselect[flag] } });
    }
  }
  return { items: staged, expectedPaths };
}
