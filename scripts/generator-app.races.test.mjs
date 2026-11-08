// Run-state races and notification escaping in the production GeneratorApp
// (T-BUG-GEN, bug hunt rows 1, 2, 4, 5, 6). The real scripts/generator-app.mjs
// is loaded in a vm module with its imports mocked; private names are made
// public with a _test_ prefix, the same seam generator-app.rerollPick.test.mjs uses.
// Run: node scripts/generator-app.races.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import * as reroll from "./reroll.mjs";
import * as recentGenerations from "./recent-generations.mjs";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

// `#name` after whitespace or a dot is a private member (strings and hex colours are not).
const source = (await readFile(new URL("./generator-app.mjs", import.meta.url), "utf8"))
  .replace(/(?<=[.\s])#([A-Za-z_]\w*)/g, "_test_$1");

const notices = [];
const folders = [];
let fromUuidImpl = async () => null;
const context = vm.createContext({
  console: { warn() {}, error() {}, log() {}, debug() {} },
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
  fromUuid: (uuid) => fromUuidImpl(uuid)
});

let beginFails = 0;
let treasureCalls = [];
const createdWith = [];
let reskinReply = { flavor: { blurb: "x" }, usage: { total: 1 } };
const featRef = (id) => ({ packId: "sf2e.feats", _id: id });
const mocks = {
  MODULE_ID: "simplysf2e",
  SETTINGS: { generatorInput: "generatorInput" }, getSetting: () => undefined,
  restoreGeneratorInput: (_saved, defaults) => defaults, rememberedInput: (input) => input,
  SpfApp: class {
    _beginProgress() {
      if (beginFails > 0) { beginFails -= 1; throw new Error("progress setup failed"); }
      this.abort = new AbortController();
      return this.abort.signal;
    }
    async _setStep() {}
    _recordTokens() {}
    _finishRun() {}
    _recordFailure() {}
    _throwIfCancelled() {}
    _onAIProgress() {}
    async render() {}
  },
  ...reroll,
  ...recentGenerations,
  generateReskin: async () => reskinReply,
  normalizeReskin: (flavor) => ({ ...flavor, normalized: true }),
  reskinRenameTargets: () => [],
  loadRelevelSources: async () => ({}),
  lootValueGp: (loot) => Number(loot?.target ?? 0),
  applyTreasureBudget: (loot, target) => treasureCalls.shift()?.(loot, target),
  getFeatCandidates: async () => [{ id: "F0", name: "Quick Draw", ref: featRef("qd") }],
  selectRerollPick: async () => ({ candidate: null, usage: { total: 1 } }),
  computeStats: () => ({ level: 1, ac: 10, hp: 10, perception: 0, saves: { fortitude: 0, reflex: 0, will: 0 }, strikes: [] }),
  adjustedStats: (stats) => stats,
  signed: (n) => String(n),
  gpToCredits: (gp) => Math.round(gp * 10),
  generatedFolderId: async () => null,
  completionManifest: () => ({ complete: true }),
  completionSummary: () => ({ total: 0 }),
  statCheckForActor: () => ({}),
  describeStatCheck: () => ({ problems: 0, total: 0 }),
  hasSpellEntry: () => false,
  findBestiaryScaffold: async () => ({}),
  scaffoldArt: () => null,
  createActor: async (concept, resolved) => {
    createdWith.push({ name: concept.name, loot: resolved.loot });
    const actor = { id: `A${createdWith.length}`, name: concept.name, update: async () => {}, sheet: { render: async () => {} } };
    return { actor, expectedItems: [] };
  },
  verifyCreatedActor: () => {},
  rollbackActor: async () => null,
  moveToGeneratedFolder: async () => {},
  assertComplete: () => {}
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
// No DOM here: the form read is a no-op, so inputs are whatever the test sets.
const makeApp = () => { const app = new App(); app._test_readForm = () => {}; return app; };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};
const npc = (uuid) => ({
  documentName: "Actor", type: "npc", uuid, name: "Source", img: null,
  _source: { system: { details: { level: { value: 3 } } } }, toObject: () => ({ name: "Source", system: {} })
});

// --- Row 1: a reskin load that resumes after a finished run must not wipe its preview ---
{
  const app = makeApp();
  const gate = deferred();
  let calls = 0;
  fromUuidImpl = async () => {
    calls += 1;
    if (calls === 1) await gate.promise;   // the load's own source read stays pending
    return npc("Actor.src");
  };
  app._test_input.mode = "reskin";
  app._test_input.prompt = "a swamp theme";
  const load = app._test_loadReskinActor(npc("Actor.src"));
  await tick();
  await app._test_generateReskin();   // a whole run, started and finished during the load
  assert.ok(app._test_reskinFlavor?.normalized, "the run produced a preview");
  const flavor = app._test_reskinFlavor;
  gate.resolve();
  await load;
  assert.equal(app._test_reskinFlavor, flavor, "the late load leaves the finished preview alone");
  assert.equal(app._test_busy, false);
}

// A load that resumes while a run is still in flight leaves the busy run's state alone.
{
  const app = makeApp();
  const gate = deferred();
  fromUuidImpl = async () => { await gate.promise; return npc("Actor.src"); };
  const load = app._test_loadReskinActor(npc("Actor.src"));
  await tick();
  app._test_busy = true;
  app._test_error = "kept";
  gate.resolve();
  await load;
  assert.equal(app._test_error, "kept", "a busy run's error is not cleared by the load");
}

// An ordinary load (nothing started meanwhile) still resets the preview, as before.
{
  const app = makeApp();
  fromUuidImpl = async () => npc("Actor.src");
  app._test_error = "old";
  await app._test_loadReskinActor(npc("Actor.src"));
  assert.equal(app._test_error, null);
  assert.equal(app._test_reskinFlavor, null);
  assert.deepEqual(app._test_reskinData, { name: "Source", system: {} });
}

// --- Row 4: member-count loot fits resolve in order, the last matches the final count ---
{
  const app = makeApp();
  const member = { count: 1, xpEach: 10, treasureGroupBudget: 90, treasureBudgetEach: 90, treasureEach: 90, resolved: { loot: { target: 90 } } };
  app._test_encounter = { members: [member], spent: 10, budget: 100 };
  const pending = [];
  const apply = (loot, target) => {
    const d = deferred();
    pending.push({ target, resolve: () => d.resolve({ target }) });
    return d.promise;
  };
  treasureCalls = [apply, apply];
  const first = app._test_stepMemberCount(0, 1);    // count 2
  const second = app._test_stepMemberCount(0, 1);   // count 3
  assert.equal(member.count, 3, "the count changes at once");
  // Resolve the newest pending fit first each round, so an unserialised pair lands out of order.
  let done = false;
  const both = Promise.all([first, second]).then(() => { done = true; });
  for (let guard = 0; guard < 20 && !done; guard += 1) {
    await tick();
    while (pending.length) pending.pop().resolve();
  }
  await both;
  assert.equal(member.treasureBudgetEach, 30, "per-copy budget follows the final count (90 / 3)");
  assert.equal(member.resolved.loot.target, 30, "the loot is fitted to the final count");
  assert.equal(member.treasureEach, 30, "treasureEach matches the loot");
  assert.equal(app._test_encounter.treasureSpent, 90);
}

// --- Row 5: all counts 0 -> no folder, a notice, not busy ---
{
  const app = makeApp();
  app._test_encounter = {
    name: "Empty", members: [{ count: 0, role: "minion", concept: { name: "A" } }, { count: 0, role: "minion", concept: { name: "B" } }], spent: 0, budget: 100
  };
  folders.length = 0;
  notices.length = 0;
  await app._test_createEncounterActors();
  assert.equal(folders.length, 0, "no empty folder is created");
  assert.equal(notices.length, 1);
  assert.equal(notices[0].message, "SIMPLYSF2E.Generator.NoMembers");
  assert.equal(app._test_busy, false);
  assert.equal(app._test_buildEncounterPreviewContext().allSkipped, true, "the template disables Create All");
  app._test_encounter.members[0].count = 1;
  assert.equal(app._test_buildEncounterPreviewContext().allSkipped, false);
}

// --- Row 6: a throw while the progress bar is set up must not leave the window busy ---
{
  const app = makeApp();
  app._test_reskinSource = { uuid: "Actor.src", name: "Source", level: 3 };
  app._test_input.prompt = "a theme";
  beginFails = 1;
  await app._test_generateReskin();
  assert.equal(app._test_busy, false, "busy is reset after a setup failure");
  assert.equal(beginFails, 0);
}

// --- Row 2: an AI name reaches the notification as an escaped format value ---
{
  const app = makeApp();
  const evil = "<b>x</b>";
  const feats = [{ name: evil, candidate: featRef("qd") }];
  app._test_concept = {
    name: "N", level: 5, traits: [], spellcasting: null, focusSpells: [], feats, specialAbilities: [],
    equipment: [], loot: []
  };
  app._test_resolved = {
    spells: [], feats: [{ name: evil, entry: featRef("qd") }], abilities: [], focusSpells: [], equipment: [], loot: [], skippedGear: []
  };
  notices.length = 0;
  await App.DEFAULT_OPTIONS.actions.rerollPick.call(app, null, { dataset: { kind: "feat", index: "0" } });
  const notice = notices.find((n) => /RerollPick/.test(n.message));
  assert.ok(notice, "the reroll notice fired");
  assert.deepEqual(JSON.parse(JSON.stringify(notice.options)), { localize: true, format: { name: evil }, escape: true },
    "the AI name travels as an escaped format value, not pre-formatted into the message");
  assert.ok(!notice.message.includes(evil), "the raw name is not in the message string");
}

// --- Epoch: a manual create that finishes during a reskin load keeps its created card ---
{
  const app = makeApp();
  const gate = deferred();
  let calls = 0;
  fromUuidImpl = async () => {
    calls += 1;
    if (calls === 1) await gate.promise;
    return npc("Actor.src");
  };
  const load = app._test_loadReskinActor(npc("Actor.src"));
  await tick();
  app._test_concept = { name: "Made", level: 1, traits: [], feats: [], specialAbilities: [], equipment: [], loot: [] };
  app._test_resolved = { spells: [], feats: [], abilities: [], focusSpells: [], equipment: [], loot: [], skippedGear: [] };
  app._test_manifest = { complete: true };
  await App._test_onCreateActor.call(app);   // a whole manual create, started and finished during the load
  assert.equal(app._test_created?.name, "Made", `the create produced its card (${app._test_error})`);
  gate.resolve();
  await load;
  assert.equal(app._test_created?.name, "Made", "the late load leaves the created card alone");
}

// --- Create All waits for a queued +/- fit and embeds loot fitted to the final count ---
{
  const app = makeApp();
  const member = {
    count: 1, xpEach: 10, treasureGroupBudget: 90, treasureBudgetEach: 90, treasureEach: 90,
    concept: { name: "Grunt" }, manifest: {}, resolved: { loot: { target: 90 } }
  };
  app._test_encounter = { name: "Fight", members: [member], spent: 10, budget: 100 };
  const fit = deferred();
  treasureCalls = [(loot, target) => fit.promise.then(() => ({ target }))];
  createdWith.length = 0;
  const step = app._test_stepMemberCount(0, 1);   // count 2, fit still in flight
  const create = app._test_createEncounterActors();
  await tick();
  assert.equal(createdWith.length, 0, "no actor is built while the fit is pending");
  fit.resolve();
  await step;
  await create;
  assert.equal(createdWith.length, 2);
  assert.ok(createdWith.every((c) => c.loot.target === 45), "both actors carry loot fitted to the final count (90 / 2)");
}

console.log("generator-app.races.test.mjs: reskin load, member steps, empty encounter, busy reset and notice escaping passed");
