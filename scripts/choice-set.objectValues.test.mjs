// Object-valued ChoiceSets (sf2e 1.6 Living Hologram / SRO size choices).
// Run: node scripts/choice-set.objectValues.test.mjs
import assert from "node:assert/strict";
import {
  choiceSetOptions, pickChoiceSelection, preselectChoiceSets, sameChoiceValue
} from "./choice-set.mjs";

// Real Living Hologram rules (packs/sf2e/ancestry-features/living-hologram/hardlight-body.json,
// tag sf2e-1.6.1, system.rules).
const HARDLIGHT_RULES = [
  {
    adjustName: false,
    choices: [
      { label: "PF2E.ActorSizeLarge", value: { size: "large" } },
      { label: "PF2E.ActorSizeMedium", value: { size: "medium" } },
      { label: "PF2E.ActorSizeSmall", value: { size: "small" } }
    ],
    flag: "choice",
    key: "ChoiceSet",
    prompt: "PF2E.SpecificRule.Prompt.CreatureSize"
  },
  { key: "CreatureSize", value: "{item|flags.system.rulesSelections.choice.size}" },
  { key: "GrantItem", uuid: "Compendium.sf2e.actions.Item.Disable Hardlight Projector" },
  { key: "GrantItem", uuid: "Compendium.sf2e.actions.Item.Project Hardlight Body" }
];
const SIZE_CHOICE = HARDLIGHT_RULES[0];
const LARGE = { size: "large" };
const MEDIUM = { size: "medium" };
const SMALL = { size: "small" };

/* -------------------------------------------------------------- enumerate */

const sizeOptions = choiceSetOptions(SIZE_CHOICE.choices);
assert.equal(sizeOptions.length, 3, "all three size options enumerate");
assert.deepEqual(sizeOptions.map((o) => o.value), [LARGE, MEDIUM, SMALL]);
assert.deepEqual(sizeOptions.map((o) => o.label), [
  "PF2E.ActorSizeLarge", "PF2E.ActorSizeMedium", "PF2E.ActorSizeSmall"
], "i18n-key labels are kept as-is for the AI and native prompt to localize");

// Enumerated values are copies: editing one never edits the rule's choice.
sizeOptions[0].value.size = "tiny";
assert.equal(SIZE_CHOICE.choices[0].value.size, "large", "option values are deep copies");
sizeOptions[0].value.size = "large";

// Flat numeric leaves are accepted too.
assert.deepEqual(choiceSetOptions([
  { label: "Two by three", value: { width: 2, height: 3 } },
  { label: "Four by four", value: { width: 4, height: 4 } }
]).map((o) => o.value), [{ width: 2, height: 3 }, { width: 4, height: 4 }]);

/* -------------------------------------------------------- native fallbacks */

// A predicated object option makes the whole group native, as for other values.
assert.equal(choiceSetOptions([
  { label: "PF2E.ActorSizeLarge", value: LARGE, predicate: ["self:level:5"] },
  { label: "PF2E.ActorSizeMedium", value: MEDIUM }
]), null, "a predicated object option stays native");

// Nested objects, arrays, booleans, empty objects and label-less object values stay native.
assert.equal(choiceSetOptions([
  { label: "Nested", value: { size: { name: "large" } } },
  { label: "Small", value: SMALL }
]), null, "nested object values stay native");
assert.equal(choiceSetOptions([
  { label: "List", value: { sizes: ["large"] } }, { label: "Small", value: SMALL }
]), null, "array leaves stay native");
assert.equal(choiceSetOptions([
  { label: "Flag", value: { big: true } }, { label: "Small", value: SMALL }
]), null, "boolean leaves stay native");
assert.equal(choiceSetOptions([
  { label: "Empty", value: {} }, { label: "Small", value: SMALL }
]), null, "an empty object value stays native");
assert.equal(choiceSetOptions([{ value: LARGE }, { label: "Small", value: SMALL }]), null,
  "an object value without a label stays native rather than printing [object Object]");

// A rule-level predicate keeps the ChoiceSet out of preselection entirely.
const predicatedRule = { ...structuredClone(SIZE_CHOICE), predicate: ["self:level:5"] };
let predicatedCalls = 0;
const predicatedItem = { name: "Predicated", system: { rules: [predicatedRule] } };
await preselectChoiceSets([predicatedItem], {}, {}, null, async () => { predicatedCalls++; return { picks: [] }; });
assert.equal(predicatedRule.selection, undefined, "predicated object ChoiceSet is not written");
assert.equal(predicatedCalls, 0, "predicated object ChoiceSet is never offered for pre-selection");

/* ----------------------------------------------------------- preselection */

// The AI picks by opaque option id; the module writes the copied object value.
const hologram = { name: "Hardlight Body", system: { rules: structuredClone(HARDLIGHT_RULES) } };
const offered = [];
await preselectChoiceSets([hologram], {}, {}, async () => null, async (groups) => {
  offered.push(groups);
  return { picks: [{ choice: groups[0].id, option: groups[0].options[1].id }] };
});
assert.equal(offered.length, 1, "three object options are batched, not guessed");
assert.deepEqual(offered[0][0].options.map((o) => o.label), [
  "PF2E.ActorSizeLarge", "PF2E.ActorSizeMedium", "PF2E.ActorSizeSmall"
]);
const written = hologram.system.rules[0].selection;
assert.deepEqual(written, MEDIUM, "picking medium writes { size: \"medium\" }");
assert.ok(sameChoiceValue(written, SIZE_CHOICE.choices[1].value), "written selection deep-equals the medium choice");
assert.notEqual(written, SIZE_CHOICE.choices[1].value, "written selection is a copy, not the choice object");
written.size = "small";
assert.equal(SIZE_CHOICE.choices[1].value.size, "medium", "mutating the written selection cannot change the source");
assert.deepEqual(hologram.system.rules[1], HARDLIGHT_RULES[1], "the CreatureSize rule is untouched");

// A granter whose granted item carries the same ChoiceSet gets a preselectChoices
// entry under the normalized flag, again as an equal, detached copy.
const granter = { name: "Granter", system: { rules: [{ key: "GrantItem", uuid: "Compendium.x.y.Item.hologram" }] } };
await preselectChoiceSets([granter], {}, {}, async () => ({
  name: "Hologram", system: { rules: structuredClone(HARDLIGHT_RULES) }
}), async (groups) => ({ picks: [{ choice: groups[0].id, option: groups[0].options[2].id }] }));
const granted = granter.system.rules[0].preselectChoices;
assert.deepEqual(granted, { choice: SMALL }, "grant-level preselection writes the small size under the flag");
assert.ok(sameChoiceValue(granted.choice, SIZE_CHOICE.choices[2].value));
assert.notEqual(granted.choice, SIZE_CHOICE.choices[2].value);

// Object values never auto-select from concept text: a name equal to a size
// stays with the AI or the native prompt.
assert.equal(pickChoiceSelection(sizeOptions, { names: ["Medium"] }), null,
  "a concept name matching a size label does not choose the size");
assert.equal(pickChoiceSelection(sizeOptions, { keyAbility: "str" }), null,
  "a key ability does not choose a size");
assert.deepEqual(pickChoiceSelection([{ label: "Only size", value: MEDIUM }], {}),
  { label: "Only size", value: MEDIUM, reason: "only" }, "a sole object option is still deterministic");

/* --------------------------------------------------------- sameChoiceValue */

assert.equal(sameChoiceValue("acrobatics", "acrobatics"), true);
assert.equal(sameChoiceValue(2, 2), true);
assert.equal(sameChoiceValue(2, "2"), false, "primitives compare strictly");
assert.equal(sameChoiceValue(MEDIUM, { size: "medium" }), true, "equal flat objects match key by key");
assert.equal(sameChoiceValue(MEDIUM, LARGE), false, "a differing leaf does not match");
assert.equal(sameChoiceValue({ size: "medium", x: 1 }, MEDIUM), false, "extra keys do not match");
assert.equal(sameChoiceValue(MEDIUM, "medium"), false, "an object never equals its string form");
assert.equal(sameChoiceValue(MEDIUM, null), false);

console.log("choice-set object values: all checks passed");
