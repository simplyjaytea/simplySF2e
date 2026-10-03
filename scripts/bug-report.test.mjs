// Copy bug report: redaction, failure capture and report layout.
// Run: node scripts/bug-report.test.mjs
import assert from "node:assert/strict";
import {
  captureFailure,
  endpointHost,
  formatBugReport,
  gatherEnvironment,
  redactSecrets,
  trimStack
} from "./bug-report.mjs";

// Exact configured keys and generic key shapes are masked.
const key = "sk-or-v1-abcdef0123456789abcdef";
assert.equal(redactSecrets(`Incorrect API key provided: ${key}.`, [key]), "Incorrect API key provided: [redacted].");
assert.equal(redactSecrets("Authorization: Bearer abcdefghijklmnop"), "Authorization: [redacted]");
assert.equal(redactSecrets("got sk-proj-AAAAbbbbCCCC1234 back"), "got [redacted] back");
assert.equal(redactSecrets("GET https://x.test/v1?key=SECRET123&model=m"), "GET https://x.test/v1?key=[redacted]&model=m");
assert.equal(redactSecrets("ask-me-later", ["abc"]), "ask-me-later", "short secrets do not mask ordinary text");
assert.equal(redactSecrets("plain message"), "plain message");

// Endpoint keeps only scheme and host.
assert.equal(endpointHost("https://user:pw@openrouter.ai/api/v1?key=x"), "https://openrouter.ai");
assert.equal(endpointHost("http://localhost:11434/v1"), "http://localhost:11434");
assert.equal(endpointHost(""), "(not set)");
assert.equal(endpointHost("not a url"), "(unparseable URL)");

// Stack: message line dropped, long stacks truncated.
const longStack = ["Error: boom", ...Array.from({ length: 20 }, (_, i) => `    at f${i} (x.mjs:${i})`)].join("\n");
const trimmed = trimStack(longStack, "boom").split("\n");
assert.equal(trimmed[0], "    at f0 (x.mjs:0)");
assert.equal(trimmed.length, 13);
assert.match(trimmed.at(-1), /8 more lines/);

// Failure capture reads the active step and the finished ones.
const err = new Error("Equipment pick failed");
const progress = {
  steps: [
    { key: "concept", label: "Concept", state: "done" },
    { key: "spells", label: "Spells", state: "done" },
    { key: "equipment", label: "Equipment", state: "active" },
    { key: "match", label: "Match", state: "pending" }
  ]
};
const failure = captureFailure(err, {
  operation: "generation", shown: "Equipment pick failed", progress, now: new Date("2026-10-03T12:00:00Z")
});
assert.equal(failure.step, "Equipment");
assert.deepEqual(failure.stepsDone, ["Concept", "Spells"]);
assert.equal(failure.at, "2026-10-03T12:00:00.000Z");
assert.equal(failure.cancelled, false);
const cancelled = new Error("Cancelled");
cancelled.cancelled = true;
assert.equal(captureFailure(cancelled, { operation: "generation" }).cancelled, true);
assert.equal(captureFailure("text only", { operation: "x" }).message, "text only");
assert.equal(captureFailure(err, { operation: "x" }).step, null, "no progress means no step");

// Environment: allowlisted settings, key settings as yes/no, every key in secrets.
const bankKey = "sk-ant-bankkey0123456789";
const settings = {
  temperature: 0.7, maxTokens: 8000, requestTimeout: 120, freeArchetype: true,
  sourcePacks: { feats: ["sf2e.feats", "world.homebrew"] },
  apiKey: key, jevApiKey: "jev-secret-0123456789",
  providerBank: { connections: [{ apiKey: bankKey }] }
};
const prevGame = globalThis.game;
globalThis.game = {
  version: "14.367",
  system: { id: "sf2e", version: "1.5.1" },
  modules: new Map([
    ["simplysf2e", { id: "simplysf2e", version: "0.0.50", active: true }],
    ["dice-so-nice", { id: "dice-so-nice", version: "5.0.0", active: true }],
    ["off-module", { id: "off-module", version: "1.0", active: false }]
  ])
};
let gathered;
try {
  gathered = gatherEnvironment({
    moduleId: "simplysf2e",
    provider: {
      provider: { name: "OpenRouter" }, connectionName: "Main", connections: [{}, {}],
      baseUrl: "https://openrouter.ai/api/v1", model: "anthropic/claude-sonnet-5",
      apiKey: key, hasConfiguredApiKey: true, apiKeyIsBound: true, keylessLocal: false
    },
    jev: { apiKey: "jev-secret-0123456789", source: "openrouter" },
    getSetting: (k) => {
      if (k === "boom") throw new Error("not registered");
      return settings[k];
    }
  });
} finally {
  globalThis.game = prevGame;
}
const { env, secrets } = gathered;
assert.equal(env.moduleVersion, "0.0.50");
assert.equal(env.system, "sf2e 1.5.1");
assert.equal(env.foundry, "14.367");
assert.deepEqual(env.modules, ["dice-so-nice 5.0.0"]);
assert.equal(env.settings["API key set"], true);
assert.equal(env.settings.Endpoint, "https://openrouter.ai");
assert.deepEqual(env.settings["Source packs"], ["feats=sf2e.feats|world.homebrew"]);
assert.ok(secrets.includes(key) && secrets.includes(bankKey) && secrets.includes("jev-secret-0123456789"));
assert.ok(!Object.values(env.settings).some((v) => String(v).includes("secret") || String(v).includes(key)));

// Formatting: fenced, key-free even when the error and prompt echo a key.
const echoing = new Error(`401 Unauthorized: key ${bankKey} rejected`);
const report = formatBugReport({
  app: "Generator",
  failure: captureFailure(echoing, { operation: "generation", shown: echoing.message, progress }),
  input: { mode: "monster", level: 4, allowSpellcasting: false, prompt: `test ${key} ${"x".repeat(700)}` },
  env,
  secrets
});
assert.ok(report.startsWith("```\nSimplySF2e bug report\n"));
assert.ok(report.endsWith("\n```"));
for (const secret of [key, bankKey, "jev-secret-0123456789"]) assert.ok(!report.includes(secret), `report leaks ${secret}`);
assert.match(report, /Failed step: Equipment/);
assert.match(report, /Steps finished: Concept, Spells/);
assert.match(report, /allowSpellcasting: no/);
assert.match(report, /\(7\d\d chars\)/, "long prompts are truncated");
assert.match(report, /SimplySF2e: 0\.0\.50/);
assert.match(report, /Other active modules: dice-so-nice 5\.0\.0/);
assert.equal((report.match(/```/g) ?? []).length, 2);
const fenced = formatBugReport({ app: "Item Forge", failure: captureFailure(new Error("bad ```json"), { operation: "x" }) });
assert.equal((fenced.match(/```/g) ?? []).length, 2, "a fence inside the error cannot end the block");

console.log("bug-report.test.mjs: ok");
