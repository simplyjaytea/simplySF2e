// HUNT2-CREATURE regressions (T-CRE2): re-level and Recall Knowledge DC edges.
// Run: node scripts/creature.hunt2.test.mjs
import assert from "node:assert/strict";
import * as T from "./tables.mjs";
import { relevelActorData } from "./relevel.mjs";

const abilityMods = (actor) => Object.fromEntries(Object.entries(actor.system.abilities).map(([key, entry]) => [key, entry.mod]));
const npc = (level, abilities) => ({
  system: {
    details: { level: { value: level } },
    abilities: Object.fromEntries(Object.entries(abilities).map(([key, mod]) => [key, { mod }])),
    attributes: { ac: { value: T.AC.high[level + 1] }, hp: { max: 100, value: 100 } }
  },
  items: []
});

// 1. Extreme ability modifier re-levelled to level 0 / -1: the printed Extreme cell is
// missing there, so the value falls back to High (tables.lookup) and keeps its offset.
{
  const ext10 = T.ABILITY_MODIFIER.extreme[10 + 1];
  const high10 = T.ABILITY_MODIFIER.high[10 + 1];
  assert.equal(ext10, 8, "table anchor: Extreme at level 10");
  const source = npc(10, { str: ext10, dex: ext10 + 1, con: high10, int: 3, wis: 3, cha: 3 });
  for (const to of [0, -1]) {
    const out = abilityMods(relevelActorData(source, to).data);
    const high = T.ABILITY_MODIFIER.high[to + 1];
    assert.equal(out.str, high, `Extreme str at level ${to} lands on High`);
    assert.ok(out.str <= high, `Extreme str at level ${to} is at most High`);
    assert.notEqual(out.str, ext10, `Extreme str at level ${to} is no longer the level 10 number`);
    assert.equal(out.dex, high + 1, `an Extreme+1 stat keeps its offset at level ${to}`);
    assert.equal(out.con, high, `High con stays High at level ${to}`);
  }
  // Level 1 is the first printed Extreme level; 1 -> 0 loses the column too.
  const ext1 = T.ABILITY_MODIFIER.extreme[1 + 1];
  const fromOne = abilityMods(relevelActorData(npc(1, { str: ext1, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }), 0).data);
  assert.equal(fromOne.str, T.ABILITY_MODIFIER.high[0 + 1], "level 1 Extreme re-levelled to 0 lands on High");
  assert.notEqual(fromOne.str, ext1, "level 1 Extreme re-levelled to 0 changes");
  // Printed cells are unchanged where they exist: 10 -> 12 stays Extreme.
  assert.equal(abilityMods(relevelActorData(source, 12).data).str, T.ABILITY_MODIFIER.extreme[12 + 1]);
}

console.log("creature.hunt2 tests passed");
