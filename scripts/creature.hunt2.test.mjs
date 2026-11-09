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

// Production build path for items 2 and 3 (same stubs as relevel-abilities.test.mjs):
// normalizeConcept -> resolveConcept -> createActor, with Actor.create stubbed.
const PACK = "sf2e.bestiary-ability-glossary-srd";
const TRAMPLE = "<p>[Size], [Listed Strike], @Check[reflex|dc:|basic]</p>\n<hr />\n<p>@Localize[PF2E.NPC.Abilities.Glossary.Trample]</p>";
const trampleDoc = { _id: "trample", name: "Trample", type: "action", system: { slug: "trample", description: { value: TRAMPLE }, rules: [] } };
const trampleUuid = `Compendium.${PACK}.Item.trample`;
const pack = {
  async getIndex() { return [{ _id: "trample", name: "Trample", type: "action", system: { slug: "trample", traits: { value: [] }, actionType: { value: "action" } } }]; },
  async getDocument(id) { return id === "trample" ? { ...trampleDoc, uuid: trampleUuid, toObject: () => structuredClone(trampleDoc) } : null; }
};
const equipmentPack = { documents: {}, async getIndex() { return Object.values(this.documents).map((d) => ({ _id: d._id, name: d.name, type: d.type, system: d.system })); }, async getDocument(id) { const d = this.documents[id]; return d ? { ...d, uuid: `Compendium.sf2e.equipment-srd.Item.${id}`, toObject: () => structuredClone(d) } : null; } };
globalThis.game = {
  settings: { get: () => ({}) },
  packs: new Map([[PACK, pack], ["sf2e.equipment-srd", equipmentPack]]),
  i18n: { localize: (k) => k, format: (k) => k }
};
globalThis.CONFIG = { PF2E: { damageTypes: {}, npcAttackTraits: {}, attackEffects: {} } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 20 } };
globalThis.foundry = { utils: { randomID: (() => { let n = 0; return () => `id${++n}`; })() } };
const warnings = [];
console.warn = (message) => warnings.push(String(message));

const { normalizeConcept, resolveConcept, createActor } = await import("./builder.mjs");
const { refineCreatureAbilities } = await import("./creature-pipeline.mjs");
const selector = async ({ candidates }) => ({ abilities: candidates.filter((c) => c.name === "Trample").map((c) => ({ name: c.name, candidate: c.ref })), usage: null, timing: null });
async function build(raw) {
  const concept = normalizeConcept({ name: "Test Brute", level: 7, size: "lg", ...raw }, { level: 7, rarity: "common" });
  await refineCreatureAbilities(concept, { ai: { selectCreatureAbilities: selector }, labels: {}, onTokens: () => {} });
  const resolved = await resolveConcept(concept);
  let created = null;
  globalThis.Actor = { create: async (data) => { created = data; return data; } };
  await createActor(concept, resolved, {});
  return { concept, resolved, actor: created };
}
const trample = (actor) => actor.items.find((item) => item.name === "Trample");
const sources = { [trampleUuid]: trampleDoc };
const CLAW = { name: "Claw", attackScale: "high", damageScale: "moderate", damageType: "slashing", traits: [], attackEffects: [] };
const RIFLE = { name: "Laser Rifle", type: "ranged", range: 60, attackScale: "high", damageScale: "extreme", damageType: "fire", traits: [], attackEffects: [] };
const TRAMPLE_PICK = [{ name: "Trample", glossary: "Trample", description: "It tramples." }];

// 2. Re-level rebuilds Trample from the melee strikes only (a ranged NPC strike is a
// melee-type item with system.range, builder.mjs createActor writes {increment|max}).
{
  const { actor } = await build({ strikes: [CLAW, RIFLE], specialAbilities: TRAMPLE_PICK });
  assert.ok(actor.items.find((i) => i.name === "Laser Rifle").system.range, "built ranged strike carries system.range");
  assert.match(trample(actor).system.description.value, /Claw/, "create names the melee strike");
  assert.doesNotMatch(trample(actor).system.description.value, /Laser Rifle/, "create never names the ranged strike");
  const out = relevelActorData(actor, 8, { sources });
  assert.match(trample(out.data).system.description.value, /Claw/, "re-level still names the melee strike");
  assert.doesNotMatch(trample(out.data).system.description.value, /Laser Rifle/, "re-level never names the ranged strike");

  // Ranged-only creature: no melee Strike, the item is kept as is and reported.
  const only = await build({ strikes: [RIFLE], specialAbilities: TRAMPLE_PICK });
  assert.equal(trample(only.actor), undefined, "create drops Trample when no melee Strike exists");
  const flagged = structuredClone(actor);
  flagged.items = flagged.items.filter((i) => i.name !== "Claw");
  const kept = relevelActorData(flagged, 8, { sources });
  const report = kept.abilities.find((a) => a.name === "Trample");
  assert.equal(report.status, "kept", "ranged-only re-level keeps Trample");
  assert.equal(report.reason, "no melee Strike", "and reports the no melee Strike reason");
  assert.equal(trample(kept.data).system.description.value, trample(flagged).system.description.value, "text untouched");
}

console.log("creature.hunt2 tests passed");
