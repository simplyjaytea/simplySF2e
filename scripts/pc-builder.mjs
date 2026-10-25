import * as T from "./tables.mjs";
import { findEntry, getDocument, toItemData, getPacksFor, getAllPacksFor, getFeatCandidates, getHeritageCandidates, isIssuedCandidate } from "./compendium.mjs";
import {
  parseCoins, resolveLoot, resolveEquipment, resolveFocusSpells,
  buildEquipmentItems, buildLootItems, filterItemTypes, heightenedLevelFor, systemIcon
} from "./builder.mjs";
import { slugify, capitalized, toHtml } from "./text.mjs";
import { preselectChoiceSets } from "./choice-set.mjs";
import {
  PC_WEALTH_BY_LEVEL, buildFeatSlots, featSlotLocation, pcSpellcastingProfile, pcSpellPlan,
  ARCHETYPE_CASTER_DEDICATIONS, archetypeSpellSlots, witchwarperArchetypeAbility
} from "./pc-tables.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { CORE_SKILLS, normalizeSkillPriorities, initialSkillTraining, allocateCharacterSkills, characterSkillSnapshot } from "./pc-skills.mjs";
import { ABILITY_KEYS, normalizeAbilityPriorities, assignAbilityBoosts, assignItemBoosts, projectAttributeModifiers, projectSkillRanks } from "./pc-projection.mjs";
import { applyCharacterLoadout } from "./pc-loadout.mjs";
import { planClassPaths, stageClassPaths } from "./class-paths.mjs";
import { COMPLETE_PC_CLASS_SLUGS, archetypeTraditionFor, classManualNotes, getMulticlassDedicationSlug, technomancerCacheSpells, technomancerInitialHack, withInitialFocusSpell } from "./pc-support.mjs";
import {
  archetypeOfFeat, createDedicationRuleState, dedicationRuleBlock, evidencePrerequisitesMet, recordDedicationRulePlacement,
  stagedActorContext
} from "./pc-prerequisites.mjs";
import { gpToCredits } from "./currency.mjs";

/**
 * Player-character counterpart of builder.mjs. PCs get their AC/HP/saves/
 * proficiencies computed by the PF2e system itself from real
 * Ancestry+Background+Class items once those are correctly attached — this
 * module's job is assembling a valid, fully-grounded set of real-item
 * choices, NOT reimplementing that math (unlike tables.mjs, which hardcodes
 * NPC benchmark numbers because NPCs have no such items to derive from).
 * Spell slots/repertoire plans are supplied separately by verified class
 * profiles: class items expose spell proficiency, not automatic slot counts.
 */

/**
 * Second class of a multiclass PC: a complete class slug other than the main
 * class, or null. "ai" is the AI's choice before it resolves, so it is null
 * here. Anything else is dropped with a warning (fail closed).
 */
function normalizeMulticlass(raw, mainClass) {
  if (!raw || raw === "ai") return null;
  const slug = typeof raw === "string" ? slugify(raw) : "";
  if (COMPLETE_PC_CLASS_SLUGS.has(slug) && slug !== slugify(mainClass)) return slug;
  console.warn(`simplysf2e | dropped invalid multiclass "${String(raw).slice(0, 40)}"`);
  return null;
}

/**
 * Coerce the AI's raw PC concept JSON into a well-formed object. Guarantees
 * every field downstream code touches exists and has a legal value — the PC
 * counterpart of builder.mjs's normalizeConcept(), clamping level 1-20 (not
 * -1..24 — PCs, unlike creatures, don't go below level 1 or above 20).
 *
 * A few fields (rarity/traits/strikes/description) are filled with inert PC
 * defaults purely so the EXISTING NPC refine helpers in generator-app.mjs
 * (#refineSpells/#refineEquipment/#refineLoot) can run unchanged against a PC
 * concept — those helpers only ever read concept.blurb/description/traits/
 * strikes/equipment/loot/level/name/rarity, all of which a PC concept can
 * legitimately provide.
 */
export function normalizePCConcept(raw, { level }) {
  const c = typeof raw === "object" && raw !== null ? raw : {};
  const clampedLevel = Math.min(Math.max(Math.round(Number(level) || 1), 1), 20);
  const maxSpellRank = Math.max(1, Math.ceil(clampedLevel / 2));
  const skillPriorities = normalizeSkillPriorities(c.skillPriorities);
  const abilityPriorities = normalizeAbilityPriorities(c.abilityPriorities);
  if (c.skillPriorities !== undefined && (!Array.isArray(c.skillPriorities)
    || c.skillPriorities.some((slug) => !skillPriorities.includes(slug)))) {
    console.warn("simplysf2e | dropped invalid character skill priorities");
  }

  let spellcasting = null;
  if (c.spellcasting && typeof c.spellcasting === "object"
    && ["arcane", "divine", "occult", "primal"].includes(c.spellcasting.tradition)) {
    const spells = (Array.isArray(c.spellcasting.spells) ? c.spellcasting.spells : [])
      .filter((s) => s?.name)
      .map((s) => ({
        name: String(s.name),
        rank: Math.min(Math.max(Math.round(Number(s.rank) || 0), 0), maxSpellRank)
      }));
    spellcasting = { tradition: c.spellcasting.tradition, dcScale: "high", maxRank: maxSpellRank, spells };
  }

  return {
    name: String(c.name || "Unnamed Character").slice(0, 120),
    ancestry: String(c.ancestry || "Human").slice(0, 80),
    heritage: c.heritage ? String(c.heritage).slice(0, 80) : null,
    background: String(c.background || "Follower").slice(0, 80),
    class: String(c.class || "Soldier").slice(0, 80),
    // Null unless Free Archetype is on at resolve time (resolvePCConcept ignores it otherwise).
    multiclass: normalizeMulticlass(c.multiclass, c.class || "Soldier"),
    keyAbility: ABILITY_KEYS.includes(c.keyAbility) ? c.keyAbility : "str",
    abilityPriorities,
    skillPriorities,
    level: clampedLevel,
    // Inert PC defaults so the reused NPC refine helpers have legal input:
    rarity: "common",
    traits: [], // generator-app fills this with [ancestry slug, class slug] once ABC is grounded
    strikes: [], // PCs have no precomputed strikes; only read for equipment keyword extraction
    blurb: String(c.blurb ?? ""),
    description: String(c.backstory ?? ""), // #refineEquipment/#refineLoot read concept.description
    backstory: String(c.backstory ?? ""),
    appearance: String(c.appearance ?? ""),
    age: String(c.age ?? "").slice(0, 40),
    gender: String(c.gender ?? "").slice(0, 40),
    height: String(c.height ?? "").slice(0, 40),
    weight: String(c.weight ?? "").slice(0, 40),
    ethnicity: String(c.ethnicity ?? "").slice(0, 60),
    nationality: String(c.nationality ?? "").slice(0, 60),
    personality: String(c.personality ?? ""),
    alignmentFlavor: String(c.alignmentFlavor ?? ""),
    likes: String(c.likes ?? ""),
    dislikes: String(c.dislikes ?? ""),
    allies: String(c.allies ?? ""),
    enemies: String(c.enemies ?? ""),
    organizations: String(c.organizations ?? ""),
    languages: (Array.isArray(c.languages) ? c.languages : []).map((l) => String(l)).filter(Boolean).slice(0, 6),
    feats: (Array.isArray(c.feats) ? c.feats : []).map((f) => String(f)).filter(Boolean).slice(0, 8),
    spellcasting,
    // Focus spells are independent of `spellcasting` (a character can have focus
    // spells but no slots). Cap at 3 AFTER filtering — the hard focus-pool
    // ceiling — so the first 3 VALID names are kept, not the first 3 raw ones.
    focusSpells: (Array.isArray(c.focusSpells) ? c.focusSpells : [])
      .map((s) => {
        const name = typeof s === "string" ? s.trim() : String(s?.name ?? "").trim();
        const candidate = s?.candidate?.packId && s?.candidate?._id ? s.candidate : null;
        return name ? { name, ...(candidate ? { candidate } : {}) } : null;
      })
      .filter(Boolean)
      .slice(0, 3),
    equipment: (Array.isArray(c.equipment) ? c.equipment : [])
      .map((e) => {
        if (typeof e === "string" && e) return { name: e, quantity: 1, value: 0 };
        if (e?.name) {
          return {
            name: String(e.name),
            quantity: Math.min(Math.max(Math.round(Number(e.quantity) || 1), 1), 10),
            value: Math.max(Number(e.value) || 0, 0)
          };
        }
        return null;
      })
      // Coins belong in loot only, same guard as normalizeConcept's equipment.
      .filter((e) => e && !parseCoins(e.name))
      .slice(0, 10),
    // PCs get their starting wealth as loot separately (see pcStartingWealthGp
    // below), not from an AI-drafted "dropped loot" list — there's no AI
    // first draft for this, so it starts empty and applyTreasureBudget()
    // (reused completely unchanged) pads it with coins to the target value.
    loot: []
  };
}

/**
 * Expected starting wealth (gp-equivalent) for a character created at `level`:
 * the lump sum from the cited Starfinder GM Core Character Wealth table (see PC_WEALTH_BY_LEVEL),
 * scaled by the GM's Treasure amount setting. Surface that budget in credits
 * with `pcStartingWealthCredits` (1 gp = 10 credits, cited DENOMINATION_RATES).
 *
 * Deliberately NOT tables.mjs's TREASURE_BY_LEVEL, which this function used
 * to read: that is Table 10-9 Treasure by Level, the total treasure a whole
 * PARTY should accumulate across a level of play, not one character's own
 * starting wealth. Reading it here overpaid every PC above level 1 by an
 * order of magnitude (level 2: 300 gp instead of 30). Also not
 * treasureBudget(), which divides that party total by ENCOUNTERS_PER_LEVEL
 * for an NPC's per-encounter share.
 *
 * Level 1 needs no special case: Table 10-10's own level-1 lump sum is the
 * same flat 15 gp a character gets at normal character creation.
 */
export function pcStartingWealthGp(level, amount = "standard") {
  const lv = Math.min(Math.max(Math.round(Number(level)) || 1, 1), 20);
  const gp = PC_WEALTH_BY_LEVEL[lv - 1];
  return Math.round(gp * (T.TREASURE_AMOUNT_MULTIPLIER[amount] ?? 1));
}

/** Same lump sum as `pcStartingWealthGp`, surfaced in credits at 1 gp = 10 credits. */
export function pcStartingWealthCredits(level, amount = "standard") {
  return gpToCredits(pcStartingWealthGp(level, amount));
}

/**
 * Whether a heritage document is legal for a given ancestry document.
 *
 * Verified against the real pf2e source (`src/module/item/heritage/data.ts`,
 * HeritageSystemSchema): a heritage's `system.ancestry` field is a
 * `SchemaField` that is either `null` (a "versatile heritage" such as
 * Dhampir or Duskwalker — see e.g.
 * `packs/heritages/versatile-heritages/dhampir.json`, which has
 * `"ancestry": null` — valid for ANY ancestry) or an object
 * `{name, slug, uuid}` naming the single ancestry it belongs to (e.g.
 * `packs/heritages/dwarf/rock-dwarf.json` has
 * `"ancestry": {"name": "Dwarf", "slug": "dwarf", "uuid":
 * "Compendium.pf2e.ancestries.Item.BYj5ZvlXZdpaEgA6"}`). Every pf2e item
 * also carries a base `system.slug` (nullable, auto-derived from name —
 * `src/module/item/base/data/model.ts`), so a same-slug fallback covers an
 * ancestry doc whose `system.slug` hasn't been generated yet.
 * @param {{system?: {ancestry?: {slug?: string, uuid?: string}|null}}|null} heritageDoc
 * @param {{name: string, uuid?: string, system?: {slug?: string|null}}|null} ancestryDoc
 * @returns {boolean}
 */
export function heritageMatchesAncestry(heritageDoc, ancestryDoc) {
  const link = heritageDoc?.system?.ancestry ?? null;
  if (!link) return true; // versatile heritage — valid for any ancestry
  if (!ancestryDoc) return false;
  if (link.uuid && ancestryDoc.uuid && link.uuid === ancestryDoc.uuid) return true;
  const ancestrySlug = ancestryDoc.system?.slug || slugify(ancestryDoc.name ?? "");
  return Boolean(link.slug) && Boolean(ancestrySlug) && link.slug === ancestrySlug;
}

/**
 * Deterministic fallback heritage for `ancestryDoc`, used when the AI's
 * heritage pick didn't resolve or belonged to a different ancestry. Heritage
 * is ABC-adjacent (falls under invariant #5's PC-feat-slot exception, same
 * as resolveFeatPicks()'s `candidates[0]` fallback below): a PC with no
 * heritage at all is a worse outcome than a plausible, GM-swappable
 * substitute. Walks getHeritageCandidates()'s full name-sorted list (NOT
 * rarity-capped — resolvePCConcept has no rarityCap in scope here, so this
 * fallback may surface a rarer heritage than the generator's own cap would
 * normally offer) and resolves+checks each one until a match for
 * `ancestryDoc` turns up.
 * @param {object} ancestryDoc
 * @returns {Promise<object|null>}
 */
async function fallbackHeritageFor(ancestryDoc) {
  const candidates = await getHeritageCandidates();
  const packIds = await getAllPacksFor("heritages");
  for (const candidate of candidates) {
    const entry = await findEntry(packIds, candidate.name, (e) => e.type === "heritage");
    const doc = await getDocument(entry);
    if (doc && heritageMatchesAncestry(doc, ancestryDoc)) return doc;
  }
  return null;
}

/**
 * Technomancer's initial magic hack for the staged Programming Language
 * (pc-support.mjs TECHNOMANCER_INITIAL_HACKS), loaded from sf2e.spells by its
 * exact id. Fail closed: a disabled pack or a document that is not a focus
 * spell warns and yields no hack. The AI never picks it.
 */
async function resolveInitialMagicHack(stagedItems) {
  const hack = technomancerInitialHack(stagedItems);
  if (!hack) return null;
  const entry = { packId: "sf2e.spells", _id: hack.spellId };
  if (!getPacksFor("spells").includes(entry.packId)) {
    console.warn(`simplysf2e | ${entry.packId} is not an enabled spell source — no initial magic hack added`);
    return null;
  }
  const doc = await getDocument(entry);
  if (doc?.type !== "spell" || !(doc.system?.traits?.value ?? []).includes("focus")) {
    console.warn(`simplysf2e | initial magic hack "${hack.spell}" (${hack.spellId}) is not a focus spell in ${entry.packId} — none added`);
    return null;
  }
  return { name: doc.name, entry };
}

/**
 * Candidates for a later archetype slot of a multiclass PC, follow-ups of the
 * pinned archetype first. Membership comes from prerequisite text
 * (archetypeOfFeat); each follow-up found joins `archetypeMembers`, so a
 * follow-up of a follow-up still counts. Preferred, not exclusive: other
 * candidates keep their order after them.
 */
function archetypeFollowUpsFirst(candidates, archetypeMembers) {
  const followUps = [];
  const others = [];
  for (const candidate of candidates) {
    const owner = archetypeOfFeat(candidate, archetypeMembers);
    if (owner === null) {
      others.push(candidate);
      continue;
    }
    archetypeMembers.set(slugify(candidate.name), owner);
    followUps.push(candidate);
  }
  return [...followUps, ...others];
}

/**
 * Resolve every compendium reference in a PC concept — the PC counterpart of
 * builder.mjs's resolveConcept(). Assumes concept.ancestry/heritage/
 * background/class already carry GROUNDED real names (i.e. generator-app has
 * already run selectAncestryBackgroundClass() and copied its picks onto the
 * concept) — this just does the findEntry/getDocument/grant-resolution work.
 * Ancestry/background/class are REQUIRED: the build is meaningless without
 * them, so a failure to resolve any of the three throws rather than silently
 * producing a broken actor. Heritage: if the AI didn't name one, it's left
 * empty (like any other unresolved AI pick). If it DID name one, that pick
 * is validated against the resolved ancestry doc (heritageMatchesAncestry())
 * — a heritage that doesn't resolve, or resolves to a document belonging to
 * a DIFFERENT ancestry (a fuzzy-match near-miss, or the AI simply ignoring
 * the "match the ancestry" prompt instruction), is dropped and replaced with
 * fallbackHeritageFor(ancestryDoc)'s deterministic ancestry-matched pick
 * rather than silently embedding a wrong-ancestry heritage.
 *
 * Returns feat SLOTS with their candidate lists (not yet picked) — picking
 * happens in generator-app via ai.mjs's selectFeats(), mirroring how AI calls
 * live in the app while resolution lives here for the NPC pipeline too.
 */
export async function resolvePCConcept(concept, { exactContent = false, pathPlan = null, selectChoices = null } = {}) {
  // ABC lookups scan ALL installed packs of the right type (getAllPacksFor),
  // not just the hardcoded default pack, so a legit AI pick living in a Lost
  // Omens / add-on compendium still resolves instead of aborting the run (#51).
  const ancestryPacks = await getAllPacksFor("ancestries");
  const ancestryEntry = isIssuedCandidate(concept.ancestryCandidate, ancestryPacks)
    ? concept.ancestryCandidate : (exactContent ? null : await findEntry(ancestryPacks, concept.ancestry, (e) => e.type === "ancestry"));
  const ancestryDoc = await getDocument(ancestryEntry);
  if (!ancestryDoc || ancestryDoc.type !== "ancestry") throw new Error(`Could not find ancestry "${concept.ancestry}" in the compendium`);

  const backgroundPacks = await getAllPacksFor("backgrounds");
  const backgroundEntry = isIssuedCandidate(concept.backgroundCandidate, backgroundPacks)
    ? concept.backgroundCandidate : (exactContent ? null : await findEntry(backgroundPacks, concept.background, (e) => e.type === "background"));
  const backgroundDoc = await getDocument(backgroundEntry);
  if (!backgroundDoc || backgroundDoc.type !== "background") throw new Error(`Could not find background "${concept.background}" in the compendium`);

  const classPacks = await getAllPacksFor("classes");
  const classEntry = isIssuedCandidate(concept.classCandidate, classPacks)
    ? concept.classCandidate : (exactContent ? null : await findEntry(classPacks, concept.class, (e) => e.type === "class"));
  const classDoc = await getDocument(classEntry);
  if (!classDoc || classDoc.type !== "class") throw new Error(`Could not find class "${concept.class}" in the compendium`);

  let heritageDoc = null;
  if (concept.heritage) {
    const heritagePacks = await getAllPacksFor("heritages");
    const heritageEntry = isIssuedCandidate(concept.heritageCandidate, heritagePacks)
      ? concept.heritageCandidate : (exactContent ? null : await findEntry(heritagePacks, concept.heritage, (e) => e.type === "heritage"));
    const pickedDoc = await getDocument(heritageEntry);
    if (!pickedDoc || pickedDoc.type !== "heritage") {
      console.warn(`simplysf2e | heritage "${concept.heritage}" not found in the compendium — falling back to an ancestry-matched heritage`);
    } else if (!heritageMatchesAncestry(pickedDoc, ancestryDoc)) {
      console.warn(`simplysf2e | heritage "${concept.heritage}" does not belong to ancestry "${ancestryDoc.name}" — dropping and falling back to an ancestry-matched heritage`);
    } else {
      heritageDoc = pickedDoc;
    }
    if (!heritageDoc) {
      heritageDoc = await fallbackHeritageFor(ancestryDoc);
      if (!heritageDoc) {
        console.warn(`simplysf2e | no heritage in the compendium matches ancestry "${ancestryDoc.name}" — character will have no heritage`);
      }
    }
  }

  // Feat slots: candidates only (no picks yet — generator-app runs
  // selectFeats() and resolveFeatPicks() below once it has these lists).
  // Ordinary prerequisites are display text; filter them against the staged
  // ABC/grants/skills the plan already proves, never an empty-array shortcut.
  const { ranks: provenSkills } = initialSkillTraining(classDoc.system, backgroundDoc.system);
  const loreSkills = Object.fromEntries((Array.isArray(backgroundDoc.system?.trainedSkills?.lore)
    ? backgroundDoc.system.trainedSkills.lore : [])
    .filter((name) => typeof name === "string" && name.trim())
    .map((name) => [slugify(name), 1]));

  if (!pathPlan) {
    const pathContext = { names: conceptChoiceNames(concept, { ancestryDoc, heritageDoc, backgroundDoc, classDoc }) };
    const excludeFeats = abcGrantExclusions([ancestryDoc, heritageDoc, backgroundDoc]);
    pathPlan = await planClassPaths(classDoc, { context: pathContext, selectChoices, excludeFeats });
  }

  for (const planned of Object.values(pathPlan ?? {})) {
    for (const [skillSlug, rank] of Object.entries(planned.skills ?? {})) {
      provenSkills[skillSlug] = Math.max(provenSkills[skillSlug] ?? 0, rank);
    }
  }

  // Projected ability modifiers and skill ranks, computed with the same key
  // ability and boosts createCharacterActor applies. Prerequisites such as
  // "Charisma +2" or "trained in Stealth" are proven at each slot's level.
  // A null ability projection passes no abilities; a null skill projection
  // falls back to the staged ABC skills. Either case warns once.
  const keyAbility = resolveKeyAbility(classDoc.system, concept.keyAbility);
  const modsByLevel = new Map();
  const modsAt = (lvl) => {
    if (!modsByLevel.has(lvl)) {
      modsByLevel.set(lvl, projectAttributeModifiers({
        ancestrySystem: ancestryDoc.system, backgroundSystem: backgroundDoc.system,
        keyAbility, preferences: concept.abilityPriorities, level: lvl
      }));
    }
    return modsByLevel.get(lvl);
  };
  const levelMods = modsAt(concept.level);
  const initialMods = modsAt(1);
  const projection = levelMods && initialMods ? projectSkillRanks({
    classSystem: classDoc.system, backgroundSystem: backgroundDoc.system, provenSkills,
    intelligence: levelMods.int, initialIntelligence: initialMods.int, keyAbility,
    priorities: concept.skillPriorities, level: concept.level
  }) : null;
  if (!levelMods || !initialMods || !projection) {
    console.warn("simplysf2e | could not project ability modifiers or skill ranks — feat prerequisites use the staged ABC skills only");
  }

  // Path- and heritage-keyed prerequisites ("drone exocortex", "<X> heritage")
  // are proven from the planned names only. Feats a class path keeps for its
  // own choice never fill a general or skill slot.
  const pathFeatures = [];
  for (const [tag, planned] of Object.entries(pathPlan ?? {})) {
    if (!planned?.name) continue;
    pathFeatures.push({ name: planned.name });
    if (tag === "mechanic-exocortex") pathFeatures.push({ name: `${planned.name} exocortex` });
    if (tag === "technomancer-programming-language") pathFeatures.push({ name: `${planned.name} programming language` });
  }
  if (heritageDoc) pathFeatures.push({ name: `${heritageDoc.name} heritage` });
  const reservedFeats = Object.values(pathPlan ?? {}).flatMap((planned) => planned?.reservedFeats ?? []);
  const reservedFeatNames = Object.values(pathPlan ?? {}).flatMap((planned) => planned?.reservedFeatNames ?? []);
  const slotExclusions = [...reservedFeats, ...reservedFeatNames];

  const hasSpecializedSkillSet = Object.values(classDoc.system?.items ?? {}).some((feature) =>
    Number(feature?.level) === 3 && (
      [
        "Compendium.sf2e.class-features.Item.N6fZPvGFrS8LZgnE",
        "Compendium.sf2e.class-features.Item.Specialized Skill Set"
      ].includes(feature?.uuid) ||
      (typeof feature?.uuid === "string" && feature.uuid.toLowerCase().includes("specialized-skill-set")) ||
      slugify(feature?.name) === "specialized-skill-set"
    ));
  const operativePlan = pathPlan?.["operative-specialization"];
  const operativeSkill = operativePlan?.trainedSkill ?? null;

  const ancestryTrait = slugify(ancestryDoc.name);
  const classTrait = slugify(classDoc.name);
  const featSlots = [];
  const freeArchetype = Boolean(getSetting(SETTINGS.freeArchetype));
  // Multiclass (Free Archetype only): the first archetype slot takes the second
  // class's dedication as its only candidate, when that dedication is provable
  // there. Later archetype slots list that archetype's follow-ups first.
  const secondClass = freeArchetype && concept.multiclass && concept.multiclass !== classTrait ? concept.multiclass : null;
  const dedicationSlug = secondClass ? getMulticlassDedicationSlug(secondClass) : null;
  const archetypeMembers = new Map(); // feat slug -> dedication slug of its archetype
  // Slugs of every archetype candidate offered to an EARLIER archetype slot
  // (dedications and follow-ups, the pinned dedication included).
  const offeredArchetypeSlugs = new Set();
  let multiclass = null;
  let firstArchetypeSlotSeen = false;
  for (const slot of buildFeatSlots(concept.level, { freeArchetype, classSystem: classDoc.system })) {
    const isSpecializedSlot = hasSpecializedSkillSet && slot.type === "skill" && [3, 7, 15].includes(slot.level);
    // The staged facts alone; resolveFeatPicks re-proves archetype picks against these.
    const stagedContext = stagedActorContext({
      level: slot.level, ancestry: ancestryDoc, heritage: heritageDoc,
      background: backgroundDoc, class: classDoc, features: pathFeatures,
      skills: { ...(projection ? projection.ranksAt(slot.level) : provenSkills), ...loreSkills },
      abilities: modsAt(slot.level) ?? {},
      allowedSkillFeats: isSpecializedSlot ? (operativeSkill ? [operativeSkill] : []) : null
    });
    // A follow-up names its dedication ("Envoy Dedication"), which no staged fact
    // proves yet. Candidate time therefore also accepts the names offered to earlier
    // archetype slots; the cap in getFeatCandidates still bounds the list. Other
    // slots keep the pinned dedication, as before.
    const offeredNames = slot.archetype
      ? offeredArchetypeSlugs : new Set(multiclass ? [slugify(multiclass.dedication)] : []);
    const prerequisiteContext = { ...stagedContext, names: new Set([...stagedContext.names, ...offeredNames]) };
    const traits = slot.archetype ? ["archetype"]
      : slot.type === "ancestry" ? [ancestryTrait]
      : slot.type === "class" ? [classTrait] : [];
    // General slots also accept skill feats (sf2e-1.6.1 feats/collection.ts: supported ["general", "skill"]).
    const category = slot.type === "general" ? ["general", "skill"] : slot.type;
    let candidates = await getFeatCandidates({
      level: slot.level, category, traits, preferredNames: concept.feats,
      excludeUuids: slotExclusions, prerequisiteContext
    });
    if (!candidates.length && traits.length && !slot.archetype) {
      candidates = await getFeatCandidates({
        level: slot.level, category, preferredNames: concept.feats,
        excludeUuids: slotExclusions, prerequisiteContext
      });
    }
    if (slot.archetype && dedicationSlug && !firstArchetypeSlotSeen) {
      firstArchetypeSlotSeen = true;
      // preferredNames keeps the exact dedication inside the bounded candidate list.
      const dedications = (await getFeatCandidates({
        level: slot.level, category, traits,
        preferredNames: [`${capitalized(secondClass)} Dedication`],
        excludeUuids: slotExclusions, prerequisiteContext
      })).filter((candidate) => slugify(candidate.name) === dedicationSlug);
      if (dedications.length) {
        candidates = dedications;
        multiclass = { class: secondClass, dedication: dedications[0].name };
        archetypeMembers.set(dedicationSlug, dedicationSlug);
      } else {
        console.warn(`simplysf2e | multiclass ${secondClass} dedication not legal for this character — using ordinary archetype candidates`);
      }
    } else if (slot.archetype && multiclass) {
      candidates = archetypeFollowUpsFirst(candidates, archetypeMembers);
    }
    // Archetype slots carry their staged context to resolveFeatPicks, which proves
    // each pick's prerequisites against it plus the archetype feats actually taken.
    const archetypeProof = slot.archetype ? { prerequisiteContext: stagedContext } : {};
    if (slot.archetype) for (const candidate of candidates) offeredArchetypeSlugs.add(slugify(candidate.name));
    if (candidates.length) featSlots.push({ ...slot, candidates, ...archetypeProof });
    else {
      console.warn(`simplysf2e | no feat candidates for a ${slot.type}${slot.archetype ? " (archetype)" : ""} slot at level ${slot.level} — slot remains unresolved`);
      featSlots.push({ ...slot, candidates: [], ...archetypeProof });
    }
  }

  const spells = await groundSpellPicks(concept.spellcasting?.spells ?? [], { exactContent });
  // Caster dedication picks (archetype entry), grounded the same way.
  const archetypeSpells = await groundSpellPicks(concept.archetypeSpellcasting?.spells ?? [], { exactContent });

  const focusSpells = await resolveFocusSpells(concept.focusSpells ?? [], { exactContent });

  const skippedGear = [];
  const equipment = await resolveEquipment(concept, { exactContent, skipped: skippedGear });
  // concept.loot starts empty (see normalizePCConcept) — resolveLoot() is a
  // no-op on it here; applyTreasureBudget() (called by generator-app with
  // pcStartingWealthGp()) is what actually fills it with coins.
  const loot = await resolveLoot(concept, { exactContent, skipped: skippedGear });

  return {
    ancestryDoc, heritageDoc, backgroundDoc, classDoc, featSlots, spells, archetypeSpells, focusSpells, equipment, loot, skippedGear,
    pathPlan, skillPlan: projection?.plan ?? null, abilityMods: levelMods ?? null, multiclass
  };
}

/**
 * Resolve ai.mjs's selectFeats() picks against each slot's own candidate
 * list. Unlike NPC feats (which fail closed — a creature is fine with fewer
 * abilities), a PC feat SLOT is a real, level-gated entitlement the rules
 * grant — leaving it permanently empty is a worse outcome than filling it
 * with a plausible default the GM can swap out. So a slot whose pick is
 * missing (the AI dropped it — selectFeats batches every slot into one call,
 * and a large character can have 20+ slots) or doesn't resolve (hallucinated
 * name) falls back to the first candidate from THAT SLOT's own already-
 * validated list (issue #56 item 4) instead of being dropped. The AI's pick
 * is also now matched with the SAME category filter (`system.category ===
 * slot.type`) the candidate list itself was built with — previously a
 * same-named-but-wrong-category feat elsewhere in the compendium could
 * resolve in place of the slot's own intended pick.
 *
 * Picks are deduplicated ACROSS slots: PF2e feats aren't repeatable, and both
 * failure modes here converge on the same name otherwise — the AI can name one
 * feat for two slots, and the fallback below is `candidates[0]`, which (sorted
 * by level then name) is IDENTICAL for every slot of a category. A level-20
 * character whose batched selectFeats() call came back empty used to get ten
 * copies of the same class feat.
 * In the complete one-click flow `exactContent` keeps this final step inside
 * the per-slot, locally issued catalog: an AI selection cannot become a
 * different same-named feat through a post-selection lookup. The entitlement
 * fallback remains, but it too uses that slot's exact candidate reference.
 * Legacy/pre-selection callers retain the former name-lookup behavior.
 * A slot still empty after this pass gets an augmenting-path repair
 * (repairUnfilledFeatSlots), which may move an earlier slot to another of its own candidates.
 * @param {{type: string, level: number, candidates: {name: string, ref?: object}[]}[]} featSlots
 * @param {{slot: number, name: string, candidate?: object}[]} picks
 * @param {{exactContent?: boolean}} [options]
 * @returns {Promise<{type: string, level: number, archetype: boolean, name: string, entry: object|null}[]>}
 */
export async function resolveFeatPicks(featSlots, picks, { exactContent = false } = {}) {
  const bySlot = new Map(picks.map((p) => [p.slot, p]));
  const taken = new Set();
  const resolved = [];

  /** Resolve one candidate for one slot, rejecting cross-slot/raw references. */
  const resolveFor = (slot, name, candidate = null) => {
    const allowedPacks = getPacksFor("feats");
    const offeredCandidate = (slot.candidates ?? []).find((item) => item?.ref === candidate) ?? null;
    const offered = offeredCandidate?.ref ?? null;
    if (offered && isIssuedCandidate(offered, allowedPacks)) {
      return Promise.resolve(taken.has(slugify(offeredCandidate.name)) ? null : offered);
    }
    if (exactContent) return Promise.resolve(null);
    // Preserve the pre-existing permissive seam for callers that explicitly
    // opt out of complete-only creation. The one-click path above never
    // reaches this branch: it requires the exact reference offered to this
    // slot, not merely an allowed pack.
    if (candidate?.packId && allowedPacks.includes(candidate.packId)) {
      return Promise.resolve(taken.has(slugify(name)) ? null : candidate);
    }
    return findEntry(
      allowedPacks,
      name,
      (e) => e.type === "feat"
        && (slot.type === "general" ? ["general", "skill"] : [slot.type]).includes(e.system?.category)
        && (e.system?.level?.value ?? 0) <= slot.level
        && !taken.has(slugify(e.name))
    );
  };

  /** The candidate record behind a resolved entry; a full compendium entry (permissive path) is its own evidence. */
  const evidenceOf = (slot, entry) => (slot.candidates ?? []).find((candidate) => candidate?.ref === entry) ?? entry;

  // Archetype slots also obey the dedication rule in slot order: a dedication
  // is skipped while an earlier one still needs follow-ups, and a slot with no
  // legal feat stays empty (entry null) rather than taking an illegal one. Their
  // prerequisites must also hold against the archetype feats accepted so far.
  const archetypeRule = createDedicationRuleState();
  const archetypeAccepted = new Set(); // slugs of archetype feats accepted in earlier archetype slots
  const aiPicked = [];
  const evidence = [];
  for (let i = 0; i < featSlots.length; i++) {
    const slot = featSlots[i];
    const archetypeSlot = slot.archetype === true;
    const pick = bySlot.get(i + 1) ?? null;
    let name = pick?.name ?? null;
    let entry = name ? await resolveFor(slot, name, pick?.candidate) : null;
    // One warning per skipped pick, emitted once the slot's outcome is known.
    let skipped = null;
    if (entry && archetypeSlot) {
      const blocked = archetypeBlock(archetypeRule, slot, evidenceOf(slot, entry), archetypeAccepted);
      if (blocked) {
        skipped = { name, reason: blocked };
        entry = null;
        name = null;
      }
    }
    aiPicked[i] = Boolean(entry);
    if (name && !entry) {
      console.warn(`simplysf2e | feat pick "${name}" for slot ${i + 1} (${slot.type}, level ${slot.level}) did not resolve to an unused feat for this slot`);
    }
    if (!entry) {
      // Fallback: walk this slot's own candidate list (real, already
      // level/category/trait-filtered) for the first one not already taken.
      // An archetype slot skips what the dedication rule forbids right now.
      const candidates = archetypeSlot
        ? dedicationRuleOrder(slot.candidates ?? [], archetypeRule)
        : slot.candidates ?? [];
      for (const candidate of candidates) {
        if (archetypeSlot && archetypeBlock(archetypeRule, slot, candidate, archetypeAccepted)) continue;
        entry = await resolveFor(slot, candidate.name, candidate.ref);
        if (entry) {
          name = candidate.name;
          if (!skipped) console.warn(`simplysf2e | slot ${i + 1} (${slot.type}, level ${slot.level}) had no usable AI pick — defaulted to "${name}"`);
          break;
        }
      }
    }
    if (entry) {
      // Exact candidate references intentionally carry only opaque source
      // identity. Recover their verified catalog label before deduplicating
      // or presenting the result; a document lookup is neither needed nor
      // desirable on the strict path.
      name = (slot.candidates ?? []).find((candidate) => candidate?.ref === entry)?.name ?? entry.name ?? name;
      taken.add(slugify(name));
      if (archetypeSlot) {
        recordDedicationRulePlacement(archetypeRule, slugify(name), evidenceOf(slot, entry));
        archetypeAccepted.add(slugify(name));
      }
    }
    if (skipped) {
      const outcome = entry ? `took "${name}"` : "no legal feat left, slot left empty";
      console.warn(`simplysf2e | feat pick "${skipped.name}" for slot ${i + 1} (archetype, level ${slot.level}) skipped: ${skipped.reason}; ${outcome}`);
    }
    evidence[i] = entry ? evidenceOf(slot, entry) : null;
    // entry can still be null when every candidate for this slot is already
    // taken (a sparse category at low levels); the name is kept so the preview
    // can still show intent, and the slot is simply left empty on the sheet.
    resolved.push({
      type: slot.type, level: slot.level, archetype: slot.archetype === true,
      name: name ?? `${slot.type} feat`, entry
    });
  }
  repairUnfilledFeatSlots(featSlots, resolved, aiPicked, evidence);
  return resolved;
}

/**
 * Candidate order for an archetype slot while a dedication is open and still
 * needs follow-ups: that dedication's follow-ups first, the rest in their own
 * order. The caller drops what the dedication rule forbids. Unchanged otherwise.
 */
function dedicationRuleOrder(candidates, rule) {
  const open = rule.openDedication;
  if (open === null || (rule.archetypeCounts.get(open) ?? 0) >= 2) return candidates;
  const followUps = candidates.filter((candidate) => archetypeOfFeat(candidate, rule.archetypeFeats) === open);
  return [...followUps, ...candidates.filter((candidate) => !followUps.includes(candidate))];
}

/**
 * Why an archetype slot may not take `evidence` now, or null when it may. The
 * dedication rule comes first. Then the feat's own prerequisite text must hold
 * against the slot's staged facts plus the archetype feats already accepted
 * (`acceptedSlugs`). Candidate time offers a follow-up whose dedication was only
 * offered, so this is what refuses it when that dedication was not taken. A slot
 * with no staged context (a hand-built slot) has nothing to prove against.
 */
function archetypeBlock(rule, slot, evidence, acceptedSlugs) {
  const blocked = dedicationRuleBlock(rule, evidence);
  if (blocked) return blocked;
  if (!slot.prerequisiteContext) return null;
  const names = new Set([...slot.prerequisiteContext.names, ...acceptedSlugs]);
  return evidencePrerequisitesMet(evidence, { ...slot.prerequisiteContext, names })
    ? null : "prerequisites not met by the staged character or the archetype feats taken before it";
}

/**
 * Whether the archetype slots, in slot order, pass the dedication rule and their
 * prerequisites (archetypeBlock). `assigned[k]` is `{ slug, evidence }` for a
 * filled slot and null for an empty one; empty and non-archetype slots take no part.
 */
function archetypeSequenceLegal(featSlots, assigned) {
  const rule = createDedicationRuleState();
  const accepted = new Set();
  for (let k = 0; k < featSlots.length; k++) {
    const placement = assigned[k];
    if (featSlots[k]?.archetype !== true || !placement) continue;
    if (archetypeBlock(rule, featSlots[k], placement.evidence, accepted)) return false;
    recordDedicationRulePlacement(rule, placement.slug, placement.evidence);
    accepted.add(placement.slug);
  }
  return true;
}

/**
 * Cause B repair for resolveFeatPicks. The greedy pass above never gives a feat
 * back, so a later slot whose candidates were all taken can stay empty even
 * when a full assignment exists. Treat the resolved slots as a matching of
 * slots to feats (keyed by slugified name) and augment from each empty slot
 * (Kuhn's algorithm): a feat held by another slot is freed only when that slot
 * moves to another of ITS OWN offered candidates. Only exact issued references
 * qualify, the same rule resolveFor applies. A default-filled slot moves
 * first; an AI-picked slot moves only when no other path fills an empty slot,
 * and only as part of that augmenting path. Each moved slot warns.
 * Mutates `resolved` in place (name and entry only). A move is kept only when the
 * archetype slots still pass the dedication rule and their prerequisites in slot
 * order (archetypeSequenceLegal), so a repair never creates an illegal dedication
 * or a follow-up whose dedication was not taken.
 * @param {{candidates?: {name: string, ref?: object}[]}[]} featSlots
 * @param {{name: string, entry: object|null}[]} resolved
 * @param {boolean[]} aiPicked true where the slot's own AI pick was kept
 * @param {(object|null)[]} evidence per slot, the candidate record or entry that resolved it (null when empty)
 */
function repairUnfilledFeatSlots(featSlots, resolved, aiPicked, evidence) {
  const allowedPacks = getPacksFor("feats");
  const usable = featSlots.map((slot) => {
    const keys = new Set();
    return (slot.candidates ?? []).filter((candidate) => {
      const key = slugify(candidate?.name ?? "");
      if (!key || keys.has(key) || !isIssuedCandidate(candidate.ref, allowedPacks)) return false;
      keys.add(key);
      return true;
    });
  });
  if (!resolved.some((row, i) => !row.entry && usable[i].length)) return;

  const holder = new Map(); // feat key -> index of the slot holding it
  resolved.forEach((row, i) => { if (row.entry) holder.set(slugify(row.name), i); });
  const originalKeys = resolved.map((row) => (row.entry ? slugify(row.name) : null));
  const chosen = new Map(); // slot index -> candidate it now holds
  /** The archetype placements as they stand, with `chosen` applied. */
  const placements = () => resolved.map((row, k) => {
    if (chosen.has(k)) return { slug: slugify(chosen.get(k).name), evidence: chosen.get(k) };
    return row.entry ? { slug: originalKeys[k], evidence: evidence[k] } : null;
  });

  /** Try to give slot i one of its candidates, re-homing any holder on the way. */
  const place = (i, allowAiMoves, visited) => {
    for (const candidate of usable[i]) {
      const key = slugify(candidate.name);
      if (visited.has(key)) continue;
      visited.add(key);
      const owner = holder.get(key);
      if (owner !== undefined) {
        if (!allowAiMoves && aiPicked[owner]) continue;
        if (!place(owner, allowAiMoves, visited)) continue;
      }
      holder.set(key, i);
      chosen.set(i, candidate);
      return true;
    }
    return false;
  };

  for (let i = 0; i < resolved.length; i++) {
    if (resolved[i].entry || !usable[i].length) continue;
    const savedHolder = new Map(holder);
    const savedChosen = new Map(chosen);
    for (const allowAiMoves of [false, true]) {
      if (place(i, allowAiMoves, new Set()) && archetypeSequenceLegal(featSlots, placements())) break;
      holder.clear();
      for (const [key, owner] of savedHolder) holder.set(key, owner);
      chosen.clear();
      for (const [index, candidate] of savedChosen) chosen.set(index, candidate);
    }
  }

  for (const [i, candidate] of chosen) {
    const key = slugify(candidate.name);
    if (key === originalKeys[i]) continue;
    const slot = featSlots[i];
    const where = `slot ${i + 1} (${slot.type}, level ${slot.level})`;
    if (originalKeys[i]) console.warn(`simplysf2e | ${where} moved to "${candidate.name}" to free a feat for an empty slot`);
    else console.warn(`simplysf2e | ${where} filled with "${candidate.name}" by moving an earlier slot`);
    resolved[i].name = candidate.name;
    resolved[i].entry = candidate.ref;
  }
}

/**
 * The class's `keyAbility.selected` must be one of `keyAbility.value` (verified
 * against class data.ts); a hallucinated/illegal key ability would leave the
 * class boost unapplied. Validate the AI's pick, falling back to the class's
 * first legal option.
 */
function resolveKeyAbility(classSystem, requested) {
  const options = Array.isArray(classSystem?.keyAbility?.value) ? classSystem.keyAbility.value : [];
  if (options.includes(requested)) return requested;
  return options[0] ?? (ABILITY_KEYS.includes(requested) ? requested : "str");
}

/**
 * Resolve the AI's freeform language names against the world's real language
 * list (`CONFIG.PF2E.languages`, a slug -> localized-label map read at
 * runtime rather than hardcoded, since installed content packs can add to
 * it), capped to the ancestry's bonus-language slot count and restricted to
 * its allowed list when the ancestry has one (verified against
 * ancestry/data.ts: `additionalLanguages.count`/`.value`). Does NOT include
 * the ancestry's own automatic languages (e.g. Common) — those are added by
 * the ancestry item's own data prep (verified in ancestry/document.ts:
 * prepareActorData pushes them into build.languages.granted, which
 * character/document.ts merges into system.details.languages.value at
 * runtime), so listing them here would just be redundant, not wrong.
 */
function resolveLanguages(names, ancestryDoc, bonus = 0) {
  const known = CONFIG?.PF2E?.languages ?? {};
  const bySlug = new Set(Object.keys(known));
  const byLabel = new Map(
    Object.entries(known).map(([slug, label]) => [String(game.i18n.localize(label)).toLowerCase(), slug])
  );
  const additional = ancestryDoc?.system?.additionalLanguages ?? {};
  // Cap = the ancestry's own bonus-language slots PLUS the character's
  // Intelligence-modifier bonus languages (issue #64 item 1) — without the
  // Int bonus the AI's extra language picks were silently truncated.
  const max = Math.max(0, Math.round(Number(additional.count) || 0)) + Math.max(0, Math.round(Number(bonus) || 0));
  const allowed = Array.isArray(additional.value) && additional.value.length ? new Set(additional.value) : null;
  const automatic = new Set(ancestryDoc?.system?.languages?.value ?? []);

  const resolved = [];
  for (const raw of names) {
    if (resolved.length >= max) break;
    const text = String(raw).trim();
    if (!text) continue;
    const slug = bySlug.has(slugify(text)) ? slugify(text) : byLabel.get(text.toLowerCase()) ?? null;
    if (!slug || automatic.has(slug) || resolved.includes(slug)) continue;
    if (allowed && !allowed.has(slug)) continue;
    resolved.push(slug);
  }
  return resolved;
}

/** A `type:"lore"` skill item (shape verified against pf2e src/module/item/lore.ts:
 * `proficient.value` is the rank, 1 = trained). Background lore isn't a
 * system.skills entry — it needs its own embedded item (issue #50 item 3). */
function loreItem(name, rank = 1) {
  return {
    name: String(name),
    type: "lore",
    img: "icons/sundries/scrolls/scroll-symbol-sun-brown.webp",
    system: {
      mod: { value: 0 },
      proficient: { value: rank },
      traits: { value: [], otherTags: [] },
      description: { value: "" }
    }
  };
}

/**
 * Item types the PF2e system allows on character actors. Mirrors builder.mjs's
 * NPC_ITEM_TYPES safety net — anything else embedded on a character actor
 * breaks the sheet.
 */
const CHARACTER_ITEM_TYPES = new Set([
  "ancestry", "heritage", "background", "class", "feat", "action", "lore",
  "spell", "spellcastingEntry", "weapon", "armor", "equipment", "consumable", "ammo",
  "treasure", "backpack", "shield", "kit", "condition", "effect", "deity"
]);

/**
 * Uuids and names of the feats ancestry, heritage and background grant
 * natively. A class path must never reserve one of these for its own choice.
 */
function abcGrantExclusions(docs) {
  const grants = [];
  for (const doc of docs) {
    const docItems = doc?.system?.items;
    if (docItems && typeof docItems === "object") {
      for (const entry of Object.values(docItems)) {
        if (typeof entry?.uuid === "string" && entry.uuid) grants.push(entry.uuid);
        if (typeof entry?.name === "string" && entry.name) grants.push(entry.name);
      }
    }
  }
  return grants;
}

/**
 * Core skill ranks a stored skill plan proves at `level`, over `base` (the
 * ABC and class-path floors). Same rule as pc-projection.mjs's ranksAt.
 */
function projectedSkillRanks(skillPlan, base, level) {
  const ranks = Object.fromEntries(CORE_SKILLS.map((slug) => [slug, base[slug] ?? 0]));
  for (const slug of skillPlan.training ?? []) {
    if ((skillPlan.trainingLevels?.[slug] ?? 1) <= level) ranks[slug] = Math.max(ranks[slug], 1);
  }
  for (const event of skillPlan.events ?? []) {
    if (event.level <= level && event.slug in ranks) ranks[event.slug] = Math.max(ranks[event.slug], event.rank);
  }
  return ranks;
}

/**
 * Every real name this concept already committed to, used by choice-set.mjs's
 * middle-priority policy step: a ChoiceSet option the character was already
 * given (a clan weapon in its equipment, a named feat) beats the deterministic
 * first-option fallback.
 */
function conceptChoiceNames(concept, resolved) {
  return [
    ...(concept.equipment ?? []).map((e) => e?.name),
    ...(concept.feats ?? []),
    ...(resolved.feats ?? []).map((f) => f?.name),
    ...(concept.spellcasting?.spells ?? []).map((s) => s?.name),
    ...(concept.archetypeSpellcasting?.spells ?? []).map((s) => s?.name),
    ...(concept.focusSpells ?? []).map((s) => s?.name),
    resolved.ancestryDoc?.name,
    resolved.heritageDoc?.name,
    resolved.backgroundDoc?.name,
    resolved.classDoc?.name
  ].filter((n) => typeof n === "string" && n.length);
}

/**
 * Walk every item source about to be embedded and pre-answer its ChoiceSet
 * rules (and, one level down, the ChoiceSets of items its GrantItem rules
 * grant) to reduce prompts during createEmbeddedDocuments(). Native prompts
 * can still open for unresolved choices and choices on deeper ABC grant paths.
 *
 * Fail-open by design — see choice-set.mjs's header. Ambiguous, dynamic, and
 * unanswered choices remain native rather than being guessed.
 */
async function preresolveChoiceSets(itemSources, concept, resolved, keyAbility, selectChoices) {
  const context = { keyAbility, names: conceptChoiceNames(concept, resolved) };
  const config = CONFIG?.PF2E ?? {};
  const cache = new Map();
  const loadItemSource = async (uuid) => {
    if (cache.has(uuid)) return cache.get(uuid);
    let source = null;
    try {
      const doc = await fromUuid(uuid);
      source = doc?.toObject?.() ?? null;
    } catch { source = null; }
    cache.set(uuid, source);
    return source;
  };

  await preselectChoiceSets(itemSources, context, config, loadItemSource, selectChoices);
}

/**
 * Ground AI spell picks: an issued candidate reference wins; otherwise a name
 * match (never under exactContent, which allows only issued references).
 * @returns {Promise<{spell: object, entry: object|null}[]>}
 */
async function groundSpellPicks(picks, { exactContent = false } = {}) {
  const grounded = [];
  for (const spell of Array.isArray(picks) ? picks : []) {
    const entry = isIssuedCandidate(spell.candidate, getPacksFor("spells"))
      ? spell.candidate : (exactContent ? null : await findEntry(getPacksFor("spells"), spell.name, (e) => e.type === "spell"));
    grounded.push({ spell, entry });
  }
  return grounded;
}

/** Document identity for spell de-duplication. Bare `_id`s collide across packs. */
function spellIdentity(doc, entry) {
  return doc?.uuid ?? entry?.uuid ?? (entry?.packId && entry?._id ? `${entry.packId}:${entry._id}` : null);
}

/**
 * Resolve one Technomancer cache spell by its exact name in sf2e.spells
 * (pc-support TECHNOMANCER_LANGUAGE_CACHE). Fail closed: a disabled pack, a
 * name miss, a non-spell, or a base rank other than the cited rank warns and
 * yields null.
 */
async function resolveCacheSpell({ rank, name }) {
  if (!getPacksFor("spells").includes("sf2e.spells")) {
    console.warn(`simplysf2e | sf2e.spells is not an enabled spell source — cache spell "${name}" not added`);
    return null;
  }
  const entry = await findEntry(["sf2e.spells"], name, (e) => e.type === "spell" && e.name === name);
  const doc = entry ? await getDocument(entry) : null;
  const data = doc ? toItemData(doc) : null;
  if (!data || data.type !== "spell" || data.name !== name || data.system?.level?.value !== rank) {
    console.warn(`simplysf2e | cache spell "${name}" (rank ${rank}) not found in sf2e.spells as a rank ${rank} spell — not added`);
    return null;
  }
  return { entry, doc, data };
}

/**
 * One spellcasting entry and the spell documents it owns. The class entry and
 * an archetype (dedication) entry both come through here, so each keeps its
 * own counts, caps and tradition; nothing is merged between them.
 *  - spontaneous: each valid pick is a repertoire row at its assigned rank.
 *  - prepared: each valid pick is a daily slot; a repeated pick repeats the slot.
 *  - prepared with `plan.database` (Technomancer class): valid picks form the
 *    spell database, plus the cache spells by exact name. Daily slots are then
 *    prepared only from database spells of the same rank, in database order
 *    (cache spells first), and a shortfall warns instead of inventing a spell.
 * `profiled` is true when the class or dedication has a verified profile; then
 * trait data is required and tradition, focus/ritual and 10th-rank rules apply.
 */
async function buildSpellcastingEntry({ entryId, name, tradition, mode, ability, proficiency, profiled, plan, picks, cacheSpells = [] }) {
  const database = plan.database ?? null;
  const counts = plan.slots;
  const caps = database ? database.caps : plan.picks;
  const slots = {};
  for (const [rank, max] of Object.entries(counts)) {
    slots[`slot${rank}`] = { value: max, max, prepared: [] };
  }

  const spellSources = new Map();
  const databaseSpells = [];
  const seenDatabase = new Set();
  // The database holds the cited totals: 10 cantrips and 5 + levelUps ranked spells.
  // Per-rank caps alone would let a model exceed the total, so it is checked here.
  const databaseTotals = { cantrips: 0, ranked: 0 };
  const usedCantrips = new Set();
  const spontaneousSeen = new Set();
  const usedRanks = new Map();
  const signatureCandidates = new Map();
  for (const cache of cacheSpells) {
    const found = await resolveCacheSpell(cache);
    if (!found) continue;
    const identity = spellIdentity(found.doc, found.entry);
    if (!identity || seenDatabase.has(identity)) continue;
    seenDatabase.add(identity);
    found.data._id = foundry.utils.randomID();
    found.data.system.location = { value: entryId };
    databaseSpells.push({ rank: cache.rank, data: found.data });
  }

  for (const { spell, entry } of picks) {
    const assignedRank = spell?.rank;
    const reject = (reason) => console.warn(`simplysf2e | dropped planned spell "${spell?.name ?? entry?.name ?? "?"}": ${reason}`);
    if (typeof assignedRank !== "number" || !Number.isInteger(assignedRank) || assignedRank < 0 || assignedRank > 10 || !caps[assignedRank]) { reject("assigned rank is invalid or has no slot"); continue; }
    const doc = await getDocument(entry);
    if (!doc) { reject("could not load grounded spell"); continue; }
    const source = toItemData(doc);
    if (source.type !== "spell") { reject("grounded document is not a spell"); continue; }
    const baseRank = source.system?.level?.value;
    const traits = source.system?.traits ?? {};
    const cantrip = Array.isArray(traits.value) && traits.value.includes("cantrip");
    const traditions = Array.isArray(traits.traditions) ? traits.traditions : [];
    if (profiled && (!Array.isArray(traits.value) || !Array.isArray(traits.traditions))) { reject("missing spell trait data"); continue; }
    if (!Number.isInteger(baseRank) || baseRank < 0 || (!cantrip && baseRank > assignedRank)) { reject("base rank cannot occupy assigned rank"); continue; }
    if (cantrip !== (assignedRank === 0)) { reject("cantrip rank mismatch"); continue; }
    if ((Array.isArray(traits.value) && traits.value.includes("focus")) || source.system?.ritual) { reject("focus spells and rituals use separate casting entries"); continue; }
    if (profiled && !traditions.includes(tradition)) { reject("spell tradition does not match caster profile"); continue; }
    if (profiled && mode === "spontaneous" && assignedRank === 10 && traits.rarity !== "common") {
      reject("ordinary 10th-rank repertoire picks must be common"); continue;
    }
    const identity = spellIdentity(doc, entry);
    if (!identity) { reject("grounded spell identity is missing"); continue; }
    if (database) {
      if (seenDatabase.has(identity)) { reject("spell is already in the database"); continue; }
      if ((usedRanks.get(assignedRank) ?? 0) >= caps[assignedRank]) { reject("assigned rank is already at its pick cap"); continue; }
      const kind = assignedRank === 0 ? "cantrips" : "ranked";
      const limit = kind === "cantrips" ? database.cantrips : database.rankOne + database.levelUps;
      if (databaseTotals[kind] >= limit) { reject(`database already holds its ${limit} ${kind} spells`); continue; }
      databaseTotals[kind] += 1;
      seenDatabase.add(identity);
      source._id = foundry.utils.randomID();
      source.system.location = { value: entryId };
      databaseSpells.push({ rank: assignedRank, data: source });
      usedRanks.set(assignedRank, (usedRanks.get(assignedRank) ?? 0) + 1);
      continue;
    }
    if (assignedRank === 0 && usedCantrips.has(identity)) { reject("duplicate cantrip"); continue; }
    const key = `${identity}:${assignedRank}`;
    if (mode === "spontaneous" && spontaneousSeen.has(key)) { reject("duplicate spontaneous repertoire rank"); continue; }
    if ((usedRanks.get(assignedRank) ?? 0) >= caps[assignedRank]) { reject("assigned rank is already at its pick cap"); continue; }
    // A spontaneous repertoire can contain the same source at different
    // assigned ranks; each needs its own embedded item/location heightening.
    const sourceKey = mode === "spontaneous" ? key : identity;
    let data = spellSources.get(sourceKey);
    if (!data) {
      data = source;
      data._id = foundry.utils.randomID();
      spellSources.set(sourceKey, data);
    }
    // A cloned source can carry a stale entry or heightened location from a
    // compendium/previous embedding. Rebuild it rather than merging one.
    data.system.location = { value: entryId };
    if (mode === "spontaneous") {
      const heightenedLevel = heightenedLevelFor(data.system, assignedRank);
      if (heightenedLevel) data.system.location.heightenedLevel = heightenedLevel;
      else delete data.system.location.heightenedLevel;
      spontaneousSeen.add(key);
    } else {
      // PF2e entry/data.ts SpellPrepData; the native entry pads unused
      // positions with null IDs, and its collection casts at the slot rank.
      slots[`slot${assignedRank}`].prepared.push({ id: data._id, expended: false });
    }
    usedRanks.set(assignedRank, (usedRanks.get(assignedRank) ?? 0) + 1);
    if (spell?.signature === true) {
      if (!plan.signatureRanks.includes(assignedRank)) console.warn(`simplysf2e | ignored signature marker on "${source.name}": rank is not eligible`);
      else signatureCandidates.set(assignedRank, [...(signatureCandidates.get(assignedRank) ?? []), data]);
    } else if (spell?.signature != null && spell.signature !== false) {
      console.warn(`simplysf2e | ignored invalid signature marker on "${source.name}"`);
    }
    if (assignedRank === 0) usedCantrips.add(identity);
  }

  if (database) {
    for (const [rank, max] of Object.entries(counts)) {
      const ranked = Number(rank);
      const prepared = databaseSpells.filter((spell) => spell.rank === ranked).slice(0, max);
      if (prepared.length < max) console.warn(`simplysf2e | ${name}: ${prepared.length} of ${max} rank-${ranked} daily slots can be prepared from the database`);
      for (const { data } of prepared) slots[`slot${rank}`].prepared.push({ id: data._id, expended: false });
    }
    if (databaseSpells.length < database.size) console.warn(`simplysf2e | ${name}: database holds ${databaseSpells.length} of ${database.size} spells`);
  }
  for (const [rank, candidates] of signatureCandidates) {
    // PF2e spell/data.ts location.signature; collection.ts expands native
    // virtual casting rows from the spell's original rank, not learned rank.
    if (candidates.length === 1) candidates[0].system.location.signature = true;
    else console.warn(`simplysf2e | ignored ${candidates.length} signature markers at rank ${rank}: only one is allowed`);
  }
  const entry = {
    _id: entryId,
    name,
    type: "spellcastingEntry",
    img: systemIcon("icons/default-icons/spellcastingEntry.svg"),
    system: {
      tradition: { value: tradition },
      prepared: { value: mode, flexible: false },
      ability: { value: ability },
      proficiency: { value: proficiency },
      slots,
      spelldc: { value: 0, dc: 0, mod: 0 },
      showSlotlessLevels: { value: false }
    }
  };
  const sources = database ? databaseSpells.map((spell) => spell.data) : [...spellSources.values()];
  return { entry, sources };
}

/**
 * The one caster dedication (Mystic, Witchwarper or Technomancer) a build
 * places, with its archetype spell plan, or null. Two placed caster
 * dedications get no archetype entry. An unproven tradition (Mystic connection,
 * Witchwarper paradox: archetypeTraditionFor) or key attribute returns null
 * with a warning, never a guess. Grants: the dedication's two cantrips plus one
 * slot per rank from each placed Basic/Expert/Master <Class> Spellcasting feat
 * (archetypeSpellSlots). Proficiency is trained, or expert/master with those feats.
 * @returns {{dedication: string, mode: string, tradition: string, ability: string,
 *   proficiency: number, counts: Record<number, number>, maxRank: number} | null}
 */
export function archetypeCasterPlan(concept, resolved) {
  const placed = (resolved?.feats ?? []).filter((feat) => feat?.entry);
  const placedSlugs = new Set(placed.map((feat) => slugify(feat.name ?? "")));
  const dedications = [...placedSlugs].filter((slug) => Object.hasOwn(ARCHETYPE_CASTER_DEDICATIONS, slug));
  if (dedications.length > 1) {
    console.warn("simplysf2e | more than one caster dedication placed — archetype spellcasting skipped");
    return null;
  }
  if (dedications.length !== 1) return null;
  const dedication = dedications[0];
  const profile = ARCHETYPE_CASTER_DEDICATIONS[dedication];
  const classSlug = dedication.replace(/-dedication$/, "");
  const grants = {
    basic: placedSlugs.has(`basic-${classSlug}-spellcasting`),
    expert: placedSlugs.has(`expert-${classSlug}-spellcasting`),
    master: placedSlugs.has(`master-${classSlug}-spellcasting`)
  };
  const tradition = archetypeTraditionFor(dedication, null);
  if (!tradition) return null;
  const ability = profile.ability ?? witchwarperArchetypeAbility(resolved.abilityMods);
  if (!ability) {
    console.warn(`simplysf2e | ${dedication}: key attribute not proven — archetype spellcasting skipped`);
    return null;
  }
  const archetype = archetypeSpellSlots(concept?.level, grants);
  const counts = { 0: archetype.cantrips, ...archetype.slots };
  return {
    dedication,
    mode: profile.mode,
    tradition,
    ability,
    proficiency: grants.master ? 3 : grants.expert ? 2 : 1,
    counts,
    maxRank: Math.max(0, ...Object.keys(archetype.slots).map(Number))
  };
}

/**
 * Build the full actor + embedded item data and create the `type: "character"`
 * actor. Unlike builder.mjs's createActor() (NPC), no stats are computed here
 * — embedding real ancestry/background/class/feat/spell items with correct
 * system.build data is enough for the PF2e system's own derived-data
 * preparation to compute AC/HP/saves/proficiencies. Skill choices and verified
 * class spell plans are allocated separately; no derived-stat math is copied.
 * @param {object} [options]
 * @param {string|null} [options.img]
 * @param {(groups: object[]) => Promise<unknown>} [options.selectChoices]
 * @returns {Promise<{actor: Actor, skillReport: object}>}
 */
export async function createCharacterActor(concept, resolved, { img = null, selectChoices = null } = {}) {
  const items = [];

  // Key ability: validate the AI's pick against the class's legal options once,
  // then reuse it to drive ancestry/background free-boost preference, the class
  // item's own keyAbility.selected, the actor-level boosts, and details.keyability.
  const keyAbility = resolveKeyAbility(resolved.classDoc.system, concept.keyAbility);

  const { ranks: initialRanks, replacements } = initialSkillTraining(resolved.classDoc.system, resolved.backgroundDoc.system);
  const backgroundLore = [];

  // Assign ABC ids before embedding and preserve them with `keepId` below.
  // Generated feat slots already reference these ids, and PF2e's native
  // ABCItemPF2e.createGrantedItems() uses the same parent ids when it links
  // background/ancestry/class grants into their system locations.
  const ancestryId = foundry.utils.randomID();
  const heritageId = resolved.heritageDoc ? foundry.utils.randomID() : null;
  const backgroundId = foundry.utils.randomID();
  const classId = foundry.utils.randomID();

  // ABC boosts: without `selected` set on each item's boost slots, the system
  // applies none of them (issue #50 item 1) — set them on the cloned data.
  const ancestryData = toItemData(resolved.ancestryDoc);
  ancestryData._id = ancestryId;
  assignItemBoosts(ancestryData.system, keyAbility, concept.abilityPriorities);
  items.push(ancestryData);

  if (resolved.heritageDoc) {
    const heritageData = toItemData(resolved.heritageDoc);
    heritageData._id = heritageId;
    items.push(heritageData);
  }

  const backgroundData = toItemData(resolved.backgroundDoc);
  backgroundData._id = backgroundId;
  assignItemBoosts(backgroundData.system, keyAbility, concept.abilityPriorities);
  items.push(backgroundData);

  const classData = toItemData(resolved.classDoc);
  classData._id = classId;
  classData.system.keyAbility = { ...(classData.system.keyAbility ?? {}), selected: keyAbility };
  // Mandatory native class paths are normally re-fetched from
  // Class.system.items, where the ordinary source preselector cannot reach
  // them. Stage only a proven exact bridge before Actor.create; all remaining
  // class grants still flow through PF2e's normal class item.
  const excludeFeats = abcGrantExclusions([resolved.ancestryDoc, resolved.heritageDoc, resolved.backgroundDoc]);
  for (const feat of resolved.feats ?? []) {
    const entry = feat?.entry;
    if (!entry) continue;
    let added = false;
    if (typeof entry === "string") {
      excludeFeats.push(entry);
      added = true;
    } else if (typeof entry === "object") {
      if (typeof entry.uuid === "string" && entry.uuid) {
        excludeFeats.push(entry.uuid);
        added = true;
      } else if (entry.packId && entry._id) {
        excludeFeats.push(`Compendium.${entry.packId}.Item.${entry._id}`);
        added = true;
      } else if (entry.ref?.packId && entry.ref?._id) {
        excludeFeats.push(`Compendium.${entry.ref.packId}.Item.${entry.ref._id}`);
        added = true;
      } else if (typeof entry._stats?.compendiumSource === "string" && entry._stats.compendiumSource) {
        excludeFeats.push(entry._stats.compendiumSource);
        added = true;
      }
    }
    if (added && typeof feat.name === "string" && feat.name) {
      excludeFeats.push(feat.name);
    }
  }
  const stagedClassPaths = await stageClassPaths(classData, classId, {
    context: { keyAbility, names: conceptChoiceNames(concept, resolved) },
    selectChoices,
    excludeFeats,
    pathPlan: resolved.pathPlan ?? null
  });
  items.push(classData);
  items.push(...stagedClassPaths.items);
  const manualNotes = classManualNotes(stagedClassPaths.items);
  const classSlug = slugify(resolved.classDoc.system?.slug ?? resolved.classDoc.name);
  const focusSpells = classSlug === "technomancer"
    ? withInitialFocusSpell(resolved.focusSpells ?? [], await resolveInitialMagicHack(stagedClassPaths.items))
    : (resolved.focusSpells ?? []);

  // Background Lore: a real embedded lore item (not a system.skills entry).
  const loreNames = resolved.backgroundDoc.system?.trainedSkills?.lore;
  for (const name of Array.isArray(loreNames) ? loreNames : []) {
    if (typeof name !== "string" || !name.trim() || backgroundLore.some((entry) => slugify(entry.name) === slugify(name))) continue;
    const data = { ...loreItem(name), _id: foundry.utils.randomID() };
    backgroundLore.push(data);
    initialRanks[`lore:${data._id}`] = 1;
    items.push(data);
  }

  // Feats: PCs allow the real "feat" item type directly — skip builder.mjs's
  // featToAction() NPC-only conversion entirely for this path. Each feat's
  // system.location must be the SLOT id ("<group>-<level>", e.g. "ancestry-1")
  // and system.level.taken the slot level, or the system's feat-slotting
  // (verified in feats/group.ts assignFeat) can't place it and dumps it into
  // Bonus feats (issue #50 item 4).
  for (const { entry, type, level, archetype = false } of resolved.feats ?? []) {
    const doc = await getDocument(entry);
    if (!doc) continue;
    const data = toItemData(doc);
    const location = featSlotLocation({ type, level, archetype });
    if (location) {
      data.system.location = location;
      data.system.level = { ...(data.system.level ?? {}), taken: level };
    }
    items.push(data);
  }

  // Spellcasting entry + explicit spell plan. Recognized Remaster classes use
  // their published profile; unsupported classes retain the legacy spontaneous
  // fallback until a source-qualified profile is added.
  const spellProfile = concept.spellcasting ? pcSpellcastingProfile(resolved.classDoc) : null;
  if (concept.spellcasting && (spellProfile || resolved.spells?.some((s) => s.entry))) {
    const plan = pcSpellPlan(concept.level, spellProfile);
    const built = await buildSpellcastingEntry({
      entryId: foundry.utils.randomID(),
      name: `${capitalized(spellProfile?.tradition ?? concept.spellcasting.tradition)} Spells`,
      tradition: spellProfile?.tradition ?? concept.spellcasting.tradition,
      mode: spellProfile?.mode ?? "spontaneous",
      ability: spellProfile?.ability ?? keyAbility,
      proficiency: 1,
      profiled: Boolean(spellProfile),
      plan,
      picks: resolved.spells ?? [],
      cacheSpells: plan.database ? technomancerCacheSpells(stagedClassPaths.items, plan.database.cacheRanks) : []
    });
    items.push(built.entry, ...built.sources);
  }

  // Caster dedication: a SEPARATE archetype entry built by the same code path,
  // never merged into the class entry. Planned only when the generator allowed
  // spellcasting (concept.archetypeSpellcasting), so a disabled concept gets none.
  const archetype = concept.archetypeSpellcasting ? archetypeCasterPlan(concept, resolved) : null;
  if (archetype) {
    const built = await buildSpellcastingEntry({
      entryId: foundry.utils.randomID(),
      name: `${capitalized(archetype.tradition)} Archetype Spells`,
      tradition: archetype.tradition,
      mode: archetype.mode,
      ability: archetype.ability,
      proficiency: archetype.proficiency,
      profiled: true,
      plan: { slots: archetype.counts, picks: archetype.counts, signatureRanks: [] },
      picks: resolved.archetypeSpells ?? []
    });
    items.push(built.entry, ...built.sources);
  }

  // Focus spells: a separate `prepared.value: "focus"` entry — how the real
  // system identifies a focus pool (spellcasting-entry/document.ts
  // isFocusPool) — with NO slots object (focus spells spend pool points, not
  // slots). Independent of the block above. The pool MAX is derived by the
  // system itself: character/document.ts resets focus.max to 0 each prep, and
  // every embedded non-cantrip focus spell adds 1 (v14-dev
  // item/spell/document.ts prepareActorData: `if (traits.has("focus") &&
  // !traits.has("cantrip")) { this.actor.system.resources.focus.max += 1; }`),
  // clamped to cap 3 in creature/document.ts. No rule is cloned: sf2e packs
  // carry no focus-max ActiveEffectLike, and one would double-count.
  let focusPoolSize = 0;
  if (focusSpells.some((s) => s.entry)) {
    const focusEntryId = foundry.utils.randomID();
    focusPoolSize = Math.min(focusSpells.filter((s) => s.entry).length, 3);
    items.push({
      _id: focusEntryId,
      name: "Focus Spells",
      type: "spellcastingEntry",
      img: systemIcon("icons/default-icons/spellcastingEntry.svg"),
      system: {
        // Real focus spells carry no tradition of their own; tag the entry
        // with the class's casting tradition only when the concept has one.
        ...(concept.spellcasting ? { tradition: { value: concept.spellcasting.tradition } } : {}),
        prepared: { value: "focus" },
        ability: { value: keyAbility },
        proficiency: { value: 1 },
        spelldc: { value: 0, dc: 0, mod: 0 },
        showSlotlessLevels: { value: false }
      }
    });
    for (const { entry } of focusSpells) {
      const doc = await getDocument(entry);
      if (!doc) continue;
      const data = toItemData(doc);
      data.system.location = { ...(data.system.location ?? {}), value: focusEntryId };
      items.push(data);
    }
  }

  // Equipment and loot (the character's starting wealth, see
  // pcStartingWealthGp) use the exact same quantity/rune/carry-state handling
  // as the NPC pipeline — shared helpers, no PC-specific copy. Equipment is
  // deduped by name (issue #64 item 3) because the AI pads a thin list by
  // repeating items; loot dedups for the same reason.
  const equipmentItems = await buildEquipmentItems(resolved.equipment, { dedup: true });
  // A compendium UUID proves the exact published document, but it is not an
  // actor-item instance identity: native grants may clone the same source.
  // Keep a transaction-local embedded id so post-native loadout updates can
  // affect only the equipment this generation supplied.
  for (const item of equipmentItems) item._id = foundry.utils.randomID();
  items.push(...equipmentItems);
  items.push(...await buildLootItems(resolved.loot));

  const safeItems = filterItemTypes(items, CHARACTER_ITEM_TYPES, "character");

  // Pre-answer resolvable ChoiceSet rule elements to reduce native
  // PickAThingPrompt dialogs. Unresolved choices and deeper ABC grant paths
  // still prompt, because a dialog beats a silently invalid item. See
  // choice-set.mjs for the fail-open selection policy.
  await preresolveChoiceSets(safeItems, concept, resolved, keyAbility, selectChoices);

  // -----------------------------------------------------------------------
  // SCHEMA NOTE — the actor `system.*` field names below were VERIFIED against
  // foundryvtt/pf2e master source (character/data.ts + document.ts) when these
  // bugs were fixed: details.keyability.value, details.biography.{backstory,
  // appearance,attitude,beliefs,likes,dislikes,allies,enemies,organizations},
  // details.{age,gender,height,weight,ethnicity,nationality}.value,
  // details.languages.{value,details}, build.attributes.boosts.{1,5,10,15,20},
  // skills.<slug>.rank,
  // attributes.hp.{value,temp}. Base spell plans are source-qualified in
  // pc-tables; unsupported profiles remain explicitly approximate. Skill
  // schedules come from class.skillIncreaseLevels, with native grant/Int data
  // inspected on detached clones. Wealth uses GM Core Table 10-10's lump sum.
  // -----------------------------------------------------------------------

  // Bonus languages: capped to the ancestry's own slot count and allowed-list
  // (issue #56.2) — the ancestry's automatic languages (e.g. Common) are
  // added separately by the system itself, not listed here (see
  // resolveLanguages's doc comment).
  const languages = resolveLanguages(concept.languages ?? [], resolved.ancestryDoc);

  const actorData = {
    name: concept.name,
    type: "character",
    // Add items after Actor creation through PF2e's Item.createDocuments
    // override. That native path recursively creates ABC grants and runs
    // ChoiceSet/GrantItem pre-create rules; embedding raw item sources here
    // bypasses it and leaves choices such as a dwarf's clan weapon invalid.
    items: [],
    system: {
      details: {
        level: { value: concept.level },
        keyability: { value: keyAbility },
        // Age/gender/height/weight/ethnicity/nationality (issue #56.1) and
        // languages (#56.2): field shapes verified against character/data.ts
        // (all plain strings under details.<field>.value except languages,
        // whose .value is the array of chosen languages beyond the
        // ancestry's automatic ones).
        age: { value: concept.age },
        gender: { value: concept.gender },
        height: { value: concept.height },
        weight: { value: concept.weight },
        ethnicity: { value: concept.ethnicity },
        nationality: { value: concept.nationality },
        languages: { value: languages, details: "" },
        // CharacterBiography has NO `.value` — the real fields (verified in
        // character/data.ts) are backstory/appearance (HTML), attitude/
        // beliefs/likes/dislikes (plain text), allies/enemies/organizations
        // (HTML). "personality"/"alignmentFlavor" map onto the closest real
        // biography fields (attitude/beliefs) — issue #56.6.
        biography: {
          backstory: toHtml(concept.backstory),
          appearance: toHtml(concept.appearance),
          attitude: concept.personality,
          beliefs: concept.alignmentFlavor,
          likes: concept.likes,
          dislikes: concept.dislikes,
          allies: toHtml(concept.allies),
          enemies: toHtml(concept.enemies),
          organizations: toHtml(concept.organizations)
        }
      },
      attributes: { hp: { temp: 0 } },
      // Focus pool starts full. Source `value` survives data prep (verified in
      // character/document.ts prepareBaseData — it keeps value, zeroes max);
      // `max` is derived by the system: +1 per embedded non-cantrip focus spell.
      resources: { focus: { value: focusPoolSize } },
      build: {
        attributes: {
          // Not manual entry — we want the boosts below (and the ABC-item
          // boosts) applied by the system to derive ability scores.
          manual: false,
          boosts: assignAbilityBoosts(keyAbility, concept.abilityPriorities)
        }
      },
      skills: {}
    },
    prototypeToken: {
      actorLink: true,
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER
    }
  };
  if (img) {
    actorData.img = img;
    actorData.prototypeToken.texture = { src: img };
  }

  const actor = await Actor.create(actorData);
  let skillPlan = null;
  let initialIntelligence = null;
  let seededSourceRanks = {};
  const skillWarnings = [];
  let loadoutWarnings = [];
  const loreIds = backgroundLore.map((item) => item._id);
  const planSkills = (snapshot, previous = null) => allocateCharacterSkills({
    ...snapshot, level: concept.level, initialRanks, initialIntelligence,
    additional: classData.system.trainedSkills?.additional, replacements,
    increaseLevels: classData.system.skillIncreaseLevels?.value,
    priorities: concept.skillPriorities, keyAbility, previous
  });
  // These clones only prepare native data: no document writes, preCreate,
  // grant expansion, or rule-source edits. Clear only sources we still own.
  const skillCloneData = (plan, previous) => {
    const patch = {};
    for (const slug of CORE_SKILLS) {
      const current = actor._source.system.skills?.[slug]?.rank ?? 0;
      const owned = current === (seededSourceRanks[slug] ?? 0);
      patch[`system.skills.${slug}.rank`] = Math.max(owned ? 0 : current, plan?.sourceRanks[slug] ?? 0);
    }
    const clonedItems = actor.toObject().items;
    for (const item of clonedItems) {
      if (!loreIds.includes(item._id)) continue;
      const key = `lore:${item._id}`;
      const current = item.system.proficient.value;
      const owned = current === (previous?.sourceRanks[key] ?? 1);
      item.system.proficient.value = Math.max(owned ? 1 : current, plan?.sourceRanks[key] ?? 1);
    }
    return { ...patch, items: clonedItems };
  };
  try {
    // Seed legal preferences before PF2e evaluates skill-dependent ChoiceSets.
    let previewSnapshot;
    try {
      const firstLevel = actor.clone({
        items: safeItems.filter((item) => ["ancestry", "background", "class", "heritage"].includes(item.type)),
        "system.details.level.value": 1
      }, { keepId: true });
      initialIntelligence = firstLevel.system.abilities.int.base;
      const preview = actor.clone({ items: safeItems }, { keepId: true });
      previewSnapshot = characterSkillSnapshot(preview, loreIds);
      skillPlan = planSkills(previewSnapshot);
    } catch (err) {
      console.warn("simplysf2e | could not inspect provisional native skills", err);
      skillWarnings.push("native-data");
    }
    if (skillPlan) {
      // Fixed ABC training also needs source ranks now: PF2e's preCreate
      // item preparation does not refresh numeric skill roll options.
      seededSourceRanks = Object.fromEntries(CORE_SKILLS.filter((slug) => !previewSnapshot.blocked.includes(slug))
        .map((slug) => [slug, Math.max(previewSnapshot.nativeRanks[slug] ?? 0, skillPlan.sourceRanks[slug] ?? 0)]));
      const coreUpdates = Object.fromEntries(Object.entries(seededSourceRanks).filter(([, rank]) => rank > 0)
        .map(([slug, rank]) => [`system.skills.${slug}.rank`, rank]));
      const projected = actor.clone({ items: safeItems, ...coreUpdates }, { keepId: true });
      const projection = characterSkillSnapshot(projected, loreIds);
      if (CORE_SKILLS.some((slug) => projection.nativeRanks[slug] !== Math.max(
        previewSnapshot.nativeRanks[slug], seededSourceRanks[slug] ?? 0))) {
        skillWarnings.push("native-rank-rule");
        skillPlan = null;
        seededSourceRanks = {};
      }
      if (skillPlan) {
        if (Object.keys(coreUpdates).length) await actor.update(coreUpdates);
        for (const item of backgroundLore) item.system.proficient.value = skillPlan.sourceRanks[`lore:${item._id}`] ?? 1;
      }
    }
    // The explicit ABC ids above are referenced by feat slots. `keepId`
    // preserves them while PF2e expands and links all native granted items.
    await actor.createEmbeddedDocuments("Item", safeItems, { keepId: true });

    // Once native ABC items have supplied the real character proficiencies,
    // ready only this generation's exact equipment. This must precede commit
    // so an unexpected Foundry write failure remains inside the actor rollback.
    const loadout = await applyCharacterLoadout(actor, equipmentItems);
    loadoutWarnings = loadout.warnings;

    // Refund overlaps only when the native floor supplies the old rank.
    // Confirm the real projected result is monotonic before applying it.
    let finalSkillData = null;
    if (skillPlan) {
      let snapshot;
      try {
        const native = actor.clone(skillCloneData(null, skillPlan), { keepId: true });
        snapshot = characterSkillSnapshot(native, loreIds);
      } catch (err) {
        console.warn("simplysf2e | could not inspect final native skills", err);
        skillWarnings.push("native-data");
      }
      if (snapshot) {
        const finalPlan = planSkills(snapshot, skillPlan);
        const data = skillCloneData(finalPlan, skillPlan);
        const projected = actor.clone(data, { keepId: true });
        const before = characterSkillSnapshot(actor, loreIds);
        const after = characterSkillSnapshot(projected, loreIds);
        const changedUnexpectedly = Object.keys(after.nativeRanks).some((slug) =>
          after.nativeRanks[slug] < before.nativeRanks[slug]
          || after.nativeRanks[slug] !== Math.max(snapshot.nativeRanks[slug], finalPlan.sourceRanks[slug] ?? 0));
        if (changedUnexpectedly) {
          skillWarnings.push("native-rank-rule");
          skillWarnings.push(...finalPlan.warnings);
        } else {
          skillPlan = finalPlan;
          finalSkillData = data;
        }
      }
    }

    if (finalSkillData) {
      const loreUpdates = finalSkillData.items.filter((item) => loreIds.includes(item._id))
        .filter((item) => item.system.proficient.value !== actor.items.get(item._id)?.system.proficient.value)
        .map((item) => ({ _id: item._id, "system.proficient.value": item.system.proficient.value }));
      if (loreUpdates.length) await actor.updateEmbeddedDocuments("Item", loreUpdates);
      const { items: _items, ...skillUpdates } = finalSkillData;
      const changedSkills = Object.fromEntries(Object.entries(skillUpdates).filter(([path, rank]) =>
        (actor._source.system.skills?.[path.split(".")[2]]?.rank ?? 0) !== rank));
      if (Object.keys(changedSkills).length) await actor.update(changedSkills);
    }

    // PF2e's ItemPF2e._preCreate adjusts current HP for each incoming ABC item
    // from the actor's then-current derived HP. A newly empty actor can be
    // clamped before all grants finish, so fill this one new character from
    // the system-derived maximum after awaited native item creation completes.
    // This does not await detached onCreate updates from other rules/modules.
    const hpMax = actor?.system?.attributes?.hp?.max;
    if (typeof hpMax !== "number" || !Number.isFinite(hpMax) || hpMax <= 0) {
      throw new Error("simplysf2e | character creation produced no usable derived HP maximum");
    }

    // Int-modifier bonus languages (issue #64 item 1): the character gets
    // extra language slots equal to their Intelligence modifier on top of the
    // ancestry's own count. Int is read from the system's own derived data
    // after native creation rather than re-deriving the boost math here.
    const updates = { "system.attributes.hp.value": hpMax };
    const intMod = Number(actor?.system?.abilities?.int?.mod) || 0;
    if (intMod > 0) {
      const withBonus = resolveLanguages(concept.languages ?? [], resolved.ancestryDoc, intMod);
      if (withBonus.length > languages.length) {
        updates["system.details.languages.value"] = withBonus;
      }
    }

    await actor.update(updates);
  } catch (err) {
    // Character creation is one operation from the user's perspective. Do
    // not leave an empty or partially populated Actor behind on failure.
    try { await actor.delete(); }
    catch (cleanupErr) {
      console.error("simplysf2e | failed to roll back incomplete character", cleanupErr);
      // The generator owns retryability. Carry the surviving actor out with
      // the original error so it can discard the draft instead of duplicating
      // this partially-created character on a retry.
      err.simplySF2eRollbackActor = actor;
    }
    throw err;
  }

  // Reporting is presentation-only: a read failure must not roll back a
  // successfully finalized character or leave a retryable generator draft.
  let rows = [];
  try {
    const snapshot = characterSkillSnapshot(actor, loreIds);
    rows = Object.entries(snapshot.nativeRanks).filter(([, rank]) => Number.isInteger(rank) && rank > 0)
      .map(([slug, rank]) => ({ slug, rank, name: snapshot.lore.find((entry) => entry.key === slug)?.name ?? null }));
    // Feat prerequisites were proven against projected ranks. A native rule
    // can block module training, so any projected rank above the created
    // actor's real rank means a feat may have been planned without its skill.
    if (resolved.skillPlan) {
      const base = { ...initialRanks };
      for (const planned of Object.values(resolved.pathPlan ?? {})) {
        for (const [slug, rank] of Object.entries(planned?.skills ?? {})) base[slug] = Math.max(base[slug] ?? 0, rank);
      }
      const projected = projectedSkillRanks(resolved.skillPlan, base, concept.level);
      if (CORE_SKILLS.some((slug) => projected[slug] > (snapshot.nativeRanks[slug] ?? 0))) {
        skillWarnings.push("projection-mismatch");
      }
    }
  } catch { skillWarnings.push("native-data"); }
  const warnings = [...new Set([...skillWarnings, ...(skillPlan?.warnings ?? [])])];
  for (const warning of warnings) console.warn(`simplysf2e | character skill review: ${warning}`);
  return { actor, manualNotes, expectedItems: [...safeItems, ...stagedClassPaths.expectedPaths], skillReport: { rows, warnings, loadoutWarnings, automatic: skillPlan?.automatic ?? !normalizeSkillPriorities(concept.skillPriorities).length,
    trainingBudget: skillPlan?.trainingBudget ?? null, unspentTraining: skillPlan?.unspentTraining ?? null,
    unspentIncreases: skillPlan?.unspentIncreases ?? null } };
}
