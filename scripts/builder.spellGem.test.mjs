// sf2e's only spell consumable is the spell gem (v14-dev
// src/scripts/config/spell-consumables.ts "spell-gem"). Loot gems are built
// like the system's createConsumableFromSpell: clone the rank template, merge
// spell traits and rarity, drop "magical" when a tradition trait is present,
// name "Spell Gem of {name} (Rank {level})", link the spell, embed it heightened.
// Run: node scripts/builder.spellGem.test.mjs
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";

const docs = new Map();
const makeDoc = (pack, id, name, type, system) => ({
  name, uuid: `Compendium.${pack}.Item.${id}`, system,
  toObject: () => ({ _id: id, name, type, system: structuredClone(system) })
});
// Shape copied from packs/sf2e/equipment/consumables/spell-gems/spell-gem-3rd-rank-spell.json
const gem3 = makeDoc("sf2e.equipment", "Nwl7YydQ0r8cAhw7", "Spell Gem (3rd-Rank Spell)", "consumable", {
  category: "spell-gem", level: { value: 5 }, price: { per: 1, value: { sp: 300 } },
  traits: { rarity: "common", value: ["consumable", "magical"] },
  usage: { value: "held-in-one-hand" }, uses: { autoDestroy: true, max: 1, value: 1 },
  description: { value: "<p>A gem.</p>" }, spell: null
});
const fireball = makeDoc("sf2e.spells", "fireball", "Fireball", "spell", {
  level: { value: 3 }, traits: { rarity: "uncommon", value: ["concentrate", "fire", "arcane"], traditions: ["arcane", "primal"] },
  location: { value: "entry1" }
});
docs.set("Nwl7YydQ0r8cAhw7", gem3);
docs.set("fireball", fireball);

const pack = (entries) => ({ getIndex: async () => entries, getDocument: async (id) => docs.get(id) });
globalThis.game = {
  settings: { get: (_moduleId, key) => key === SETTINGS.sourcePacks ? {} : null },
  i18n: { localize: (key) => key },
  packs: new Map([
    ["sf2e.equipment", pack([{ _id: "Nwl7YydQ0r8cAhw7", name: "Spell Gem (3rd-Rank Spell)", type: "consumable", system: { category: "spell-gem", spell: null } }])],
    ["sf2e.spells", pack([{ _id: "fireball", name: "Fireball", type: "spell", system: { level: { value: 3 } } }])]
  ])
};
globalThis.foundry = { utils: { escapeHTML: String, randomID: () => "newSpellId" } };

const { parseScroll, buildSpellGemItem } = await import("./builder.mjs");

assert.deepEqual(parseScroll("Spell Gem of Fireball (Rank 3)"), { spellName: "Fireball", rank: 3 });
assert.deepEqual(parseScroll("Scroll of Fireball"), { spellName: "Fireball", rank: null }, "a PF2e-style draft is still recognized");
assert.equal(parseScroll("Spell Gem (3rd-Rank Spell)"), null, "the blank template name is not a gem pick");

const data = await buildSpellGemItem({ packId: "sf2e.spells", _id: "fireball" }, 3);
assert.equal(data.name, "Spell Gem of Fireball (Rank 3)");
assert.equal(data.type, "consumable");
assert.equal(data.system.category, "spell-gem");
assert.deepEqual(data.system.traits.value, ["arcane", "concentrate", "consumable", "fire"],
  "spell traits merged and sorted; magical dropped because a tradition trait is present");
assert.equal(data.system.traits.rarity, "uncommon", "rarity follows the spell");
assert.equal(data.system.spell._id, "newSpellId");
assert.deepEqual(data.system.spell.system.location, { value: null, heightenedLevel: 3 });
assert.equal(data.system.description.value,
  "<p>@UUID[Compendium.sf2e.spells.Item.fireball]{Fireball}</p><hr /><p>A gem.</p>");
assert.deepEqual(data.system.price, { per: 1, value: { sp: 300 } }, "the template price is kept");

assert.equal(await buildSpellGemItem({ packId: "sf2e.spells", _id: "fireball" }, 4), null,
  "a rank with no installed template fails closed");

console.log("builder.spellGem.test.mjs: spell gem assembly matches createConsumableFromSpell");
