// Execute the unmodified production app with mocked imports/platform services.
// No provider calls, Foundry documents, or test-only production hooks.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import * as recentGenerations from "./recent-generations.mjs";
import { reviewUnresolvedChoices } from "./choice-set.mjs";
import { normalizeSkillPriorities, skillPriorityOrder } from "./pc-skills.mjs";
import { assertComplete, completionManifest, completionSummary } from "./completion.mjs";
import { freeArchetypeNeedsPrerequisiteValidation } from "./pc-support.mjs";
import { validateArchetypeSlotPlacement } from "./pc-prerequisites.mjs";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

let actor, createFailure, verifyFailure, deleteFailure, skillReport, creates = 0, deleted = 0, sheetCalls = 0;
let conceptCalls = 0, generatorLevel = 1, freeArchetype = false;
let previewLoot = [];
let budgetPending = null, budgetStarted = null;
const notices = [];
class App {
  element = { querySelector: (selector) => selector.includes('name="mode"') ? { value: "character" }
    : selector.includes('name="level"') ? { value: String(generatorLevel) }
      : selector.includes('name="prompt"') ? { value: "A dwarf fighter" }
      : selector.includes('name="allowSpellcasting"') ? { checked: false } : null };
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
  console: { log() {}, warn() {}, error() {} },
  game: {
    i18n: { localize: (key) => key, format: (key) => key },
    actors: { get: (id) => id === actor?.id ? actor : null },
    settings: { get: () => freeArchetype }
  },
  ui: { notifications: Object.fromEntries(["info", "warn"].map((kind) => [kind, (text) => notices.push([kind, text])])) }
});
const resolved = () => ({ ancestryDoc: { name: "Dwarf" }, classDoc: { name: "Fighter" },
  backgroundDoc: { name: "Warrior" }, featSlots: [], feats: [], spells: [], equipment: [], loot: previewLoot });
const mocks = {
  ...recentGenerations,
  SpfApp: App, MODULE_ID: "simplysf2e", SETTINGS: { freeArchetype: "freeArchetype" }, reviewUnresolvedChoices, normalizeSkillPriorities, skillPriorityOrder,
  assertComplete, completionManifest, completionSummary,
  verifyCreatedActor: () => { if (verifyFailure) throw verifyFailure; },
  freeArchetypeNeedsPrerequisiteValidation, validateArchetypeSlotPlacement, jevKeySource: () => "connection",
  supportedClassCandidates: (candidates) => candidates,
  getProviderRequestConfig: () => ({}), getProviderAuthWarningKey: () => null,
  BUILT_IN_PRESETS: [], getCustomPresets: () => [], findPreset: () => null, examplePrompt: () => "",
  presetPickerGroups: () => ({ selectedId: "", standard: [], custom: [] }),
  THREATS: {}, TREASURE_AMOUNT_MULTIPLIER: {}, randomBrief: () => "A dwarf",
  generatePCConcept: async () => { conceptCalls++; return { concept: { name: `Test ${conceptCalls}`, level: 1, equipment: [], loot: [] } }; },
  normalizePCConcept: (raw) => raw,
  getAncestryCandidates: () => [], getBackgroundCandidates: () => [], getClassCandidates: () => [{ name: "Fighter" }], getHeritageCandidates: () => [],
  selectAncestryBackgroundClass: async () => ({ ancestry: "Dwarf", background: "Warrior", class: "Fighter" }),
  resolvePCConcept: async () => resolved(), pcSpellcastingProfile: () => null, slugify: (name) => name.toLowerCase(),
  generatePCLoot: async () => ({ loot: [] }), normalizeLoot: (loot) => loot,
  dedupeLootAgainstEquipment: (loot) => loot, enforceNamedLootBudget: (loot) => loot,
  applyTreasureBudget: async (loot) => { budgetStarted?.(); if (budgetPending) await budgetPending; return loot; },
  pcStartingWealthGp: () => 0, equipmentValueGp: () => 0, lootValueGp: () => 0, parseCoins: () => null,
  describeMissingSources: (missing = []) => missing.join(", "),
  createCharacterActor: async () => { creates++; if (createFailure) throw createFailure; return { actor, skillReport }; }
};
const source = await readFile(new URL("./generator-app.mjs", import.meta.url), "utf8");
const appModule = new vm.SourceTextModule(source, { context });
await appModule.link((specifier) => {
  const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .filter((match) => match[2] === specifier).flatMap((match) => match[1].split(",").map((name) => name.trim()));
  return new vm.SyntheticModule(imports, function () {
    for (const name of imports) this.setExport(name, mocks[name] ?? (() => { throw new Error(`Unexpected dependency: ${name}`); }));
  }, { context });
});
await appModule.evaluate();
const { GeneratorApp } = appModule.namespace;
const actions = GeneratorApp.DEFAULT_OPTIONS.actions;
assert.equal(typeof actions.cancelGeneration, "function", "in-flight generation must expose Cancel");

// A mode change re-renders the application. Foundry focuses the first hidden
// radio during that render, so production must explicitly restore focus to
// the checked radio instead of visually highlighting Monster as well.
{
  const modeApp = new GeneratorApp();
  let changeHandler;
  let focused = false;
  const npcRadio = {
    value: "npc", checked: true,
    addEventListener: (type, handler) => { if (type === "change") changeHandler = handler; },
    focus: ({ preventScroll } = {}) => { focused = preventScroll === true; }
  };
  modeApp.element = {
    querySelector: (selector) => selector.includes('name="mode"') ? npcRadio : null,
    querySelectorAll: (selector) => selector.includes('name="mode"') ? [npcRadio] : []
  };
  modeApp._onRender({}, {});
  await changeHandler();
  assert.equal(modeApp.context.npcMode, true, "the selected NPC mode must survive the re-render");
  assert.equal(focused, true, "the checked mode radio must regain focus without scrolling");
}

async function generate() {
  const app = new GeneratorApp();
  await actions.generateRandom.call(app);
  assert.equal(app.context.error, null);
  assert.ok(app.context.pcPreview, "real generation flow must seed the private PC draft");
  return app;
}

// Exact scroll references carry identity only, not a spell display name.
// Exercise the production private mapper through the real preview lifecycle.
previewLoot = [
  { name: "Spell Gem of Fear (Rank 2)", quantity: 2, scroll: { rank: 2 }, entry: { packId: "spells", _id: "fear" } },
  { name: "Spell Gem of Draft (Rank 1)", quantity: 1, scroll: { rank: 1 }, entry: { name: "Heal" } }
];
const scrollPreview = await generate();
assert.deepEqual(Array.from(scrollPreview.context.pcPreview.loot, ({ name, found }) => ({ name, found })), [
  { name: "Spell Gem of Fear (Rank 2) ×2", found: true },
  { name: "Spell Gem of Heal (Rank 1)", found: true }
]);
previewLoot = [];

// Free Archetype begins adding feats at level 2. Archetype slots now carry
// staged prerequisite filtering plus post-resolution placement checks, so the
// production preflight no longer stops before the first concept request;
// unprovable placements fail closed into the completion manifest instead.
freeArchetype = true;
generatorLevel = 2;
const beforeArchetype = conceptCalls;
await actions.generateRandom.call(new GeneratorApp());
assert.equal(conceptCalls, beforeArchetype + 1, "Free Archetype proceeds to the provider concept call under staged validation");
assert.ok(!notices.some(([, text]) => text === "SIMPLYSF2E.Generator.FreeArchetypeUnsupported"),
  "the retired hard-stop notice is never shown");
freeArchetype = false;
generatorLevel = 1;

function setActor({ items = [], failSheet = false } = {}) {
  actor = { id: "created", name: "<img src=x>", items: { contents: items }, async delete() {
    deleted++;
    if (deleteFailure) throw deleteFailure;
  }, sheet: { async render() {
    sheetCalls++;
    if (failSheet) throw new Error("sheet failure");
  } } };
}
setActor({ items: [{ id: "feature", name: "Feature", type: "feat", system: { rules: [{ key: "ChoiceSet", ignored: true }] } }], failSheet: true });
const app = await generate();
await actions.createActor.call(app);
assert.equal(app.context.error, null, "a presentation error is not a creation failure");
assert.equal(app.context.pcPreview, null);
assert.equal(app.context.characterReview.choices.length, 1);
assert.equal(app.context.characterReview.actorName, "<img src=x>");
assert.equal(app.context.showEmptyState, false);
assert.ok(notices.some(([, text]) => text.endsWith("CreatedPresentationFailed")));
await actions.createActor.call(app);
assert.equal(creates, 1, "a failed sheet must not allow duplicate creation");
actor.sheet.render = async () => { sheetCalls++; };
await actions.openReviewedCharacter.call(app);
assert.equal(sheetCalls, 2);
actor = null;
await actions.openReviewedCharacter.call(app);
assert.ok(notices.some(([, text]) => text.endsWith("ReviewUnavailable")));
await actions.dismissCharacterReview.call(app);
assert.equal(app.context.characterReview, null);
assert.equal(creates, 1, "review actions never create or recreate actors");

setActor();
Object.defineProperty(actor, "items", { get() { throw new Error("unreadable items"); } });
const unreadable = await generate();
await actions.createActor.call(unreadable);
assert.equal(unreadable.context.characterReview.incomplete, true);
assert.equal(unreadable.context.pcPreview, null);

const renderFailure = await generate();
renderFailure.render = async function () {
  await App.prototype.render.call(this);
  if (this.context.characterReview && !this.context.busy) throw new Error("review template failed");
};
const warningCount = notices.filter(([, text]) => text.endsWith("CreatedPresentationFailed")).length;
await actions.createActor.call(renderFailure);
assert.equal(renderFailure.context.pcPreview, null);
assert.equal(notices.filter(([, text]) => text.endsWith("CreatedPresentationFailed")).length, warningCount + 1);
const afterRenderFailure = creates;
await actions.createActor.call(renderFailure);
assert.equal(creates, afterRenderFailure);

setActor();
const clean = await generate();
await actions.createActor.call(clean);
assert.equal(clean.context.characterReview, null, "no empty all-complete claim");
assert.equal(clean.context.pcPreview, null);

skillReport = { rows: [{ slug: "medicine", rank: 2, name: null }, { slug: "lore:owned", rank: 1, name: "<img src=x> Lore" }],
  warnings: ["unspent-increases"], automatic: true, trainingBudget: 3, unspentTraining: 0, unspentIncreases: 1 };
const skills = await generate();
assert.equal(skills.context.pcPreview.automaticSkills, true);
assert.equal(skills.context.pcPreview.skillPriorities.length, 18, "16 core skills plus sf2e Computers and Piloting");
await actions.createActor.call(skills);
assert.equal(skills.context.characterReview.skills.rows[0].name, "medicine");
assert.equal(skills.context.characterReview.skills.rows[0].rank, "SIMPLYSF2E.Skills.Rank2");
assert.equal(skills.context.characterReview.skills.rows[1].name, "<img src=x> Lore");
assert.deepEqual(Array.from(skills.context.characterReview.skills.warnings), ["SIMPLYSF2E.Skills.UnspentIncreases"]);
assert.equal(skills.context.pcPreview, null);
skillReport = undefined;

createFailure = new Error("native creation rejected");
const failed = await generate();
await actions.createActor.call(failed);
assert.equal(failed.context.error, createFailure.message);
assert.ok(failed.context.pcPreview, "genuine creation failure retains the retryable draft");
assert.equal(failed.context.busy, false);
createFailure = undefined;

setActor();
verifyFailure = new Error("expected embedded feat was dropped");
const unverified = await generate();
await actions.createActor.call(unverified);
assert.equal(unverified.context.error, verifyFailure.message, "post-create verification failure reaches the normal creation error state");
assert.ok(unverified.context.pcPreview, "an unverified actor leaves the retryable plan intact");
assert.equal(deleted, 1, "an unverified newly created character is rolled back before commit");
verifyFailure = undefined;

setActor();
verifyFailure = new Error("expected embedded feat was dropped");
deleteFailure = new Error("delete rejected");
const stranded = await generate();
await actions.createActor.call(stranded);
assert.equal(stranded.context.pcPreview, null, "a failed rollback must discard the draft so retry cannot duplicate the actor");
assert.match(stranded.context.error, /still exists/);
verifyFailure = undefined;
deleteFailure = undefined;

setActor();
const nativeStranded = new Error("native write rejected");
nativeStranded.simplySF2eRollbackActor = actor;
createFailure = nativeStranded;
const incomplete = await generate();
await actions.createActor.call(incomplete);
assert.equal(incomplete.context.pcPreview, null, "a builder-reported surviving actor also makes the draft non-retryable");
assert.match(incomplete.context.error, /still exists/);
createFailure = undefined;

// Cancellation can arrive after the provider has finished, while the last
// compendium/coin step is pending. One-click must not write that cancelled PC.
setActor();
let releaseBudget;
budgetPending = new Promise((resolve) => { releaseBudget = resolve; });
const budgetReady = new Promise((resolve) => { budgetStarted = resolve; });
const cancelledApp = new GeneratorApp();
cancelledApp._preserveForm(); // model the preceding switch into Character mode
const createsBeforeCancel = creates;
const cancelledRun = actions.generate.call(cancelledApp);
await budgetReady;
actions.cancelGeneration.call(cancelledApp);
releaseBudget();
await cancelledRun;
assert.equal(creates, createsBeforeCancel, "a late cancelled one-click PC run must not create an actor");
assert.equal(cancelledApp.context.pcPreview, null);
assert.equal(cancelledApp.context.error, "cancelled");
budgetPending = budgetStarted = null;

// Re-entrant Generate is also rejected while a previous request owns the app.
setActor();
budgetPending = new Promise((resolve) => { releaseBudget = resolve; });
const duplicateReady = new Promise((resolve) => { budgetStarted = resolve; });
const duplicateApp = new GeneratorApp();
duplicateApp._preserveForm();
const callsBeforeDuplicate = conceptCalls;
const firstRun = actions.generate.call(duplicateApp);
await duplicateReady;
const secondRun = actions.generate.call(duplicateApp);
releaseBudget();
await Promise.all([firstRun, secondRun]);
assert.equal(conceptCalls, callsBeforeDuplicate + 1, "one active run owns the provider calls and cancellation signal");
budgetPending = budgetStarted = null;

// Recent previews: a new run moves the on-screen preview into the list
// instead of discarding it; Open swaps it back; a created preview is
// consumed and never offered again (no duplicate actor from the list).
{
  setActor();
  createFailure = verifyFailure = null;
  const recentApp = new GeneratorApp();
  await actions.generateRandom.call(recentApp);
  const firstName = recentApp.context.pcPreview.concept.name;
  assert.equal(recentApp.context.recent, null, "the preview on screen is not listed");
  await actions.generateRandom.call(recentApp);
  const secondName = recentApp.context.pcPreview.concept.name;
  assert.notEqual(firstName, secondName);
  assert.equal(recentApp.context.recent.length, 1);
  assert.equal(recentApp.context.recent[0].name, firstName);
  assert.equal(recentApp.context.recent[0].mode, "character");
  await actions.openRecent.call(recentApp, {}, { dataset: { recentId: recentApp.context.recent[0].id } });
  assert.equal(recentApp.context.pcPreview.concept.name, firstName, "Open restores the earlier preview");
  assert.equal(recentApp.context.recent.length, 1);
  assert.equal(recentApp.context.recent[0].name, secondName, "the replaced preview takes its place in the list");
  const createsBefore = creates;
  await actions.createActor.call(recentApp);
  assert.equal(creates, createsBefore + 1);
  assert.equal(recentApp.context.pcPreview, null);
  assert.deepEqual(Array.from(recentApp.context.recent, (row) => row.name), [secondName],
    "a created preview is not put back in the list");
  await actions.generateAnother.call(recentApp);
  await actions.generateRandom.call(recentApp);
  assert.equal(recentApp.context.recent.length, 1, "nothing is stashed when no preview was on screen");
  await actions.forgetRecent.call(recentApp, {}, { dataset: { recentId: recentApp.context.recent[0].id } });
  assert.equal(recentApp.context.recent, null, "Remove drops the entry");
  for (let i = 0; i < recentGenerations.RECENT_LIMIT + 2; i++) await actions.generateRandom.call(recentApp);
  assert.equal(recentApp.context.recent.length, recentGenerations.RECENT_LIMIT, "the list is capped");
  // Discard only removes the preview the GM confirmed: an Open while the
  // dialog was up swaps the screen, and the confirm then does nothing.
  const shownBefore = recentApp.context.pcPreview.concept.name;
  const swapTarget = recentApp.context.recent[0];
  recentApp._confirm = async () => {
    await actions.openRecent.call(recentApp, {}, { dataset: { recentId: swapTarget.id } });
    return true;
  };
  await actions.discard.call(recentApp);
  assert.equal(recentApp.context.pcPreview.concept.name, swapTarget.name, "the swapped-in preview survives");
  assert.ok(recentApp.context.recent.some((row) => row.name === shownBefore), "the confirmed preview went to the list");
  const listed = Array.from(recentApp.context.recent, (row) => row.id);
  recentApp._confirm = async () => true;
  await actions.discard.call(recentApp);
  assert.equal(recentApp.context.pcPreview, null);
  assert.deepEqual(Array.from(recentApp.context.recent, (row) => row.id), listed,
    "Discard throws away only the preview on screen");
}

console.log("generator-app.review.test.mjs: production generation/creation/review lifecycle passed");
