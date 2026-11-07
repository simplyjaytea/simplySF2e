// The run deadline defaults to 5 minutes; 0 still means off (T-DEADLINE, JT 2026-11-07).
// Reads the real registration from registerSettings, so the default cannot drift from the test.
// Run: node scripts/settings.runDeadline.test.mjs
import assert from "node:assert/strict";
import { SETTINGS, registerSettings } from "./settings.mjs";

const registrations = new Map();
globalThis.game = {
  settings: { register: (_moduleId, key, config) => registrations.set(key, config), registerMenu: () => {}, get: () => undefined },
  i18n: { localize: (key) => key, format: (key) => key }
};
class Stub {}
registerSettings(Stub, Stub, Stub, Stub);

const config = registrations.get(SETTINGS.runDeadline);
assert.ok(config, "runDeadline is registered");
assert.equal(config.default, 5, "default is 5 minutes");
assert.equal(config.type, Number, "stored as a number of minutes");
assert.equal(config.hint, "SIMPLYSF2E.Settings.RunDeadline.Hint", "hint key unchanged");
console.log("settings.runDeadline: ok");
