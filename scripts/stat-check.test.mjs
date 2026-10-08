// Stat check after Create: expected-vs-sheet comparison and GM Core bands.
// Run: node scripts/stat-check.test.mjs
import assert from "node:assert/strict";
import { normalizeConcept } from "./builder.mjs";
import * as T from "./tables.mjs";
import { expectedSheetStats, readSheetStats, scaleBand, checkStats, statCheckForActor, describeStatCheck } from "./stat-check.mjs";

const raw = {
  name: "Drift Zombie",
  level: 4,
  rarity: "common",
  abilityScales: { str: "high", dex: "moderate", con: "high", int: "low", wis: "moderate", cha: "low" },
  acScale: "moderate",
  hpScale: "high",
  perceptionScale: "moderate",
  saveScales: { fortitude: "high", reflex: "moderate", will: "low" },
  speeds: [{ type: "land", value: 25 }],
  strikes: [{ name: "Claw", type: "melee", attackScale: "high", damageScale: "high", damageType: "slashing", traits: [] }],
  specialAbilities: [], feats: [], equipment: [], loot: [], traits: ["undead"],
  languages: [], senses: [], resistances: [], weaknesses: [], immunities: []
};
const concept = normalizeConcept(raw, { level: 4, rarity: "common" });

/** A fake prepared sf2e NPC with the accessors stat-check.mjs reads. */
function fakeActor(stats, patch = {}) {
  return {
    level: stats.level,
    armorClass: { value: stats.ac },
    perception: { mod: stats.perception },
    saves: Object.fromEntries(Object.entries(stats.saves).map(([key, mod]) => [key, { mod }])),
    spellcasting: { regular: stats.spellDC === null ? [] : [{ statistic: { dc: { value: stats.spellDC } } }] },
    system: {
      attributes: { hp: { max: stats.hp } },
      actions: [
        ...stats.strikes.map((strike) => ({ type: "strike", totalModifier: strike.bonus, item: { name: strike.name } })),
        { type: "area-fire", totalModifier: 99, item: { name: "Not a strike" } }
      ]
    },
    ...patch
  };
}

// Expected numbers are the table values at level 4.
const expected = expectedSheetStats(concept);
assert.equal(expected.level, 4);
assert.equal(expected.ac, T.AC.moderate[5]);
assert.equal(expected.hp, T.HP.high[5]);
assert.equal(expected.saves.will, T.PERCEPTION_AND_SAVES.low[5]);
assert.deepEqual(expected.strikes, [{ name: "Claw", bonus: T.STRIKE_ATTACK.high[5] }]);
assert.equal(expected.spellDC, null);

// A sheet matching the preview passes, and each row carries its scale.
let result = statCheckForActor(concept, fakeActor(expected));
assert.equal(result.problems, 0);
assert.equal(result.rows.find((r) => r.key === "ac").band, "moderate");
assert.equal(result.rows.find((r) => r.key === "hp").band, "high");
assert.equal(result.rows.find((r) => r.key === "save-will").band, "low");
assert.equal(result.rows.find((r) => r.key === "strike-Claw").band, "high");
assert.equal(result.rows.some((r) => r.key === "spellDC"), false, "no spell DC row without spellcasting");
assert.equal(result.rows.filter((r) => r.key.startsWith("strike-")).length, 1, "area fire is not a strike");

// A sheet that differs from the preview is flagged with both numbers.
result = statCheckForActor(concept, fakeActor({ ...expected, ac: expected.ac + 3 }));
const ac = result.rows.find((r) => r.key === "ac");
assert.equal(ac.status, "differs");
assert.equal(ac.expected, expected.ac);
assert.equal(ac.actual, expected.ac + 3);
assert.equal(result.problems, 1);

// A missing strike or unreadable value is reported, never guessed.
result = statCheckForActor(concept, fakeActor({ ...expected, strikes: [] }));
assert.equal(result.rows.find((r) => r.key === "strike-Claw").status, "unreadable");
const broken = readSheetStats({});
assert.equal(broken.ac, null);
assert.equal(broken.hp, null);
assert.deepEqual(broken.strikes, []);

// Elite: expected values follow the stored adjustment (sheet level 5).
const elite = expectedSheetStats({ ...concept, adjustment: "elite" });
assert.equal(elite.level, 5);
assert.equal(elite.ac, expected.ac + 2);
assert.equal(statCheckForActor({ ...concept, adjustment: "elite" }, fakeActor(elite)).problems, 0);

// Spellcasters get a spell DC row.
const caster = normalizeConcept({ ...raw, spellcasting: { tradition: "arcane", type: "prepared", dcScale: "high", spells: [] } }, { level: 4, rarity: "common" });
const casterExpected = expectedSheetStats(caster);
assert.equal(casterExpected.spellDC, T.SPELL_DC.high[5]);
result = statCheckForActor(caster, fakeActor(casterExpected));
assert.equal(result.rows.find((r) => r.key === "spellDC").status, "ok");
result = statCheckForActor(caster, fakeActor({ ...casterExpected, spellDC: null }));
assert.equal(result.rows.find((r) => r.key === "spellDC").status, "unreadable");

// Bands: above the top printed scale or below the lowest are out of range.
assert.equal(scaleBand(T.AC, 4, T.AC.extreme[5] + 1), "above");
assert.equal(scaleBand(T.AC, 4, T.AC.extreme[5]), "extreme");
assert.equal(scaleBand(T.AC, 4, T.AC.low[5] - 1), "below");
assert.equal(scaleBand(T.HP, 4, T.HP.moderate[5] + 1), "moderate", "between scales reads as the lower one");
assert.equal(scaleBand(T.PERCEPTION_AND_SAVES, 4, T.PERCEPTION_AND_SAVES.terrible[5]), "terrible");
assert.equal(scaleBand(T.AC, 4, null), null);
const tooHigh = checkStats({ ...expected, ac: T.AC.extreme[5] + 4 }, readSheetStats(fakeActor({ ...expected, ac: T.AC.extreme[5] + 4 })));
assert.equal(tooHigh.rows.find((r) => r.key === "ac").status, "outOfRange", "matches the preview but is outside GM Core");

console.log("stat-check.test.mjs: expected-vs-sheet rows, bands and unreadable values verified");

// Display text: keys and placeholders resolve through the given i18n.
{
  const { readFileSync } = await import("node:fs");
  const flat = {};
  const walk = (obj, prefix) => { for (const [k, v] of Object.entries(obj)) typeof v === "object" ? walk(v, `${prefix}${k}.`) : (flat[`${prefix}${k}`] = v); };
  walk(JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8")), "");
  const i18n = {
    localize: (key) => { assert.ok(key in flat, `missing ${key}`); return flat[key]; },
    format: (key, data) => i18n.localize(key).replace(/\{(\w+)\}/g, (m, n) => (n in data ? String(data[n]) : m))
  };
  const ok = describeStatCheck("Drift Zombie", statCheckForActor(concept, fakeActor(expected)), i18n);
  assert.match(ok.summary, /all 7 numbers match/);
  assert.equal(ok.rows[0].text, `AC ${expected.ac} (moderate)`);
  assert.ok(ok.rows.some((r) => r.text === `Strike: Claw ${expected.strikes[0].bonus} (high)`));
  const bad = describeStatCheck("Drift Zombie", statCheckForActor(concept, fakeActor({ ...expected, ac: expected.ac + 3 })), i18n);
  assert.match(bad.summary, /1 of 7 numbers need a look/);
  assert.equal(bad.rows[0].text, `AC ${expected.ac + 3} on the sheet, but the preview said ${expected.ac}`);
  for (const r of [...ok.rows, ...bad.rows]) assert.doesNotMatch(r.text, /\{\w+\}/, "no unfilled placeholder");
}
console.log("stat-check.test.mjs: display text verified");
