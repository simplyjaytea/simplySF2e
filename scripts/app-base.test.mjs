// Test SpfApp base class: cancellation, token reporting, progress state, and provider test
// Run: node scripts/app-base.test.mjs

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

import {
  PHASE_FILL,
  applyStep,
  createProgress,
  progressPercent,
  progressPhaseClass,
  resetStreamPhase,
  streamFraction
} from "./progress.mjs";
import { coarsenTokenEstimate, lastRunTokenTotal } from "./tokens.mjs";

let testProviderResult = { total: 1250 };
let testProviderShouldThrow = null;
let activeConnectionSelected = null;
let currentConnection = "default-conn";
const notifications = [];
const context = vm.createContext({
  AbortController,
  console: { log() {}, warn() {}, error() {} },
  game: {
    i18n: {
      localize: (key) => key,
      format: (key, data) => `${key}:${JSON.stringify(data)}`
    }
  },
  ui: {
    notifications: {
      info(msg) { notifications.push({ type: "info", msg }); },
      warn(msg) { notifications.push({ type: "warn", msg }); },
      error(msg) { notifications.push({ type: "error", msg }); }
    }
  },
  foundry: {
    applications: {
      api: {
        ApplicationV2: class FakeApplicationV2 {
          constructor(options = {}) { this.options = options; }
          async render() { this.rendered = true; }
        },
        HandlebarsApplicationMixin: (Base) => class extends Base {}
      }
    }
  }
});

const mocks = {
  testProviderConnection: async () => {
    if (testProviderShouldThrow) throw testProviderShouldThrow;
    return testProviderResult;
  },
  getProviderRequestConfig: () => ({
    connectionId: currentConnection,
    provider: { name: "OpenAI" },
    model: "gpt-4o"
  }),
  selectProviderConnection: async (id) => {
    activeConnectionSelected = id;
    currentConnection = id;
  },
  ProviderSetupApp: class FakeProviderSetupApp {
    constructor(callback) { this.callback = callback; }
    render() { return this; }
  },
  PHASE_FILL,
  applyStep,
  createProgress,
  progressPercent,
  progressPhaseClass,
  resetStreamPhase,
  streamFraction,
  coarsenTokenEstimate,
  lastRunTokenTotal
};

const source = await readFile(new URL("./app-base.mjs", import.meta.url), "utf8");
const appModule = new vm.SourceTextModule(source, { context });
await appModule.link((specifier) => {
  const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .filter((match) => match[2] === specifier)
    .flatMap((match) => match[1].split(",").map((name) => name.trim()));
  return new vm.SyntheticModule(imports, function () {
    for (const name of imports) {
      this.setExport(name, mocks[name] ?? (() => { throw new Error(`Unexpected dependency: ${name}`); }));
    }
  }, { context });
});
await appModule.evaluate();

const { SpfApp } = appModule.namespace;

// Concrete subclass for testing
class TestApp extends SpfApp {
  preserved = false;
  _preserveForm() { this.preserved = true; }
}

const app = new TestApp();

// 1. Token reporting & last run cost
assert.equal(app._buildTokenReport(), null, "Empty token usage yields null report");
assert.equal(app._formatLastRunCost(), null, "No last run yields null cost format");

app._recordTokens("Step 1", { prompt: 100, completion: 50, total: 150, estimated: false });
app._recordTokens("Step 2 (Est)", { total: 200, estimated: true });

const report = app._buildTokenReport();
assert.ok(report, "Token report constructed");
assert.equal(report.steps.length, 2, "Report has two steps");
assert.ok(report.totalText.includes("SIMPLYSF2E.Tokens.TotalEstimated"), "Any estimated step uses TotalEstimated label");

app._finishRun();
assert.ok(app._lastRunCost, "Last run cost snapshotted after _finishRun");
assert.ok(app._formatLastRunCost().includes("SIMPLYSF2E.Tokens.LastRunEstimated"));

// 2. Cancellation lifecycle
const stepDefs = [
  ["concept", "Concept"],
  ["equipment", "Equipment"]
];

const signal = app._beginProgress(stepDefs, { cancellable: true });
assert.ok(signal, "BeginProgress returns AbortSignal");
assert.equal(app._canCancel, true, "canCancel is true");
assert.equal(signal.aborted, false, "Signal is not aborted initially");

// Cancelling
let cancelBtnDisabled = false;
app.element = {
  querySelector(sel) {
    if (sel.includes('data-action="cancelGeneration"')) {
      return {
        set disabled(v) { cancelBtnDisabled = v; },
        setAttribute(k, v) {}
      };
    }
    return null;
  }
};

app._cancelGeneration();
assert.equal(signal.aborted, true, "Signal is aborted after _cancelGeneration");
assert.equal(app._canCancel, false, "canCancel is false after cancellation");
assert.equal(cancelBtnDisabled, true, "Cancel button is disabled in DOM");
assert.equal(app._progress.phase, "cancelling");

// _throwIfCancelled
assert.throws(
  () => app._throwIfCancelled(),
  (err) => err.cancelled === true,
  "_throwIfCancelled throws error with .cancelled = true"
);

// Idempotent cancellation
app._cancelGeneration(); // Should not throw

app._disarmCancel();
assert.equal(app._canCancel, false);
assert.equal(app._generationAbort, null);
assert.doesNotThrow(() => app._throwIfCancelled(), "Does not throw after disarm");

// 3. Progress step transitions & in-place DOM painting
app._beginProgress(stepDefs, { cancellable: false });

const domSteps = [
  { className: "", querySelector: () => ({ className: "" }) },
  { className: "", querySelector: () => ({ className: "" }) }
];
const domFill = { style: { width: "0%" } };
const domBar = { setAttribute(k, v) { this[k] = v; } };
const domPct = { textContent: "" };
const domDetail = { textContent: "" };
const domCard = { classList: { remove() {}, add() {} }, dataset: {} };

app.element = {
  querySelectorAll(sel) {
    if (sel.includes(".spf-progress-steps li")) return domSteps;
    return [];
  },
  querySelector(sel) {
    if (sel.includes(".spf-progress-fill")) return domFill;
    if (sel.includes(".spf-progress-bar")) return domBar;
    if (sel.includes(".spf-progress-percent")) return domPct;
    if (sel.includes(".spf-progress-detail")) return domDetail;
    if (sel.includes(".spf-progress")) return domCard;
    return null;
  }
};

await app._setStep("concept");
assert.equal(app._progress.steps[0].state, "active");
assert.equal(domSteps[0].className, "spf-step-active");
assert.ok(domFill.style.width.endsWith("%"));

// AI progress streaming
app._onAIProgress({ phase: "thinking", tokens: 50, exact: true, call: "Drafting" });
assert.equal(app._progress.phase, "thinking");
assert.ok(domDetail.textContent.includes("ThinkingExact"));

app._onAIProgress({ phase: "writing", tokens: 120, exact: false, call: "Generating" });
assert.equal(app._progress.phase, "writing");
assert.ok(domDetail.textContent.includes("Writing"));

await app._setStep("equipment");
assert.equal(app._progress.steps[0].state, "done");
assert.equal(app._progress.steps[1].state, "active");
assert.equal(domSteps[0].className, "spf-step-done");
assert.equal(domSteps[1].className, "spf-step-active");

// 4. Provider switching & testing
app.rendered = false;
await app._switchActiveConnection("conn-2");
assert.equal(activeConnectionSelected, "conn-2");
assert.equal(app.preserved, true, "Preserves form before switching connection");
assert.equal(app.rendered, true, "Re-renders after connection switch");

// Switching to same connection is a no-op
app.rendered = false;
app.preserved = false;
await app._switchActiveConnection("conn-2");
assert.equal(app.preserved, false, "Same connection does not preserve form or re-render");

// Testing provider success
const testBtn = {
  disabled: false,
  icon: { className: "fa-solid fa-plug" },
  querySelector(sel) { return this.icon; }
};
await app._testProvider(testBtn);
assert.equal(testBtn.disabled, false);
assert.equal(testBtn.icon.className, "fa-solid fa-plug", "Icon restored after test");
assert.ok(notifications.some((n) => n.type === "info" && n.msg.includes("TestSuccess")));

// Testing provider failure
testProviderShouldThrow = new Error("Connection timed out");
await app._testProvider(testBtn);
assert.equal(testBtn.disabled, false);
assert.equal(testBtn.icon.className, "fa-solid fa-plug");
assert.ok(notifications.some((n) => n.type === "error" && n.msg.includes("TestFailed")));

console.log("app-base.test.mjs: cancellation, token reporting, progress, and provider assertions passed");
