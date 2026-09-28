// Regression check for hardcoded systems/pf2e/ item icons (issue: 404 under
// the sf2e system). builder.mjs and pc-builder.mjs used to embed literal
// "systems/pf2e/icons/..." img paths on generated action/lore/melee/
// spellcastingEntry items; the installed system id is "sf2e", so those paths
// 404. systemIcon() resolves the same verified icon tree against the live
// game.system.id instead. Pure string logic — real-imported here, no Foundry
// globals required (game is optional-chained with an "sf2e" default).
// Run: node scripts/builder.systemIcon.test.mjs

import assert from "node:assert/strict";
import { systemIcon, featToAction } from "./builder.mjs";

const savedGame = globalThis.game;
const setGame = (id) => {
  if (id == null) delete globalThis.game;
  else globalThis.game = { system: { id } };
};

try {
  // No game global (node/test context): deterministic "sf2e" default.
  setGame(null);
  assert.equal(
    systemIcon("icons/actions/Passive.webp"),
    "systems/sf2e/icons/actions/Passive.webp",
    "without a game global the icon must resolve under systems/sf2e/"
  );

  // Live under the sf2e system: the installed-system path, not pf2e.
  setGame("sf2e");
  assert.equal(
    systemIcon("icons/default-icons/spellcastingEntry.svg"),
    "systems/sf2e/icons/default-icons/spellcastingEntry.svg",
    "under game.system.id 'sf2e' the icon must not point at systems/pf2e/"
  );

  // A feat without its own img falls back to the resolved action icon.
  const fallback = featToAction({ name: "Test Feat", system: { actionType: { value: "reaction" } } });
  assert.equal(
    fallback.img,
    "systems/sf2e/icons/actions/Reaction.webp",
    "featToAction without an img must use the system-resolved reaction icon"
  );

  // Unknown action types keep the old passive default, now resolved.
  const unknown = featToAction({ name: "Test Feat", system: { actionType: { value: "nonsense" } } });
  assert.equal(
    unknown.img,
    "systems/sf2e/icons/actions/Passive.webp",
    "an unknown actionType must fall back to the system-resolved passive icon"
  );

  // Dynamic resolution is the point: a pf2e install keeps working too.
  setGame("pf2e");
  assert.equal(
    systemIcon("icons/actions/OneAction.webp"),
    "systems/pf2e/icons/actions/OneAction.webp",
    "under game.system.id 'pf2e' the icon must resolve under systems/pf2e/"
  );
} finally {
  if (savedGame === undefined) delete globalThis.game;
  else globalThis.game = savedGame;
}

console.log("builder systemIcon regression check: all assertions passed");
