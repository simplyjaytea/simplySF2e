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
  assert.ok(!/@\w+\[/.test(html), `${label}: no live @Word[`);
  assert.ok(!/&\w+\[/.test(html), `${label}: no live &Word[`);
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
// The stored name is plain (asserted below); only the description is inert.

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

// Drift guard: the macro's escHtml (a copy of the rule, since macros cannot import text.mjs)
// must equal escAi on a fixed corpus of tricky strings. Change both copies together.
const CORPUS = [
  "@UUID[Actor.x]{Boss}", "@Check[reflex|dc:20]", "@Damage[2d6[fire]]", "@Template[type:cone|distance:30]",
  "@Localize[PF2E.X]", "@Embed[Item.x]", "@Compendium[x.y]{z}", "@Foo1[x]", "@Foo_x[x]", "@Foo-bar[x]",
  "&Reference[frightened]", "&Ref_1[x]", "&&Ref[x]", "[[/r 1d20]]", "[[/gmr 1d4 #Recharge X]]",
  "[[/act escape dc=20]]", "Blast]]", "a ]] b", "one [[ two", "[[[", "]]]", "[sic]", "Hunter [Lvl 2]",
  "a @ b", "R&D", "Tom & Jerry", "x]y", "a[b", "@", "&", "[", "]", "{", "}", "|", "@@", "@@UUID[x]",
  "@ Check[reflex]", "@Check [reflex]", "@1[x]", "@_[x]", "&amp; entity", "<b>bold</b>",
  "Tom & <i>Jerry</i>", "\"quoted\" and 'single'", "line one\nline two", "  padded  ", "tab\tchar",
  "émoji 🐉 and 中文", "@UUID[x]{a}[[/r 1d6]]", "@Localize[X] and @Damage[1d4[acid]]", "\u200B@UUID[x]",
  "", "plain text with no enricher"
];
assert.ok(CORPUS.length >= 50, "corpus has about fifty strings");
for (const sample of CORPUS) {
  assert.equal(escHtml(sample), escAi(sample), `macro escHtml matches escAi for ${JSON.stringify(sample)}`);
}

// Document names stay plain: the narrative item name is not given zero-width characters.
const named = narrativeAbilityItem({ name: "@Check[reflex]", description: "x" });
assert.equal(named.name, "Narrative: @Check[reflex]", "stored name is the plain name");

console.log("ai-text-inert.test.mjs: ok");
