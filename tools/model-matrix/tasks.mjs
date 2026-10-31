export const TASKS = {
  creatureConcept: { fn: "generateConcept", args: { prompt: "a goblin commander", level: 5, rarity: "common", allowSpellcasting: false, intent: "monster" } },
  pcConcept: { fn: "generatePCConcept", args: { prompt: "a human fighter", level: 5 } },
  spellFocus: { fn: "chooseSpellFocus", args: { concept: { name: "Mage", level: 5, blurb: "b", description: "d", traits: ["arcane","humanoid"] }, tradition: "arcane" } },
  magicItemConcept: { fn: "generateMagicItemConcept", args: { prompt: "flaming sword", level: 5 } },
  encounterDesign: { fn: "designEncounter", args: { prompt: "goblin ambush", level: 5, partySize: 4 } },
  shopConcept: { fn: "generateShopConcept", args: { prompt: "magic shop", level: 5 } },
  treasureConcept: { fn: "generateTreasureConcept", args: { prompt: "dragon hoard", level: 5 } },
};