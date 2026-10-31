// Fixed, realistic arguments for each measurable task. The matrix measures the
// model, not the prompt, so these must exercise the real production signature:
// a wrong shape would show up as a model failure instead of a matrix bug.
// scripts/model-matrix.test.mjs calls every entry and fails on a TypeError.
import { SHOP_CATEGORIES } from "../../scripts/shop.mjs";

const shopCategories = Object.keys(SHOP_CATEGORIES);

export const TASKS = {
  creatureConcept: {
    fn: "generateConcept",
    args: { prompt: "a vesk siege marshal holding a breached station", level: 5, rarity: "common", allowSpellcasting: false, intent: "monster" }
  },
  pcConcept: {
    fn: "generatePCConcept",
    args: { prompt: "a human soldier who defected from a corporate militia", level: 5, allowSpellcasting: false }
  },
  spellFocus: {
    fn: "chooseSpellFocus",
    args: {
      concept: {
        name: "Drift Adept", level: 5, blurb: "A mystic who reads the gaps between stars.",
        description: "Robes stitched with navigation charts.", traits: ["humanoid", "mystic"]
      },
      tradition: "occult"
    }
  },
  magicItemConcept: {
    fn: "generateMagicItemConcept",
    args: {
      prompt: "a worn ring that keeps a scout steady on a hull breach",
      level: 5,
      rarity: "common",
      availableKinds: ["itemBonus"],
      usageOptions: ["worn", "held in one hand"],
      effectCatalog: [],
      kind: "wondrous"
    }
  },
  encounterDesign: {
    fn: "designEncounter",
    args: { theme: "a derelict hangar taken over by salvage drones", partyLevel: 5, slots: [{ level: 5, count: 1, role: "boss" }, { level: 3, count: 2, role: "minion" }] }
  },
  shopConcept: {
    fn: "generateShopConcept",
    args: { prompt: "a weapons dealer working out of a cargo container", level: 3, categories: shopCategories }
  },
  treasureConcept: {
    fn: "generateTreasureConcept",
    args: { prompt: "a dragon's hoard in a ruined vault", level: 5, categories: shopCategories }
  }
};
