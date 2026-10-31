import { SHOP_CATEGORIES } from "../../scripts/shop.mjs";
const cats = Object.keys(SHOP_CATEGORIES);

export const TASKS = {
  creatureConcept: { fn: "generateConcept", args: { prompt: "a goblin commander", level: 5, rarity: "common", allowSpellcasting: false, intent: "monster" } },
  pcConcept: { fn: "generatePCConcept", args: { prompt: "a human fighter", level: 5 } },
  spellFocus: { fn: "chooseSpellFocus", args: { concept: { name: "Mage", level: 5, blurb: "b", description: "d", traits: ["arcane","humanoid"] }, tradition: "arcane" } },
  magicItemConcept: { fn: "generateMagicItemConcept", args: { prompt: "flaming sword", level: 5, availableKinds: ["weapon"], usageOptions: ["held in one hand"], effectCatalog: [] } },
  encounterDesign: { fn: "designEncounter", args: { theme: "goblin ambush", partyLevel: 5, slots: [{ level: 5, count: 1, role: "brute" }] } },
  shopConcept: { fn: "generateShopConcept", args: { prompt: "magic shop", level: 5, categories: cats } },
  treasureConcept: { fn: "generateTreasureConcept", args: { prompt: "dragon hoard", level: 5, categories: cats } },
};