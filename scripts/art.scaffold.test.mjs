import assert from "node:assert/strict";

const entries = [
  { _id: "wrong-size", type: "npc", img: "wrong.webp", system: { traits: { value: ["undead"], size: { value: "lg" } }, details: { level: { value: 5 } } } },
  { _id: "best", type: "npc", img: "best.webp", system: { traits: { value: ["undead", "skeleton"], size: { value: "med" } }, details: { level: { value: 5 } } } }
];
const pack = { getIndex: async () => entries, getDocument: async (id) => ({ toObject: () => ({ _id: id, img: entries.find((entry) => entry._id === id).img, prototypeToken: { disposition: -1 } }) }) };
globalThis.game = { packs: { get: (id) => id === "sf2e.alien-core-bestiary" ? pack : null }, settings: { get: () => ({ bestiaryActors: ["sf2e.alien-core-bestiary"] }) } };
const { findBestiaryScaffold, findBestiaryArt, isPlaceholderArt } = await import("./art.mjs");
const scaffold = await findBestiaryScaffold({ traits: ["undead", "skeleton"], size: "med", level: 5 });
assert.equal(scaffold.img, "best.webp");
assert.equal(scaffold.prototypeToken.disposition, -1);
const fallback = await findBestiaryScaffold({ traits: ["construct"], size: "lg", level: 5 });
assert.equal(fallback.img, "wrong.webp", "an unmatched but valid creature still receives the closest exact level/size scaffold");

// Art preference: published sf2e NPCs ship the default npc.svg, so a creature
// with mapped art wins over one without when both share as many traits.
const placeholder = "systems/sf2e/icons/default-icons/npc.svg";
assert.equal(isPlaceholderArt(placeholder), true);
assert.equal(isPlaceholderArt("icons/svg/mystery-man.svg"), true);
assert.equal(isPlaceholderArt(null), true);
assert.equal(isPlaceholderArt("modules/art/tokens/ksarik.webp"), false);
entries.length = 0;
entries.push(
  { _id: "plain", type: "npc", img: placeholder, system: { traits: { value: ["aberration"], size: { value: "med" } }, details: { level: { value: 5 } } } },
  { _id: "mapped", type: "npc", img: placeholder, system: { traits: { value: ["aberration"], size: { value: "lg" } }, details: { level: { value: 7 } } } },
  { _id: "two-traits", type: "npc", img: placeholder, system: { traits: { value: ["aberration", "amphibious"], size: { value: "sm" } }, details: { level: { value: 1 } } } },
  { _id: "hazard", type: "hazard", img: "hazard.webp", system: { traits: { value: ["aberration"] }, details: { level: { value: 5 } } } }
);
globalThis.game.compendiumArt = { enabled: true, get: (uuid) => uuid === "Compendium.sf2e.alien-core-bestiary.Actor.mapped" ? { actor: "modules/art/mapped.webp" } : undefined };
assert.equal((await findBestiaryScaffold({ traits: ["aberration"], size: "med", level: 5 }))._id, "mapped",
  "mapped art outranks a closer size and level among equal trait matches");
assert.equal((await findBestiaryScaffold({ traits: ["aberration", "amphibious"], size: "med", level: 5 }))._id, "two-traits",
  "a better trait match still outranks art");
assert.equal(await findBestiaryArt({ traits: ["aberration", "amphibious"], size: "med", level: 5 }), null,
  "the default npc.svg is not reported as creature art");
globalThis.game.compendiumArt = { enabled: false, get: () => ({ actor: "modules/art/mapped.webp" }) };
assert.equal((await findBestiaryScaffold({ traits: ["aberration"], size: "med", level: 5 }))._id, "plain",
  "disabled compendium art mapping gives no preference");
delete globalThis.game.compendiumArt;
assert.equal((await findBestiaryScaffold({ traits: ["aberration"], size: "med", level: 5 }))._id, "plain",
  "no compendium art API falls back to size and level");
console.log("art.scaffold.test.mjs: exact bestiary actor scaffold selection passed");
