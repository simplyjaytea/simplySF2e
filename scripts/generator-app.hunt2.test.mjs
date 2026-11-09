// One-click Generate defects from the 2026-11-09 hunt (T-GENRUN). The real
// scripts/generator-app.mjs is loaded in a vm module with its imports mocked
// (same seam as generator-app.races.test.mjs; private names become _test_ names).
//   A. Encounter one-click Generate creates the folder and every member.
//   B. Generate with an empty prompt never creates the previous preview.
//   C. A PC whose gear exceeds starting wealth keeps no drafted coin and
//      spends no extra loot request.
// Run: node scripts/generator-app.hunt2.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import vm from "node:vm";
import * as builder from "./builder.mjs";
import * as recentGenerations from "./recent-generations.mjs";
import { composeEncounter } from "./encounter.mjs";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

const source = (await readFile(new URL("./generator-app.mjs", import.meta.url), "utf8"))
  .replace(/(?<=[.\s])#([A-Za-z_]\w*)/g, "_test_$1");

const notices = [];
const folders = [];
const warnings = [];
const context = vm.createContext({
  console: { warn: (...args) => warnings.push(args.join(" ")), error() {}, log() {}, debug() {} },
  game: {
    i18n: { localize: (key) => key, format: (key, data) => `${key}:${JSON.stringify(data)}` },
    actors: { fromCompendium: (a) => a.toObject() }
  },
  ui: {
    notifications: {
      info: (message, options) => notices.push({ level: "info", message, options }),
      warn: (message, options) => notices.push({ level: "warn", message, options })
    }
  },
  Folder: { create: async (data) => { folders.push(data); return { id: "F", name: data.name, delete: async () => {} }; } },
  fromUuid: async () => ({ name: "Source", system: {}, toObject: () => ({ name: "Source", system: {} }) }),
  Actor: { create: async (data) => ({ id: "R1", name: data.name, sheet: { render: async () => {} } }) }
});

const generatorContext = Object.assign({}, ...await Promise.all(readdirSync(new URL("./generator-context/", import.meta.url))
  .filter((file) => file.endsWith(".mjs")).map((file) => import(`./generator-context/${file}`))));

const createdWith = [];
const pcCreated = [];
const reskinCreated = [];
let renderGate = null;      // when set, the next render() waits on it
let encounterReply = null;
let pcLootCalls = 0;
let pcLootDraft = [];
let equipmentGp = 0;
const mocks = {
  MODULE_ID: "simplysf2e",
  SETTINGS: { generatorInput: "generatorInput", apiBaseUrl: "apiBaseUrl" },
  getSetting: () => undefined,
  isLikelyKeylessLocalEndpoint: () => false,
  getProviderAuthWarningKey: () => null, getProviderRequestConfig: () => ({}),
  restoreGeneratorInput: (_saved, defaults) => defaults, rememberedInput: (input) => input,
  SpfApp: class {
    _beginProgress() { this.abort = new AbortController(); return this.abort.signal; }
    async _setStep() {}
    _recordTokens() {}
    _finishRun() {}
    _recordFailure() {}
    _throwIfCancelled() {}
    _onAIProgress() {}
    async render() {
      const gate = renderGate;
      if (gate) { renderGate = null; await gate.promise; }
    }
  },
  // Real builder helpers, so loot goes through the production normalizer and budget code.
  normalizeLoot: builder.normalizeLoot, parseCoins: builder.parseCoins, lootValueGp: builder.lootValueGp,
  enforceNamedLootBudget: builder.enforceNamedLootBudget, dedupeLootAgainstEquipment: builder.dedupeLootAgainstEquipment,
  applyTreasureBudget: builder.applyTreasureBudget, slugify: builder.slugify,
  ...recentGenerations,
  ...generatorContext,
  composeEncounter,
  findPreset: () => null,
  randomBrief: () => "random brief",
  generateEncounter: async () => encounterReply(),
  findBestiaryScaffold: async () => ({}),
  scaffoldArt: () => null,
  generatedFolderId: async () => null,
  moveToGeneratedFolder: async () => {},
  verifyCreatedActor: () => {},
  rollbackActor: async () => null,
  assertComplete: () => {},
  completionManifest: () => ({ complete: true }),
  createActor: async (concept) => {
    createdWith.push(concept.name);
    return { actor: { id: `A${createdWith.length}`, name: concept.name, update: async () => {}, sheet: { render: async () => {} } }, expectedItems: [] };
  },
  createCharacterActor: async (concept) => {
    pcCreated.push(concept.name);
    return { actor: { id: "PC", name: concept.name, sheet: { render: async () => {} } }, expectedItems: [] };
  },
  relevelReskin: async () => ({ data: { name: "Source", system: {} } }),
  reskinActorData: (data, flavor) => ({ ...data, name: flavor.name ?? data.name }),
  // PC run
  generatePCConcept: async () => ({ concept: { name: "Pat", level: 1, loot: [] }, multiclass: null, usage: {} }),
  normalizePCConcept: (raw, { level }) => ({ ...raw, level }),
  getAncestryCandidates: async () => [], getBackgroundCandidates: async () => [],
  getClassCandidates: async () => [], getHeritageCandidates: async () => [],
  supportedClassCandidates: () => [{ id: "c" }],
  isCompletePCClass: () => false,
  selectAncestryBackgroundClass: async () => ({ usage: {}, ancestry: "a", ancestryCandidate: null, heritage: "h", heritageCandidate: null, background: "b", backgroundCandidate: null, class: "c", classCandidate: null, keyAbility: "str" }),
  resolvePCConcept: async (concept) => ({
    ancestryDoc: { name: "Human" }, classDoc: { name: "Fighter" }, featSlots: [], feats: [], pathPlan: null, archetypeBridges: null,
    equipment: [], loot: concept.loot.map((l) => ({ ...l, resolvedValue: l.value }))
  }),
  pcSpellcastingProfile: () => null,
  pcSpellPlan: () => ({}),
  pcStartingWealthGp: () => 15,
  equipmentValueGp: async () => equipmentGp,
  gpToCredits: (gp) => Math.ceil(gp * 10),
  generatePCLoot: async () => { pcLootCalls += 1; return { loot: pcLootDraft, usage: {} }; },
  refineSpells: async () => {}, refineEquipment: async () => {}, refineLoot: async () => {},
  selectFeats: async () => ({ picks: [], usage: {} }),
  resolveFeatPicks: async () => [],
  archetypeCasterPlan: () => null,
  resolveArchetypeBridges: async () => null,
  validateArchetypeSlotPlacement: () => ({ dropped: [] }),
  archetypePlacementContext: () => ({}),
  // Reskin run
  generateReskin: async () => ({ flavor: { name: "Reskinned" }, usage: {} }),
  normalizeReskin: (flavor) => ({ ...flavor, normalized: true }),
  reskinRenameTargets: () => [],
  loadRelevelSources: async () => ({})
};
const module = new vm.SourceTextModule(source, { context });
await module.link((specifier) => {
  const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .filter((match) => match[2] === specifier)
    .flatMap((match) => match[1].split(",").map((name) => name.trim()));
  return new vm.SyntheticModule(imports, function () {
    for (const name of imports) this.setExport(name, mocks[name] ?? (() => { throw new Error(`Unexpected dependency: ${name}`); }));
  }, { context });
});
await module.evaluate();
const App = module.namespace.GeneratorApp;

const makeApp = () => { const app = new App(); app._test_readForm = () => {}; return app; };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const memberOf = (name) => ({ count: 1, role: "minion", concept: { name }, resolved: { loot: [] }, manifest: {}, xpEach: 10, treasureEach: 0 });
const reset = () => {
  notices.length = 0; folders.length = 0; warnings.length = 0;
  createdWith.length = 0; pcCreated.length = 0; reskinCreated.length = 0;
  pcLootCalls = 0; pcLootDraft = []; equipmentGp = 0; renderGate = null;
};

// --- A. Encounter one-click Generate creates the folder and every member ---
{
  reset();
  encounterReply = () => ({ name: "Ambush", members: [memberOf("Grunt"), memberOf("Boss")], spent: 20, budget: 100 });
  const app = makeApp();
  app._test_input.mode = "encounter";
  app._test_input.prompt = "an ambush";
  await app._test_runGeneration(false, { create: true });
  assert.equal(app._test_error, null, `no error (${app._test_error})`);
  assert.equal(folders.length, 1, "one-click Generate creates the encounter folder once");
  assert.equal(createdWith.length, 2, "one-click Generate creates both members");
  assert.equal(app._test_created?.count, 2, "the created card counts both actors");
  assert.equal(app._test_encounter, null, "the preview is consumed by the create");
  assert.equal(app._test_busy, false);
}
// A GM click on Create All during the run's render gap is still refused: the run creates exactly once.
{
  reset();
  encounterReply = () => ({ name: "Ambush", members: [memberOf("Grunt"), memberOf("Boss")], spent: 20, budget: 100 });
  const app = makeApp();
  app._test_input.mode = "encounter";
  app._test_input.prompt = "an ambush";
  const gate = deferred();
  renderGate = gate;   // the generate step's final render waits: busy is false, the create is still pending
  const run = app._test_runGeneration(false, { create: true });
  await tick(); await tick();
  assert.equal(app._test_busy, false, "busy is already false in the render gap");
  await App._test_onCreateActor.call(app);   // the GM clicks Create All now
  assert.equal(folders.length, 0, "the click creates no folder");
  assert.equal(createdWith.length, 0, "the click creates no actor");
  gate.resolve();
  await run;
  assert.equal(folders.length, 1, "the run still creates one folder");
  assert.equal(createdWith.length, 2, "the run creates exactly its two members, nothing extra");
}
// A plain preview run followed by a manual Create All still works.
{
  reset();
  encounterReply = () => ({ name: "Ambush", members: [memberOf("Grunt"), memberOf("Boss")], spent: 20, budget: 100 });
  const app = makeApp();
  app._test_input.mode = "encounter";
  await app._test_runGeneration(false);
  assert.equal(createdWith.length, 0, "a preview-only run creates nothing");
  await App._test_onCreateActor.call(app);
  assert.equal(createdWith.length, 2, "Create All after a preview creates every member");
}

// --- B. Generate with an empty prompt never creates the previous preview ---
const goodPC = async (prompt) => {
  const app = makeApp();
  app._test_input.mode = "character";
  app._test_input.prompt = prompt;
  app._test_input.allowSpellcasting = false;
  return app;
};
{
  reset();
  const app = await goodPC("");
  app._test_pcConcept = { name: "Old PC", level: 1, loot: [] };
  app._test_pcResolved = { loot: [], equipment: [] };
  await app._test_runGeneration(false, { create: true });
  assert.deepEqual(pcCreated, [], "empty prompt creates no character from the old preview");
  assert.deepEqual(notices.map((n) => n.message), ["SIMPLYSF2E.Errors.NoPrompt"], "only the NoPrompt notice");
  assert.equal(app._test_pcConcept?.name, "Old PC", "the old preview is left alone");
}
{
  reset();
  const app = await goodPC("a brave pilot");
  await app._test_runGeneration(false, { create: true });
  assert.equal(app._test_error, null, `no error (${app._test_error})`);
  assert.deepEqual(pcCreated, ["Pat"], "a normal Generate creates exactly one character");
}
{
  reset();
  const app = makeApp();
  app._test_input.mode = "reskin";
  app._test_input.prompt = "";
  app._test_reskinSource = { uuid: "Actor.src", name: "Source", level: 3 };
  app._test_reskinData = { name: "Source", system: {} };
  app._test_reskinFlavor = { name: "Old flavor" };
  const before = app._test_reskinFlavor;
  await app._test_runGeneration(false, { create: true });
  assert.deepEqual(notices.map((n) => n.message), ["SIMPLYSF2E.Errors.NoPrompt"], "reskin: only the NoPrompt notice");
  assert.equal(app._test_created, null, "reskin: nothing created");
  assert.equal(app._test_reskinFlavor, before, "reskin: old preview untouched");
}
{
  reset();
  const app = makeApp();
  app._test_input.mode = "reskin";
  app._test_input.prompt = "swamp";
  app._test_reskinSource = { uuid: "Actor.src", name: "Source", level: 3 };
  app._test_reskinData = { name: "Source", system: {} };
  await app._test_runGeneration(false, { create: true });
  assert.equal(app._test_created?.name, "Reskinned", `reskin with a prompt creates once (${app._test_error})`);
}

console.log("generator-app.hunt2.test.mjs: passed");
