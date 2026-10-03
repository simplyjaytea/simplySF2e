// First-run welcome: readiness rows and when the window opens by itself.
// Run: node scripts/welcome.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MIN_SYSTEM_VERSION, compareVersions, welcomeState, shouldAutoOpenWelcome } from "./welcome.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// The minimum shown in the welcome is the one module.json enforces.
const manifest = JSON.parse(readFileSync(join(root, "module.json"), "utf8"));
const sf2e = manifest.relationships.systems.find((system) => system.id === "sf2e");
assert.equal(MIN_SYSTEM_VERSION, sf2e.compatibility.minimum, "MIN_SYSTEM_VERSION matches module.json");

// Version comparison.
assert.equal(compareVersions("1.5.1", "1.5.0") > 0, true);
assert.equal(compareVersions("1.5", "1.5.0"), 0);
assert.equal(compareVersions("1.4.9", "1.5.0") < 0, true);
assert.equal(compareVersions("1.10.0", "1.9.0") > 0, true, "numeric, not string, comparison");
assert.equal(compareVersions(undefined, "1.5.0") < 0, true);

const ready = { ready: true, missing: [], packCount: 7 };

// All green.
let state = welcomeState({
  systemId: "sf2e", systemVersion: "1.5.1",
  creatureSources: ready, characterSources: { ready: true, missing: [], packCount: 9 },
  providerWarningKey: null, jevSource: "connection"
});
assert.equal(state.ready, true);
assert.equal(state.sources.packCount, 9);
assert.deepEqual(state.jev, { on: true, source: "connection" });

// Old system, missing packs (deduplicated across modes), no provider.
state = welcomeState({
  systemId: "sf2e", systemVersion: "1.4.2",
  creatureSources: { ready: false, missing: ["spells", "bestiaryActors"], packCount: 3 },
  characterSources: { ready: false, missing: ["spells", "classes"], packCount: 4 },
  providerWarningKey: "SIMPLYSF2E.Generator.NoApiKey", jevSource: null
});
assert.equal(state.system.ready, false);
assert.equal(state.system.minimum, MIN_SYSTEM_VERSION);
assert.deepEqual(state.sources.missing, ["spells", "bestiaryActors", "classes"]);
assert.equal(state.sources.ready, false);
assert.deepEqual(state.provider, { ready: false, warningKey: "SIMPLYSF2E.Generator.NoApiKey" });
assert.equal(state.ready, false);

// Jev off is optional: it never blocks readiness.
state = welcomeState({ systemId: "sf2e", systemVersion: "1.5.0", creatureSources: ready, characterSources: ready });
assert.equal(state.jev.on, false);
assert.equal(state.ready, true);

// Wrong system is never ready.
assert.equal(welcomeState({ systemId: "pf2e", systemVersion: "7.0.0", creatureSources: ready, characterSources: ready }).system.ready, false);

// Auto-open: GM on sf2e, not dismissed, connection not working yet.
assert.equal(shouldAutoOpenWelcome({ isGM: true, systemId: "sf2e", dismissed: false, providerReady: false }), true);
assert.equal(shouldAutoOpenWelcome({ isGM: true, systemId: "sf2e", dismissed: false, providerReady: true }), false, "stops once the connection works");
assert.equal(shouldAutoOpenWelcome({ isGM: true, systemId: "sf2e", dismissed: true, providerReady: false }), false, "Don't show again wins");
assert.equal(shouldAutoOpenWelcome({ isGM: false, systemId: "sf2e", dismissed: false, providerReady: false }), false, "players never see it");
assert.equal(shouldAutoOpenWelcome({ isGM: true, systemId: "pf2e", dismissed: false, providerReady: false }), false, "wrong system shows its own error instead");

// Every data-action in the template has a handler in the app.
const template = readFileSync(join(root, "templates/welcome.hbs"), "utf8");
const app = readFileSync(join(root, "scripts/welcome-app.mjs"), "utf8");
const actions = [...new Set([...template.matchAll(/data-action="(\w+)"/g)].map((m) => m[1]))];
assert.ok(actions.length >= 4, "template declares its actions");
for (const action of actions) assert.match(app, new RegExp(`\\b${action}: WelcomeApp\\.#`), `action ${action} is wired`);

// The welcome stylesheet ships.
assert.ok(manifest.styles.includes("styles/apps/welcome.css"), "module.json lists welcome.css");

console.log("welcome.test.mjs: readiness rows, auto-open rule and template wiring verified");
