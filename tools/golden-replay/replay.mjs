// Shared runner for the golden replay suite. Installs a stubbed provider and
// Foundry globals, then drives the REAL production function named by a fixture.
// Never re-implements pipeline logic and never calls a live API.
import { installEnv, queueResponses, capturedRequests, restoreEnv } from "./env.mjs";

// Fixture task id -> production export. `normalizeConcept` lives in builder.mjs
// and is the one task that runs on an already-parsed object rather than a
// provider reply, so the normalizer is covered too.
const FUNC_MAP = {
  creatureConcept: "generateConcept",
  pcConcept: "generatePCConcept",
  spellFocus: "chooseSpellFocus",
  spellSelection: "selectSpells",
  equipmentSelection: "selectEquipment",
  lootSelection: "selectLoot",
  abilitySelection: "selectCreatureAbilities",
  creatureFeatSelection: "selectCreatureFeats",
  magicItemConcept: "generateMagicItemConcept",
  encounterDesign: "designEncounter",
  reskinFlavor: "generateReskin",
  shopConcept: "generateShopConcept",
  treasureConcept: "generateTreasureConcept",
  normalizeConcept: "normalizeConcept"
};

// Tasks that try the Jev fast pick first. A replay must never take that path:
// it is a second network call with its own transport, so the fixture would no
// longer be exercising the chat pipeline. Passing jevConfig: null makes the
// selector fall through to the chat model (scripts/jev-picks.mjs pickPerDraftEntry).
const SELECTOR_TASKS = new Set([
  "spellSelection", "equipmentSelection", "lootSelection", "abilitySelection",
  "creatureFeatSelection"
]);

/**
 * Run one fixture. Returns `{ result, requests, error }`; `error` is whatever
 * production threw, so a negative fixture can assert the fail-closed path.
 * @param {object} fixture parsed fixture JSON
 */
export async function runScenario(fixture) {
  installEnv({ settings: fixture.settings || {} });
  queueResponses(fixture.responses || []);
  let result = null;
  let error = null;
  let requests = null;
  try {
    const fnName = FUNC_MAP[fixture.task];
    if (!fnName) throw new Error(`golden-replay: no production function for task ${fixture.task}`);
    const args = { ...(fixture.args || {}) };
    if (SELECTOR_TASKS.has(fixture.task)) args.jevConfig = null;
    if (fixture.task === "normalizeConcept") {
      // Production signature: normalizeConcept(raw, { level, rarity }).
      const builder = await import("../../scripts/builder.mjs");
      result = builder.normalizeConcept(args.raw, { level: args.level, rarity: args.rarity });
    } else {
      const mod = await import("../../scripts/ai.mjs");
      result = await mod[fnName](args);
    }
  } catch (err) {
    error = err;
  } finally {
    requests = capturedRequests();
    restoreEnv();
  }
  return { result, requests, error };
}

export { FUNC_MAP, SELECTOR_TASKS };
