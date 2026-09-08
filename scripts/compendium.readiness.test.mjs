import assert from "node:assert/strict";

const packs = new Map([
  ["sf2e.bestiary-ability-glossary-srd", {}], ["sf2e.equipment", {}], ["sf2e.spells", {}], ["sf2e.ancestries", {}],
  ["sf2e.backgrounds", {}], ["sf2e.classes", {}], ["sf2e.class-features", {}], ["sf2e.feats", {}], ["sf2e.alien-core-bestiary", {}]
]);
globalThis.game = { packs: { get: (id) => packs.get(id) }, settings: { get: () => ({}) } };
const { sourceReadiness } = await import("./compendium.mjs");

const creature = sourceReadiness("monster");
assert.equal(creature.ready, true);
assert.equal(creature.packCount, 5);
packs.delete("sf2e.spells");
assert.deepEqual(sourceReadiness("npc").missing, ["spells"]);
assert.deepEqual(sourceReadiness("npc", { allowSpellcasting: false }).missing, ["spells"],
  "scroll grounding requires spell sources even for a non-caster");
packs.set("sf2e.spells", {});
packs.delete("sf2e.alien-core-bestiary");
assert.deepEqual(sourceReadiness("monster").missing, ["bestiaryActors"],
  "complete creature generation requires an enabled exact bestiary Actor scaffold source");
packs.set("sf2e.alien-core-bestiary", {});
assert.equal(sourceReadiness("character").ready, true);
packs.delete("sf2e.classes");
assert.ok(sourceReadiness("character").missing.includes("classes"));
console.log("compendium.readiness.test.mjs: required source preflight passed");
