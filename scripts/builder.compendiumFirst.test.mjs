// Regression check for the compendium-first audit: creature mechanics the
// model used to write freely now come from published sf2e data or cited
// tables.
//
// 1. A strike named after a carried published weapon takes that weapon's
//    damage type, traits, reload/expend and range (as published NPCs do).
// 2. Recall Knowledge skills follow the Starfinder GM Core pg. 54 table,
//    including Robot (Computers, Crafting); no table row means no skill.
// 3. Speeds and sense ranges land on published values; senses take the
//    shape pf2e expects (no range on darkvision, mandatory precise acuity).
// 4. "custom" IWR is not a pickable type.
// 5. Narrative-only text with dice, a DC or Hit Points is recognised.
// 6. Generated casters get 3 slots per known rank.
// 7. Item Forge drops model traits that are not real equipment traits.
//
// Run: node scripts/builder.compendiumFirst.test.mjs

import assert from "node:assert/strict";
import {
  normalizeConcept, strikeFromWeapon, alignStrikesToWeapons, recallKnowledgeSkills,
  shapeSense, nearestPublished, narrativeHasMechanics, NPC_SLOTS_PER_RANK
} from "./builder.mjs";
import { recallKnowledgeNote } from "./reskin.mjs";
import { normalizeMagicItemConcept } from "./item-builder.mjs";

// Real v14-dev data (packs/sf2e/equipment/weapons/laser-pistol.json, knife.json).
const laserPistol = {
  name: "Laser Pistol",
  system: { damage: { damageType: "fire", dice: 1, die: "d6" }, traits: { value: ["tech"] }, range: 40, reload: { value: "1" }, expend: 2 }
};
const knife = {
  name: "Knife",
  system: { damage: { damageType: "piercing", dice: 1, die: "d4" }, traits: { value: ["agile", "analog", "finesse", "thrown-10", "versatile-s"] }, range: null, reload: { value: null }, expend: null }
};
const npcTraits = new Set(["tech", "agile", "finesse", "thrown-10", "versatile-s", "reload-1", "expend-2"]);
const draft = (overrides) => ({
  name: "x", type: "melee", attackScale: "high", damageScale: "high",
  damageType: "bludgeoning", traits: [], range: null, attackEffects: [], ...overrides
});

// --- 1. Strikes follow the published weapon ---
{
  const strike = strikeFromWeapon(draft({ name: "rusted laser pistol", damageType: "cold" }), laserPistol, npcTraits);
  assert.equal(strike.type, "ranged", "a weapon with its own range is a ranged strike");
  assert.equal(strike.range, 40);
  assert.equal(strike.damageType, "fire", "damage type comes from the weapon, not the draft");
  assert.deepEqual(strike.traits, ["tech", "reload-1", "expend-2"]);
  assert.equal(strike.attackScale, "high", "scales stay with the concept");

  const stab = strikeFromWeapon(draft({ name: "knife" }), knife, npcTraits);
  assert.equal(stab.type, "melee");
  assert.equal(stab.range, null);
  assert.equal(stab.damageType, "piercing");
  assert.deepEqual(stab.traits, ["agile", "finesse", "versatile-s"],
    "traits outside npcAttackTraits drop, and a melee strike loses thrown-N (pf2e would make it ranged)");

  const thrown = strikeFromWeapon(draft({ name: "thrown knife", type: "ranged", range: 60 }), knife, npcTraits);
  assert.equal(thrown.type, "ranged");
  assert.equal(thrown.range, 10, "thrown range comes from the weapon's thrown trait");
  assert.ok(thrown.traits.includes("thrown-10"), "a thrown strike keeps its thrown trait");

  // Published grenades and area weapons strike at a maximum range with no
  // grenade or area trait (alien-core-bestiary Frag Grenade, Plasma Cannon).
  const grenade = { name: "Frag Grenade", system: { damage: { damageType: "piercing" }, traits: { value: ["consumable", "grenade", "tech", "area-burst-10"] }, range: 70 } };
  const lob = strikeFromWeapon(draft({ name: "frag grenade" }),
    grenade, new Set([...npcTraits, "consumable", "grenade", "area-burst-10"]));
  assert.equal(lob.type, "ranged");
  assert.equal(lob.range, 70);
  assert.equal(lob.rangeMax, true);
  assert.deepEqual(lob.traits, ["consumable", "tech"]);
  assert.equal(strikeFromWeapon(lob, laserPistol, npcTraits).rangeMax, undefined, "a normal weapon clears rangeMax");

  const weapons = [{ names: ["Laser Pistol", "laser pistol"], weapon: laserPistol }, { names: ["Knife"], weapon: knife }];
  const [pistol, jaws, blade] = alignStrikesToWeapons(
    [draft({ name: "Laser Pistol (Commercial)" }), draft({ name: "jaws", damageType: "piercing" }), draft({ name: "knife slash" })],
    weapons, npcTraits
  );
  assert.equal(pistol.damageType, "fire");
  assert.equal(jaws.damageType, "piercing", "a strike with no matching weapon is unchanged");
  assert.deepEqual(jaws.traits, []);
  assert.equal(blade.damageType, "bludgeoning", "the weapon name must end the strike name");
  assert.equal(alignStrikesToWeapons([draft({ name: "pistol whip" })], [{ names: ["pistol"], weapon: laserPistol }], npcTraits)[0].type,
    "melee", "a strike that only starts with a weapon name is not that weapon");
  assert.equal(alignStrikesToWeapons([draft({ name: "serrated knife" })], weapons, npcTraits)[0].damageType, "piercing");
  assert.equal(alignStrikesToWeapons([draft({ name: "knifepoint" })], weapons, npcTraits)[0].damageType,
    "bludgeoning", "only whole words match a weapon name");
}

// --- 2. Recall Knowledge ---
{
  assert.deepEqual(recallKnowledgeSkills(["robot"]), ["computers", "crafting"]);
  assert.deepEqual(recallKnowledgeSkills(["beast", "animal"]), ["arcana", "nature"]);
  assert.deepEqual(recallKnowledgeSkills(["construct", "robot"]), ["arcana", "crafting", "computers"]);
  assert.deepEqual(recallKnowledgeSkills(["time"]), [], "no SF2e table row, no guessed skill");
  assert.deepEqual(recallKnowledgeSkills(["tech"]), []);
  const both = recallKnowledgeNote(["computers", "crafting"], 18, "It <hums>.");
  assert.ok(both.includes("@Check[type:computers|dc:18]") && both.includes("@Check[type:crafting|dc:18]"));
  assert.ok(both.includes("It &lt;hums&gt;."), "flavor text is escaped");
  const none = recallKnowledgeNote([], 18, "Odd.");
  assert.ok(!none.includes("@Check") && none.includes("DC 18"));
  assert.ok(recallKnowledgeNote("nature", 20, "x").includes("@Check[type:nature|dc:20]"), "a single slug still works");
}

// --- 3. Speeds and senses ---
{
  assert.equal(nearestPublished(33, [30, 35]), 35);
  assert.equal(nearestPublished(32.5, [30, 35]), 30, "ties go to the lower value");
  const c = normalizeConcept({
    speeds: [{ type: "land", value: 500 }, { type: "fly", value: 65 }, { type: "swim", value: 7 }],
    senses: [
      { type: "darkvision", acuity: "imprecise", range: 60 },
      { type: "scent", acuity: null, range: 50 },
      { type: "tremorsense", acuity: "precise", range: null },
      { type: "truesight", acuity: "vague", range: 1000 },
      { type: "echolocation", acuity: null, range: 25 }
    ]
  }, { level: 3, rarity: "common" });
  assert.deepEqual(c.speeds, [{ type: "land", value: 60 }, { type: "fly", value: 60 }, { type: "swim", value: 20 }]);
  assert.deepEqual(c.senses, [
    { type: "darkvision" },
    { type: "scent", acuity: "imprecise", range: 60 },
    { type: "tremorsense", acuity: "precise", range: 60 },
    { type: "truesight", acuity: "precise", range: 60 },
    { type: "echolocation", acuity: "precise", range: 30 }
  ]);
  assert.deepEqual(shapeSense({ type: "low-light-vision", range: 30 }), { type: "low-light-vision" });
}

// --- 4. custom IWR ---
{
  const c = normalizeConcept({ resistances: ["custom", "fire"], weaknesses: ["custom"], immunities: ["custom"] },
    { level: 3, rarity: "common" });
  assert.deepEqual(c.resistances, ["fire"]);
  assert.deepEqual(c.weaknesses, []);
  assert.deepEqual(c.immunities, []);
}

// --- 5. Narrative text ---
{
  assert.ok(narrativeHasMechanics("Its bite deals 2d6 fire damage."));
  assert.ok(narrativeHasMechanics("DC 22 Fortitude or be sickened."));
  assert.ok(narrativeHasMechanics("It regains 15 Hit Points."));
  assert.ok(narrativeHasMechanics("Its touch deals 10 fire damage."));
  assert.ok(!narrativeHasMechanics("It smells of ozone and hums in 2 tones."));
  assert.ok(!narrativeHasMechanics(""));
}

// --- 6. Slots ---
assert.equal(NPC_SLOTS_PER_RANK, 3);

// --- 7. Item Forge traits ---
{
  const opts = { level: 3, rarity: "common", availableKinds: [], usageOptions: ["worn"], kind: "wondrous" };
  const before = normalizeMagicItemConcept({ name: "Hum", traits: ["sonic", "made-up"] }, opts);
  assert.ok(before.traits.includes("made-up"), "outside Foundry there is no trait list to check");
  globalThis.CONFIG = { PF2E: { equipmentTraits: { sonic: "Sonic", magical: "Magical" } } };
  try {
    const after = normalizeMagicItemConcept({ name: "Hum", traits: ["sonic", "made-up"] }, opts);
    assert.ok(after.traits.includes("sonic"));
    assert.ok(!after.traits.includes("made-up"), "unknown model trait drops");
    assert.ok(after.traits.includes("magical"), "module-added traits stay");
  } finally {
    delete globalThis.CONFIG;
  }
}

console.log("builder.compendiumFirst: all checks passed");
