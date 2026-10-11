// Treasure window. Shapes follow TreasureApp._prepareContext() and
// #buildPreviewContext() in scripts/treasure-app.mjs. Item rows are real
// sf2e 1.5.1 equipment (foundryvtt/pf2e v14-dev packs/sf2e/equipment) with the
// credit prices used by the shop fixture. The budget is level 4, one
// encounter: 680 credits (scripts/treasure.test.mjs).
import { providerContext, PROVIDER_ATTENTION, TOKEN_REPORT, progressAt, localize } from "./_shared.mjs";
import { creditsEach, treasureBudgetCredits, hoardLeftover } from "../../../scripts/treasure.mjs";

const AMOUNTS = ["encounter", "level"].map((value) => ({
  value, label: `SIMPLYSF2E.Treasure.Amount${value[0].toUpperCase()}${value.slice(1)}`
}));
const RARITIES = ["common", "uncommon", "rare"].map((value) => ({
  value, label: `SIMPLYSF2E.Rarity.${value[0].toUpperCase()}${value.slice(1)}`
}));

const STEPS = [
  ["treasureConcept", localize("SIMPLYSF2E.Treasure.ProgressConcept")],
  ["candidates", localize("SIMPLYSF2E.Treasure.ProgressCandidates")],
  ["picks", localize("SIMPLYSF2E.Treasure.ProgressPicks")],
  ["prices", localize("SIMPLYSF2E.Treasure.ProgressPrices")]
];

const PROMPT = "Abandoned corporate lab on an ice moon";

const PARTY = { name: "The Vanguard", count: 4, size: 4, level: 4 };

export function treasureContext(patch = {}) {
  const input = { prompt: "", level: 4, partySize: 4, amount: "encounter", rarity: "common", ...(patch.input ?? {}) };
  const { input: _ignored, ...rest } = patch;
  return {
    input,
    busy: false,
    canCancel: false,
    error: null,
    canReportBug: false,
    progress: null,
    ...providerContext(),
    minLevel: 1,
    maxLevel: 20,
    minParty: 1,
    maxParty: 8,
    party: PARTY,
    amounts: AMOUNTS,
    rarities: RARITIES,
    preview: null,
    tokenReport: null,
    showEmptyState: true,
    ...rest
  };
}

const row = (key, name, level, credits, rarity = null) => ({
  key, name, level, rarity, credits, price: credits.toLocaleString()
});

const ITEMS = [
  row("c-1", "Medkit (Tactical)", 3, 500),
  row("c-2", "Adrenosuppressant Serum (Commercial)", 2, 70),
  row("c-3", "Laser Pistol", 0, 30),
  row("c-4", "Battery (Tactical)", 2, 20),
  row("c-5", "Comm Unit", 1, 7)
];

const preview = (patch = {}) => {
  const budget = treasureBudgetCredits(4, "encounter");
  const items = patch.rows ?? ITEMS;
  const leftover = hoardLeftover(budget, items);
  return {
    concept: {
      name: "Cryo-lab salvage",
      description: "Frost-furred racks of sample drawers line the sealed lab. Whoever evacuated left in a hurry: a few cases are still latched, the rest were emptied in the dark.",
      keywords: ["cryo", "lab", "medical", "battery"],
      categories: ["gear", "consumables", "weapons"]
    },
    level: 4,
    rows: items.map(({ credits, ...rest }) => rest),
    hasItems: items.length > 0,
    count: items.length,
    leftover: leftover.toLocaleString(),
    hasLeftover: leftover > 0,
    budget: budget.toLocaleString(),
    each: creditsEach(budget, 4).toLocaleString(),
    partySize: 4,
    amount: "encounter",
    dropped: 0,
    ...patch,
    ...(patch.rows ? { rows: patch.rows.map(({ credits, ...rest }) => rest) } : {})
  };
};

export default [
  { id: "treasure-empty", app: "treasure", context: treasureContext() },
  { id: "treasure-empty-attention", app: "treasure", context: treasureContext({ ...PROVIDER_ATTENTION, party: null }) },
  {
    id: "treasure-busy",
    app: "treasure",
    optionalKeys: ["busyMessage"],
    context: treasureContext({
      input: { prompt: PROMPT }, busy: true, canCancel: true, showEmptyState: false,
      progress: progressAt(STEPS, 2, { phase: "writing", percent: 61, detail: "Writing…" })
    })
  },
  {
    id: "treasure-error",
    app: "treasure",
    context: treasureContext({
      input: { prompt: PROMPT }, showEmptyState: false, canReportBug: true,
      error: localize("SIMPLYSF2E.Treasure.NoCandidates")
    })
  },
  {
    id: "treasure-preview",
    app: "treasure",
    context: treasureContext({
      input: { prompt: PROMPT }, showEmptyState: false, tokenReport: TOKEN_REPORT,
      lastRunCost: "Last run: 1,870 tokens", preview: preview({ dropped: 2 })
    })
  },
  {
    id: "treasure-preview-level",
    app: "treasure",
    context: treasureContext({
      input: { prompt: PROMPT, amount: "level" }, showEmptyState: false,
      preview: (() => {
        const budget = treasureBudgetCredits(4, "level");
        const leftover = hoardLeftover(budget, ITEMS);
        return preview({
          amount: "level", budget: budget.toLocaleString(), each: creditsEach(budget, 4).toLocaleString(),
          leftover: leftover.toLocaleString(), hasLeftover: leftover > 0
        });
      })()
    })
  },
  {
    id: "treasure-all-removed",
    app: "treasure",
    context: treasureContext({
      input: { prompt: PROMPT }, showEmptyState: false,
      preview: preview({ rows: [] })
    })
  }
];
