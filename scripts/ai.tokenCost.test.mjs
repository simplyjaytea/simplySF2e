// Token-cost changes, checked through the production provider path (no provider spend):
// every JSON task asks for one-line JSON, catalogs carry the level once per line and no
// separator, the heritage list follows the first-draft ancestry, the concept schema no
// longer asks for dead fields, and a draft that leaves optional keys out normalizes the same.
// Run: node scripts/ai.tokenCost.test.mjs
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";

const settings = new Map([
  [SETTINGS.apiBaseUrl, "http://localhost:11434/v1"], [SETTINGS.apiKey, ""],
  [SETTINGS.apiKeyBaseUrl, ""], [SETTINGS.model, "test-model"],
  [SETTINGS.temperature, 0.8], [SETTINGS.maxTokens, 8000], [SETTINGS.requestTimeout, 90]
]);
globalThis.game = {
  settings: { get: (_module, key) => settings.get(key) },
  i18n: { localize: (key) => key, format: (key, data) => `${key}:${JSON.stringify(data)}` }
};
const requests = [];
let reply;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, options) => {
  requests.push(JSON.parse(options.body));
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) }, finish_reason: "stop" }] }),
    { headers: { "content-type": "application/json" } });
};
const system = () => requests.at(-1).messages[0].content;
const user = () => requests.at(-1).messages[1].content;

try {
  const {
    COMPACT_JSON_NOTE, generateConcept, generatePCConcept, generateLoot, generatePCLoot, selectEquipment,
    selectAncestryBackgroundClass, heritagesForDraftAncestry, testProviderConnection
  } = await import("./ai.mjs");
  const { normalizeConcept } = await import("./builder.mjs");
  const { normalizePCConcept } = await import("./pc-builder.mjs");
  const { searchKeywords } = await import("./text.mjs");

  // --- 1. One-line JSON: asked for at the very end of every JSON task's system prompt.
  const emptyConcept = { name: "Courier", description: "A courier", abilityScales: {}, saveScales: {},
    blurb: "", readAloud: "", recallKnowledge: "", size: "med", acScale: "moderate", hpScale: "moderate",
    perceptionScale: "moderate", spellcasting: null,
    ...Object.fromEntries(["traits", "languages", "speeds", "senses", "skills", "strikes", "specialAbilities",
      "focusSpells", "feats", "equipment", "loot", "resistances", "weaknesses", "immunities"].map((key) => [key, []])) };
  reply = emptyConcept;
  await generateConcept({ prompt: "a courier", level: 4, rarity: "common", allowSpellcasting: true });
  const creatureSystem = system();
  assert.ok(creatureSystem.endsWith(COMPACT_JSON_NOTE), "the one-line note closes the system prompt, after the stable schema text");
  assert.equal(creatureSystem.split(COMPACT_JSON_NOTE).length, 2, "the note appears once");
  reply = { ok: true };
  await testProviderConnection();
  assert.ok(!system().includes(COMPACT_JSON_NOTE), "the connection test is not a JSON task and keeps its own prompt");

  // --- 2. The concept schema asks for nothing the module throws away.
  assert.match(creatureSystem, /"equipment": string\[\]/, "draft gear is a list of names; quantities come from the grounded pick");
  assert.match(creatureSystem, /"loot": \[ \{ "name": string, "quantity": number \} \]/);
  assert.doesNotMatch(creatureSystem, /"quantity": number, "value": number|legacy fallback|approximate price/,
    "no draft price: every production path resolves loot and gear from issued candidates");
  assert.match(creatureSystem, /leave out any key whose value would be null or \[\]/);
  assert.match(creatureSystem, /"keywords": string\[\]/, "spell themes ride on the concept request");
  reply = { loot: [] };
  const lootConcept = { name: "Courier", level: 4, rarity: "common", blurb: "", description: "", traits: [], equipment: [] };
  await generateLoot({ concept: lootConcept });
  assert.doesNotMatch(system(), /"value"|legacy fallback/);
  assert.match(system(), /\{"name": "Credits", "quantity": 350\}/);
  await generatePCLoot({ concept: { name: "Pc", level: 3 } });
  assert.doesNotMatch(system(), /"value"|legacy fallback/);
  reply = { name: "Pc", ancestry: "Vesk", heritage: null, background: "Bodyguard", class: "Soldier", keyAbility: "str",
    blurb: "", backstory: "Served.", appearance: "", age: "", gender: "", height: "", weight: "", ethnicity: "",
    nationality: "", personality: "", alignmentFlavor: "", likes: "", dislikes: "", allies: "", enemies: "",
    organizations: "", languages: [], feats: [], spellcasting: null, focusSpells: [], equipment: [] };
  await generatePCConcept({ prompt: "a guard", level: 3, allowSpellcasting: true });
  assert.match(system(), /"equipment": string\[\]/);
  assert.match(system(), /"keywords": string\[\]/);
  assert.doesNotMatch(system(), /"value": number/);

  // --- 3. A lean draft normalizes exactly like the verbose one it replaces.
  const verbose = {
    ...emptyConcept,
    senses: [{ type: "darkvision", acuity: null, range: null }],
    strikes: [{ name: "jaws", type: "melee", attackScale: "high", damageScale: "moderate", damageType: "piercing", traits: [], range: null, attackEffects: [] }],
    specialAbilities: [
      { name: "Vacuum Hide", glossary: null, description: "Plated hide.", abilityDcScale: null, damageType: null, template: null, kind: null, condition: null, shape: null, size: null, save: null, use: null },
      { name: "Star Flare", glossary: null, description: "A cone of light.", abilityDcScale: "high", damageType: "fire", template: "area-blast", kind: null, condition: null, shape: "cone", size: null, save: null, use: "limited" }
    ],
    equipment: [{ name: "Laser Pistol", quantity: 1, value: 150 }],
    loot: [{ name: "Credits", quantity: 90, value: 1 }, { name: "Serum of Healing", quantity: 2, value: 120 }]
  };
  const lean = {
    ...emptyConcept,
    senses: [{ type: "darkvision" }],
    strikes: [{ name: "jaws", type: "melee", attackScale: "high", damageScale: "moderate", damageType: "piercing" }],
    specialAbilities: [
      { name: "Vacuum Hide", description: "Plated hide." },
      { name: "Star Flare", description: "A cone of light.", abilityDcScale: "high", damageType: "fire", template: "area-blast", shape: "cone", use: "limited" }
    ],
    equipment: ["Laser Pistol"],
    loot: [{ name: "Credits", quantity: 90 }, { name: "Serum of Healing", quantity: 2 }]
  };
  const strip = (concept) => ({
    ...concept,
    equipment: concept.equipment.map(({ value, ...rest }) => rest),
    loot: concept.loot.map((line) => (line.name === "Serum of Healing" ? { ...line, value: 0 } : line))
  });
  const fromVerbose = normalizeConcept(verbose, { level: 4, rarity: "common" });
  const fromLean = normalizeConcept(lean, { level: 4, rarity: "common" });
  assert.deepEqual(strip(fromLean), strip(fromVerbose), "left-out keys read as null or [] everywhere but the dropped draft price");
  assert.ok(fromLean.specialAbilities[1].areaBlast, "an area blast written without its null keys is still built");
  assert.deepEqual(fromLean.equipment, [{ name: "Laser Pistol", quantity: 1, value: 0 }]);
  assert.deepEqual(fromLean.loot[1], { name: "Serum of Healing", quantity: 2, value: 0 });

  // --- 4. Spell themes: kept only as clean search words.
  assert.deepEqual(searchKeywords([" Fire ", "fire", "CONTROL", 7, null, "", "x".repeat(41)]), ["fire", "control"]);
  assert.deepEqual(searchKeywords("fire"), [], "anything but an array is no keyword list");
  assert.equal(searchKeywords(Array.from({ length: 20 }, (_, i) => `k${i}`)).length, 8, "capped");
  const caster = normalizeConcept({ ...emptyConcept, spellcasting: { tradition: "arcane", dcScale: "high", spells: [], keywords: ["Fire", "control"] } },
    { level: 4, rarity: "common" });
  assert.deepEqual(caster.spellcasting.keywords, ["fire", "control"]);
  const noThemes = normalizeConcept({ ...emptyConcept, spellcasting: { tradition: "arcane", dcScale: "high", spells: [] } }, { level: 4, rarity: "common" });
  assert.ok(!("keywords" in noThemes.spellcasting), "no key when the draft carried none, so the focus request still runs");
  const pcCaster = normalizePCConcept({ ...reply, class: "Mystic", spellcasting: { tradition: "divine", spells: [], keywords: ["Healing"] } }, { level: 3 });
  assert.deepEqual(pcCaster.spellcasting.keywords, ["healing"]);

  // --- 5. Item catalogs: one line per type and level, ID then name, no separator.
  const item = (id, name, type, level) => ({ id, name, type, level, ref: { packId: "sf2e.equipment", _id: id } });
  reply = { equipment: [{ id: "E1", quantity: 1 }] };
  const gear = await selectEquipment({
    concept: { name: "Guard", level: 3, blurb: "", description: "", traits: [], strikes: [], equipment: [{ name: "Pistol" }], gmPrompt: "a guard" },
    // Out of level order on purpose: the catalog sorts the levels inside a type and keeps candidate order inside a line.
    candidates: [item("b", "Laser Pistol", "weapon", 2), item("a", "Knife", "weapon", 0), item("c", "Medpatch", "consumable", 2), item("d", "Laser Rifle", "weapon", 2)],
    jevConfig: null
  });
  assert.match(user(), /Available items \(type and item level, then ID and name\):\nweapon L0: E2 Knife\nweapon L2: E1 Laser Pistol; E4 Laser Rifle\nconsumable L2: E3 Medpatch$/);
  assert.doesNotMatch(user(), / \| |\(L\d+\)/, "no per-item separator or level suffix");
  assert.equal(gear.equipment[0].name, "Laser Pistol", "the short id still resolves to its issued candidate");
  assert.match(system(), /explicit concept constraints override/, "the GM-priority rule stays on every grounding step");

  // --- 6. Heritages follow the first-draft ancestry.
  const uuid = (id) => `Compendium.sf2e.ancestries.Item.${id}`;
  const ancestries = [
    { id: "an1", name: "Vesk", uuid: uuid("vesk"), ref: { packId: "sf2e.ancestries", _id: "vesk" } },
    { id: "an2", name: "Ysoki", uuid: uuid("ysoki"), ref: { packId: "sf2e.ancestries", _id: "ysoki" } }
  ];
  const heritage = (id, name, ancestryId) => ({
    id, name, ref: { packId: "sf2e.heritages", _id: id }, ...(ancestryId ? { ancestryUuid: uuid(ancestryId) } : {})
  });
  const heritages = [
    heritage("h1", "Briskwander Vesk", "vesk"), heritage("h2", "Akitonian Ysoki", "ysoki"),
    heritage("h3", "Borai"), heritage("h4", "Thickhide Vesk", "vesk")
  ];
  const names = (result) => result.heritages.map((h) => h.name);
  const narrowed = heritagesForDraftAncestry(" vesk ", ancestries, heritages);
  assert.deepEqual(names(narrowed), ["Briskwander Vesk", "Borai", "Thickhide Vesk"], "its own heritages plus the versatile one, in list order");
  assert.equal(narrowed.ancestry, ancestries[0]);
  for (const [label, draft, ancestryList, heritageList] of [
    ["a draft that names no offered ancestry", "Dwarf", ancestries, heritages],
    ["an empty draft", "", ancestries, heritages],
    ["an ambiguous name", "Vesk", [...ancestries, { ...ancestries[0], id: "an3" }], heritages],
    ["an ancestry record without a uuid", "Vesk", ancestries.map(({ uuid: _uuid, ...rest }) => rest), heritages],
    ["a heritage list without ancestry links", "Vesk", ancestries, heritages.map(({ ancestryUuid, ...rest }) => rest)],
    ["an ancestry with no heritage of its own", "Ysoki", ancestries, heritages.filter((h) => h.name !== "Akitonian Ysoki")]
  ]) {
    const kept = heritagesForDraftAncestry(draft, ancestryList, heritageList);
    assert.equal(kept.heritages, heritageList, `${label} keeps the full list`);
    assert.equal(kept.ancestry, null, label);
  }

  const pcConcept = { name: "Pc", level: 1, ancestry: "Vesk", heritage: null, background: "Bodyguard", class: "Soldier", keyAbility: "str", blurb: "", backstory: "" };
  const backgrounds = [{ id: "bg1", name: "Bodyguard", ref: { packId: "sf2e.backgrounds", _id: "bg" } }];
  const classes = [{ id: "cl1", name: "Soldier", ref: { packId: "sf2e.classes", _id: "soldier" } }];
  // Encoder order: 2 ancestries (C1, C2), then the 3 kept heritages (C3-C5), background C6, class C7.
  reply = { ancestryId: "C1", heritageId: "C5", backgroundId: "C6", classId: "C7", keyAbility: "str" };
  const abc = await selectAncestryBackgroundClass({
    concept: pcConcept, ancestryCandidates: ancestries, heritageCandidates: heritages, backgroundCandidates: backgrounds, classCandidates: classes
  });
  assert.match(user(), /Available heritages for Vesk, the first-draft ancestry \(if you choose another ancestry, use null for heritageId\) \(ID then name\): C3 Briskwander Vesk; C4 Borai; C5 Thickhide Vesk\n/);
  assert.doesNotMatch(user(), /Akitonian Ysoki/, "another ancestry's heritage is not sent");
  assert.equal(abc.heritageCandidate, heritages[3].ref, "a kept heritage resolves to its issued reference");
  assert.equal(abc.ancestryCandidate, ancestries[0].ref);
  // A heritage that was not offered cannot be picked, by short id or by name.
  reply = { ancestryId: "C1", heritageId: "Akitonian Ysoki", backgroundId: "C6", classId: "C7", keyAbility: "str" };
  const notOffered = await selectAncestryBackgroundClass({
    concept: pcConcept, ancestryCandidates: ancestries, heritageCandidates: heritages, backgroundCandidates: backgrounds, classCandidates: classes
  });
  assert.equal(notOffered.heritage, null);
  assert.equal(notOffered.heritageCandidate, null);
  // No unique ancestry match: the full list goes out, as before.
  reply = { ancestryId: "C2", heritageId: "C4", backgroundId: "C7", classId: "C8", keyAbility: "str" };
  const full = await selectAncestryBackgroundClass({
    concept: { ...pcConcept, ancestry: "Lizardfolk" }, ancestryCandidates: ancestries, heritageCandidates: heritages,
    backgroundCandidates: backgrounds, classCandidates: classes
  });
  assert.match(user(), /Available heritages \(ID then name\): C3 Briskwander Vesk; C4 Akitonian Ysoki; C5 Borai; C6 Thickhide Vesk\n/);
  assert.equal(full.heritageCandidate, heritages[1].ref);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("ai.tokenCost.test.mjs: one-line JSON, lean schema, grouped catalogs and heritage narrowing passed");
