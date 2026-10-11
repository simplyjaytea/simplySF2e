// Re-level: each number moves by its nearest GM Core scale's step between the
// old and new level (HP by ratio); the source is not mutated; spells, ability
// text and unusual damage formulas stay as they were.
// Run: node scripts/relevel.test.mjs

import assert from "node:assert/strict";
import * as T from "./tables.mjs";
import { relevelActorData, shiftStat, scaleHp, shiftDamage, nearestScale, clampRelevel } from "./relevel.mjs";

const at = (table, scale, level) => table[scale][level + 1];

const source = {
  _id: "src", name: "Void Raider", type: "npc",
  system: {
    details: { level: { value: 3 } },
    abilities: { str: { mod: at(T.ABILITY_MODIFIER, "high", 3) }, dex: { mod: 0 } },
    attributes: {
      ac: { value: 19, details: "" },
      hp: { value: 30, max: 45, temp: 0, details: "" },
      adjustment: "elite",
      resistances: [{ type: "fire", value: at(T.RESISTANCE, "minimum", 3) }],
      weaknesses: []
    },
    perception: { mod: 9, senses: [] },
    saves: { fortitude: { value: 12 }, reflex: { value: 9 }, will: { value: 6 } },
    skills: {
      stealth: { base: at(T.SKILL, "high", 3), special: [{ label: "in shadows", base: at(T.SKILL, "high", 3) + 2 }] },
      piloting: { base: null }
    }
  },
  items: [
    { _id: "claw", name: "Claw", type: "melee", system: {
      bonus: { value: 12 },
      damageRolls: { a: { damage: "1d10+7", damageType: "slashing" }, b: { damage: "1d6", damageType: "fire" } }
    } },
    { _id: "odd", name: "Odd", type: "melee", system: { bonus: { value: 12 }, damageRolls: { a: { damage: "1d6+1d4" } } } },
    { _id: "lore", name: "Spacer Lore", type: "lore", system: { mod: { value: at(T.SKILL, "moderate", 3) } } },
    { _id: "cast", name: "Arcane Spells", type: "spellcastingEntry", system: { spelldc: { value: at(T.SPELL_ATTACK, "high", 3), dc: 20, mod: 0 } } },
    { _id: "bolt", name: "Force Bolt", type: "spell", system: { level: { value: 2 } } },
    { _id: "act", name: "Blast", type: "action", system: { description: { value: "@Check[reflex|dc:20]" } } }
  ]
};
const frozen = structuredClone(source);

// Benchmarks the expectations below rest on (GM Core, tables.mjs).
assert.equal(at(T.AC, "high", 3), 19);
assert.equal(at(T.AC, "high", 7), 25);
assert.equal(at(T.HP, "moderate", 3), 45);
assert.equal(at(T.HP, "moderate", 7), 115);
assert.equal(at(T.STRIKE_DAMAGE, "high", 3), "1d10+6");
assert.equal(at(T.STRIKE_DAMAGE, "high", 7), "2d10+9");

const { data, rows, from, to } = relevelActorData(source, 7);
assert.deepEqual(source, frozen, "source is not mutated");
assert.equal(from, 3);
assert.equal(to, 7);
assert.equal(data.system.details.level.value, 7);
assert.equal(data.system.attributes.ac.value, 25);
assert.equal(data.system.attributes.hp.max, 115);
assert.equal(data.system.attributes.hp.value, 115, "copy starts at full HP");
assert.equal(data.system.attributes.adjustment, "elite", "Elite/Weak is kept");
assert.equal(data.system.perception.mod, at(T.PERCEPTION_AND_SAVES, "moderate", 7));
assert.equal(data.system.saves.fortitude.value, at(T.PERCEPTION_AND_SAVES, "high", 7));
assert.equal(data.system.abilities.str.mod, at(T.ABILITY_MODIFIER, "high", 7));
assert.equal(data.system.skills.stealth.base, at(T.SKILL, "high", 7));
assert.equal(data.system.skills.stealth.special[0].base, at(T.SKILL, "high", 7) + 2, "special skill moves with its skill");
assert.equal(data.system.skills.piloting.base, null, "a null base still defers to the attribute");
assert.equal(data.system.attributes.resistances[0].value, at(T.RESISTANCE, "minimum", 7));

const claw = data.items.find((item) => item._id === "claw");
assert.equal(claw.system.bonus.value, 18);
assert.equal(claw.system.damageRolls.a.damage, "2d10+10", "one above high at 3 stays one above high at 7");
assert.equal(claw.system.damageRolls.b.damage, "1d6", "rider damage is unchanged");
assert.equal(data.items.find((item) => item._id === "odd").system.damageRolls.a.damage, "1d6+1d4", "unusual formula unchanged");
assert.equal(data.items.find((item) => item._id === "lore").system.mod.value, at(T.SKILL, "moderate", 7));
const cast = data.items.find((item) => item._id === "cast");
assert.equal(cast.system.spelldc.dc, at(T.SPELL_DC, "high", 7));
assert.equal(cast.system.spelldc.value, at(T.SPELL_ATTACK, "high", 7));
assert.deepEqual(data.items.find((item) => item._id === "bolt"), source.items[4], "spells unchanged");
assert.deepEqual(data.items.find((item) => item._id === "act"), source.items[5], "ability text unchanged");

const keys = rows.map((row) => row.key);
for (const key of ["ac", "hp", "perception", "save-fortitude", "strike-claw", "damage-claw", "spelldc-cast"]) {
  assert.ok(keys.includes(key), `preview row ${key}`);
}
assert.deepEqual(rows.find((row) => row.key === "ac"), { key: "ac", label: "SIMPLYSF2E.StatCheck.AC", scale: "high", from: 19, to: 25 });
assert.equal(rows.find((row) => row.key === "strike-claw").name, "Claw");

// Down is the mirror of up.
const back = relevelActorData(data, 3).data;
assert.equal(back.system.attributes.ac.value, 19);
assert.equal(back.system.attributes.hp.max, 45);
assert.equal(back.items.find((item) => item._id === "claw").system.damageRolls.a.damage, "1d10+7");

// Same level: an untouched copy and no rows.
const same = relevelActorData(source, 3);
assert.equal(same.rows.length, 0);
assert.deepEqual(same.data, source);

// A mindless creature's Int -5 sits below every printed attribute scale and stays put.
const mindless = relevelActorData({ system: { details: { level: { value: 1 } }, abilities: { int: { mod: -5 } }, skills: { stealth: { base: -3 } } } }, 20).data;
assert.equal(mindless.system.abilities.int.mod, -5);
assert.equal(mindless.system.skills.stealth.base, -3);

// Helpers.
assert.equal(nearestScale(T.AC, 3, 20), "high", "20 is nearer high (19) than extreme (22)");
assert.equal(shiftStat(T.AC, 20, 3, 7).value, 26);
assert.equal(shiftStat(T.AC, "20", 3, 7), null, "non-numbers are left alone");
assert.equal(scaleHp(5, 3, -1).value >= 1, true);
assert.equal(shiftDamage("2d8+9", 3, 3).value, "2d8+9");
assert.equal(shiftDamage("", 3, 7), null);
assert.equal(clampRelevel(40), T.MAX_LEVEL);
assert.equal(clampRelevel(-5), T.MIN_LEVEL);
assert.equal(clampRelevel("x", 4), 4);
assert.equal(relevelActorData({ system: {} }, 5).to, 5, "a creature with no level counts as level 0");

console.log("relevel.test.mjs: re-level keeps each stat's GM Core scale");
