import { installEnv, queueResponses, capturedRequests, restoreEnv } from "./env.mjs";

const FUNC_MAP = {
  creatureConcept: "generateConcept",
  pcConcept: "generatePCConcept",
  spellSelection: "selectSpells",
  equipmentSelection: "selectEquipment",
  abilitySelection: "selectCreatureAbilities",
  creatureFeatSelection: "selectCreatureFeats",
  magicItemConcept: "generateMagicItemConcept",
  encounterDesign: "designEncounter",
  treasureConcept: "generateTreasureConcept",
  shopConcept: "generateShopConcept",
};

export async function runScenario(fixture) {
  installEnv({ settings: fixture.settings || {} });
  queueResponses(fixture.responses || []);
  const mod = await import("../../scripts/ai.mjs");
  const fnName = FUNC_MAP[fixture.task];
  let result = null, error = null;
  try {
    if (!fnName) throw new Error("unknown task " + fixture.task);
    const fn = mod[fnName];
    result = await fn(fixture.args || {});
  } catch (e) { error = e; }
  finally { restoreEnv(); }
  const requests = capturedRequests();
  return { result, requests, error };
}