// Execute the unmodified production app with mocked imports/platform services.
// A Mystic's or Witchwarper's class spell tradition comes from the planned
// Connection/Paradox (resolved.pathPlan), never from the AI's concept: spell
// candidates, the spell focus request and the concept handed to Create all use
// it; an unproven tradition makes no class spell plan and sets the review notice.
// Fixed-tradition classes and the archetype (multiclass) entry are unchanged.
import assert from "node:assert/strict";
import { progressView } from "./progress.mjs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import * as windowParts from "./window-parts.mjs";
import { readdirSync } from "node:fs";
import * as recentGenerations from "./recent-generations.mjs";
import { reviewUnresolvedChoices } from "./choice-set.mjs";
import { normalizeSkillPriorities, skillPriorityOrder } from "./pc-skills.mjs";
import {
  classSpellTradition, freeArchetypeNeedsPrerequisiteValidation, manualNotesContent, isCompletePCClass, COMPLETE_PC_CLASS_SLUGS, getMulticlassDedicationSlug
} from "./pc-support.mjs";
import { pcSpellcastingProfile, pcSpellPlan } from "./pc-tables.mjs";
import { stagedActorContext } from "./pc-prerequisites.mjs";
import { capitalized } from "./text.mjs";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

// Scenario state, set per case below.
let aiSpellcasting = null, classDoc = null, pathPlan = {}, archetypePlan = null, previewFeats = [];
const spellCandidateCalls = [], focusCalls = [], selectCalls = [], warnings = [];
class App {
  _elapsedUnits() { return { seconds: "s", minutes: "m" }; }
  element = { querySelector: () => null };
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
  _throwIfCancelled() {}
}
const context = vm.createContext({
  console: { log() {}, debug() {}, warn: (...args) => warnings.push(args.join(" ")), error() {} },
  game: {
    i18n: { localize: (key) => key, format: (key) => key },
    actors: { get: () => null },
    settings: { get: () => true },
    users: [{ id: "gm", isGM: true }]
  },
  ChatMessage: { create: async (data) => data },
  ui: { notifications: { info() {}, warn() {} } }
});
globalThis.game = context.game;
const generatorContext = Object.assign({}, ...await Promise.all(readdirSync(new URL("./generator-context/", import.meta.url))
  .filter((file) => file.endsWith(".mjs")).map((file) => import(`./generator-context/${file}`))));
const resolved = () => ({ ancestryDoc: { name: "Human" }, classDoc, backgroundDoc: { name: "Scholar" },
  featSlots: previewFeats.map(({ type, level, archetype }) => ({ type, level, archetype, candidates: [] })), feats: previewFeats,
  spells: [], equipment: [], loot: [], pathPlan });
const mocks = {
  ...windowParts,
  progressView,
  ...generatorContext,
  ...recentGenerations,
  isCompletePCClass, COMPLETE_PC_CLASS_SLUGS, getMulticlassDedicationSlug, capitalized, stagedActorContext,
  classSpellTradition, pcSpellcastingProfile, pcSpellPlan,
  ABILITY_KEYS: ["str", "dex", "con", "int", "wis", "cha"], initialSkillTraining: () => ({ ranks: {} }),
  projectAttributeModifiers: () => null, projectSkillRanks: () => null,
  SpfApp: App, MODULE_ID: "simplysf2e", SETTINGS: { freeArchetype: "freeArchetype", generatorInput: "generatorInput" }, getSetting: () => true,
  restoreGeneratorInput: (_saved, defaults) => defaults, rememberedInput: (input) => input, reviewUnresolvedChoices, normalizeSkillPriorities, skillPriorityOrder,
  // Completion of a spell plan is covered by completion.test.mjs; this file checks the tradition routing only.
  assertComplete: () => {}, completionManifest: () => ({ lines: [] }), completionSummary: () => null,
  freeArchetypeNeedsPrerequisiteValidation, manualNotesContent, validateArchetypeSlotPlacement: () => ({ dropped: [] }), jevKeySource: () => "connection",
  supportedClassCandidates: (candidates) => candidates,
  getProviderRequestConfig: () => ({}), getProviderAuthWarningKey: () => null,
  BUILT_IN_PRESETS: [], getCustomPresets: () => [], findPreset: () => null, examplePrompt: () => "",
  presetPickerGroups: () => ({ selectedId: "", standard: [], custom: [] }),
  THREATS: {}, TREASURE_AMOUNT_MULTIPLIER: {}, randomBrief: () => "A caster",
  generatePCConcept: async () => ({ concept: { name: "Caster", level: 3, equipment: [], loot: [], focusSpells: [],
    spellcasting: aiSpellcasting ? structuredClone(aiSpellcasting) : null }, multiclass: null, usage: null }),
  normalizePCConcept: (raw) => raw,
  getAncestryCandidates: () => [], getBackgroundCandidates: () => [], getClassCandidates: () => [{ name: "Caster" }], getHeritageCandidates: () => [],
  selectAncestryBackgroundClass: async () => ({ ancestry: "Human", background: "Scholar", class: classDoc.name }),
  selectFeats: async () => ({ picks: [], usage: null, timing: null }), resolveFeatPicks: async () => previewFeats.map((feat) => ({ ...feat })),
  resolvePCConcept: async () => resolved(), slugify: (name) => String(name).toLowerCase().replace(/\s+/g, "-"),
  generatePCLoot: async () => ({ loot: [] }), normalizeLoot: (loot) => loot,
  dedupeLootAgainstEquipment: (loot) => loot, enforceNamedLootBudget: (loot) => loot, applyTreasureBudget: async (loot) => loot,
  pcStartingWealthGp: () => 0, equipmentValueGp: () => 0, lootValueGp: () => 0, parseCoins: () => null,
  resolveArchetypeBridges: async () => ({}), archetypeCasterPlan: () => archetypePlan,
  describeMissingSources: (missing = []) => missing.join(", "),
  // Shared spell step (creature-pipeline.mjs refineSpells) and the archetype pass.
  chooseSpellFocus: async ({ tradition }) => { focusCalls.push(tradition); return { keywords: [], usage: null }; },
  getSpellCandidates: async (tradition, maxRank) => { spellCandidateCalls.push({ tradition, maxRank }); return [{ name: `${tradition}-spell`, rank: 1 }]; },
  getFocusSpellCandidates: async () => [],
  selectSpells: async ({ concept }) => { selectCalls.push(concept.spellcasting?.tradition); return { spells: [], focusSpells: [], usage: null, timing: null }; },
  createCharacterActor: async () => ({ actor: null, skillReport: null, manualNotes: [], expectedItems: [] })
};
const source = await readFile(new URL("./generator-app.mjs", import.meta.url), "utf8");
const pipelineSource = await readFile(new URL("./creature-pipeline.mjs", import.meta.url), "utf8");
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
const plain = (value) => JSON.parse(JSON.stringify(value));

const sf2eClass = (name, slug = "") => ({ name, system: { slug, publication: { title: name === "Technomancer" ? "Starfinder Tech Core" : "Starfinder Player Core", remaster: true } } });
const MYSTIC = sf2eClass("Mystic");
const WITCHWARPER = sf2eClass("Witchwarper");
const TECHNOMANCER = sf2eClass("Technomancer");
const connection = (name, tradition) => ({ "mystic-connection": { tag: "mystic-connection", uuid: `Compendium.sf2e.class-features.Item.${name}`, name, tradition } });

async function run({ cls, plan = {}, ai = null, allowSpellcasting = true, archetype = null, feats = [] }) {
  classDoc = cls; pathPlan = plan; aiSpellcasting = ai; archetypePlan = archetype; previewFeats = feats;
  spellCandidateCalls.length = 0; focusCalls.length = 0; selectCalls.length = 0; warnings.length = 0;
  const app = new GeneratorApp();
  await app.runFromChat({ mode: "character", level: 3, prompt: "A caster", allowSpellcasting });
  assert.equal(app.context.error, null, "the character run completes");
  return { app, concept: plain(app.context.pcPreview.concept), notice: app.context.pcPreview.spellcastingNotice };
}

// 1. Mystic: the planned connection is primal while the AI said occult.
{
  const { concept, notice } = await run({ cls: MYSTIC, plan: connection("Elemental", "primal"), ai: { tradition: "occult", spells: [{ name: "Daze" }] } });
  assert.equal(concept.spellcasting.tradition, "primal", "the concept handed to Create carries the connection's tradition");
  assert.deepEqual(spellCandidateCalls.map((call) => call.tradition), ["primal"], "class spell candidates are primal");
  assert.deepEqual(focusCalls, ["primal"], "the spell focus request names the connection's tradition");
  assert.deepEqual(selectCalls, ["primal"], "the spell selector sees the connection's tradition");
  assert.equal(concept.spellcasting.preparationMode, "spontaneous");
  assert.ok(concept.spellcasting.plannedPicks, "the base plan is attached");
  assert.equal(notice, "SIMPLYSF2E.Preview.PCVariableSpellPlan");
}

// 2. Witchwarper: the planned paradox is arcane while the AI said occult; the Anchor path declares nothing.
{
  const plan = {
    "witchwarper-paradox": { tag: "witchwarper-paradox", uuid: "Compendium.sf2e.class-features.Item.Analyst", name: "Analyst", tradition: "arcane" },
    "witchwarper-anchor": { tag: "witchwarper-anchor", uuid: "Compendium.sf2e.class-features.Item.Focal Point", name: "Focal Point", tradition: null }
  };
  const { concept } = await run({ cls: WITCHWARPER, plan, ai: { tradition: "occult", spells: [] } });
  assert.equal(concept.spellcasting.tradition, "arcane");
  assert.deepEqual(spellCandidateCalls.map((call) => call.tradition), ["arcane"]);
}

// 3. The AI returned no spellcasting: the proven tradition still gets the base plan.
{
  const { concept, notice } = await run({ cls: MYSTIC, plan: connection("Healing", "divine"), ai: null });
  assert.equal(concept.spellcasting?.tradition, "divine", "a Mystic without AI spellcasting still gets its class plan");
  assert.ok(concept.spellcasting.plannedPicks);
  assert.deepEqual(spellCandidateCalls.map((call) => call.tradition), ["divine"]);
  assert.equal(notice, "SIMPLYSF2E.Preview.PCVariableSpellPlan");
}

// 4. No provable tradition: no class spell plan, the review notice says so, nothing is fetched.
for (const plan of [{}, connection("Unruled", null),
  { a: { tradition: "primal" }, b: { tradition: "occult" } }]) {
  const { concept, notice } = await run({ cls: MYSTIC, plan, ai: { tradition: "occult", spells: [{ name: "Daze" }] } });
  assert.equal(concept.spellcasting, null, `no class spell plan without a proven tradition (${JSON.stringify(plan)})`);
  assert.equal(notice, "SIMPLYSF2E.Preview.PCSpellTraditionUnproven");
  assert.equal(spellCandidateCalls.length, 0, "no spell candidates are fetched");
  assert.ok(warnings.some((text) => text.includes("spell tradition not proven")), "the console says why");
}

// 5. Fixed tradition (Technomancer): unchanged, with or without AI spellcasting, whatever the plan says.
{
  const plan = { "technomancer-programming-language": { tag: "technomancer-programming-language", name: "Bytecode", tradition: null } };
  for (const ai of [{ tradition: "occult", spells: [] }, null]) {
    const { concept, notice } = await run({ cls: TECHNOMANCER, plan, ai });
    assert.equal(concept.spellcasting.tradition, "arcane");
    assert.equal(concept.spellcasting.preparationMode, "prepared");
    assert.equal(concept.spellcasting.database, true);
    assert.equal(notice, "SIMPLYSF2E.Preview.PCBaseSpellPlan");
    assert.deepEqual(spellCandidateCalls.map((call) => call.tradition), ["arcane"]);
  }
}

// 6. Spellcasting off: no plan and no notice for any class.
{
  const { concept, notice } = await run({ cls: MYSTIC, plan: connection("Elemental", "primal"), ai: { tradition: "occult", spells: [] }, allowSpellcasting: false });
  assert.equal(concept.spellcasting, null);
  assert.equal(notice, null);
  assert.equal(spellCandidateCalls.length, 0);
}

// 7. Multiclass caster: a non-caster main class with a Mystic Dedication keeps its own archetype entry.
{
  const archetype = { dedication: "mystic-dedication", mode: "spontaneous", tradition: "divine", counts: { 0: 2 }, maxRank: 0 };
  const feats = [{ type: "class", level: 2, archetype: true, name: "Mystic Dedication", traits: ["archetype", "dedication"], entry: { packId: "feats", _id: "ded" } }];
  const { concept } = await run({ cls: { name: "Soldier", system: { publication: { title: "Starfinder Player Core", remaster: true } } }, plan: {}, ai: null, archetype, feats });
  assert.equal(concept.spellcasting, null, "a non-caster main class gains no class entry");
  assert.deepEqual(concept.archetypeSpellcasting, { tradition: "divine", preparationMode: "spontaneous", plannedPicks: { 0: 2 }, maxRank: 0, spells: [] });
  assert.deepEqual(spellCandidateCalls, [{ tradition: "divine", maxRank: 0 }], "the archetype list uses its own proven tradition");
}

console.log("generator-app class tradition: connection/paradox decides, AI ignored, fail-closed notice, fixed and archetype casters unchanged");
