// Class-path nested choices are decided at preview time (planClassPaths) and
// only applied at Create (stageClassPaths / createCharacterActor), with no
// chooser call and a fail-closed check on the stored record.
// Run: node scripts/class-paths.planChoices.test.mjs
import assert from "node:assert/strict";

const docs = new Map();
const uuid = (id) => `Compendium.sf2e.class-features.Item.${id}`;
const featUuid = (id) => `Compendium.sf2e.feats.Item.${id}`;
const doc = (id, name, system) => ({
  pack: "sf2e.class-features", uuid: uuid(id), name,
  toObject: () => ({ _id: id, name, type: "feat", system: structuredClone(system) })
});
// Operative's Specialization shape, rule keys as in v14-dev
// packs/sf2e/class-features/operative/{operatives-specialization,specializations/*}.json
// (same fixture as class-paths.test.mjs).
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
docs.set(uuid("ghost"), doc("ghost", "Ghost", specialization("deception")));
docs.set(uuid("sniper"), doc("sniper", "Sniper", specialization("stealth", [
  { adjustName: false, choices: [{ value: featUuid("keep") }, { value: featUuid("scope") }], flag: "bonusFeat", key: "ChoiceSet", predicate: ["class:operative"] },
  { key: "GrantItem", predicate: ["class:operative"], uuid: "{item|flags.system.rulesSelections.bonusFeat}" }
])));
const featDoc = (id, name, system) => ({ pack: "sf2e.feats", uuid: featUuid(id), name, toObject: () => ({ _id: id, name, type: "feat", system: structuredClone(system) }) });
const skillFeats = [
  ["face", "Face in the Crowd", "trained in Deception"],
  ["favored", "Favored Disguise", "trained in Deception"],
  ["trace", "Without a Trace", "trained in Deception, Stealth, or Underworld Lore"]
];
for (const [id, name, prerequisite] of skillFeats) {
  docs.set(featUuid(id), featDoc(id, name, { category: "skill", level: { value: 1 }, prerequisites: { value: [{ value: prerequisite }] }, rules: [] }));
}
docs.set(featUuid("keep"), featDoc("keep", "Keep Them in Your Sights", { category: "class", level: { value: 1 }, rules: [] }));
docs.set(featUuid("scope"), featDoc("scope", "Scope Sight", { category: "class", level: { value: 1 }, rules: [] }));

const classFeatureEntry = (id, name) => ({ _id: id, name, type: "feat", system: { category: "classfeature", level: { value: 1 }, traits: { value: [], otherTags: ["operative-specialization"] } } });
const pack = {
  async getIndex() { return [classFeatureEntry("ghost", "Ghost"), classFeatureEntry("sniper", "Sniper")]; },
  getDocument: async (id) => docs.get(uuid(id)) ?? null
};
const featPack = {
  async getIndex() {
    return skillFeats.map(([id, name, prerequisite]) => ({ _id: id, name, type: "feat", system: {
      category: "skill", level: { value: 1 }, traits: { value: ["general", "skill"] }, prerequisites: { value: [{ value: prerequisite }] }
    } }));
  },
  getDocument: async (id) => docs.get(featUuid(id)) ?? null
};
const events = [];
globalThis.foundry = { utils: { randomID: (() => { let id = 0; return () => `id-${++id}`; })() } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 50 } };
globalThis.CONFIG = { PF2E: { languages: {} } };
globalThis.game = {
  packs: { get: (id) => id === "sf2e.class-features" ? pack : id === "sf2e.feats" ? featPack : null },
  settings: { get: () => ({}) },
  i18n: { localize: (label) => label }
};
globalThis.fromUuid = async (id) => docs.get(id) ?? null;
let stagedItems = null;
globalThis.Actor = {
  async create() {
    events.push("actor-create");
    return {
      system: { attributes: { hp: { max: 20 } }, abilities: { int: { mod: 0 } } },
      async createEmbeddedDocuments(_type, items) { stagedItems = items; events.push("embedded-create"); },
      async update() { events.push("actor-update"); },
      async delete() { throw new Error("unexpected rollback"); }
    };
  }
};

const { planClassPaths, stageClassPaths } = await import("./class-paths.mjs");
const { createCharacterActor } = await import("./pc-builder.mjs");
const operativeClass = () => ({ name: "Operative", system: { slug: null, items: { spec: { level: 1, uuid: uuid("opspec") } } } });
const pickLabels = (labels, calls) => async (groups) => {
  calls.push(groups.map((group) => [group.flag, group.options.map((option) => option.label)]));
  return { picks: groups.map((group) => ({ choice: group.id, option: group.options.find((option) => labels.includes(option.label)).id })) };
};
const throwingChooser = (calls) => async (groups) => {
  calls.push(groups);
  throw new Error("the AI chooser must not run at Create");
};

// 1. Planning answers the selected path's own ChoiceSets with the same bounded
//    chooser and stores the native GrantItem record on the plan.
const planCalls = [];
const sniperPlan = await planClassPaths(operativeClass(), { context: {}, selectChoices: pickLabels(["Sniper", "Scope Sight"], planCalls) });
assert.deepEqual(planCalls, [
  [["specialization", ["Ghost", "Sniper"]]],
  [["bonusFeat", ["Keep Them in Your Sights", "Scope Sight"]]]
], "the path pick and the selected path's nested choice are both asked during planning");
const sniperEntry = sniperPlan["operative-specialization"];
assert.deepEqual(sniperEntry.preselectChoices, { feat: featUuid("trace"), bonusFeat: featUuid("scope") },
  "the plan stores the exact preselectChoices record (sole proven skill feat plus the chooser's bonus feat)");
assert.deepEqual(sniperEntry.reservedFeats, [featUuid("trace"), featUuid("scope")],
  "the feats the plan chose are the ones reserved from feat slots");
assert.deepEqual(sniperEntry.reservedFeatNames, ["without-a-trace", "scope-sight"]);

// 2. Applying the plan makes no chooser call and yields the record today's
//    Create-time chooser produced for the same picks (pinned from
//    class-paths.test.mjs: { feat: trace, bonusFeat: scope } and the
//    sniper/trace/scope expected grants).
const stageCalls = [];
const staged = await stageClassPaths(operativeClass(), "operative-id", {
  context: {}, selectChoices: throwingChooser(stageCalls), pathPlan: sniperPlan
});
assert.equal(stageCalls.length, 0, "staging a planned path never calls the chooser");
assert.equal(staged.items[0].system.rules[0].selection, uuid("sniper"));
assert.deepEqual(staged.items[0].system.rules[1].preselectChoices, { feat: featUuid("trace"), bonusFeat: featUuid("scope") },
  "the native grant carries the planned record unchanged");
assert.deepEqual(staged.expectedPaths.map((entry) => entry._stats.compendiumSource),
  [uuid("sniper"), featUuid("trace"), featUuid("scope")]);

// The same through createCharacterActor, which receives the generator's
// chooser: zero calls for the class path, and the record reaches Actor.create.
const doc0 = (type, system) => ({ type, name: type, system, toObject: () => ({ name: type, type, system: structuredClone(system) }) });
const concept = {
  name: "Plan Test", level: 1, keyAbility: "dex", languages: [], backstory: "", appearance: "",
  personality: "", alignmentFlavor: "", likes: "", dislikes: "", allies: "", enemies: "", organizations: "",
  age: "", gender: "", height: "", weight: "", ethnicity: "", nationality: ""
};
const resolvedFor = (pathPlan) => ({
  ancestryDoc: doc0("ancestry", { boosts: {}, additionalLanguages: {}, languages: { value: [] } }),
  backgroundDoc: doc0("background", { boosts: {}, trainedSkills: { value: [] } }),
  classDoc: { type: "class", name: "Operative", uuid: "Compendium.sf2e.classes.Item.operative", toObject: () => ({ name: "Operative", type: "class", system: {
    slug: "operative", keyAbility: { value: ["dex"] }, trainedSkills: { value: [], additional: 0 }, items: { spec: { level: 1, uuid: uuid("opspec") } }
  } }) },
  heritageDoc: null, feats: [], spells: [], focusSpells: [], equipment: [], loot: [], pathPlan
});
const createCalls = [];
await createCharacterActor(concept, resolvedFor(sniperPlan), { selectChoices: throwingChooser(createCalls) });
assert.equal(createCalls.length, 0, "Create makes no AI call for a planned class path");
const bridge = stagedItems.find((item) => item.name === "Operative's Specialization");
assert.deepEqual(bridge.system.rules[1].preselectChoices, { feat: featUuid("trace"), bonusFeat: featUuid("scope") });

// 3. A plan without the record (a preview made before this change, or an
//    edited plan) fails closed with the existing message before Actor.create.
const { preselectChoices: _dropped, ...legacyEntry } = sniperEntry;
events.length = 0;
await assert.rejects(createCharacterActor(concept, resolvedFor({ "operative-specialization": legacyEntry }), { selectChoices: throwingChooser(createCalls) }),
  /class path "Sniper" has an unanswered choice/, "a missing stored record blocks Create");
assert.deepEqual(events, [], "no actor is created");
assert.equal(createCalls.length, 0, "the missing record is not filled by a Create-time chooser call");
const partial = { ...sniperEntry, preselectChoices: { feat: featUuid("trace") } };
await assert.rejects(stageClassPaths(operativeClass(), "operative-id", { context: {}, pathPlan: { "operative-specialization": partial } }),
  /has an unanswered choice/, "a record missing one required flag blocks");
const forged = { ...sniperEntry, preselectChoices: { feat: featUuid("face"), bonusFeat: featUuid("scope") } };
await assert.rejects(stageClassPaths(operativeClass(), "operative-id", { context: {}, pathPlan: { "operative-specialization": forged } }),
  /has an unanswered choice/, "a stored value outside the path's offered options blocks");
const extra = { ...sniperEntry, preselectChoices: { ...sniperEntry.preselectChoices, other: "x" } };
await assert.rejects(stageClassPaths(operativeClass(), "operative-id", { context: {}, pathPlan: { "operative-specialization": extra } }),
  /has an unanswered choice/, "a record carrying a flag the path does not have blocks");

// A planned build whose plan lacks a path entry still makes no Create-time
// chooser call: the unplanned path cannot be answered and blocks.
await assert.rejects(createCharacterActor(concept, resolvedFor({}), { selectChoices: throwingChooser(createCalls) }),
  /was not selected/, "an unplanned path on a planned build blocks Create");
assert.equal(createCalls.length, 0, "createCharacterActor gives stageClassPaths no chooser when the build has a plan");
assert.deepEqual(events, [], "no actor is created");

// 4. A failed chooser at planning surfaces at preview time, the same way an
//    unselected path does: planning throws, no plan is returned.
let call = 0;
const failNested = async (groups) => {
  call += 1;
  if (call === 1) return { picks: [{ choice: groups[0].id, option: groups[0].options.find((option) => option.label === "Ghost").id }] };
  throw new Error("provider error");
};
await assert.rejects(planClassPaths(operativeClass(), { context: {}, selectChoices: failNested }),
  /class path "Ghost" has an unanswered choice/, "a nested choice the chooser fails to answer blocks the preview");
await assert.rejects(planClassPaths(operativeClass(), { context: { names: ["Ghost"] }, selectChoices: async () => ({ picks: [] }) }),
  /class path "Ghost" has an unanswered choice/, "an empty answer for the nested choice blocks the preview");
const limit = Object.assign(new Error("budget"), { runLimit: true });
call = 0;
await assert.rejects(planClassPaths(operativeClass(), { context: {}, selectChoices: async (groups) => {
  call += 1;
  if (call === 1) return { picks: [{ choice: groups[0].id, option: groups[0].options[0].id }] };
  throw limit;
} }), (error) => error === limit, "a run limit during the nested choice ends the run");

// A path whose own choices are all deterministic needs no chooser at all.
const ghostPlan = await planClassPaths(operativeClass(), { context: { names: ["Ghost", "Face in the Crowd"] } });
assert.deepEqual(ghostPlan["operative-specialization"].preselectChoices, { feat: featUuid("face") });

console.log("class-paths.planChoices.test.mjs: nested class-path choices planned at preview, applied at Create");
