// Behaviour guard for the generator-app context-builder split (T-P4).
// The snapshot in scripts/__snapshots__/generator-context.json was written from the
// builders as they were INSIDE generator-app.mjs; this test replays the same inputs
// and deep-equals the output, so moving the builders into scripts/generator-context/
// cannot change what the templates receive.
// Run: node scripts/generator-context.snapshot.test.mjs
//      SPF_WRITE_SNAPSHOT=1 node scripts/generator-context.snapshot.test.mjs   (rewrite the snapshot; only for a deliberate change)
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

const SNAPSHOT = new URL("./__snapshots__/generator-context.json", import.meta.url);
const WRITE = process.env.SPF_WRITE_SNAPSHOT === "1";

// ---- deterministic Foundry stand-ins -------------------------------------------------------
const context = vm.createContext({
  console: { warn() {}, error() {}, log() {}, debug() {} },
  game: { i18n: { localize: (key) => key, format: (key, data) => `${key}:${JSON.stringify(data)}` } },
  CONFIG: { PF2E: { skills: { acrobatics: { label: "Acrobatics" }, athletics: { label: "Athletics" } } } }
});
// Wall-clock formatting is locale and zone dependent; pin it.
vm.runInContext("Date.prototype.toLocaleTimeString = function () { return 'T' + this.getTime(); };", context);
// The recent-previews builder now runs outside the vm (generator-context/result-context.mjs), in this realm.
Date.prototype.toLocaleTimeString = function () { return "T" + this.getTime(); };
// Number formatting follows the browser locale in production (no locale argument); pin it here.
{
  const toLocale = Number.prototype.toLocaleString;
  Number.prototype.toLocaleString = function (locale, options) { return toLocale.call(this, locale ?? "en-US", options); };
}
console.warn = () => {}; // the real modules warn about fixture traits; keep the output clean
globalThis.game = context.game;
globalThis.CONFIG = context.CONFIG;

// ---- load the production GeneratorApp with every private member made public ------------------
const source = (await readFile(new URL("./generator-app.mjs", import.meta.url), "utf8"))
  .replace(/(?<=[.\s])#([A-Za-z_]\w*)/g, "_test_$1");
const specifiers = [...new Set([...source.matchAll(/from\s*"([^"]+)"/g)].map((match) => match[1]))];
const MOCKED = new Set(["./app-base.mjs", "./manage-presets-app.mjs", "./sources-app.mjs"]);
const real = new Map();
for (const specifier of specifiers) {
  if (MOCKED.has(specifier)) continue;
  try { real.set(specifier, await import(new URL(specifier, import.meta.url).href)); } catch { /* left to the throwing stub */ }
}
const module = new vm.SourceTextModule(source, { context });
await module.link((specifier) => {
  const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .filter((match) => match[2] === specifier)
    .flatMap((match) => match[1].split(",").map((name) => name.trim()));
  const namespace = real.get(specifier) ?? {};
  return new vm.SyntheticModule(imports, function () {
    for (const name of imports) {
      if (specifier === "./app-base.mjs" && name === "SpfApp") this.setExport(name, class { async render() {} });
      else if (MOCKED.has(specifier)) this.setExport(name, class {});
      else this.setExport(name, namespace[name] ?? (() => { throw new Error(`Unexpected dependency: ${name}`); }));
    }
  }, { context });
});
await module.evaluate();
const App = module.namespace.GeneratorApp;
const newApp = () => new App();
// Builders that moved out of the app class are called on their modules (T-P4); the rest still go through the app seam.
const { archetypePlacementContext, skillReportContext } = await import("./generator-context/pc-preview.mjs");
const { completionContext } = await import("./generator-context/result-context.mjs");

// ---- inputs: production shapes ---------------------------------------------------------------
const { normalizeConcept } = await import("./builder.mjs");
const rawConcept = (overrides = {}) => ({
  name: "Rift-Scarred Vanguard", level: 4, rarity: "common", size: "medium",
  blurb: "A mercenary half-fused with a failing warp lattice.",
  description: "Its armor hums where it meets the lattice.",
  abilityScales: { str: "high", dex: "moderate", con: "high", int: "low", wis: "moderate", cha: "low" },
  acScale: "high", hpScale: "high", perceptionScale: "moderate",
  saveScales: { fortitude: "high", reflex: "moderate", will: "low" },
  speeds: [{ type: "land", value: 25 }], senses: [{ type: "darkvision", acuity: "precise" }],
  languages: ["Common", "Kalo"], skills: [{ name: "Athletics", scale: "high" }],
  strikes: [
    { name: "Lattice Blade", type: "melee", attackScale: "high", damageScale: "high", damageType: "slashing", traits: [] },
    { name: "Rail Pistol", type: "ranged", attackScale: "moderate", damageScale: "moderate", damageType: "piercing", traits: [] }
  ],
  specialAbilities: [], feats: [], equipment: [], loot: [], traits: ["humanoid", "human"],
  resistances: ["fire"], weaknesses: ["cold-iron"], immunities: ["fear"], ...overrides
});
const concept = (overrides = {}) => normalizeConcept(rawConcept(overrides), { level: overrides.level ?? 4, rarity: overrides.rarity ?? "common" });

const creatureConcept = concept({ rarity: "uncommon", specialAbilities: [{ name: "Surge" }], spellcasting: { tradition: "arcane", dcScale: "high", attackScale: "high", spells: [] } });
creatureConcept.spellcasting = { tradition: "arcane", maxRank: 2, spells: [{ name: "Shock", rank: 1 }, { name: "Haste", rank: 2 }] };
creatureConcept.feats = ["Sudden Charge"];
const creatureResolved = {
  abilities: [
    { ability: { name: "Rally", narrative: false, description: "x" }, entry: { name: "Rally the Line" } },
    { ability: { name: "Frost Breath", areaBlast: true, description: "Frost pours." }, entry: null },
    { ability: { name: "Hums", narrative: true, description: "Flavor only." }, entry: null },
    { ability: { name: "Stench", aura: true }, entry: null }
  ],
  spells: [
    { spell: { name: "Shock", rank: 1, signature: true }, entry: { name: "Shock" } },
    { spell: { name: "Haste", rank: 2 }, entry: null }
  ],
  feats: [{ name: "Sudden Charge", entry: { name: "Sudden Charge" } }, { name: "Lattice Reflex", entry: null }],
  equipment: [
    { name: "Plasma Rifle", quantity: 1, runes: { potency: 1 }, entry: { name: "Rifle" } },
    { name: "Tactical Plate Armor", quantity: 2, runes: {}, entry: { name: "Tactical Plate Armor" } },
    { name: "Ghost Gem", quantity: 1, scroll: { rank: 3 }, entry: { name: "Fireball" } }
  ],
  loot: [{ name: "Credstick", quantity: 120, entry: { name: "Credstick" } }],
  skippedGear: [{ name: "Chitin Shell", quantity: 3, category: "equipment" }, { name: "Oddity", quantity: 1, category: "loot" }]
};

const encounter = (counts, over = {}) => ({
  name: "Ambush at the Failing Lattice", budget: 120, spent: 135, treasureBudget: 280, treasureSpent: 120.4,
  members: counts.map((count, index) => ({
    count, role: index === 0 ? "boss" : "minion", xpEach: 40, concept: concept({ name: `Member ${index + 1}`, level: 3 + index })
  })), ...over
});

const pcConcept = {
  name: "Kess Vandrel", ancestry: "Vesk", heritage: "Armored", background: "Guard", class: "Soldier", keyAbility: "str",
  level: 3, skillPriorities: ["athletics", "acrobatics"], spellcasting: { signatureRanks: [1, 2] },
  spellcastingNoticeKey: "SIMPLYSF2E.Notice.Test", multiclass: "mystic"
};
const pcResolved = {
  ancestryDoc: { name: "Vesk" }, heritageDoc: null, backgroundDoc: { name: "Guard" }, classDoc: { name: "Soldier" },
  feats: [
    { name: "Power Strike", entry: { name: "Power Strike" }, type: "class", level: 1 },
    { name: "x", entry: null, type: "general", level: 3 },
    { name: "Mystic Dedication", entry: { name: "Mystic Dedication" }, type: "class", level: 2, archetype: true, placement: "placed" },
    { name: "y", entry: null, type: "skill", level: 2, placement: "rejected" }
  ],
  spells: [
    { spell: { name: "Shock", rank: 1, signature: true }, entry: { name: "Shock" } },
    { spell: { name: "Haste", rank: 2, signature: true }, entry: null }
  ],
  equipment: [{ name: "Plasma Rifle", quantity: 1, runes: {}, entry: { name: "Rifle" } }],
  loot: [{ name: "Credstick", quantity: 5, entry: { name: "Credstick" } }],
  skippedGear: [{ name: "Chitin", quantity: 2, category: "equipment" }]
};

const skillReport = {
  rows: [{ slug: "athletics", rank: 2 }, { name: "Custom Lore", rank: 1 }], automatic: false,
  trainingBudget: 6, unspentTraining: 1, unspentIncreases: 2,
  warnings: ["unspent-training", "grant-timing", "unknown-code"],
  loadoutWarnings: ["loadout-untrained-armor", "loadout-missing-ammo", "loadout-mystery"]
};

const reskinSource = { uuid: "Actor.src", name: "Source Creature", img: null, level: 5 };
const reskinFlavor = {
  name: "Captain Voss", blurb: "b", readAloud: "r", recallKnowledge: "rk",
  description: "First paragraph.\n\nSecond paragraph.\n\n\n\n  Third.  ", renames: [{ id: "a1", name: "Void Blade" }]
};
const reskinData = {
  name: "Source", type: "npc", system: { details: { level: { value: 5 } }, attributes: { ac: { value: 21 }, hp: { max: 90, value: 90 } },
    perception: { mod: 11 }, saves: { fortitude: { value: 12 }, reflex: { value: 9 }, will: { value: 8 } } },
  items: [
    { _id: "m1", type: "melee", name: "Claw", system: { bonus: { value: 13 }, damageRolls: { a: { damage: "2d8+6", damageType: "slashing" } } } }
  ]
};

const recentEntries = [
  { id: "r5", mode: "character", name: "Kess Vandrel", level: 3, at: 1000 },
  { id: "r4", mode: "encounter", name: "", level: 4, at: 2000 },
  { id: "r3", mode: "reskin", name: "Captain Voss", level: null, at: 3000 },
  { id: "r2", mode: "npc", name: "Quartermaster", level: 2, at: 4000 },
  { id: "r1", mode: "monster", name: "Vanguard", level: 4, at: 5000 }
];

// ---- run every builder; clone so the snapshot is plain JSON ----------------------------------
const plain = (value) => JSON.parse(JSON.stringify(value === undefined ? null : value));
const out = {};

// Single creature preview (monster / NPC statblock)
{
  const app = newApp();
  out.creatureNone = plain(app._test_buildPreviewContext());
  app._test_concept = creatureConcept;
  app._test_resolved = creatureResolved;
  out.creatureFull = plain(app._test_buildPreviewContext());
  app._test_resolved = null;
  out.creatureNoResolved = plain(app._test_buildPreviewContext());
  app._test_concept = concept({ adjustment: "elite", immunities: [], resistances: [], weaknesses: [], rarity: "rare" });
  app._test_resolved = { abilities: [], spells: [], feats: [], equipment: [], loot: [], skippedGear: [] };
  out.creatureElite = plain(app._test_buildPreviewContext());
}
// Encounter preview
{
  const app = newApp();
  out.encounterNone = plain(app._test_buildEncounterPreviewContext());
  app._test_encounter = encounter([1, 3, 0]);
  out.encounterMixed = plain(app._test_buildEncounterPreviewContext());
  app._test_encounter = encounter([0, 0]);
  out.encounterAllSkipped = plain(app._test_buildEncounterPreviewContext());
  app._test_encounter = encounter([2, 2], { spent: 80, budget: 120, treasureSpent: 10, treasureBudget: 500 });
  out.encounterUnder = plain(app._test_buildEncounterPreviewContext());
}
// Character preview, multiclass picker, archetype placement is staged-context only (needs docs): covered below via skills/completion
{
  const app = newApp();
  out.pcNone = plain(app._test_buildPCPreviewContext());
  app._test_pcConcept = pcConcept;
  app._test_pcResolved = pcResolved;
  out.pcFull = plain(app._test_buildPCPreviewContext());
  app._test_pcConcept = { ...pcConcept, heritage: null, multiclass: null, spellcasting: null, spellcastingNoticeKey: null, skillPriorities: [] };
  app._test_pcResolved = { ...pcResolved, ancestryDoc: null, backgroundDoc: null, classDoc: null, feats: [], spells: [], skippedGear: [] };
  out.pcSparse = plain(app._test_buildPCPreviewContext());
  app._test_input.multiclass = "mystic";
  out.multiclassPicker = plain(app._test_multiclassPickerContext());
}
{
  const docs = {
    ancestryDoc: { name: "Vesk", system: { boosts: {}, flaws: {} } },
    heritageDoc: { name: "Armored" },
    backgroundDoc: { name: "Guard", system: { boosts: {}, trainedSkills: { lore: ["Guard Lore", " "], value: [] } } },
    classDoc: { name: "Soldier", system: { keyAbility: { value: ["str", "con"] }, trainedSkills: { value: ["athletics"], additional: 3 }, skillIncreaseLevels: { value: [3] } } },
    pathPlan: { "mechanic-exocortex": { name: "Drone", skills: { stealth: 1 } }, "technomancer-programming-language": { name: "Rust" }, empty: {} }
  };
  out.archetypePlacement = plain(archetypePlacementContext(docs, { ...pcConcept, abilityPriorities: ["str"], skillPriorities: [] }));
  out.archetypePlacementNoHeritage = plain(archetypePlacementContext({ ...docs, heritageDoc: null, pathPlan: {} }, { ...pcConcept, keyAbility: "dex" }));
}
out.skillReport = plain(skillReportContext(skillReport));
out.skillReportNone = plain(skillReportContext(null));
out.skillReportAuto = plain(skillReportContext({ rows: [], automatic: true, trainingBudget: null, unspentTraining: null, unspentIncreases: 0, warnings: [], loadoutWarnings: [] }));
{
  const { completionManifest } = await import("./completion.mjs");
  const manifest = completionManifest({ mode: "npc", concept: creatureConcept, resolved: creatureResolved });
  out.completion = plain(completionContext([manifest]));
  out.completionEmpty = plain(completionContext([]));
}
// Reskin preview and re-level controls
{
  const app = newApp();
  out.reskinNone = plain(app._test_buildReskinPreviewContext());
  out.relevelNone = plain(app._test_buildRelevelContext());
  app._test_reskinSource = reskinSource;
  app._test_reskinFlavor = reskinFlavor;
  out.reskinSame = plain(app._test_buildReskinPreviewContext());
  app._test_reskinData = reskinData;
  app._test_reskinSources = {};
  out.relevelSame = plain(app._test_buildRelevelContext());
  app._test_reskinLevel = 8;
  out.reskinReleveled = plain(app._test_buildReskinPreviewContext());
  out.relevelUp = plain(app._test_buildRelevelContext());
  app._test_reskinFlavor = { name: undefined, description: undefined };
  out.reskinBare = plain(app._test_buildReskinPreviewContext());
}
// Recent previews
{
  const app = newApp();
  out.recentNone = plain(app._test_buildRecentContext());
  app._test_recent = recentEntries;
  out.recent = plain(app._test_buildRecentContext());
}

if (WRITE) {
  await mkdir(dirname(SNAPSHOT.pathname), { recursive: true });
  await writeFile(SNAPSHOT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`generator-context.snapshot.test.mjs: wrote ${Object.keys(out).length} snapshots`);
} else {
  const expected = JSON.parse(await readFile(SNAPSHOT, "utf8"));
  assert.deepEqual(Object.keys(out), Object.keys(expected), "the same builders are snapshotted");
  for (const key of Object.keys(expected)) {
    assert.deepEqual(plain(out[key]), expected[key], `${key}: the context the template receives is unchanged`);
  }
  console.log(`generator-context.snapshot.test.mjs: ${Object.keys(expected).length} builder outputs match the snapshot`);
}
