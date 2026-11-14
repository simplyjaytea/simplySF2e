// Shared pieces for the fixtures. Context shapes are copied from the real
// _prepareContext() method and the builders in scripts/generator-context/;
// the pure functions those call (computeStats, adjustedStats, createProgress, ...) are
// imported from the module itself so the numbers are the real ones.
// Update the matching fixture whenever one of those methods changes. The
// harness reports any root key a template reads that a fixture lacks.
import { normalizeConcept, computeStats, adjustedStats } from "../../../scripts/builder.mjs";
import { applyStep, createProgress, progressView } from "../../../scripts/progress.mjs";
import { localize } from "../render.mjs";

export { normalizeConcept, computeStats, adjustedStats, createProgress, localize };

export const RARITIES = [
  { value: "common", label: "SIMPLYSF2E.Rarity.Common" },
  { value: "uncommon", label: "SIMPLYSF2E.Rarity.Uncommon" },
  { value: "rare", label: "SIMPLYSF2E.Rarity.Rare" },
  { value: "unique", label: "SIMPLYSF2E.Rarity.Unique" }
];

/** Mirrors the provider fields both _prepareContext() methods share. */
export function providerContext(overrides = {}) {
  return {
    apiKeyWarning: null,
    providerBaseUrl: "https://openrouter.ai/api/v1",
    provider: { id: "openrouter", name: "OpenRouter", local: false, model: "anthropic/claude-sonnet-5" },
    connectionName: "OpenRouter",
    connections: [{ id: "c1", name: "OpenRouter", active: true }],
    canSwitchConnection: false,
    providerReady: true,
    canAuthorizeApiKey: false,
    model: "anthropic/claude-sonnet-5",
    lastRunCost: null,
    tokenReport: null,
    ...overrides
  };
}

/** The key-needs-attention strip. */
export const PROVIDER_ATTENTION = {
  apiKeyWarning: localize("SIMPLYSF2E.Generator.ApiKeyNotAuthorized"),
  providerReady: false,
  canAuthorizeApiKey: true
};

export const TOKEN_REPORT = {
  steps: [
    { label: "Concept", text: "1,204 prompt + 612 completion = 1,816 tokens" },
    { label: "Equipment", text: "820 tokens · Jev, 0.8 s" }
  ],
  totalText: "Total: 2,716 tokens",
  costText: null
};

/** Token report with a provider-reported run cost (OpenRouter). */
export const TOKEN_REPORT_COST = { ...TOKEN_REPORT, costText: "Cost: $0.0042" };

/** Token report where some requests reported no cost: approximate, labeled partial. */
export const TOKEN_REPORT_PARTIAL = {
  ...TOKEN_REPORT,
  costText: "Cost: at least $0.0042 (some requests reported no cost)"
};

/** Step durations the preview clock advances by (ms): one per tier of formatElapsed. */
const PREVIEW_STEP_MS = [800, 12000, 65000, 4300, 2100];

/**
 * Progress card context as the apps build it: the real createProgress()/
 * applyStep() on a fake clock (each finished step took PREVIEW_STEP_MS[i]),
 * then progressView() for the per-step `elapsed` and `totalElapsed`.
 */
export function progressAt(defs, activeIndex, extra = {}) {
  let clock = 0;
  const progress = createProgress(defs, { now: () => clock });
  for (let index = 0; index <= activeIndex && index < progress.steps.length; index += 1) {
    if (index > 0) clock += PREVIEW_STEP_MS[(index - 1) % PREVIEW_STEP_MS.length];
    applyStep(progress.steps, progress.steps[index].key);
  }
  return progressView({ ...progress, ...extra });
}

export const MONSTER_STEPS = [
  ["concept", "Drafting the concept"],
  ["spells", "Choosing spells"],
  ["abilities", "Matching abilities"],
  ["feats", "Matching feats"],
  ["equipment", "Outfitting"],
  ["loot", "Rolling loot"],
  ["match", "Matching the compendium"]
];

/** A raw AI concept in scale words, as normalizeConcept() expects it. */
export function rawConcept(overrides = {}) {
  return {
    name: "Rift-Scarred Vanguard",
    level: 4,
    rarity: "common",
    size: "medium",
    blurb: "A mercenary half-fused with a failing warp lattice.",
    description: "Its armor hums where it meets the lattice. Anyone who watches it fight long enough starts to hear the hum too.",
    abilityScales: { str: "high", dex: "moderate", con: "high", int: "low", wis: "moderate", cha: "low" },
    acScale: "high",
    hpScale: "high",
    perceptionScale: "moderate",
    saveScales: { fortitude: "high", reflex: "moderate", will: "low" },
    speeds: [{ type: "land", value: 25 }],
    senses: [{ type: "darkvision", acuity: "precise" }],
    languages: ["Common", "Kalo"],
    skills: [{ name: "Athletics", scale: "high" }, { name: "Intimidation", scale: "moderate" }],
    strikes: [
      { name: "Lattice Blade", type: "melee", attackScale: "high", damageScale: "high", damageType: "slashing", traits: ["agile", "forceful"] },
      { name: "Rail Pistol", type: "ranged", attackScale: "moderate", damageScale: "moderate", damageType: "piercing", traits: ["range increment 60 feet"] }
    ],
    specialAbilities: [],
    feats: [],
    equipment: [],
    loot: [],
    traits: ["humanoid", "human"],
    resistances: [],
    weaknesses: [],
    immunities: [],
    ...overrides
  };
}

export function concept(overrides = {}, input = {}) {
  const raw = rawConcept(overrides);
  const warn = console.warn;
  console.warn = () => {};
  let normalized;
  try { normalized = normalizeConcept(raw, { level: raw.level, rarity: raw.rarity, ...input }); }
  finally { console.warn = warn; }
  // normalizeConcept validates strike traits against the live system's trait
  // list, which does not exist under Node and would drop them all.
  normalized.strikes.forEach((strike, i) => { strike.traits = raw.strikes[i]?.traits ?? []; });
  return normalized;
}
