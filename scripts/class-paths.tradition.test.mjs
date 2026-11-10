// A Mystic's or Witchwarper's class spell tradition comes from the planned
// Connection or Paradox's own rule (planClassPaths `tradition`), never the AI.
// Part 1 uses rules copied verbatim from the pinned sf2e 1.7.0 packs; part 2
// re-reads every Connection and Paradox from the local class-bench cache when
// it exists (gitignored) and plans the real class against each option.
// Run: node scripts/class-paths.tradition.test.mjs
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// compendium.mjs caches pack indexes per process, so the cache check (part 2)
// runs in its own child process with a fresh index.
const DATA_RUN = process.env.SPF_TRADITION_DATA === "1";

const docs = new Map();
const indexes = new Map();
const PACKS = { "class-features": "sf2e.class-features", feats: "sf2e.feats", actions: "sf2e.actions" };

function register(packKey, source) {
  const packId = PACKS[packKey];
  const document = { pack: packId, name: source.name, uuid: `Compendium.${packId}.Item.${source._id}`, toObject: () => structuredClone(source) };
  docs.set(`Compendium.${packId}.Item.${source._id}`, document);
  docs.set(`Compendium.${packId}.Item.${source.name}`, document);
  if (!indexes.has(packId)) indexes.set(packId, []);
  indexes.get(packId).push({ _id: source._id, name: source.name, type: source.type, system: source.system });
}

globalThis.game = {
  packs: { get: (id) => (indexes.has(id) ? {
    getIndex: async () => indexes.get(id),
    getDocument: async (docId) => docs.get(`Compendium.${id}.Item.${docId}`) ?? null
  } : null) },
  settings: { get: () => ({}) }
};
globalThis.CONFIG = { PF2E: {} };
globalThis.fromUuid = async (uuid) => docs.get(uuid) ?? null;

const { planClassPaths } = await import("./class-paths.mjs");
const { classSpellTradition, traditionFromChoiceOption } = await import("./pc-support.mjs");

/** selectChoices stub with the production return shape: picks the labelled option per group. */
const choose = (label, seen = []) => async (groups) => {
  seen.push(...groups);
  return { picks: groups.map((group) => ({ choice: group.id, option: (group.options.find((option) => option.label === label) ?? group.options[0]).id })) };
};

// ---- Part 1: verbatim rules (sf2e 1.7.0 class-features/mystic/connection.json,
// connections/{elemental,akashic}.json, witchwarper/paradox.json, paradoxes/{analyst,gap-influenced}.json).
const feature = (id, name, tag, rules) => ({ _id: id, name, type: "feat",
  system: { category: "classfeature", level: { value: 1 }, traits: { value: [], otherTags: tag ? [tag] : [] }, rules } });
const bridgeRules = (flag, tag, prompt) => [
  { adjustName: false, choices: { filter: [`item:tag:${tag}`] }, flag, key: "ChoiceSet", prompt },
  { key: "GrantItem", uuid: `{item|flags.system.rulesSelections.${flag}}` }
];
const skill = (slug) => ({ key: "ActiveEffectLike", mode: "upgrade", path: `system.skills.${slug}.rank`, value: 1 });
const declares = (cls, value) => ({ key: "ActiveEffectLike", mode: "override", path: `flags.system.${cls}.tradition`, value });

register("class-features", feature("68j2yQ0lamRuR6oF", "Connection", null, bridgeRules("connection", "mystic-connection", "SF2E.SpecificRule.Mystic.Connection.Prompt")));
register("class-features", feature("AurhNoZmNNhHktx6", "Elemental", "mystic-connection", [skill("nature"), declares("mystic", "primal")]));
register("class-features", feature("fM1vlupLq9Zlyt7C", "Akashic", "mystic-connection", [skill("occultism"), declares("mystic", "occult")]));
// Fail-closed fixtures, each one leaf away from a real connection.
register("class-features", feature("noRuleConnection", "Unruled", "mystic-connection", [skill("medicine")]));
register("class-features", feature("twoRuleConnection", "Conflicted", "mystic-connection", [skill("stealth"), declares("mystic", "divine"), declares("mystic", "occult")]));
register("class-features", feature("TJ6x3cwFzlZmpglX", "Paradox", null, bridgeRules("paradox", "witchwarper-paradox", "SF2E.SpecificRule.Witchwarper.Paradox.Prompt")));
register("class-features", feature("42tQJXhySw9QKcn6", "Analyst", "witchwarper-paradox", [skill("computers"), declares("witchwarper", "arcane")]));
register("class-features", feature("1E12XmyqzIK1jXrY", "Gap Influenced", "witchwarper-paradox", [skill("society"), declares("witchwarper", "occult")]));

const mystic = () => ({ name: "Mystic", system: { items: { conn: { level: 1, uuid: "Compendium.sf2e.class-features.Item.Connection" } } } });
const witchwarper = () => ({ name: "Witchwarper", system: { items: { para: { level: 1, uuid: "Compendium.sf2e.class-features.Item.Paradox" } } } });
const VARIABLE = { tradition: null };

if (!DATA_RUN) {
  const groups = [];
  const plan = await planClassPaths(mystic(), { context: {}, selectChoices: choose("Elemental", groups) });
  assert.equal(groups.length, 1, "the connection is chosen through the bounded chooser");
  assert.ok(groups[0].options.some((option) => option.label === "Akashic"), "the occult connection was offered too");
  assert.equal(plan["mystic-connection"].name, "Elemental");
  assert.equal(plan["mystic-connection"].tradition, "primal", "the plan carries the Elemental connection's own tradition");
  assert.equal(classSpellTradition(VARIABLE, plan), "primal");

  const akashic = await planClassPaths(mystic(), { context: {}, selectChoices: choose("Akashic") });
  assert.equal(classSpellTradition(VARIABLE, akashic), "occult");

  const unruled = await planClassPaths(mystic(), { context: {}, selectChoices: choose("Unruled") });
  assert.equal(unruled["mystic-connection"].tradition, null, "an option without the rule proves nothing");
  assert.equal(classSpellTradition(VARIABLE, unruled), null);
  const conflicted = await planClassPaths(mystic(), { context: {}, selectChoices: choose("Conflicted") });
  assert.equal(conflicted["mystic-connection"].tradition, null, "two overrides on one option prove nothing");
  assert.equal(classSpellTradition(VARIABLE, conflicted), null);

  const paradox = await planClassPaths(witchwarper(), { context: {}, selectChoices: choose("Gap Influenced") });
  assert.equal(paradox["witchwarper-paradox"].tradition, "occult");
  assert.equal(classSpellTradition(VARIABLE, paradox), "occult");
  const analyst = await planClassPaths(witchwarper(), { context: {}, selectChoices: choose("Analyst") });
  assert.equal(classSpellTradition(VARIABLE, analyst), "arcane");

  // A Mystic flag never proves a Witchwarper tradition (path is class-qualified).
  assert.equal(traditionFromChoiceOption({ system: { rules: [declares("mystic", "primal")] } }, "witchwarper"), null);
}

if (!DATA_RUN) {
  // classSpellTradition: fixed profiles keep their own, variable ones need exactly one declared value.
  assert.equal(classSpellTradition({ tradition: "arcane" }, { "mystic-connection": { tradition: "primal" } }), "arcane",
    "a fixed-tradition class (Technomancer) is unchanged by any plan");
  assert.equal(classSpellTradition({ tradition: "arcane" }, null), "arcane");
  assert.equal(classSpellTradition(null, { "mystic-connection": { tradition: "primal" } }), null, "no profile, no class tradition");
  assert.equal(classSpellTradition(VARIABLE, null), null, "no plan, no tradition");
  assert.equal(classSpellTradition(VARIABLE, {}), null);
  assert.equal(classSpellTradition(VARIABLE, { "witchwarper-paradox": { tradition: "arcane" }, "witchwarper-anchor": { tradition: null } }), "arcane",
    "a path that declares nothing (Anchor) does not block the paradox");
  assert.equal(classSpellTradition(VARIABLE, { a: { tradition: "arcane" }, b: { tradition: "occult" } }), null, "two conflicting paths prove nothing");
  assert.equal(classSpellTradition(VARIABLE, { a: { tradition: "elemental" } }), null, "only the four traditions");
  console.log("class-paths tradition: planned path tradition, fail-closed cases and fixed profiles passed");
}

// ---- Part 2: every Connection and Paradox in the pinned cache.
const CACHE = "/root/simplySF2e/tools/class-bench/cache";
if (!existsSync(CACHE)) {
  console.log(`class-paths tradition: SKIP data check (${CACHE} not present)`);
} else if (!DATA_RUN) {
  const child = spawnSync(process.execPath, [import.meta.filename], { stdio: "inherit", env: { ...process.env, SPF_TRADITION_DATA: "1" } });
  if (child.status !== 0) process.exit(child.status ?? 1);
} else {
  docs.clear();
  indexes.clear();
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name.endsWith(".json") ? [path.join(dir, entry.name)] : []);
  for (const packKey of Object.keys(PACKS)) {
    for (const file of walk(path.join(CACHE, packKey))) {
      const source = JSON.parse(readFileSync(file, "utf8"));
      if (source?._id && source?.name) register(packKey, source);
    }
  }
  const classSource = (slug) => JSON.parse(readFileSync(path.join(CACHE, "classes", `${slug}.json`), "utf8"));
  const expected = {
    mystic: { tag: "mystic-connection", options: { Akashic: "occult", Elemental: "primal", Healing: "divine", Rhythm: "primal", Shadow: "divine" } },
    witchwarper: { tag: "witchwarper-paradox", options: { Analyst: "arcane", Anomaly: "arcane", "Gap Influenced": "occult", Precog: "occult" } }
  };
  let checked = 0;
  for (const [slug, { tag, options }] of Object.entries(expected)) {
    const tagged = indexes.get("sf2e.class-features").filter((entry) => entry.system?.traits?.otherTags?.includes(tag));
    assert.deepEqual(tagged.map((entry) => entry.name).sort(), Object.keys(options).sort(), `${tag}: the cache holds exactly the expected options`);
    for (const option of tagged) {
      const overrides = option.system.rules.filter((rule) => rule?.key === "ActiveEffectLike" && rule.path === `flags.system.${slug}.tradition`);
      assert.equal(overrides.length, 1, `${option.name} declares exactly one tradition`);
      assert.equal(overrides[0].mode, "override");
      const plan = await planClassPaths(classSource(slug), { context: {}, selectChoices: choose(option.name) });
      assert.equal(plan[tag]?.name, option.name, `${option.name} is a resolvable, selectable class path`);
      assert.equal(plan[tag].tradition, options[option.name], `${option.name} plans ${options[option.name]}`);
      assert.equal(classSpellTradition({ tradition: null }, plan), options[option.name], `${slug} class tradition from ${option.name}`);
      checked++;
    }
  }
  assert.equal(checked, 9);
  console.log(`class-paths tradition: ${checked} cached Connections/Paradoxes plan their own tradition`);
}
