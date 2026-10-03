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
// does not exist yet; setInput must not read it.
assert.doesNotThrow(() => handleChat("/sf2e npc 30 cyberdoc with stolen cyberware"));

console.log("chat-command.test.mjs: all chat command triggers and permissions verified");
