// The encounter plan preview the Generator template renders (budget chips, one
// stat grid per member). Moved out of generator-app.mjs unchanged (T-P4): a pure
// function of the plan.
import { computeStats, adjustedStats } from "../builder.mjs";
import { gpToCredits } from "../currency.mjs";
import { signed } from "../text.mjs";

export function buildEncounterPreviewContext(encounter) {
  if (!encounter) return null;
  return {
    name: encounter.name,
    // Display-boundary thousands separators only; budget math stays numeric
    // above (overBudget comparisons use the raw values, unchanged).
    budget: Number(encounter.budget ?? 0).toLocaleString("en-US"),
    spent: Number(encounter.spent ?? 0).toLocaleString("en-US"),
    overBudget: encounter.spent > encounter.budget,
    // True when every member's count is 0: Create All has nothing to create.
    allSkipped: encounter.members.every((m) => !(m.count > 0)),
    // Internal treasure math stays in gp (applyTreasureBudget/lootValueGp);
    // only the display boundary converts to credits via the cited rate.
    treasureBudget: gpToCredits(Math.round(encounter.treasureBudget ?? 0)).toLocaleString("en-US"),
    treasureSpent: gpToCredits(encounter.treasureSpent ?? 0).toLocaleString("en-US"),
    treasureOverBudget: (encounter.treasureSpent ?? 0) > (encounter.treasureBudget ?? 0),
    members: encounter.members.map((member, index) => {
      const stats = adjustedStats(computeStats(member.concept), member.concept);
      const strike = stats.strikes[0];
      return {
        index,
        count: member.count,
        skipped: member.count === 0,
        role: `SIMPLYSF2E.Role.${member.role.charAt(0).toUpperCase()}${member.role.slice(1)}`,
        name: member.concept.name,
        level: stats.level,
        blurb: member.concept.blurb,
        stats: {
          ac: stats.ac,
          hp: stats.hp,
          perception: signed(stats.perception),
          fort: signed(stats.saves.fortitude),
          ref: signed(stats.saves.reflex),
          will: signed(stats.saves.will),
          strike: strike ? { name: strike.name, bonus: signed(strike.bonus), damage: strike.damage } : null,
          spellDC: stats.spellDC ?? null
        }
      };
    })
  };
}
