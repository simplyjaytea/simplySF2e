// Exercise the production reroll-one-pick action without provider or Foundry writes.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { completionManifest, assertComplete } from "./completion.mjs";
import * as reroll from "./reroll.mjs";
import * as recentGenerations from "./recent-generations.mjs";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}
const source = (await readFile(new URL("./generator-app.mjs", import.meta.url), "utf8"))
  .replace(/#(concept|resolved|manifest|error|busy|rerollRejected|buildPreviewContext|stashPreview|readForm|recent)\b/g, "_test_$1");
const warnings = [];
const context = vm.createContext({
  console: { warn() {}, error() {}, log() {} },
  game: { i18n: { localize: (key) => key, format: (key, data) => `${key}:${JSON.stringify(data)}` } },
  ui: { notifications: { warn: (message) => warnings.push(message) } }
});

const spellRef = (id) => ({ packId: "sf2e.spells", _id: id });
const featRef = (id) => ({ packId: "sf2e.feats", _id: id });
const abilityRef = (id) => ({ packId: "sf2e.abilities", _id: id });
let spellCatalog = [];
let replyId = null;
let providerFailure = null;
let lastPick = null;
let spellArgs = null;
let featArgs = null;
const mocks = {
  MODULE_ID: "simplysf2e",
  SpfApp: class {
    _beginProgress() { this.abort = new AbortController(); return this.abort.signal; }
    async _setStep() {}
    _recordTokens() {}
    _finishRun() {}
    _recordFailure() {}
    _throwIfCancelled() {
      if (this.abort?.signal.aborted) throw Object.assign(new Error("cancelled"), { cancelled: true });
    }
    async render() {}
  },
  ...reroll,
  ...recentGenerations,
  completionManifest, assertComplete,
  getSpellCandidates: async (...args) => { spellArgs = args; return spellCatalog; },
  getFeatCandidates: async (args) => {
    featArgs = args;
    return [
      { id: "F0", name: "Quick Draw", ref: featRef("qd") },
      { id: "F1", name: "Reactive Shield", ref: featRef("rs") }
    ];
  },
  getAbilityCandidates: async () => [
    { id: "A0", name: "Grab", ref: abilityRef("grab") },
    { id: "A1", name: "Knockdown", ref: abilityRef("kd") }
  ],
  selectRerollPick: async ({ candidates, ...rest }) => {
    lastPick = { candidates, ...rest };
    if (providerFailure) throw providerFailure;
    return { candidate: candidates.find((candidate) => candidate.id === replyId) ?? null, usage: { total: 10 } };
  }
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
const action = App.DEFAULT_OPTIONS.actions.rerollPick;
const target = (kind, index) => ({ dataset: { kind, index: String(index) } });

function preview() {
  const app = new App();
  const spells = [
    { name: "Electric Arc", candidate: spellRef("arc"), rank: 0 },
    { name: "Shock", candidate: spellRef("shock"), rank: 2 }
  ];
  const feats = [{ name: "Quick Draw", candidate: featRef("qd") }];
  const specialAbilities = [{ name: "Grab", candidate: abilityRef("grab") }, { name: "Storm Aura", narrative: true }];
  app._test_concept = {
    name: "Storm Adept", level: 5, traits: ["humanoid"],
    spellcasting: { tradition: "arcane", maxRank: 2, spells }, focusSpells: [], feats, specialAbilities,
    equipment: [], loot: []
  };
  app._test_resolved = {
    spells: spells.map((spell) => ({ spell, entry: spell.candidate })),
    feats: feats.map((feat) => ({ name: feat.name, entry: feat.candidate })),
    abilities: specialAbilities.map((ability) => ({ ability, entry: ability.candidate ?? null })),
    focusSpells: [], equipment: [], loot: [], skippedGear: []
  };
  app._test_manifest = completionManifest({ mode: "npc", concept: app._test_concept, resolved: app._test_resolved });
  assert.equal(app._test_manifest.complete, true);
  return app;
}
const retained = (app) => ({ concept: app._test_concept, resolved: app._test_resolved, manifest: app._test_manifest });
function assertRetained(app, before) {
  assert.equal(app._test_concept, before.concept);
  assert.equal(app._test_resolved, before.resolved);
  assert.equal(app._test_manifest, before.manifest);
  assert.equal(app._test_busy, false);
}

spellCatalog = [
  { id: "S0", name: "Light", rank: 0, ref: spellRef("light") },
  { id: "S1", name: "Fear", rank: 1, ref: spellRef("fear") },
  { id: "S2", name: "Blur", rank: 2, ref: spellRef("blur") },
  { id: "S3", name: "Shock", rank: 1, ref: spellRef("shock2") }
];

// A successful spell reroll swaps only that slot, keeps its rank, and records the old name.
{
  const app = preview();
  const before = retained(app);
  replyId = "S2";
  await action.call(app, null, target("spell", 1));
  assert.equal(app._test_error, null);
  assert.deepEqual(spellArgs.slice(0, 2), ["arcane", 2], "spell catalogs use the creature's tradition and max rank");
  assert.deepEqual(lastPick.candidates.map((c) => c.id), ["S1", "S2"], "only ranked, unused spells that fit the slot are offered");
  assert.equal(lastPick.current, "Shock");
  assert.notEqual(app._test_concept, before.concept);
  assert.deepEqual(app._test_concept.spellcasting.spells[1], { name: "Blur", candidate: spellRef("blur"), rank: 2 });
  assert.equal(app._test_concept.spellcasting.spells[0], before.concept.spellcasting.spells[0]);
  assert.equal(before.concept.spellcasting.spells[1].name, "Shock", "the accepted concept is not mutated");
  assert.equal(app._test_resolved.spells[1].entry, spellCatalog[2].ref, "the issued reference reaches resolution unchanged");
  assert.equal(app._test_resolved.spells[1].spell, app._test_concept.spellcasting.spells[1]);
  assert.equal(app._test_manifest.complete, true);
  assert.equal(app._test_manifest.mode, "npc");

  // A second reroll of the same slot never swaps back to a rejected pick.
  replyId = "S1";
  await action.call(app, null, target("spell", 1));
  assert.deepEqual(lastPick.candidates.map((c) => c.id), ["S1"], "Shock (rejected) and Blur (current) are not offered");
  assert.equal(app._test_concept.spellcasting.spells[1].name, "Fear");
  warnings.length = 0;
  await action.call(app, null, target("spell", 1));
  assert.equal(warnings.length, 1, "an exhausted slot warns instead of calling the AI with nothing");
  assert.match(warnings[0], /RerollPickNone/);
  assert.equal(app._test_concept.spellcasting.spells[1].name, "Fear");
}

// Feats and abilities follow the same path.
{
  const app = preview();
  replyId = "F1";
  await action.call(app, null, target("feat", 0));
  assert.equal(featArgs.level, 5);
  assert.equal(featArgs.category, "class");
  assert.deepEqual(app._test_concept.feats[0], { name: "Reactive Shield", candidate: featRef("rs") });
  assert.equal(app._test_resolved.feats[0].name, "Reactive Shield");
  assert.deepEqual({ ...app._test_resolved.feats[0].entry }, featRef("rs"));
  replyId = "A1";
  await action.call(app, null, target("ability", 0));
  assert.deepEqual(app._test_concept.specialAbilities[0], { name: "Knockdown", candidate: abilityRef("kd") });
  assert.deepEqual({ ...app._test_resolved.abilities[0].entry }, abilityRef("kd"));
  assert.equal(app._test_resolved.abilities[1].ability.name, "Storm Aura", "the narrative row is untouched");
  assert.equal(app._test_manifest.complete, true);
}

// Narrative abilities, bad slots and busy windows are ignored.
for (const [kind, index] of [["ability", 1], ["spell", 7], ["loot", 0], ["spell", "x"]]) {
  const app = preview();
  const before = retained(app);
  lastPick = null;
  await action.call(app, null, target(kind, index));
  assertRetained(app, before);
  assert.equal(lastPick, null, `${kind}:${index} never reaches the AI`);
}
{
  const app = preview();
  app._test_busy = true;
  lastPick = null;
  await action.call(app, null, target("spell", 1));
  assert.equal(lastPick, null, "a busy window ignores the click");
}

// An unlisted reply or a provider failure keeps the accepted preview.
{
  const app = preview();
  const before = retained(app);
  replyId = "invented";
  warnings.length = 0;
  await action.call(app, null, target("spell", 1));
  assertRetained(app, before);
  assert.match(warnings[0], /RerollPickInvalid/);
  assert.equal(app._test_error, null);
}
for (const failure of [new Error("provider unavailable"), Object.assign(new Error("cancelled"), { cancelled: true })]) {
  const app = preview();
  const before = retained(app);
  providerFailure = failure;
  await action.call(app, null, target("spell", 1));
  assertRetained(app, before);
  assert.equal(app._test_error, failure.message);
  assert.equal(app._test_rerollRejected.size, 0, "a failed reroll rejects nothing");
}
providerFailure = null;

// Recent previews: a rerolled preview keeps its picks (and its rejected
// names) when it moves to the list, and Open brings back exactly that state.
// Rerolling the restored preview never edits a list entry in place.
{
  const app = preview();
  app._test_readForm = () => {};
  replyId = "F1";
  await action.call(app, null, target("feat", 0));
  const rerolled = app._test_concept;
  app._test_stashPreview();
  assert.equal(app._test_concept, null);
  assert.equal(app._test_rerollRejected.size, 0, "the next preview starts with no rejected names");
  const [entry] = app._test_recent;
  assert.equal(entry.state.concept, rerolled);
  await App.DEFAULT_OPTIONS.actions.openRecent.call(app, null, { dataset: { recentId: entry.id } });
  assert.equal(app._test_concept.feats[0].name, "Reactive Shield", "the rerolled pick comes back");
  assert.equal(app._test_rerollRejected.get("feat:0")?.size, 1, "rejected names come back with their preview");
  assert.equal(app._test_recent.length, 0, "the open preview is not also in the list");
  replyId = "A1";
  await action.call(app, null, target("ability", 0));
  assert.equal(entry.state.concept.specialAbilities[0].name, rerolled.specialAbilities[0].name,
    "a reroll after Open leaves the old entry object untouched");
  assert.equal(app._test_manifest.complete, true);
}

console.log("generator-app reroll pick: slot-preserving grounded swaps passed");
