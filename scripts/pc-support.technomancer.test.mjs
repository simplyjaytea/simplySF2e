// Technomancer programming-language cache spells and archetype caster tradition.
// Cited: each language description's "Spell Cache 1st ... 9th" lines (sf2e-1.6.1
// packs/sf2e/class-features); Dedications' traditions (archetypes.json).
import assert from "node:assert/strict";
import {
  TECHNOMANCER_LANGUAGE_CACHE, archetypeTraditionFor, technomancerCacheSpells, traditionFromChoiceOption
} from "./pc-support.mjs";

const IDS = { DPS: "msU9FRYDZwkYvLNH", FORTRUN: "7yxVnWzTynBvFVjr", Servoshell: "KVc89RjerouF0wo1", Viper: "KWVSfZLZIW4zCW7K" };
assert.deepEqual(Object.keys(TECHNOMANCER_LANGUAGE_CACHE).sort(), Object.values(IDS).sort());
for (const [id, cache] of Object.entries(TECHNOMANCER_LANGUAGE_CACHE)) {
  assert.equal(cache.spells.length, 9, `${cache.language} has one cache spell per rank 1-9`);
  assert.equal(new Set(cache.spells).size, 9, `${cache.language} cache spells are distinct`);
  assert.ok(cache.spells.every((name) => typeof name === "string" && name === name.trim() && name.length), id);
}
assert.equal(TECHNOMANCER_LANGUAGE_CACHE[IDS.DPS].spells[0], "Supercharge Weapon");
assert.equal(TECHNOMANCER_LANGUAGE_CACHE[IDS.DPS].spells[8], "Implosion");
assert.equal(TECHNOMANCER_LANGUAGE_CACHE[IDS.FORTRUN].spells[8], "Foresight");
assert.equal(TECHNOMANCER_LANGUAGE_CACHE[IDS.Servoshell].spells[8], "Telekinetic Tantrum");
assert.equal(TECHNOMANCER_LANGUAGE_CACHE[IDS.Viper].spells[8], "Foresight");
assert.equal(TECHNOMANCER_LANGUAGE_CACHE[IDS.Viper].spells[2], "Locate");

const staged = (id) => [{ system: { rules: [{ key: "ChoiceSet", flag: "programmingLanguage", selection: `Compendium.sf2e.class-features.Item.${id}` }] } }];
const warnings = [];
const warn = console.warn;
console.warn = (...args) => warnings.push(args.join(" "));
try {
  for (const [language, id] of Object.entries(IDS)) {
    assert.deepEqual(technomancerCacheSpells(staged(id), [1, 2, 3]).map((spell) => spell.name),
      TECHNOMANCER_LANGUAGE_CACHE[id].spells.slice(0, 3), `${language} cache ranks 1-3`);
    assert.deepEqual(technomancerCacheSpells(staged(id), [9]), [{ rank: 9, name: TECHNOMANCER_LANGUAGE_CACHE[id].spells[8] }]);
  }
  assert.deepEqual(technomancerCacheSpells(staged(IDS.Viper), [0, 10, 2, 2, 1.5]), [{ rank: 2, name: "Translate" }],
    "only ranks 1-9 that the PC has earned are added, once each");
  assert.deepEqual(warnings, [], "a known language warns nothing");

  assert.deepEqual(technomancerCacheSpells([], [1]), [], "no staged language: no cache spell");
  assert.match(warnings.pop(), /no known Programming Language/);
  assert.deepEqual(technomancerCacheSpells(staged("unknownLanguage"), [1]), []);
  assert.match(warnings.pop(), /no known Programming Language/);
} finally {
  console.warn = warn;
}

// Archetype caster tradition: the Technomancer Dedication is arcane by its own text.
assert.equal(archetypeTraditionFor("technomancer-dedication", null), "arcane");
assert.equal(archetypeTraditionFor("not-a-dedication", null), null);
const quiet = [];
console.warn = (...args) => quiet.push(args.join(" "));
try {
  // Mystic (Connection) and Witchwarper (Paradox) traditions are not in any cited map yet.
  assert.equal(archetypeTraditionFor("mystic-dedication", null), null, "mystic tradition is unproven");
  assert.equal(archetypeTraditionFor("mystic-dedication", "any-connection"), null, "a connection id is not a proof by itself");
  assert.equal(archetypeTraditionFor("witchwarper-dedication", "any-paradox"), null, "witchwarper tradition is unproven");
  assert.equal(quiet.length, 3, "each unproven dedication warns");
} finally {
  console.warn = warn;
}

// The tradition is read from the chosen option's own override, never from an id table.
// Fixtures copy the cited option shapes (packs/sf2e/class-features/{mystic/connections,witchwarper/paradoxes}).
const option = (path, value, mode = "override", key = "ActiveEffectLike") => ({ name: "Option", system: { rules: [{ key, mode, path, value }] } });
const akashic = option("flags.system.mystic.tradition", "occult");
const analyst = option("flags.system.witchwarper.tradition", "arcane");
assert.equal(traditionFromChoiceOption(akashic, "mystic"), "occult");
assert.equal(traditionFromChoiceOption(analyst, "witchwarper"), "arcane");
assert.equal(archetypeTraditionFor("mystic-dedication", akashic), "occult", "a pre-answered Connection supplies its tradition");
assert.equal(archetypeTraditionFor("witchwarper-dedication", analyst), "arcane", "a pre-answered Paradox supplies its tradition");
assert.equal(traditionFromChoiceOption(analyst, "mystic"), null, "a Paradox override never serves a Mystic dedication");
assert.equal(traditionFromChoiceOption(option("flags.system.mystic.tradition", "occult", "add"), "mystic"), null, "only an override counts");
assert.equal(traditionFromChoiceOption(option("flags.system.mystic.tradition", "sorcery"), "mystic"), null, "only the four traditions count");
assert.equal(traditionFromChoiceOption(option("flags.system.mystic.tradition", "occult", "override", "Other"), "mystic"), null);
assert.equal(traditionFromChoiceOption({ system: { rules: [] } }, "mystic"), null);
assert.equal(traditionFromChoiceOption(null, "mystic"), null);
const doubled = { system: { rules: [akashic.system.rules[0], akashic.system.rules[0]] } };
assert.equal(traditionFromChoiceOption(doubled, "mystic"), null, "two conflicting overrides are not a proof");
const warned = [];
console.warn = (...args) => warned.push(args.join(" "));
try {
  assert.equal(archetypeTraditionFor("mystic-dedication", { system: { rules: [] } }), null);
  assert.equal(warned.length, 1, "an unproven dedication warns once");
} finally {
  console.warn = warn;
}

console.log("technomancer cache spells and archetype tradition: all assertions passed");
