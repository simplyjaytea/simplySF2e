// Test SpfApp base class: cancellation, token reporting, progress state, and provider test
// Run: node scripts/app-base.test.mjs

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { formatCost, runCost } from "./cost.mjs";

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
  stepElapsed,
  streamFraction
} from "./progress.mjs";
import { coarsenTokenEstimate, lastRunTokenTotal } from "./tokens.mjs";

let testProviderResult = { total: 1250 };
let testProviderShouldThrow = null;
let activeConnectionSelected = null;
let currentConnection = "default-conn";
let activePrices = { inputPerM: null, outputPerM: null };
const notifications = [];
let confirmAnswer = true;
let confirmCalls = 0;
// Unit letters the localize stub returns for the two elapsed-time keys.
const unitLabels = { "SIMPLYSF2E.Progress.UnitSeconds": "s", "SIMPLYSF2E.Progress.UnitMinutes": "m" };
const context = vm.createContext({
  AbortController,
  console: { log() {}, warn() {}, error() {}, debug() {} },
  game: {
    i18n: {
      localize: (key) => (key in unitLabels ? unitLabels[key] : key),
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
          async close() { this.closedCalled = (this.closedCalled ?? 0) + 1; return this; }
        },
        DialogV2: { async confirm() { confirmCalls += 1; return confirmAnswer; } },
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
  getSetting: () => 0,
  SETTINGS: { runTokenBudget: "runTokenBudget", runDeadline: "runDeadline" },
  beginRunBudget: () => null,
  endRunBudget: () => {},
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
  stepElapsed,
  streamFraction,
  coarsenTokenEstimate,
  lastRunTokenTotal,
  runCost,
  formatCost,
  getActiveProviderPrices: () => activePrices
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

// Per-step timing suffix (J6)
app._recordTokens("Equipment", { prompt: 10, completion: 0, total: 10, estimated: false }, { source: "jev", ms: 820 });
app._recordTokens("Loot", { prompt: 10, completion: 5, total: 15, estimated: false }, { source: "llm", ms: 6140, jevMs: 900 });
app._recordTokens("Spells", { prompt: 10, completion: 5, total: 15, estimated: false }, { source: "llm", ms: 3000 });
const timed = app._buildTokenReport().steps;
assert.ok(timed[2].text.endsWith('SIMPLYSF2E.Tokens.ViaJev:{"seconds":"0.8"}'), "Jev step shows Jev timing");
assert.ok(timed[3].text.includes("ViaChatFallback") && timed[3].text.includes('"6.1"'), "fallback step names the fallback");
assert.ok(timed[4].text.includes("ViaChat:"), "plain chat step shows chat timing");
assert.ok(!timed[0].text.includes("Via"), "steps without timing get no suffix");
assert.equal(app._formatStepTiming({ source: "jev", ms: NaN }), null);
assert.equal(app._formatStepTiming({ source: "x", ms: 5 }), null);
app._tokenUsage.splice(2);

app._finishRun();
assert.ok(app._lastRunCost, "Last run cost snapshotted after _finishRun");
assert.ok(app._formatLastRunCost().includes("SIMPLYSF2E.Tokens.LastRunEstimated"));

// 1b. Run cost is tied to the connection that made each request.
{
  const costApp = new TestApp();
  const usage = { prompt: 1_000_000, completion: 1_000_000, total: 2_000_000, estimated: false };
  activePrices = { inputPerM: 1, outputPerM: 2 };
  currentConnection = "priced-conn";
  costApp._recordTokens("A", usage);
  assert.ok(costApp._buildTokenReport().costText.includes("CostManual"), "manual prices price the run");
  assert.ok(costApp._buildTokenReport().costText.includes("$3.00"));
  // Switching connection after the run (to one with other or no prices) does not reprice it.
  activePrices = { inputPerM: 50, outputPerM: 50 };
  currentConnection = "other-conn";
  assert.ok(costApp._buildTokenReport().costText.includes("$3.00"), "later switch: unchanged");
  activePrices = { inputPerM: null, outputPerM: null };
  assert.ok(costApp._buildTokenReport().costText.includes("$3.00"), "later switch to unpriced: still priced");
  // Switching mid-run: each step keeps the prices of the connection active when it was recorded.
  costApp._recordTokens("B", usage);
  assert.equal(costApp._tokenUsage[0].connectionId, "priced-conn");
  assert.equal(costApp._tokenUsage[1].connectionId, "other-conn");
  assert.ok(costApp._buildTokenReport().costText.includes("CostPartial"), "unpriced second step: partial, first not repriced");
  assert.ok(costApp._buildTokenReport().costText.includes("$3.00"));
  // Restoring a history draft keeps its recorded prices; an old draft without any stays unpriced.
  activePrices = { inputPerM: 100, outputPerM: 100 };
  const restored = new TestApp();
  restored._tokenUsage = [...costApp._tokenUsage.slice(0, 1)];
  assert.ok(restored._buildTokenReport().costText.includes("$3.00"), "restored draft: recorded prices, not current");
  const legacy = new TestApp();
  legacy._tokenUsage = [{ label: "old", usage }];
  assert.equal(legacy._buildTokenReport().costText, null, "legacy entry without prices: no cost");
  activePrices = { inputPerM: null, outputPerM: null };
}

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
// A non-cancellable step still needs a live run signal (budget + deadline) but
// must not offer a cancel affordance; a continuation step reuses that signal so
// one run cannot open a second budget window.
const noCancelSignal = app._beginProgress(stepDefs, { cancellable: false });
assert.ok(noCancelSignal, "a non-cancellable step still gets a live run signal");
assert.equal(app._canCancel, false, "a non-cancellable step must not offer cancel");
assert.equal(
  app._beginProgress(stepDefs, { cancellable: false, reuseRunSignal: true }),
  noCancelSignal,
  "a continuation step reuses the run signal instead of opening a new budget window"
);

const domElapsed = [{ textContent: "" }, { textContent: "" }];
const domSteps = [
  { className: "", querySelector: (sel) => (sel === ".spf-step-elapsed" ? domElapsed[0] : { className: "" }) },
  { className: "", querySelector: (sel) => (sel === ".spf-step-elapsed" ? domElapsed[1] : { className: "" }) }
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
assert.equal(domElapsed[0].textContent, "SIMPLYSF2E.Progress.Running", "the active step paints the running label");
assert.equal(domElapsed[1].textContent, "", "a pending step paints no status value");

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
assert.match(domElapsed[0].textContent, /^\d+\.\d s$/, "a finished step paints its elapsed time in place");
assert.equal(domElapsed[1].textContent, "SIMPLYSF2E.Progress.Running");

// A live repaint uses the app's localized unit letters, not the defaults.
unitLabels["SIMPLYSF2E.Progress.UnitSeconds"] = "sek";
unitLabels["SIMPLYSF2E.Progress.UnitMinutes"] = "min";
app._paintStepList();
assert.match(domElapsed[0].textContent, /^\d+\.\d sek$/, "the in-place repaint ends with the localized seconds letter");
assert.equal(domElapsed[1].textContent, "SIMPLYSF2E.Progress.Running", "the active step still paints the running label");

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

// Close while a run is cancellable: confirm, then abort; No keeps the window open.
{
  const closing = new TestApp();
  closing._armCancel();
  confirmAnswer = false;
  await closing.close();
  assert.equal(confirmCalls, 1, "closing a busy window asks first");
  assert.equal(closing.closedCalled, undefined, "No keeps the window open");
  assert.equal(closing._generationAbort.signal.aborted, false, "No leaves the run alone");
  confirmAnswer = true;
  const signal = closing._generationAbort.signal;
  await closing.close();
  assert.equal(signal.aborted, true, "Yes aborts the run");
  assert.equal(closing.closedCalled, 1, "Yes closes the window");
  closing.rendered = false;
  await closing.render();
  assert.equal(closing.rendered, false, "a late plain render cannot reopen a closed window");
  await closing.render(true);
  assert.equal(closing.rendered, true, "a forced render reopens it");

  // Shortcut binds once per window frame, and again for a reopened frame.
  const listeners = [];
  const frame = () => ({ addEventListener: (type, fn) => listeners.push({ type, fn }), querySelector: () => null });
  const keyed = new TestApp();
  keyed.element = frame();
  keyed._onRender();
  keyed._onRender();
  assert.equal(listeners.filter((l) => l.type === "keydown").length, 1, "re-render does not stack keydown listeners");
  keyed.element = frame();
  keyed._onRender();
  assert.equal(listeners.filter((l) => l.type === "keydown").length, 2, "a reopened frame gets its own listener");

  const idle = new TestApp();
  const before = confirmCalls;
  await idle.close();
  assert.equal(confirmCalls, before, "closing an idle window does not prompt");
  assert.equal(idle.closedCalled, 1, "idle window closes");
}

console.log("app-base.test.mjs: cancellation, token reporting, progress, and provider assertions passed");
