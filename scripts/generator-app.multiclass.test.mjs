// Execute the unmodified production app with mocked imports/platform services.
// No provider calls, Foundry documents, or test-only production hooks.
// Multiclass picker, GM-vs-AI routing and the archetype placement context.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import * as recentGenerations from "./recent-generations.mjs";
import { reviewUnresolvedChoices } from "./choice-set.mjs";
import { normalizeSkillPriorities, skillPriorityOrder } from "./pc-skills.mjs";
import { assertComplete, completionManifest, completionSummary } from "./completion.mjs";
import {
  freeArchetypeNeedsPrerequisiteValidation, manualNotesContent, isCompletePCClass, COMPLETE_PC_CLASS_SLUGS, getMulticlassDedicationSlug
} from "./pc-support.mjs";
import { validateArchetypeSlotPlacement as realValidate, stagedActorContext } from "./pc-prerequisites.mjs";
import { capitalized } from "./text.mjs";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

let actor, createFailure, verifyFailure, deleteFailure, skillReport, creates = 0, deleted = 0, sheetCalls = 0;
let manualNotes = [], whispers = [];
let conceptCalls = 0, generatorLevel = 1, freeArchetype = false;
let previewLoot = [], previewFeats = [];
let mainClass = "Fighter", aiPick = null;
const conceptArgs = [], resolvedConcepts = [], placementContexts = [];
let budgetPending = null, budgetStarted = null;
let spellcastingOn = false, wealthGp = 0, coinValue = 0, bridgesOut = {};
const createdResolved = [];
const notices = [];
function recordPlacement(slots, feats, context) {
  placementContexts.push(context);
  return realValidate(slots, feats, context);
}
class App {
  element = { querySelector: (selector) => selector.includes('name="mode"') ? { value: "character" }
    : selector.includes('name="level"') ? { value: String(generatorLevel) }
      : selector.includes('name="prompt"') ? { value: "A dwarf fighter" }
      : selector.includes('name="allowSpellcasting"') ? { checked: spellcastingOn } : null };
  async render() { this.context = await this._prepareContext(); }
  _beginProgress() { this.abort = new AbortController(); return this.abort.signal; }
  async _setStep() {}
  _recordTokens() {}
  _recordFailure() {}
  _canReportBug() { return false; }
  _buildTokenReport() { return null; }
  _formatLastRunCost() { return null; }
  _finishRun() { this._progress = null; }
  _cancelGeneration() { this.abort?.abort(); }
  _throwIfCancelled() {
    if (this.abort?.signal.aborted) throw Object.assign(new Error("cancelled"), { cancelled: true });
  }
}
const context = vm.createContext({
  console: { log() {}, debug() {}, warn() {}, error() {} },
  game: {
    i18n: { localize: (key) => key, format: (key, data) => (key === "SIMPLYSF2E.PC.EmptyFeatSlots" ? `${key} ${data.count} ${data.slots}` : key) },
    actors: { get: (id) => id === actor?.id ? actor : null },
    settings: { get: () => freeArchetype },
    users: [{ id: "gm", isGM: true }, { id: "player", isGM: false }]
  },
  ChatMessage: { create: async (data) => { whispers.push(data); return data; } },
  ui: { notifications: Object.fromEntries(["info", "warn"].map((kind) => [kind, (text) => notices.push([kind, text])])) }
});
const resolved = () => ({ ancestryDoc: { name: "Dwarf" }, classDoc: { name: mainClass },
  backgroundDoc: { name: "Warrior" }, featSlots: previewFeats.map(({ type, level, archetype }) => ({ type, level, archetype, candidates: [] })), feats: previewFeats, spells: [], equipment: [], loot: previewLoot });
const mocks = {
  ...recentGenerations,
  isCompletePCClass, COMPLETE_PC_CLASS_SLUGS, getMulticlassDedicationSlug, capitalized, stagedActorContext,
  ABILITY_KEYS: ["str", "dex", "con", "int", "wis", "cha"], initialSkillTraining: () => ({ ranks: {} }),
  projectAttributeModifiers: () => null, projectSkillRanks: () => null,
  SpfApp: App, MODULE_ID: "simplysf2e", SETTINGS: { freeArchetype: "freeArchetype", generatorInput: "generatorInput" }, getSetting: (key) => (key === "freeArchetype" ? freeArchetype : undefined),
  restoreGeneratorInput: (_saved, defaults) => defaults, rememberedInput: (input) => input, reviewUnresolvedChoices, normalizeSkillPriorities, skillPriorityOrder,
  assertComplete, completionManifest, completionSummary,
  verifyCreatedActor: () => { if (verifyFailure) throw verifyFailure; },
  moveToGeneratedFolder: async () => {}, generatedFolderId: async () => "root", createHandout: async () => null,
  freeArchetypeNeedsPrerequisiteValidation, manualNotesContent, validateArchetypeSlotPlacement: recordPlacement, jevKeySource: () => "connection",
  supportedClassCandidates: (candidates) => candidates,
  getProviderRequestConfig: () => ({}), getProviderAuthWarningKey: () => null,
  BUILT_IN_PRESETS: [], getCustomPresets: () => [], findPreset: () => null, examplePrompt: () => "",
  presetPickerGroups: () => ({ selectedId: "", standard: [], custom: [] }),
  THREATS: {}, TREASURE_AMOUNT_MULTIPLIER: {}, randomBrief: () => "A dwarf",
  generatePCConcept: async (args) => { conceptCalls++; conceptArgs.push(args); return { concept: { name: `Test ${conceptCalls}`, level: 2, equipment: [], loot: [] }, multiclass: aiPick, usage: null }; },
  normalizePCConcept: (raw) => raw,
  getAncestryCandidates: () => [], getBackgroundCandidates: () => [], getClassCandidates: () => [{ name: "Fighter" }], getHeritageCandidates: () => [],
  selectAncestryBackgroundClass: async () => ({ ancestry: "Dwarf", background: "Warrior", class: "Fighter" }),
  selectFeats: async () => ({ picks: [], usage: null, timing: null }), resolveFeatPicks: async () => previewFeats.map((feat) => ({ ...feat })),
  resolvePCConcept: async (concept) => { resolvedConcepts.push(concept); return resolved(); }, pcSpellcastingProfile: () => null, slugify: (name) => name.toLowerCase().replace(/\s+/g, "-"),
  generatePCLoot: async () => ({ loot: [] }), normalizeLoot: (loot) => loot,
  dedupeLootAgainstEquipment: (loot) => loot, enforceNamedLootBudget: (loot) => loot,
  applyTreasureBudget: async (loot) => { budgetStarted?.(); if (budgetPending) await budgetPending; return loot; },
  pcStartingWealthGp: () => wealthGp, equipmentValueGp: () => 0, lootValueGp: () => coinValue, parseCoins: () => null,
  resolveArchetypeBridges: async () => bridgesOut, archetypeCasterPlan: () => null,
  describeMissingSources: (missing = []) => missing.join(", "),
  createCharacterActor: async (concept, resolvedPC) => { creates++; createdResolved.push(resolvedPC); if (createFailure) throw createFailure; return { actor, skillReport, manualNotes, expectedItems: [] }; }
};
const source = await readFile(new URL("./generator-app.mjs", import.meta.url), "utf8");
const pipelineSource = await readFile(new URL("./creature-pipeline.mjs", import.meta.url), "utf8");
// creature-pipeline.mjs is linked from the same mocks, so the shared step chain runs against them.
const pipelineModule = new vm.SourceTextModule(pipelineSource, { context });
const linkWith = (text) => (specifier) => {
  if (specifier === "./creature-pipeline.mjs") return pipelineModule;
  const imports = [...text.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .filter((match) => match[2] === specifier).flatMap((match) => match[1].split(",").map((name) => name.trim()));
  return new vm.SyntheticModule(imports, function () {
    for (const name of imports) this.setExport(name, mocks[name] ?? (() => { throw new Error(`Unexpected dependency: ${name}`); }));
  }, { context });
};
await pipelineModule.link(linkWith(pipelineSource));
const appModule = new vm.SourceTextModule(source, { context });
await appModule.link(linkWith(source));
await appModule.evaluate();
const { GeneratorApp } = appModule.namespace;

// The app runs in its own vm realm, so compare plain copies of its arrays and objects.
const plain = (value) => JSON.parse(JSON.stringify(value));

async function runCharacter(updates = {}) {
  const app = new GeneratorApp();
  conceptArgs.length = 0; resolvedConcepts.length = 0; placementContexts.length = 0;
  await app.runFromChat({ mode: "character", level: 2, prompt: "A soldier who dabbles in mysticism", ...updates });
  assert.equal(app.context.error, null, "the character run completes");
  return app;
}

// 1. Picker: only in Character mode with Free Archetype on; None, Let the AI decide, then the eight classes.
{
  freeArchetype = false;
  const off = new GeneratorApp();
  off.setInput({ mode: "character" });
  await off.render();
  assert.equal(off.context.multiclassPicker, null, "the Multiclass picker is hidden with Free Archetype off");

  freeArchetype = true;
  const on = new GeneratorApp();
  on.setInput({ mode: "character" });
  await on.render();
  const options = on.context.multiclassPicker.options;
  assert.deepEqual(plain(options.slice(0, 2).map((o) => o.value)), ["none", "ai"]);
  assert.deepEqual(plain(options.slice(2).map((o) => o.value)), [...COMPLETE_PC_CLASS_SLUGS]);
  assert.equal(options[0].selected, true, "None is the default pick");
  assert.equal(options[2].label, "Envoy", "classes are labelled by name");

  const monster = new GeneratorApp();
  monster.setInput({ mode: "monster" });
  await monster.render();
  assert.equal(monster.context.multiclassPicker, null, "the picker is Character-only");
}

// 2. Free Archetype off: multiclass is always null, and the AI is never asked, even for a stored GM pick.
{
  freeArchetype = false;
  previewFeats = [];
  const app = await runCharacter({ multiclass: "mystic" });
  assert.equal(resolvedConcepts[0].multiclass, null, "multiclass is null with Free Archetype off");
  assert.equal(conceptArgs[0].allowMulticlass, false);
  assert.equal(app.context.pcPreview.multiclass, null);
}

// 3. GM pick: the concept carries the class and the AI is never asked (allowMulticlass false).
{
  freeArchetype = true;
  previewFeats = [{ type: "class", level: 2, archetype: true, name: "Mystic Dedication", traits: ["archetype", "dedication"], entry: { packId: "feats", _id: "ded" } }];
  const app = await runCharacter({ multiclass: "mystic" });
  assert.equal(conceptArgs[0].allowMulticlass, false, "a GM-chosen class never asks the AI for a second class");
  assert.equal(resolvedConcepts[0].multiclass, "mystic");
  assert.deepEqual(plain(app.context.pcPreview.multiclass), { name: "Mystic", dedication: "Mystic Dedication" },
    "the preview names the dedication only when a real feat was placed");
}

// 4. The preview says so when the dedication did not land on a feat.
{
  previewFeats = [{ type: "class", level: 2, archetype: true, name: "Nimble Dodge", traits: ["archetype"], entry: { packId: "feats", _id: "nd" } }];
  const app = await runCharacter({ multiclass: "mystic" });
  assert.deepEqual(plain(app.context.pcPreview.multiclass), { name: "Mystic", dedication: null });
}

// 5. "Let the AI decide": the AI is asked, and its validated pick becomes the concept's class.
{
  previewFeats = [{ type: "class", level: 2, archetype: true, name: "Mystic Dedication", traits: ["archetype", "dedication"], entry: { packId: "feats", _id: "ded" } }];
  aiPick = "mystic";
  await runCharacter({ multiclass: "ai" });
  assert.equal(conceptArgs[0].allowMulticlass, true, "Let the AI decide asks for the optional second class");
  assert.equal(resolvedConcepts[0].multiclass, "mystic");

  aiPick = null;
  await runCharacter({ multiclass: "ai" });
  assert.equal(resolvedConcepts[0].multiclass, null, "no AI pick means no second class");
  aiPick = null;
}

// 6. A second class equal to the main class is dropped, never substituted.
{
  mainClass = "Envoy";
  await runCharacter({ multiclass: "envoy" });
  assert.equal(resolvedConcepts[0].multiclass, null, "a main-class pick cannot be its own multiclass");
  mainClass = "Fighter";
}

// 7. The archetype placement check always gets a real staged context.
{
  freeArchetype = true;
  previewFeats = [{ type: "class", level: 2, archetype: true, name: "Mystic Dedication", traits: ["archetype", "dedication"], entry: { packId: "feats", _id: "ded" } }];
  await runCharacter({ multiclass: "none" });
  assert.ok(placementContexts.length >= 1, "archetype placement runs for an archetype slot");
  for (const context of placementContexts) {
    assert.ok(context, "placement receives a staged context, not null");
    assert.ok(context.names instanceof Set, "the staged context carries the possessed names");
    assert.equal(context.level, 2, "the staged context is at the PC's level");
  }
}

// 8. Archetype bridges (Connection/Paradox pre-answers) reach the actor on every resolve pass, with and without the coin top-up.
{
  freeArchetype = true;
  spellcastingOn = true;
  previewFeats = [{ type: "class", level: 2, archetype: true, name: "Mystic Dedication", traits: ["archetype", "dedication"], entry: { packId: "feats", _id: "ded" } }];
  bridgesOut = { "mystic-dedication": { dedication: "Mystic Dedication", choice: "Connection", choiceType: "feat", grantUuid: "uuid", option: { name: "Akashic" } } };
  for (const coins of [0, 30]) {
    // 30 gp of coin is over a quarter of the 100 gp loot budget, so the top-up pass runs only in the second case.
    coinValue = coins;
    wealthGp = 100;
    createdResolved.length = 0;
    const app = await runCharacter({ multiclass: "none" });
    await GeneratorApp.DEFAULT_OPTIONS.actions.createActor.call(app);
    assert.equal(createdResolved.length, 1, `coin ${coins}: the actor is created once`);
    assert.ok(createdResolved[0].archetypeBridges, `coin ${coins}: the resolved concept carries archetypeBridges`);
    assert.deepEqual(plain(createdResolved[0].archetypeBridges), plain(bridgesOut),
      `coin ${coins}: the Mystic bridge survives the resolve passes`);
  }
  spellcastingOn = false;
  coinValue = 0;
  wealthGp = 0;
  bridgesOut = {};
}

console.log("generator-app.multiclass.test.mjs: picker gating, GM/AI routing, main-class guard, placement context, and archetype bridge survival passed");
