// Art on a created creature: the scaffold's mapped token art (and its scale)
// survives a real portrait, the placeholder token texture takes the portrait,
// and the token is named for the new creature, not the borrowed bestiary one.
// Run: node scripts/builder.scaffoldArt.test.mjs

import assert from "node:assert/strict";

globalThis.CONFIG = { PF2E: { damageTypes: {}, npcAttackTraits: {}, attackEffects: {} } };
globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 20 } };
globalThis.foundry = { utils: { randomID: () => "test-id" } };
let created = null;
globalThis.Actor = { create: async (data) => (created = data) };

const { normalizeConcept, createActor } = await import("./builder.mjs");

const concept = normalizeConcept({ name: "Vault Warden" }, { level: 4, rarity: "common" });
const resolved = { abilities: [], feats: [], spells: [], focusSpells: [], equipment: [], loot: [] };
const placeholder = "systems/sf2e/icons/default-icons/npc.svg";

// (a) mapped portrait + distinct mapped token art with scale.
await createActor(concept, resolved, {
  img: "modules/art/portrait.webp",
  scaffold: { name: "Ksarik", prototypeToken: { name: "Ksarik", texture: { src: "modules/art/token.webp", scaleX: 1.2, scaleY: 1.2 } } }
});
assert.equal(created.img, "modules/art/portrait.webp");
assert.deepEqual(created.prototypeToken.texture, { src: "modules/art/token.webp", scaleX: 1.2, scaleY: 1.2 }, "mapped token art and scale are kept");
assert.equal(created.prototypeToken.name, "Vault Warden", "token is named after the new creature");

// (b) placeholder token texture takes the portrait and keeps its other fields.
await createActor(concept, resolved, {
  img: "modules/art/portrait.webp",
  scaffold: { name: "Ksarik", prototypeToken: { name: "Ksarik", texture: { src: placeholder, scaleX: 0.8 } } }
});
assert.deepEqual(created.prototypeToken.texture, { src: "modules/art/portrait.webp", scaleX: 0.8 });
assert.equal(created.prototypeToken.name, "Vault Warden");

// (c) no real art: nothing set by us, scaffold token texture kept.
await createActor(concept, resolved, {
  img: null,
  scaffold: { name: "Ksarik", prototypeToken: { name: "Ksarik", texture: { src: placeholder } } }
});
assert.equal("img" in created, false, "no img key is written, so the sf2e default applies");
assert.deepEqual(created.prototypeToken.texture, { src: placeholder }, "scaffold token texture is kept");
assert.equal(created.prototypeToken.name, "Vault Warden");
console.log("builder.scaffoldArt.test.mjs: scaffold token art kept, placeholder replaced, token named for the new creature");
