// Observable integration test: createCharacterActor aggregates already-granted/planned
// feat UUIDs and names into excludeFeats for stageClassPaths, strictly gating on a resolved entry.
// Run: node scripts/pc-builder.stageClassPaths-exclude.test.mjs
import assert from "node:assert/strict";

const docs = new Map();
const uuid = (id) => `Compendium.sf2e.class-features.Item.${id}`;
const featUuid = (id) => `Compendium.sf2e.feats.Item.${id}`;
const doc = (id, name, type, system) => ({
  pack: type === "feat" && !system.category ? "sf2e.feats" : "sf2e.class-features",
  uuid: (type === "feat" && !system.category ? featUuid(id) : uuid(id)),
  name,
  toObject: () => ({ _id: id, name, type, system: structuredClone(system) })
});

// Setup mock docs for Operative specialization bridge and Ghost
docs.set(uuid("opspec"), doc("opspec", "Operative's Specialization", "feat", {
  category: "classfeature",
  rules: [
    { key: "ChoiceSet", flag: "specialization", choices: { filter: ["item:tag:operative-specialization"] } },
    { key: "GrantItem", uuid: "{item|flags.system.rulesSelections.specialization}" }
  ]
}));
docs.set(uuid("ghost"), doc("ghost", "Ghost", "feat", {
  category: "classfeature", traits: { otherTags: ["operative-specialization"] }, rules: [
    { key: "ActiveEffectLike", mode: "upgrade", path: "system.skills.deception.rank", value: 1 },
    { key: "ChoiceSet", flag: "feat", choices: { filter: ["item:category:skill", "item:level:1"], itemType: "feat" } },
    { key: "GrantItem", uuid: "{item|flags.system.rulesSelections.feat}" }
  ]
}));
docs.set(featUuid("face"), doc("face", "Face in the Crowd", "feat", {
  category: "skill", level: { value: 1 }, prerequisites: { value: [{ value: "trained in deception" }] }, rules: []
}));
docs.set(featUuid("disguise"), doc("disguise", "Favored Disguise", "feat", {
  category: "skill", level: { value: 1 }, prerequisites: { value: [{ value: "trained in deception" }] }, rules: []
}));
docs.set(featUuid("trace"), doc("trace", "Without a Trace", "feat", {
  category: "skill", level: { value: 1 }, prerequisites: { value: [{ value: "trained in deception" }] }, rules: []
}));
docs.set(featUuid("shadow"), doc("shadow", "Shadow Walker", "feat", {
  category: "skill", level: { value: 1 }, prerequisites: { value: [{ value: "trained in deception" }] }, rules: []
}));
const classPack = {
  async getIndex() {
    return [
      { _id: "ghost", name: "Ghost", type: "feat", system: { category: "classfeature", level: { value: 1 }, traits: { value: [], otherTags: ["operative-specialization"] } } }
    ];
  },
  getDocument: async (id) => docs.get(uuid(id)) ?? null
};
const featPack = {
  async getIndex() {
    return [
      { _id: "face", name: "Face in the Crowd", type: "feat", system: { category: "skill", level: { value: 1 }, prerequisites: { value: [{ value: "trained in deception" }] }, traits: { value: [] } } },
      { _id: "disguise", name: "Favored Disguise", type: "feat", system: { category: "skill", level: { value: 1 }, prerequisites: { value: [{ value: "trained in deception" }] }, traits: { value: [] } } },
      { _id: "trace", name: "Without a Trace", type: "feat", system: { category: "skill", level: { value: 1 }, prerequisites: { value: [{ value: "trained in deception" }] }, traits: { value: [] } } },
      { _id: "shadow", name: "Shadow Walker", type: "feat", system: { category: "skill", level: { value: 1 }, prerequisites: { value: [{ value: "trained in deception" }] }, traits: { value: [] } } }
    ];
  },
  getDocument: async (id) => docs.get(featUuid(id)) ?? null
};

globalThis.game = {
  packs: {
    get: (id) => id === "sf2e.class-features" ? classPack : id === "sf2e.feats" ? featPack : null
  },
  settings: { get: () => ({}) },
  i18n: { localize: (k) => k }
};
globalThis.CONFIG = { PF2E: {} };
globalThis.fromUuid = async (id) => docs.get(id) ?? null;
globalThis.foundry = { utils: { randomID: (() => { let id = 0; return () => `id-${++id}`; })() } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 50 } };

let embeddedItems = [];
globalThis.Actor = {
  async create() {
    return {
      system: { attributes: { hp: { max: 20 } }, abilities: { int: { mod: 0 } } },
      async createEmbeddedDocuments(type, items) {
        embeddedItems = items;
      },
      async update() {},
      async delete() {}
    };
  }
};

const { createCharacterActor } = await import("./pc-builder.mjs");

// Case 1: Observable selectChoices callback
// Background grants "Face in the Crowd" -> must be excluded
// resolved.feats has an ungrounded draft: { name: "Other Ungrounded", entry: null }
// resolved.feats has strict ref: { name: "Slot Feat", entry: { packId: "sf2e.feats", _id: "other" } }
// Context names do not match Favored Disguise or Without a Trace, so selectChoices is called for the skill feat.
const concept1 = {
  name: "Exclude Feats Observable Test", level: 1, keyAbility: "dex", languages: [],
  feats: ["Ghost"], // Matches Ghost specialization so it preselects Ghost
  backstory: "", appearance: "", personality: "", alignmentFlavor: "",
  likes: "", dislikes: "", allies: "", enemies: "", organizations: "",
  age: "", gender: "", height: "", weight: "", ethnicity: "", nationality: ""
};

const resolved1 = {
  ancestryDoc: {
    name: "Human", type: "ancestry",
    system: { boosts: {}, additionalLanguages: {}, languages: { value: [] } },
    toObject() { return { name: "Human", type: "ancestry", system: {} }; }
  },
  backgroundDoc: {
    name: "Spy", type: "background",
    system: {
      boosts: {}, trainedSkills: { value: [] },
      items: {
        bgFeat: { uuid: featUuid("face"), name: "Face in the Crowd" }
      }
    },
    toObject() { return { name: "Spy", type: "background", system: { items: { bgFeat: { uuid: featUuid("face"), name: "Face in the Crowd" } } } }; }
  },
  heritageDoc: null,
  classDoc: {
    name: "Operative", type: "class",
    system: {
      slug: "operative", keyAbility: { value: ["dex"] }, trainedSkills: { value: [], additional: 0 },
      items: {
        spec: { level: 1, uuid: uuid("opspec") }
      }
    },
    toObject() {
      return {
        name: "Operative", type: "class",
        system: {
          slug: "operative", keyAbility: { value: ["dex"] }, trainedSkills: { value: [], additional: 0 },
          items: {
            spec: { level: 1, uuid: uuid("opspec") }
          }
        }
      };
    }
  },
  feats: [
    // Strict ref representation: resolves to Without a Trace -> must be excluded!
    { name: "Without a Trace", entry: { packId: "sf2e.feats", _id: "trace" }, type: "class", level: 1 }
  ],
};

let capturedSkillFeatGroup = null;
await createCharacterActor(concept1, resolved1, {
  selectChoices: async (groups) => {
    for (const group of groups) {
      if (group.flag === "feat") {
        capturedSkillFeatGroup = structuredClone(group);
        const pick = group.options.find((opt) => opt.label === "Favored Disguise") ?? group.options[0];
        return { picks: [{ choice: group.id, option: pick.id }] };
      }
    }
    return { picks: [{ choice: groups[0].id, option: groups[0].options[0].id }] };
  }
});

assert.ok(capturedSkillFeatGroup, "skill-feat ChoiceSet was offered via selectChoices callback");
const offeredLabels = capturedSkillFeatGroup.options.map((opt) => opt.label);

// 1. Duplicate feat (granted by background) MUST be absent
assert.equal(offeredLabels.includes("Face in the Crowd"), false, "duplicate 'Face in the Crowd' is absent from offered options");
// 2. Resolved strict ref {packId, _id} MUST be absent
assert.equal(offeredLabels.includes("Without a Trace"), false, "strict ref {packId, _id} 'Without a Trace' is excluded from offered options");
assert.ok(offeredLabels.includes("Favored Disguise"), "non-duplicate 'Favored Disguise' is offered");
assert.ok(offeredLabels.includes("Shadow Walker"), "non-duplicate 'Shadow Walker' is offered");

// Staged Operative's Specialization is embedded and receives chosen UUID
const stagedBridge1 = embeddedItems.find((item) => item.name === "Operative's Specialization");
assert.ok(stagedBridge1, "staged Operative's Specialization is embedded on actor");
assert.equal(stagedBridge1.system.rules[1].preselectChoices?.feat, featUuid("disguise"),
  "selected non-duplicate option reaches preselectChoices");

// Case 2: Ungrounded draft feat { name: "Favored Disguise", entry: null } must NOT be excluded.
// If entry: null excluded the name, then Favored Disguise would be filtered out of options,
// making it impossible for pickChoiceSelection to choose it.
const resolved2 = {
  ...resolved1,
  feats: [
    { name: "Favored Disguise", entry: null, type: "class", level: 1 }
  ]
};
const concept2 = { ...concept1, feats: ["Ghost"] };
await createCharacterActor(concept2, resolved2);

const stagedBridge2 = embeddedItems.find((item) => item.name === "Operative's Specialization");
assert.equal(stagedBridge2.system.rules[1].preselectChoices?.feat, featUuid("disguise"),
  "ungrounded draft { name: 'Favored Disguise', entry: null } was NOT excluded and was successfully selected");

console.log("pc-builder.stageClassPaths-exclude.test.mjs: observable exclusion integration verified");
