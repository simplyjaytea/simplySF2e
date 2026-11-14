// Execute production preview mapping and aggregation, not a copied helper.
// The preview builder is generator-context/creature-preview.mjs (moved out of
// generator-app.mjs, T-P4); it runs unmodified with its stat helpers mocked.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { signed } from "./text.mjs";
import { rerollTarget } from "./reroll.mjs";
import * as rows from "./generator-context/rows.mjs";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}
// The preview builder moved out of generator-app.mjs into generator-context/creature-preview.mjs
// (T-P4). Its source is run unmodified, with the stat helpers mocked so the stats are controllable.
const source = await readFile(new URL("./generator-context/creature-preview.mjs", import.meta.url), "utf8");
const context = vm.createContext({ console, game: { i18n: { format: (_key, { matched, total }) => `${matched}/${total}` } } });
// matchSummary and the row mappers (generator-context/rows.mjs) are real and run outside the vm, so they read the `game` global.
globalThis.game = context.game;
let fakeStats = {};
const mocks = { ...rows, signed, computeStats: () => fakeStats, adjustedStats: (stats) => stats, rerollTarget };
const module = new vm.SourceTextModule(source, { context });
await module.link((specifier) => {
  const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .filter((match) => match[2] === specifier)
    .flatMap((match) => match[1].split(",").map((name) => name.trim()));
  return new vm.SyntheticModule(imports, function () {
    for (const name of imports) this.setExport(name, mocks[name] ?? (() => { throw new Error(`Unexpected dependency: ${name}`); }));
  }, { context });
});
await module.evaluate();
const { buildCreaturePreviewContext } = module.namespace;
// The same call the app delegates: concept and resolved picks in, template context out.
const app = {
  _test_concept: null, _test_resolved: null,
  _test_buildPreviewContext() { return buildCreaturePreviewContext(this._test_concept, this._test_resolved); }
};
function matchSummary(...groups) {
  const result = rows.matchSummary(...groups);
  return result && { matched: result.matched, total: result.total };
}
assert.deepEqual(matchSummary([{ found: true }], [{ found: false }, { found: true }], [{ found: true }]), { matched: 3, total: 4 });
assert.deepEqual(matchSummary([{ found: true }, { found: true }], [{ found: true }]), { matched: 3, total: 3 });
assert.deepEqual(matchSummary([{ found: false }], [{ found: false }, { found: false }]), { matched: 0, total: 3 });
assert.equal(matchSummary(), null);
assert.equal(matchSummary([], [], []), null);
assert.deepEqual(matchSummary([null], [{ found: true }, undefined, { found: false }]), { matched: 1, total: 2 });
assert.deepEqual(matchSummary([{ found: true, narrative: true }, { found: false, narrative: false }]), { matched: 0, total: 1 });
assert.equal(matchSummary([{ found: false, narrative: true }]), null);

// The live courier had twelve real matches plus one narrative-only ability.
// This exercises the production caller that previously dropped `narrative`.
app._test_concept = {
  rarity: "common", size: "sm", traits: [], speeds: [], senses: [],
  languages: [], immunities: [], resistances: [], weaknesses: []
};
app._test_resolved = {
  abilities: [{ ability: { name: "Nimble Escape", narrative: true, description: "Custom flavor" }, entry: null }],
  equipment: Array.from({ length: 12 }, (_, i) => ({ name: `Item ${i}`, entry: { name: `Item ${i}` } }))
};
let preview = app._test_buildPreviewContext();
assert.equal(preview.matchSummary.text, "12/12", "narrative marker must survive the production caller mapping");
assert.equal(preview.abilities.length, 1, "narrative ability remains visible");
assert.equal(preview.abilities[0].narrative, true, "narrative-only label remains present");
app._test_resolved.abilities.push({ ability: { name: "Unresolved published ability", narrative: false }, entry: null });
preview = app._test_buildPreviewContext();
assert.equal(preview.matchSummary.text, "12/13", "unresolved non-narrative ability must still count as a miss");
app._test_resolved.equipment.push({ name: "Unresolved equipment", entry: null });
preview = app._test_buildPreviewContext();
assert.equal(preview.matchSummary.text, "12/14", "unresolved required equipment must not disappear from the denominator");
app._test_resolved.abilities = app._test_resolved.abilities.slice(0, 1);
app._test_resolved.equipment = [];
assert.equal(app._test_buildPreviewContext().matchSummary, null, "narrative-only preview has no published-content denominator");
// Signed display fields: negatives render "-1", never "+-1"; raw stats stay numeric.
fakeStats = {
  perception: -1, saves: { fortitude: 5, reflex: -2, will: 0 }, spellAttack: -1,
  skills: [{ name: "Stealth", mod: -3 }, { name: "Piloting", mod: 4 }],
  strikes: [{ name: "Claw", bonus: -1, damage: "1d4" }]
};
preview = app._test_buildPreviewContext();
assert.equal(preview.display.perception, "-1");
assert.deepEqual({ ...preview.display.saves }, { fortitude: "+5", reflex: "-2", will: "+0" });
assert.deepEqual(preview.display.skills.map((s) => s.mod), ["-3", "+4"]);
assert.equal(preview.display.strikes[0].bonusText, "-1");
assert.equal(preview.display.spellAttack, "-1");
assert.equal(preview.stats.perception, -1, "raw stats must stay numeric");
assert.equal(preview.stats.strikes[0].bonus, -1);
// unmatchedRows: the picks the compendium did not resolve, per list, in order.
// An empty slot is a slot to fill, not a failed pick, and matched rows stay out.
{
  const lists = {
    spells: [{ name: "A", found: true }, { name: "B", found: false }, { name: "C", found: false }],
    feats: [{ name: "", found: false, empty: true }, { name: "D", found: false }],
    loot: [{ name: "E", found: true }],
    equipment: undefined
  };
  const out = rows.unmatchedRows(lists);
  assert.deepEqual(Object.keys(out), ["spells", "feats", "loot", "equipment"]);
  assert.deepEqual(out.spells.map((row) => row.name), ["B", "C"]);
  assert.deepEqual(out.feats.map((row) => row.name), ["D"]);
  assert.deepEqual(out.loot, []);
  assert.deepEqual(out.equipment, [], "a missing list reads as nothing unmatched");
  assert.equal(out.spells[0], lists.spells[1], "rows are passed through, not copied");
}
console.log("generator-app.matchSummary.test.mjs: production preview and summary assertions passed");
