// Test chatMessage command hook for /sf2e and /simplysf2e
// Run: node scripts/chat-command.test.mjs

import assert from "node:assert/strict";

const hooks = new Map();
globalThis.Hooks = {
  on(event, handler) {
    if (!hooks.has(event)) hooks.set(event, []);
    hooks.get(event).push(handler);
  },
  once(event, handler) {
    this.on(event, handler);
  }
};

let generatorOpenCalls = 0;
let itemForgeOpenCalls = 0;
let lastAppInput = null;
const rendered = [];
globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {
        render() { rendered.push(this.constructor.name); return this; }
      },
      HandlebarsApplicationMixin: (Base) => class extends Base {},
      DialogV2: {}
    }
  },
  utils: {
    escapeHTML: (s) => String(s ?? "")
  }
};
globalThis.ui = {
  notifications: {
    warn() {},
    info() {},
    error() {}
  }
};

globalThis.game = {
  system: { id: "sf2e" },
  user: { isGM: true },
  i18n: { localize: (k) => k },
  modules: new Map([["simplysf2e", {}]])
};

// Import simplysf2e module to register hooks
await import("./simplysf2e.mjs");

// The real GeneratorApp is what openGenerator() constructs. Replace the three
// methods the command and context menu call with recorders so no generation
// runs in this test.
const { GeneratorApp } = await import("./generator-app.mjs");
const generatorCalls = { setInput: [], runFromChat: [], reskinFromUuid: [] };
GeneratorApp.prototype.setInput = function (updates) { generatorCalls.setInput.push(updates); };
GeneratorApp.prototype.runFromChat = async function (updates) { generatorCalls.runFromChat.push(updates); };
GeneratorApp.prototype.reskinFromUuid = async function (uuid) { generatorCalls.reskinFromUuid.push(uuid); };
const resetGeneratorCalls = () => {
  for (const list of Object.values(generatorCalls)) list.length = 0;
};

const chatHandlers = hooks.get("chatMessage") ?? [];
assert.ok(chatHandlers.length > 0, "chatMessage hook registered");

const handleChat = (msg) => {
  for (const h of chatHandlers) {
    const res = h({}, msg, {});
    if (res === false) return false;
  }
  return true;
};

// 1. Non-command messages pass through untouched
assert.equal(handleChat("Hello world!"), true, "Normal chat passes through");
assert.equal(handleChat("/roll 1d20"), true, "Standard slash commands pass through");

// 2. /sf2e bare command triggers generator
assert.equal(handleChat("/sf2e"), false, "/sf2e command intercepted");

// 3. /sf2e itemforge triggers item forge
assert.equal(handleChat("/sf2e itemforge"), false, "/sf2e itemforge intercepted");

// 3b. /sf2e welcome opens the welcome window
rendered.length = 0;
assert.equal(handleChat("/sf2e welcome"), false, "/sf2e welcome intercepted");
assert.deepEqual(rendered, ["WelcomeApp"], "/sf2e welcome opens the welcome window, not another app");

// 3c. /sf2e shop opens the shop window
rendered.length = 0;
assert.equal(handleChat("/sf2e shop"), false, "/sf2e shop intercepted");
assert.deepEqual(rendered, ["ShopApp"], "/sf2e shop opens the shop window, not another app");

// 4. Non-GM users cannot execute (command is intercepted and blocked with warning, returning false)
game.user.isGM = false;
assert.equal(handleChat("/sf2e"), false, "Non-GM command is intercepted and blocked");
game.user.isGM = true;

// 5. Wrong system cannot execute
game.system.id = "pf2e";
assert.equal(handleChat("/sf2e"), false, "Wrong system command is intercepted and blocked");
game.system.id = "sf2e";

// 6. Whole command word only, any case
assert.equal(handleChat("/SF2E"), false, "/SF2E is intercepted");
assert.equal(handleChat("/sf2efoo bar"), true, "/sf2efoo is not this command");

// 7. Mode/level/prompt on first open: render(true) is async, so the form
// does not exist yet; the command must not read it.
assert.doesNotThrow(() => handleChat("/sf2e npc 30 cyberdoc with stolen cyberware"));

// 8. A prompt starts a preview right away and does not only fill the form.
resetGeneratorCalls();
assert.equal(handleChat("/sf2e npc 5 dock foreman"), false, "/sf2e with prompt intercepted");
assert.deepEqual(generatorCalls.runFromChat, [{ mode: "npc", level: 5, prompt: "dock foreman" }],
  "/sf2e npc 5 dock foreman starts a preview with mode, level and prompt");
assert.deepEqual(generatorCalls.setInput, [], "/sf2e with prompt does not call setInput");

// 9. Without a prompt the command only fills in the form.
resetGeneratorCalls();
assert.equal(handleChat("/sf2e npc 5"), false, "/sf2e npc 5 intercepted");
assert.deepEqual(generatorCalls.setInput, [{ mode: "npc", level: 5 }], "/sf2e npc 5 fills the form");
assert.deepEqual(generatorCalls.runFromChat, [], "/sf2e npc 5 does not start a preview");

// 10. Actors sidebar context menu: "Reskin with SimplySF2e" (GM, sf2e, NPC only).
const actors = new Map([
  ["npc1", { id: "npc1", uuid: "Actor.npc1", type: "npc" }],
  ["pc1", { id: "pc1", uuid: "Actor.pc1", type: "character" }]
]);
game.actors = { get: (id) => actors.get(id) };
const contextHandlers = hooks.get("getActorContextOptions") ?? [];
assert.equal(contextHandlers.length, 1, "getActorContextOptions hook registered");
const contextEntries = [];
contextHandlers[0]({}, contextEntries);
assert.equal(contextEntries.length, 1, "GM with sf2e gets exactly one reskin entry");
const reskinEntry = contextEntries[0];
assert.equal(reskinEntry.label, "SIMPLYSF2E.ContextMenu.Reskin");
assert.equal(reskinEntry.visible({ dataset: { entryId: "npc1" } }), true, "reskin entry visible for an npc");
assert.equal(reskinEntry.visible({ dataset: { entryId: "pc1" } }), false, "reskin entry hidden for a character");
resetGeneratorCalls();
await reskinEntry.onClick({}, { dataset: { entryId: "npc1" } });
assert.deepEqual(generatorCalls.reskinFromUuid, ["Actor.npc1"], "entry click reskins the chosen npc");

game.user.isGM = false;
const playerEntries = [];
contextHandlers[0]({}, playerEntries);
assert.equal(playerEntries.length, 0, "non-GM gets no reskin entry");
game.user.isGM = true;

console.log("chat-command.test.mjs: all chat command triggers and permissions verified");
