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
  if (!fnName) { restoreEnv(); return { result: null, requests: capturedRequests(), error: new Error("unknown task " + fixture.task) }; }
  const fn = mod[fnName];
  let result = null, error = null;
  try { result = await fn(fixture.args || {}); }
  catch (e) { error = e; }
  const requests = capturedRequests();
  restoreEnv();
  return { result, requests, error };
}