// The monster / NPC preview context the Generator template renders (statblock,
// abilities, spells, feats, gear, match summary). Moved out of generator-app.mjs
// unchanged (T-P4): a pure function of the concept and its resolved picks.
import { computeStats, adjustedStats } from "../builder.mjs";
import { rerollTarget } from "../reroll.mjs";
import { signed } from "../text.mjs";
import { mapNamed, mapSpells, mapGear, matchSummary, unmatchedRows, feetText } from "./rows.mjs";

export function buildCreaturePreviewContext(concept, resolved) {
  if (!concept) return null;
  // Show what the sheet will display once pf2e applies Elite/Weak.
  const stats = adjustedStats(computeStats(concept), concept);
  // Resolved spells, feats and abilities line up 1:1 with the concept lists,
  // so a row's index is also its reroll slot.
  const rerollable = (kind, index) => Boolean(rerollTarget(concept, kind, index));
  const abilities = (resolved?.abilities ?? []).map(({ ability, entry }, index) => ({
    name: ability.name,
    fromGlossary: Boolean(entry),
    glossaryName: entry?.name ?? null,
    // A module-built area blast shows the Module-built label (no compendium source), not the narrative label.
    narrative: Boolean(ability.narrative),
    // A working area blast is module-built, not narrative-only (its own preview label).
    moduleBuilt: Boolean(ability.areaBlast || ability.aura || ability.targeted),
    description: ability.description,
    index,
    rerollable: rerollable("ability", index)
  }));
  const spells = mapSpells(resolved?.spells)
    .map((row, index) => ({ ...row, index, rerollable: rerollable("spell", index) }));
  const feats = mapNamed(resolved?.feats)
    .map((row, index) => ({ ...row, index, rerollable: rerollable("feat", index) }));
  const equipment = mapGear(resolved?.equipment, resolved?.skippedGear, "equipment");
  const loot = mapGear(resolved?.loot, resolved?.skippedGear, "loot");
  // Signed display strings live beside `stats`, never in it: stats also feeds
  // actor creation and arithmetic elsewhere.
  const display = {
    perception: signed(stats.perception),
    skills: (stats.skills ?? []).map((skill) => ({ name: skill.name, mod: signed(skill.mod) })),
    saves: {
      fortitude: signed(stats.saves?.fortitude),
      reflex: signed(stats.saves?.reflex),
      will: signed(stats.saves?.will)
    },
    strikes: (stats.strikes ?? []).map((strike) => ({ ...strike, bonusText: signed(strike.bonus) })),
    spellAttack: signed(stats.spellAttack)
  };
  return {
    concept,
    stats,
    display,
    traits: [concept.rarity !== "common" ? concept.rarity : null, concept.size, ...concept.traits].filter(Boolean),
    speeds: concept.speeds.map((s) => `${s.type} ${feetText(s.value)}`).join(", "),
    senses: concept.senses.map((s) => [s.type, s.acuity, s.range ? feetText(s.range) : null].filter(Boolean).join(" ")).join(", "),
    languages: concept.languages.join(", "),
    abilities,
    spells,
    feats,
    equipment,
    loot,
    unmatched: unmatchedRows({ spells, feats, equipment, loot }),
    matchSummary: matchSummary(
      abilities.map((a) => ({ found: a.fromGlossary, narrative: a.narrative || a.moduleBuilt })), spells, feats, equipment, loot
    ),
    iwr: {
      immunities: concept.immunities.join(", "),
      resistances: concept.resistances.map((r) => `${r} ${stats.resistanceValue}`).join(", "),
      weaknesses: concept.weaknesses.map((w) => `${w} ${stats.resistanceValue}`).join(", ")
    }
  };
}
