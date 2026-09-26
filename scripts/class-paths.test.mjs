// Exact class-path staging regression: the native class keeps its ordinary
// grant graph, while one closed level-one bridge is linked directly to it.
// Run: node scripts/class-paths.test.mjs
import assert from "node:assert/strict";

const docs = new Map();
const uuid = (id) => `Compendium.sf2e.class-features.Item.${id}`;
const doc = (id, name, system) => ({
  pack: "sf2e.class-features", uuid: uuid(id), name,
  toObject: () => ({ _id: id, name, type: "feat", system: structuredClone(system) })
});
docs.set(uuid("bridge"), doc("bridge", "Methodology", { rules: [
  { key: "ChoiceSet", flag: "methodology", choices: { filter: ["item:tag:investigator-methodology"] } },
  { key: "GrantItem", uuid: "{item|flags.system.rulesSelections.methodology}" }
] }));
docs.set(uuid("closed"), doc("closed", "Empiricism", { category: "classfeature", traits: { otherTags: ["investigator-methodology"] }, rules: [
  { key: "ChoiceSet", flag: "skill", choices: [{ value: "arcana", label: "Arcana" }, { value: "society", label: "Society" }] }
] }));
docs.set(uuid("open"), doc("open", "Unsupported Methodology", { category: "classfeature", traits: { otherTags: ["investigator-methodology"] }, rules: [
  { key: "ChoiceSet", flag: "other", choices: { filter: ["item:tag:another-choice"] } }
] }));
docs.set(uuid("simple"), doc("simple", "Simple Methodology", { category: "classfeature", traits: { otherTags: ["investigator-methodology"] }, rules: [] }));
docs.set(uuid("style"), doc("style", "Soldier Fighting Style", { rules: [
  { key: "ChoiceSet", flag: "fightingStyle", choices: { filter: ["item:tag:soldier-fighting-style"] } },
  { key: "GrantItem", uuid: "{item|flags.system.rulesSelections.fightingStyle}" }
] }));
docs.set(uuid("hero"), doc("hero", "Action Hero", { category: "classfeature", traits: { otherTags: ["soldier-fighting-style"] }, rules: [] }));

// Operative's Specialization shape, verbatim rule keys from v14-dev
// packs/sf2e/class-features/operative/{operatives-specialization,specializations/*}.json.
const featUuid = (id) => `Compendium.sf2e.feats.Item.${id}`;
const actionUuid = (id) => `Compendium.sf2e.actions.Item.${id}`;
const specialization = (skill, extra = []) => ({
  category: "classfeature", traits: { otherTags: ["operative-specialization"] }, rules: [
    { key: "ActiveEffectLike", mode: "upgrade", path: `system.skills.${skill}.rank`, value: 1 },
    { adjustName: false, choices: { filter: ["item:category:skill", "item:level:1"], itemType: "feat" }, flag: "feat", key: "ChoiceSet", prompt: "PF2E.SpecificRule.Prompt.SkillFeat" },
    { key: "GrantItem", uuid: "{item|flags.system.rulesSelections.feat}" },
    ...extra
  ]
});
docs.set(uuid("opspec"), doc("opspec", "Operative's Specialization", { rules: [
  { adjustName: false, choices: { filter: ["item:tag:operative-specialization"] }, flag: "specialization", key: "ChoiceSet", prompt: "SF2E.SpecificRule.Operative.Specialization.Prompt" },
  { key: "GrantItem", uuid: "{item|flags.system.rulesSelections.specialization}" }
] }));
docs.set(uuid("ghost"), doc("ghost", "Ghost", specialization("deception", [
  { allowDuplicate: false, key: "GrantItem", predicate: [{ gte: ["self:level", 9] }, "class:operative"], reevaluateOnUpdate: true, uuid: actionUuid("ghosttap") }
])));
docs.set(uuid("sniper"), doc("sniper", "Sniper", specialization("stealth", [
  { adjustName: false, choices: [{ value: featUuid("keep") }, { value: featUuid("scope") }], flag: "bonusFeat", key: "ChoiceSet", predicate: ["class:operative"] },
  { key: "GrantItem", predicate: ["class:operative"], uuid: "{item|flags.system.rulesSelections.bonusFeat}" }
])));
docs.set(uuid("striker"), doc("striker", "Striker", specialization("athletics")));
docs.set(actionUuid("ghosttap"), { uuid: actionUuid("ghosttap"), name: "Ghost Tap", toObject: () => ({ name: "Ghost Tap", type: "action", system: { rules: [] } }) });
const featDoc = (id, name, system) => ({ pack: "sf2e.feats", uuid: featUuid(id), name, toObject: () => ({ _id: id, name, type: "feat", system: structuredClone(system) }) });
const skillFeats = [
  ["face", "Face in the Crowd", 1, "trained in Deception", []],
  ["favored", "Favored Disguise", 1, "trained in Deception", [{ key: "RollOption", option: "favored-disguise" }]],
  ["trace", "Without a Trace", 1, "trained in Deception, Stealth, or Underworld Lore", []],
  ["terrain", "Terrain Expertise", 1, "trained in Stealth", [{ key: "ChoiceSet", flag: "terrain", choices: [{ value: "urban", label: "Urban" }] }]],
  ["skeptic", "Hologram Skeptic", 1, "trained in Computers", []],
  ["later", "Deceptive Veteran", 2, "trained in Deception", []]
];
for (const [id, name, level, prerequisite, rules] of skillFeats) {
  docs.set(featUuid(id), featDoc(id, name, { category: "skill", level: { value: level }, prerequisites: { value: [{ value: prerequisite }] }, rules }));
}
docs.set(featUuid("keep"), featDoc("keep", "Keep Them in Your Sights", { category: "class", level: { value: 1 }, rules: [{ key: "ActiveEffectLike", mode: "add", path: "system.custom", value: 1 }] }));
docs.set(featUuid("scope"), featDoc("scope", "Scope Sight", { category: "class", level: { value: 1 }, rules: [] }));

const classFeatureEntry = (id, name, tag) => ({ _id: id, name, type: "feat", system: { category: "classfeature", level: { value: 1 }, traits: { value: [], otherTags: [tag] } } });
const pack = {
  async getIndex() {
    return [
      classFeatureEntry("closed", "Empiricism", "investigator-methodology"),
      classFeatureEntry("simple", "Simple Methodology", "investigator-methodology"),
      classFeatureEntry("open", "Unsupported Methodology", "investigator-methodology"),
      classFeatureEntry("hero", "Action Hero", "soldier-fighting-style"),
      classFeatureEntry("ghost", "Ghost", "operative-specialization"),
      classFeatureEntry("sniper", "Sniper", "operative-specialization"),
      classFeatureEntry("striker", "Striker", "operative-specialization")
    ];
  },
  getDocument: async (id) => docs.get(uuid(id)) ?? null
};
const featPack = {
  async getIndex() {
    return skillFeats.map(([id, name, level, prerequisite]) => ({ _id: id, name, type: "feat", system: {
      category: "skill", level: { value: level }, traits: { value: ["general", "skill"] }, prerequisites: { value: [{ value: prerequisite }] }
    } }));
  },
  getDocument: async (id) => docs.get(featUuid(id)) ?? null
};
let configuredSources = {};
globalThis.game = {
  packs: { get: (id) => id === "sf2e.class-features" || id === "module.other-features" ? pack : id === "sf2e.feats" ? featPack : null },
  settings: { get: () => configuredSources }
};
globalThis.CONFIG = { PF2E: {} };
globalThis.fromUuid = async (id) => docs.get(id) ?? null;

const { stageClassPaths } = await import("./class-paths.mjs");
const classData = { system: { items: { bridge: { level: 1, uuid: uuid("bridge") }, ordinary: { level: 1, uuid: "Compendium.sf2e.class-features.Item.NotAPath" } } } };
const calls = [];
const staged = await stageClassPaths(classData, "class-id", {
  context: {},
  selectChoices: async (groups) => {
    calls.push(groups);
    const option = groups[0].options.find((entry) => entry.label === "Empiricism") ?? groups[0].options.at(-1);
    return { picks: [{ choice: groups[0].id, option: option.id }] };
  }
});

assert.equal(staged.items.length, 1);
assert.ok(!("bridge" in classData.system.items), "only the staged bridge is removed from the native class entries");
assert.ok("ordinary" in classData.system.items, "other class grants remain native");
assert.equal(staged.items[0].system.location, "class-id");
assert.deepEqual(staged.items[0].system.rules[0].choices, [
  { value: uuid("closed"), label: "Empiricism" }, { value: uuid("simple"), label: "Simple Methodology" }
],
  "the selector is narrowed to the issued, choice-closed exact candidate");
assert.equal(staged.items[0].system.rules[0].selection, uuid("closed"));
assert.deepEqual(staged.items[0].system.rules[1].preselectChoices, { skill: "society" },
  "the native GrantItem receives an exact preselection for its selected path feature");
assert.equal(calls.length, 2, "the bridge and selected path's static choice reuse the existing bounded selector");
assert.deepEqual(staged.expectedPaths, [{ name: "Empiricism", type: "feat", _stats: { compendiumSource: uuid("closed") } }],
  "the native selected-path grant is included in post-create exact-source verification");

await assert.rejects(stageClassPaths({ system: { items: { bridge: { level: 1, uuid: uuid("bridge") } } } }, "class-id", { context: {} }),
  /was not selected/, "an omitted mandatory path choice blocks before Actor.create");

configuredSources = { classFeatures: ["module.other-features"] };
await assert.rejects(stageClassPaths({ system: { items: { bridge: { level: 1, uuid: uuid("bridge") } } } }, "class-id", { context: {}, selectChoices: async () => ({ picks: [] }) }),
  /source.*not enabled/, "an excluded bridge source blocks instead of falling back to PF2e's native dialog");

// Cited SF2e shape: Soldier Fighting Style uses item:tag:soldier-fighting-style
// (packs/sf2e/class-features/soldier/soldier-fighting-style.json). Same stager,
// not a renamed Rogue racket.
configuredSources = {};
const soldierClass = { system: { items: { style: { level: 1, uuid: uuid("style") } } } };
const soldier = await stageClassPaths(soldierClass, "soldier-id", {
  context: {},
  selectChoices: async (groups) => ({ picks: [{ choice: groups[0].id, option: groups[0].options[0].id }] })
});
assert.equal(soldier.items[0].name, "Soldier Fighting Style");
assert.deepEqual(soldier.items[0].system.rules[0].choices, [{ value: uuid("hero"), label: "Action Hero" }]);
assert.equal(soldier.items[0].system.rules[0].selection, uuid("hero"));
assert.deepEqual(soldier.expectedPaths, [{ name: "Action Hero", type: "feat", _stats: { compendiumSource: uuid("hero") } }]);

// Operative: every specialization's level-one skill-feat query is narrowed to
// enabled feats its own trained skill proves and that carry no choice.
const operativeClass = () => ({ name: "Operative", system: { slug: null, items: { spec: { level: 1, uuid: uuid("opspec") } } } });
const sniperGroups = [];
const sniper = await stageClassPaths(operativeClass(), "operative-id", {
  context: {},
  selectChoices: async (groups) => {
    sniperGroups.push(groups);
    const picks = groups.map((group) => {
      const option = group.options.find((entry) => entry.label === "Sniper" || entry.label === "Scope Sight");
      return { choice: group.id, option: option.id };
    });
    return { picks };
  }
});
assert.deepEqual(sniper.items[0].system.rules[0].choices, [
  { value: uuid("ghost"), label: "Ghost" }, { value: uuid("sniper"), label: "Sniper" }
], "Striker is withheld: no enabled level-one skill feat is proven by Athletics training");
assert.equal(sniper.items[0].system.rules[0].selection, uuid("sniper"));
assert.deepEqual(sniperGroups[1].map((group) => [group.flag, group.options.map((option) => option.label)]), [
  ["bonusFeat", ["Keep Them in Your Sights", "Scope Sight"]]
], "the sole proven, choice-free Stealth skill feat is automatic; the class-gated bonus feat uuids are labeled and bounded");
assert.deepEqual(sniper.items[0].system.rules[1].preselectChoices, { feat: featUuid("trace"), bonusFeat: featUuid("scope") },
  "the native specialization grant receives exact published uuids for both its choices");
assert.deepEqual(sniper.expectedPaths.map((entry) => entry._stats.compendiumSource),
  [uuid("sniper"), featUuid("trace"), featUuid("scope")],
  "the specialization and both natively granted feats are verified after create");

const ghost = await stageClassPaths(operativeClass(), "operative-id", {
  context: { names: ["Ghost", "Face in the Crowd"] }, excludeFeats: ["Favored Disguise"]
});
assert.equal(ghost.items[0].system.rules[0].selection, uuid("ghost"));
assert.deepEqual(ghost.items[0].system.rules[1].preselectChoices, { feat: featUuid("face") },
  "a concept-named proven skill feat is chosen without a callback");
assert.deepEqual(ghost.expectedPaths.map((entry) => entry.name), ["Ghost", "Face in the Crowd"],
  "a predicated static action grant is checked for choices but is not a level-one expectation");

const ghostOffered = [];
await assert.rejects(stageClassPaths(operativeClass(), "operative-id", {
  context: { names: ["Ghost"] }, excludeFeats: [featUuid("face")],
  selectChoices: async (groups) => { ghostOffered.push(...groups.map((group) => group.options.map((option) => option.label))); return { picks: [] }; }
}), /unanswered choice/, "an unanswered specialization skill feat blocks before Actor.create");
assert.deepEqual(ghostOffered, [["Favored Disguise", "Without a Trace"]],
  "already-built, unproven, and higher-level skill feats are never offered");

const envoyBridge = await stageClassPaths({ name: "Envoy", system: { items: { spec: { level: 1, uuid: uuid("opspec") } } } }, "envoy-id", {
  context: { names: ["Ghost", "Face in the Crowd"] }
});
assert.deepEqual(envoyBridge.items[0].system.rules[0].choices, [{ value: uuid("ghost"), label: "Ghost" }],
  "Sniper's class:operative-gated choice is only closed when the staged class is Operative");

console.log("class-paths.test.mjs: exact closed class-path staging passed");
