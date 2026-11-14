// The character preview, its skill report and the archetype placement context the
// Generator renders and checks against. Moved out of generator-app.mjs unchanged
// (T-P4): pure functions of the concept and its resolved picks.
import { slugify } from "../builder.mjs";
import { normalizeSkillPriorities, skillPriorityOrder, initialSkillTraining } from "../pc-skills.mjs";
import { ABILITY_KEYS, projectAttributeModifiers, projectSkillRanks } from "../pc-projection.mjs";
import { COMPLETE_PC_CLASS_SLUGS, getMulticlassDedicationSlug } from "../pc-support.mjs";
import { stagedActorContext } from "../pc-prerequisites.mjs";
import { capitalized } from "../text.mjs";
import { mapSpells, mapGear, matchSummary, unmatchedRows, pcFeatRows, emptyFeatSlots, skillName } from "./rows.mjs";

export function buildPCPreviewContext(concept, resolved) {
  if (!concept) return null;
  const ancestry = { name: resolved.ancestryDoc?.name ?? concept.ancestry, found: Boolean(resolved.ancestryDoc) };
  const heritage = concept.heritage
    ? { name: resolved.heritageDoc?.name ?? concept.heritage, found: Boolean(resolved.heritageDoc) }
    : null;
  const background = { name: resolved.backgroundDoc?.name ?? concept.background, found: Boolean(resolved.backgroundDoc) };
  const pcClass = { name: resolved.classDoc?.name ?? concept.class, found: Boolean(resolved.classDoc) };
  const feats = pcFeatRows(resolved.feats);
  const emptySlots = emptyFeatSlots(resolved);
  const spells = mapSpells(resolved.spells);
  const signatureRanks = concept.spellcasting?.signatureRanks ?? [];
  const plannedSignatures = new Set(spells.filter((spell) => spell.found && spell.signature
    && signatureRanks.includes(spell.rank)).map((spell) => spell.rank));
  const equipment = mapGear(resolved.equipment, resolved.skippedGear, "equipment");
  const loot = mapGear(resolved.loot, resolved.skippedGear, "loot");
  return {
    concept,
    multiclass: multiclassPreview(concept, resolved),
    ancestry,
    heritage,
    background,
    class: pcClass,
    skillPriorities: skillPriorityOrder(concept.skillPriorities, concept.keyAbility).order.map((slug) => ({ name: skillName(slug) })),
    automaticSkills: normalizeSkillPriorities(concept.skillPriorities).length === 0,
    spellcastingNotice: concept.spellcastingNoticeKey ? game.i18n.localize(concept.spellcastingNoticeKey) : null,
    signatureSummary: signatureRanks.length ? game.i18n.format("SIMPLYSF2E.Preview.PCSignaturePlan", {
      selected: plannedSignatures.size, total: signatureRanks.length
    }) : null,
    feats,
    emptyFeatNotice: emptySlots.length ? game.i18n.format("SIMPLYSF2E.PC.EmptyFeatSlots", {
      count: emptySlots.length, slots: emptySlots.join(", ")
    }) : null,
    spells,
    equipment,
    loot,
    unmatched: unmatchedRows({ feats, spells, equipment, loot }),
    matchSummary: matchSummary([ancestry], heritage ? [heritage] : [], [background], [pcClass],
      feats.filter((feat) => !feat.empty), spells, equipment, loot)
  };
}

/** Multiclass picker options: None, Let the AI decide, then each supported class. */
export function multiclassPickerContext(selected) {
  const options = [
    { value: "none", label: game.i18n.localize("SIMPLYSF2E.Generator.MulticlassNone") },
    { value: "ai", label: game.i18n.localize("SIMPLYSF2E.Generator.MulticlassAI") },
    ...[...COMPLETE_PC_CLASS_SLUGS].map((slug) => ({ value: slug, label: capitalized(slug) }))
  ];
  return { options: options.map((option) => ({ ...option, selected: option.value === selected })) };
}

/** Preview line for a multiclass pick; the dedication counts only when it was placed on a real feat. */
export function multiclassPreview(concept, resolved) {
  if (!concept.multiclass) return null;
  const dedicationSlug = getMulticlassDedicationSlug(concept.multiclass);
  const placed = (resolved.feats ?? []).find((feat) => feat?.entry && feat.placement !== "rejected"
    && feat.name && slugify(feat.name) === dedicationSlug);
  return { name: capitalized(concept.multiclass), dedication: placed?.name ?? null };
}

/**
 * Staged context for the archetype placement check: what the PC already has
 * at its level (ABC, class path, heritage) plus the projected ability
 * modifiers and skill ranks that resolvePCConcept proved candidates against.
 * The projection repeats pc-builder's inputs because its helpers are private.
 * Ranks and modifiers only grow with level, so the final-level context is
 * never stricter than a slot's own candidate-time context.
 */
export function archetypePlacementContext(resolved, concept) {
  const { ancestryDoc, heritageDoc, backgroundDoc, classDoc, pathPlan } = resolved;
  const keyOptions = Array.isArray(classDoc.system?.keyAbility?.value) ? classDoc.system.keyAbility.value : [];
  const keyAbility = keyOptions.includes(concept.keyAbility) ? concept.keyAbility
    : keyOptions[0] ?? (ABILITY_KEYS.includes(concept.keyAbility) ? concept.keyAbility : "str");
  const modsAt = (level) => projectAttributeModifiers({
    ancestrySystem: ancestryDoc.system, backgroundSystem: backgroundDoc.system,
    keyAbility, preferences: concept.abilityPriorities, level
  });
  const levelMods = modsAt(concept.level);
  const initialMods = modsAt(1);
  const { ranks: provenSkills } = initialSkillTraining(classDoc.system, backgroundDoc.system);
  for (const planned of Object.values(pathPlan ?? {})) {
    for (const [slug, rank] of Object.entries(planned?.skills ?? {})) {
      provenSkills[slug] = Math.max(provenSkills[slug] ?? 0, rank);
    }
  }
  const projection = levelMods && initialMods ? projectSkillRanks({
    classSystem: classDoc.system, backgroundSystem: backgroundDoc.system, provenSkills,
    intelligence: levelMods.int, initialIntelligence: initialMods.int, keyAbility,
    priorities: concept.skillPriorities, level: concept.level
  }) : null;
  const loreSkills = Object.fromEntries((Array.isArray(backgroundDoc.system?.trainedSkills?.lore)
    ? backgroundDoc.system.trainedSkills.lore : [])
    .filter((name) => typeof name === "string" && name.trim())
    .map((name) => [slugify(name), 1]));
  const features = [];
  for (const [tag, planned] of Object.entries(pathPlan ?? {})) {
    if (!planned?.name) continue;
    features.push({ name: planned.name });
    if (tag === "mechanic-exocortex") features.push({ name: `${planned.name} exocortex` });
    if (tag === "technomancer-programming-language") features.push({ name: `${planned.name} programming language` });
  }
  if (heritageDoc) features.push({ name: `${heritageDoc.name} heritage` });
  return stagedActorContext({
    level: concept.level, ancestry: ancestryDoc, heritage: heritageDoc, background: backgroundDoc, class: classDoc,
    features, skills: { ...(projection ? projection.ranksAt(concept.level) : provenSkills), ...loreSkills },
    abilities: levelMods ?? {}
  });
}

export function skillReportContext(report) {
  if (!report) return null;
  const warningKeys = {
    "native-data": "NativeData", "training-data": "TrainingData", "schedule": "Schedule",
    "grant-timing": "GrantTiming", "native-rank-rule": "NativeRule",
    "intelligence-timing": "IntelligenceTiming",
    "unspent-training": "UnspentTraining", "unspent-increases": "UnspentIncreases",
    "projection-mismatch": "ProjectionMismatch"
  };
  return {
    rows: report.rows.map((row) => ({ name: row.name ?? skillName(row.slug),
      rank: game.i18n.localize(`SIMPLYSF2E.Skills.Rank${row.rank}`) })),
    automatic: report.automatic,
    budget: report.trainingBudget !== null && report.unspentTraining !== null
      ? game.i18n.format("SIMPLYSF2E.Skills.Budget", {
        spent: report.trainingBudget - report.unspentTraining, total: report.trainingBudget
      }) : null,
    warnings: report.warnings.map((code) => {
      const key = warningKeys[code] ?? "NativeData";
      const count = code === "unspent-training" ? report.unspentTraining : report.unspentIncreases;
      return {
        title: game.i18n.format(`SIMPLYSF2E.Skills.${key}Title`, { count }),
        detail: game.i18n.format(`SIMPLYSF2E.Skills.${key}`, { count })
      };
    }),
    loadoutWarnings: (report.loadoutWarnings ?? []).map((code) => {
      const key = {
        "loadout-native-data": "NativeData", "loadout-untrained-armor": "UntrainedArmor",
        "loadout-armor-conflict": "ArmorConflict", "loadout-untrained-weapon": "UntrainedWeapon",
        "loadout-hand-conflict": "HandConflict", "loadout-manual-ammo": "ManualAmmo",
        "loadout-missing-ammo": "MissingAmmo"
      }[code] ?? "NativeData";
      return {
        title: game.i18n.localize(`SIMPLYSF2E.Loadout.${key}Title`),
        detail: game.i18n.localize(`SIMPLYSF2E.Loadout.${key}`)
      };
    })
  };
}
