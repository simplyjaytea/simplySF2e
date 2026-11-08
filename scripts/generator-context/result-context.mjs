// The completion counts shown in the "created" panel and the recent-previews list.
// Moved out of generator-app.mjs unchanged (T-P4): pure functions of their inputs.
import { completionSummary } from "../completion.mjs";

/** Localized, count-only view of a validated completion manifest. */
export function completionContext(manifests) {
  const summary = completionSummary(manifests);
  const rows = [
    ["compendium", "SIMPLYSF2E.Generator.CompletionCompendium"],
    ["native", "SIMPLYSF2E.Generator.CompletionNative"],
    ["moduleBuilt", "SIMPLYSF2E.Generator.CompletionModuleBuilt"],
    ["customNarrative", "SIMPLYSF2E.Generator.CompletionCustomNarrative"],
    ["skipped", "SIMPLYSF2E.Generator.CompletionSkipped"],
    ["empty", "SIMPLYSF2E.Generator.CompletionEmpty"]
  ].filter(([key]) => summary[key] > 0).map(([key, label]) => ({
    text: game.i18n.format(label, { count: summary[key] })
  }));
  return { total: summary.total, rows };
}

/** One row per remembered preview, newest first. */
export function buildRecentContext(recent) {
  if (!recent.length) return null;
  const icons = {
    monster: "fa-dna", npc: "fa-id-badge", encounter: "fa-crosshairs",
    character: "fa-user-astronaut", reskin: "fa-masks-theater"
  };
  const modeKeys = { monster: "Monster", npc: "Npc", encounter: "Encounter", character: "Character", reskin: "Reskin" };
  return recent.map((entry) => {
    const mode = game.i18n.localize(`SIMPLYSF2E.Mode.${modeKeys[entry.mode]}`);
    const time = new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return {
      id: entry.id,
      mode: entry.mode,
      icon: icons[entry.mode],
      name: entry.name || game.i18n.localize("SIMPLYSF2E.Recent.Unnamed"),
      detail: Number.isFinite(entry.level)
        ? game.i18n.format("SIMPLYSF2E.Recent.Detail", { mode, level: entry.level, time })
        : game.i18n.format("SIMPLYSF2E.Recent.DetailNoLevel", { mode, time })
    };
  });
}
