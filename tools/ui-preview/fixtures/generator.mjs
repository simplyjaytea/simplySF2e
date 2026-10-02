// Generator window. Shapes follow GeneratorApp._prepareContext() and the
// #build*PreviewContext() / #mapGear / #mapNamed / #mapSpells helpers in
// scripts/generator-app.mjs.
import {
  RARITIES, providerContext, PROVIDER_ATTENTION, TOKEN_REPORT, progressAt, MONSTER_STEPS,
  concept, computeStats, adjustedStats, localize
} from "./_shared.mjs";
import { signed } from "../../../scripts/text.mjs";
import { THREATS } from "../../../scripts/encounter.mjs";
import { TREASURE_AMOUNT_MULTIPLIER } from "../../../scripts/tables.mjs";

const MODE_FLAGS = (mode) => ({
  monsterMode: mode === "monster",
  npcMode: mode === "npc",
  encounterMode: mode === "encounter",
  characterMode: mode === "character",
  reskinMode: mode === "reskin"
});

const RANDOM_TOOLTIP = {
  monster: "SIMPLYSF2E.Generator.RandomTooltip",
  npc: "SIMPLYSF2E.Generator.RandomNpcTooltip",
  encounter: "SIMPLYSF2E.Generator.RandomEncounterTooltip",
  character: "SIMPLYSF2E.Generator.RandomCharacterTooltip"
};

const cap = (s) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

/** The full _prepareContext() object for a mode, empty of results. */
export function generatorContext(mode, patch = {}) {
  const input = {
    mode, prompt: "", level: 1, rarity: "common", adjustment: null, allowSpellcasting: true,
    preset: "", partySize: 4, threat: "moderate", treasureAmount: "standard", rarityCap: "unique",
    ...(patch.input ?? {})
  };
  const creatureMode = ["monster", "npc"].includes(mode);
  const { input: _ignored, ...rest } = patch;
  return {
    input,
    busy: false,
    busyMessage: null,
    canCancel: false,
    error: null,
    progress: null,
    ...providerContext(),
    sourcesReady: true,
    sourcePackCount: 10,
    sourceMissing: [],
    rarities: RARITIES,
    promptPlaceholder: `${localize("SIMPLYSF2E.Generator.PromptExample")} a cult of solar-bleached smugglers...`,
    nonePresetSelected: true,
    standardPresets: ["envoy", "mystic", "operative", "solarian", "soldier", "witchwarper"].map((id) => ({
      id, label: cap(id), selected: false
    })),
    archetypePresets: [{ id: "brute", label: "Brute", selected: false }, { id: "sneak", label: "Sneak", selected: false }],
    customPresets: [{ id: "custom1", label: "Vesk raider band", selected: false }],
    ...MODE_FLAGS(mode),
    reskinSource: null,
    reskinPreview: null,
    randomTooltipKey: RANDOM_TOOLTIP[mode] ?? RANDOM_TOOLTIP.monster,
    levelMin: creatureMode ? -1 : 1,
    levelMax: creatureMode ? 24 : 20,
    threats: Object.keys(THREATS).map((key) => ({ value: key, label: `SIMPLYSF2E.Threat.${cap(key)}`, selected: input.threat === key })),
    treasureAmounts: Object.keys(TREASURE_AMOUNT_MULTIPLIER).map((key) => ({ value: key, label: `SIMPLYSF2E.TreasureAmount.${cap(key)}`, selected: input.treasureAmount === key })),
    preview: null,
    encounterPreview: null,
    pcPreview: null,
    characterReview: null,
    created: null,
    showEmptyState: true,
    ...rest
  };
}

/** #mapNamed / #mapSpells / #mapGear row shapes. */
const named = (name, found = true) => ({ name, found });
const spell = (name, rank, found = true, signature = false) => ({ name, rank, found, signature });

/** Context of #buildPreviewContext() for a (possibly adjusted) creature concept. */
function creaturePreview(c, { abilities = [], spells = [], feats = [], equipment = [], loot = [] } = {}) {
  const stats = adjustedStats(computeStats(c), c);
  const all = [...spells, ...feats, ...equipment, ...loot];
  const total = all.length + abilities.filter((a) => !a.narrative).length;
  const matched = all.filter((i) => i.found).length + abilities.filter((a) => a.fromGlossary).length;
  // Same display object the real #buildPreviewContext() builds.
  const display = {
    perception: signed(stats.perception),
    skills: (stats.skills ?? []).map((skill) => ({ name: skill.name, mod: signed(skill.mod) })),
    saves: { fortitude: signed(stats.saves?.fortitude), reflex: signed(stats.saves?.reflex), will: signed(stats.saves?.will) },
    strikes: (stats.strikes ?? []).map((strike) => ({ ...strike, bonusText: signed(strike.bonus) })),
    spellAttack: signed(stats.spellAttack)
  };
  return {
    concept: c,
    stats,
    display,
    traits: [c.rarity !== "common" ? c.rarity : null, c.size, ...c.traits].filter(Boolean),
    speeds: c.speeds.map((s) => `${s.type} ${s.value} ft.`).join(", "),
    senses: c.senses.map((s) => [s.type, s.acuity, s.range ? `${s.range} ft.` : null].filter(Boolean).join(" ")).join(", "),
    languages: c.languages.join(", "),
    abilities, spells, feats, equipment, loot,
    matchSummary: total ? { matched, total, text: localize("SIMPLYSF2E.Preview.MatchSummary", { matched, total }) } : null,
    iwr: {
      immunities: c.immunities.join(", "),
      resistances: c.resistances.map((r) => `${r} ${stats.resistanceValue}`).join(", "),
      weaknesses: c.weaknesses.map((w) => `${w} ${stats.resistanceValue}`).join(", ")
    }
  };
}

const RICH = {
  abilities: [
    { name: "Lattice Surge", fromGlossary: false, glossaryName: null, narrative: false, description: "The vanguard's blade flares; each creature within 10 feet takes 2d6 force damage (basic Reflex save)." },
    { name: "Shield Wall", fromGlossary: true, glossaryName: "Shield Block", narrative: false, description: "" },
    { name: "Hums With the Lattice", fromGlossary: false, glossaryName: null, narrative: true, description: "Flavor only: the vanguard is always faintly audible." }
  ],
  spells: [spell("Force Barrage", 1), spell("Mystic Armor", 1, false)],
  feats: [named("Sudden Charge"), named("Lattice Reflex", false)],
  equipment: [named("Tactical Plate Armor ×1"), named("Plasma Rifle (commercial)", false)],
  loot: [named("Credstick (120 credits)"), named("Scroll of Mage Armor (Rank 1)")]
};

export default [
  ...["monster", "npc", "encounter", "character", "reskin"].map((mode) => ({
    id: `generator-empty-${mode}`,
    app: "generator",
    context: generatorContext(mode, { input: { level: mode === "character" ? 3 : 4 } })
  })),
  {
    id: "generator-empty-attention",
    app: "generator",
    context: generatorContext("monster", { ...PROVIDER_ATTENTION, sourcesReady: false, sourceMissing: ["spells", "feats"] })
  },
  {
    id: "generator-two-connections",
    app: "generator",
    context: generatorContext("monster", {
      canSwitchConnection: true,
      connections: [{ id: "c1", name: "OpenRouter", active: true }, { id: "c2", name: "Home Ollama with a long profile name", active: false }]
    })
  },
  {
    id: "generator-busy-progress",
    app: "generator",
    context: generatorContext("monster", {
      input: { level: 4, prompt: "A mercenary half-fused with a failing warp lattice" },
      busy: true, canCancel: true, showEmptyState: false,
      progress: progressAt(MONSTER_STEPS, 2, { phase: "writing", percent: 38, detail: "Writing… ≈ 640 tokens" })
    })
  },
  {
    id: "generator-busy-no-progress",
    app: "generator",
    context: generatorContext("monster", { busy: true, busyMessage: "Creating the actor…", showEmptyState: false })
  },
  {
    id: "generator-error",
    app: "generator",
    context: generatorContext("monster", {
      input: { prompt: "A very long prompt that failed" },
      error: "The provider returned HTTP 429: rate limit reached for model anthropic/claude-sonnet-5. Try again in a moment.",
      showEmptyState: false
    })
  },
  (() => {
    const c = concept({ rarity: "uncommon", specialAbilities: [], resistances: ["fire"], weaknesses: ["cold-iron"] });
    return {
      id: "generator-monster-preview",
      app: "generator",
      context: generatorContext("monster", {
        input: { level: 4 }, showEmptyState: false, tokenReport: TOKEN_REPORT,
        lastRunCost: "Last run: 2,716 tokens",
        preview: creaturePreview({ ...c, spellcasting: { tradition: "arcane", dcScale: "moderate", attackScale: "moderate" } }, RICH)
      })
    };
  })(),
  (() => {
    // Level -1, terrible scales, Weak adjustment: Perception, saves and skills go
    // negative, which is what the "+-1" bug shows. The strike bonus cannot: the
    // lowest cited attack bonus at level -1 is +4, so Weak gives +2.
    const c = concept({
      name: "Weak Scrap Drone With A Deliberately Overlong Name For Wrapping Checks",
      level: -1,
      acScale: "low", hpScale: "low", perceptionScale: "terrible",
      saveScales: { fortitude: "terrible", reflex: "terrible", will: "terrible" },
      skills: [{ name: "Stealth", scale: "low" }],
      strikes: [{ name: "Cutting Claw", type: "melee", attackScale: "low", damageScale: "low", damageType: "slashing", traits: [] }],
      traits: ["construct"], languages: [], senses: [], size: "tiny"
    }, { level: -1 });
    return {
      id: "generator-npc-negative",
      app: "generator",
      context: generatorContext("npc", {
        input: { level: -1, adjustment: "weak" }, showEmptyState: false,
        preview: creaturePreview({ ...c, adjustment: "weak" })
      })
    };
  })(),
  (() => {
    const mk = (over, level) => concept(over, { level });
    const members = [
      { count: 1, role: "boss", concept: mk({ name: "Warden Ixtl", level: 6, strikes: [{ name: "Gravity Maul", type: "melee", attackScale: "high", damageScale: "high", damageType: "bludgeoning", traits: [] }] }, 6), blurb: "A rift warden." },
      { count: 3, role: "minion", concept: mk({ name: "Weak Scrap Drone", level: -1, adjustment: "weak", perceptionScale: "terrible", saveScales: { fortitude: "terrible", reflex: "terrible", will: "terrible" }, strikes: [{ name: "Claw", type: "melee", attackScale: "low", damageScale: "low", damageType: "slashing", traits: [] }] }, -1), blurb: "Scrap with opinions." },
      { count: 0, role: "minion", concept: mk({ name: "Skipped Medic", level: 3 }, 3), blurb: "" }
    ];
    const rows = members.map((member, index) => {
      const stats = adjustedStats(computeStats(member.concept), member.concept);
      const strike = stats.strikes[0];
      const t = (key) => localize(`SIMPLYSF2E.Preview.${key}`);
      return {
        index, count: member.count, skipped: member.count === 0,
        role: `SIMPLYSF2E.Role.${cap(member.role)}`,
        name: member.concept.name, level: stats.level, blurb: member.blurb,
        // Same string the real #buildEncounterPreviewContext() assembles.
        statline: `${t("AC")} ${stats.ac}, ${t("Fort")} ${signed(stats.saves.fortitude)}, ${t("Ref")} ${signed(stats.saves.reflex)}, ${t("Will")} ${signed(stats.saves.will)}, ${t("HP")} ${stats.hp}, ${t("PerceptionShort")} ${signed(stats.perception)}`
          + (strike ? `, ${strike.name} ${signed(strike.bonus)} (${strike.damage})` : "")
          + (stats.spellDC ? `, ${t("Spells")} ${t("DC")} ${stats.spellDC}` : "")
      };
    });
    return {
      id: "generator-encounter-preview",
      app: "generator",
      context: generatorContext("encounter", {
        input: { level: 4 }, showEmptyState: false, tokenReport: TOKEN_REPORT,
        encounterPreview: {
          name: "Ambush at the Failing Lattice", budget: "120", spent: "135", overBudget: true,
          treasureBudget: "2,800", treasureSpent: "1,200", treasureOverBudget: false, members: rows
        }
      })
    };
  })(),
  (() => {
    const pcConcept = { name: "Kess Vandrel", level: 3, blurb: "A disgraced envoy who still believes in the mission.", spellcasting: { tradition: "occult" }, backstory: "Kess left the Pact Worlds diplomatic corps after a treaty she negotiated was used as cover for a raid." };
    return {
      id: "generator-character-preview",
      app: "generator",
      context: generatorContext("character", {
        input: { level: 3 }, showEmptyState: false, tokenReport: TOKEN_REPORT,
        pcPreview: {
          concept: pcConcept,
          ancestry: named("Human"), heritage: named("Skilled Heritage Human", false), background: named("Diplomatic Attaché"), class: named("Envoy"),
          skillPriorities: [{ name: "Diplomacy" }, { name: "Society" }, { name: "Intimidation" }],
          automaticSkills: false,
          spellcastingNotice: "Spellcasting data for this class is incomplete in the installed system; spells were picked best-effort.",
          signatureSummary: localize("SIMPLYSF2E.Preview.PCSignaturePlan", { selected: 1, total: 2 }),
          feats: [named("Nimble Dodge"), named("Hobnobber", false)],
          spells: [spell("Telepathic Bond", 2, true, true), spell("Soothe", 1, false)],
          equipment: [named("Tactical Pistol (commercial)"), named("Explorer's Clothing", false)],
          loot: [named("Credstick (300 credits)")],
          matchSummary: { matched: 7, total: 10, text: localize("SIMPLYSF2E.Preview.MatchSummary", { matched: 7, total: 10 }) }
        }
      })
    };
  })(),
  {
    id: "generator-character-review",
    app: "generator",
    context: generatorContext("character", {
      input: { level: 3 }, showEmptyState: false,
      characterReview: {
        actorId: "a1", actorName: "Kess Vandrel", incomplete: true,
        choices: [{ itemName: "Skilled Heritage", prompt: "SIMPLYSF2E.Generator.ReviewHint" }],
        skills: {
          rows: [{ name: "Diplomacy", rank: "Expert" }, { name: "Society", rank: "Trained" }],
          automatic: false, budget: "Training: 5 of 6 spent",
          warnings: ["1 unspent skill training remains."],
          loadoutWarnings: ["Tactical Pistol: untrained in this weapon."]
        }
      }
    })
  },
  {
    id: "generator-created",
    app: "generator",
    context: generatorContext("monster", {
      showEmptyState: false, tokenReport: TOKEN_REPORT,
      created: {
        name: "Rift-Scarred Vanguard", actorId: "x1", count: 1,
        grounding: { total: 9, rows: [{ text: "6 from the compendium" }, { text: "2 built by the module" }, { text: "1 narrative only" }] }
      }
    })
  },
  {
    id: "generator-reskin-empty",
    app: "generator",
    context: generatorContext("reskin", {})
  },
  (() => {
    const source = { uuid: "Actor.abc", name: "Kasatha Warlord of the Seventh Lattice Remnant", img: "", level: 8 };
    return {
      id: "generator-reskin-dropped",
      app: "generator",
      context: generatorContext("reskin", {
        input: { prompt: "Make it a smuggler captain of a derelict freighter" }, reskinSource: source
      })
    };
  })(),
  (() => {
    const source = { uuid: "Actor.abc", name: "Kasatha Warlord", img: "", level: 8 };
    return {
      id: "generator-reskin-preview",
      app: "generator",
      context: generatorContext("reskin", {
        reskinSource: source, showEmptyState: false, tokenReport: TOKEN_REPORT,
        reskinPreview: {
          name: "Captain Voss of the Derelict", level: 8, sourceName: "Kasatha Warlord",
          blurb: "A smuggler captain who holds a dead freighter together by reputation.",
          readAloud: "The airlock groans open. Behind it, a four-armed woman in a salvaged flight coat is already smiling.",
          paragraphs: ["Voss never fires first. She talks until the other side blinks.", "Her crew would die for her, mostly because they owe her money."],
          recallKnowledge: "DC 22 Society: Voss has outrun three blockades and sold the maps afterward.",
          renames: [{ from: "Warlord's Banner", name: "Captain's Pennant" }, { from: "Halberd", name: "Boarding Hook" }]
        }
      })
    };
  })()
];
