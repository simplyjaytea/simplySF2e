// AI text in Foundry-enriched fields is inert (T-INERT): no live @Word[,
// &Word[ or [[ survives, while the visible text is kept. Drives the production
// builders (shop, treasure, NPC notes, narrative ability, PC biography, Recall
// Knowledge, macro chat) with the same hostile string.
// Run: node scripts/ai-text-inert.test.mjs
import assert from "node:assert/strict";

globalThis.game = { settings: { get: () => ({}) }, packs: new Map(), i18n: { localize: (k) => k, format: (k) => k } };

const AI = "@UUID[Actor.x]{Boss} [[/r 1d20]] @Check[reflex|dc:30]";
const visible = (html) => html.replaceAll("​", "");

function assertInert(html, label) {
  assert.ok(!/@[A-Za-z]+\[/.test(html), `${label}: no live @Word[`);
  assert.ok(!/&[A-Za-z]+\[/.test(html), `${label}: no live &Word[`);
  assert.ok(!/\[\[/.test(html), `${label}: no live [[`);
  assert.ok(!/\]\]/.test(html), `${label}: no ]] left intact`);
  assert.ok(visible(html).includes("@UUID[Actor.x]{Boss}"), `${label}: visible text kept`);
}

const { shopDescriptionHtml } = await import("./shop.mjs");
const { treasureDescriptionHtml } = await import("./treasure.mjs");
const { npcPublicNotes, narrativeAbilityItem } = await import("./builder.mjs");
const { characterBiography } = await import("./pc-builder.mjs");
const { recallKnowledgeNote } = await import("./reskin.mjs");
const { buildActivationCommand } = await import("./macro-templates.mjs");

// Shop: blurb, shopkeeper and description.
assertInert(shopDescriptionHtml({ blurb: AI, shopkeeper: AI, description: AI }), "shop");

// Treasure: description, and the name fallback when there is no description.
assertInert(treasureDescriptionHtml({ description: AI }), "treasure description");
assertInert(treasureDescriptionHtml({ name: AI, description: "" }), "treasure name");

// NPC public notes: read-aloud, description and Recall Knowledge.
assertInert(npcPublicNotes({ level: 5, rarity: "common", traits: [], readAloud: AI, description: AI, recallKnowledge: AI }), "npc notes");

// Narrative-only ability: the item name and description.
const narrative = narrativeAbilityItem({ name: AI, description: AI });
assertInert(narrative.system.description.value, "narrative description");
assertInert(narrative.name, "narrative name");

// PC biography: backstory, appearance, allies, enemies, organizations.
const bio = characterBiography({ backstory: AI, appearance: AI, allies: AI, enemies: AI, organizations: AI, personality: "plain", likes: "plain", dislikes: "plain", alignmentFlavor: "plain" });
for (const key of ["backstory", "appearance", "allies", "enemies", "organizations"]) assertInert(bio[key], `biography ${key}`);
assert.equal(bio.attitude, "plain", "plain biography fields are not HTML");

// Recall Knowledge note (reskin and NPC share it).
assertInert(recallKnowledgeNote([], 20, AI), "recall knowledge");

// Macro chat: the runtime escHtml and the pre-escaped item name in META
// (createActivationMacro passes escAi(item.name), as here).
const { escAi } = await import("./text.mjs");
const command = await buildActivationCommand({
  template: "condition",
  params: { conditionSlug: "frightened", value: 1, saveType: null, dc: null, effectName: AI }
}, { forgeId: "test-forge", itemName: escAi(AI), itemLevel: 3 });
const escLine = command.split("\n").find((line) => line.startsWith("const escHtml"));
const escHtml = new Function(`${escLine}; return escHtml;`)();
assertInert(escHtml(AI), "macro escHtml(effectName)");
assertInert(escHtml(`Actor ${AI}`), "macro escHtml(actor name)");
const metaLine = command.split("\n").find((line) => line.startsWith("const META"));
const meta = JSON.parse(metaLine.slice("const META = ".length, -1));
assertInert(meta.itemName, "macro META item name");

console.log("ai-text-inert.test.mjs: ok");
