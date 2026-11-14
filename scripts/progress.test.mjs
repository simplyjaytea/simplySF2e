// Pure progress-bar math: weighted steps, monotonic percent, phase fill.
// Run: node scripts/progress.test.mjs
import assert from "node:assert/strict";
import { AI_TASK, taskMaxTokens } from "./ai-task-profiles.mjs";
import {
  LOCAL_STEP_WEIGHT,
  PHASE_FILL,
  applyStep,
  classifyRequestAbort,
  createProgress,
  formatElapsed,
  progressPercent,
  progressPhaseClass,
  progressView,
  resetStreamPhase,
  stepElapsed,
  stepWeight,
  streamFraction
} from "./progress.mjs";

assert.equal(stepWeight("concept"), taskMaxTokens(AI_TASK.CREATURE_CONCEPT));
assert.equal(
  stepWeight("spells"),
  taskMaxTokens(AI_TASK.SPELL_FOCUS) + taskMaxTokens(AI_TASK.PC_SPELL_SELECTION)
);
assert.equal(stepWeight("match"), LOCAL_STEP_WEIGHT);
assert.ok(
  stepWeight("concept") > stepWeight("spells"),
  "concept writing must own more of the bar than spell selection"
);
assert.ok(
  stepWeight("member0") > stepWeight("concept"),
  "an encounter member covers the whole creature pipeline, not just the concept call"
);
assert.equal(stepWeight("member2"), stepWeight("member0"));

const creature = createProgress([
  ["concept", "Concept"],
  ["spells", "Spells"],
  ["match", "Match"]
]);
assert.equal(creature.percent, 0);
assert.equal(creature.phase, "local");
assert.equal(creature.steps[0].weight, stepWeight("concept"));
assert.equal(creature.streamFrac, 0);

assert.equal(progressPhaseClass("thinking"), "thinking");
assert.equal(progressPhaseClass("writing"), "writing");
assert.equal(progressPhaseClass("cancelling"), "cancelling");
assert.equal(progressPhaseClass("nope"), "local");
assert.equal(classifyRequestAbort({ userAborted: true, aborted: true }), "cancelled",
  "a user cancel must not be classified as a timeout");
assert.equal(classifyRequestAbort({ userAborted: false, aborted: true }), "timeout");
assert.equal(classifyRequestAbort({}), null);

assert.equal(applyStep(creature.steps, "missing"), false);
assert.equal(creature.steps.every((s) => s.state === "pending"), true, "unknown keys must not mark steps done");

assert.equal(applyStep(creature.steps, "concept"), true);
assert.equal(creature.steps[0].state, "active");
assert.equal(creature.steps[1].state, "pending");

const start = progressPercent({
  steps: creature.steps,
  activeKey: "concept",
  streamFrac: PHASE_FILL.start,
  floor: 0
});
assert.ok(start >= 1 && start < 20, "the concept step should start near the left of the bar");

const thinkingPct = progressPercent({
  steps: creature.steps,
  activeKey: "concept",
  streamFrac: PHASE_FILL.thinking,
  floor: start
});
const writingPct = progressPercent({
  steps: creature.steps,
  activeKey: "concept",
  streamFrac: PHASE_FILL.writing,
  floor: thinkingPct
});
assert.ok(thinkingPct >= start, "thinking must not lower percent");
assert.ok(writingPct > thinkingPct, "writing must advance past thinking");

const skipped = progressPercent({
  steps: creature.steps,
  activeKey: "match",
  streamFrac: PHASE_FILL.start,
  floor: writingPct
});
assert.ok(skipped >= writingPct, "skipping to a later step must not rewind the bar");
assert.ok(skipped <= 99, "percent must stay inside the bar");

assert.equal(
  progressPercent({ steps: creature.steps, activeKey: "nope", streamFrac: 1, floor: 17 }),
  17,
  "an unknown active key keeps the floor"
);

assert.equal(streamFraction({ phase: "thinking" }), PHASE_FILL.thinking);
assert.equal(
  streamFraction({ phase: "thinking", prior: PHASE_FILL.thinking }),
  PHASE_FILL.thinking,
  "more thinking tokens must not invent extra fill"
);
assert.equal(
  streamFraction({ phase: "writing", prior: PHASE_FILL.thinking }),
  PHASE_FILL.writing
);
assert.equal(
  streamFraction({ phase: "writing", prior: PHASE_FILL.writing }),
  PHASE_FILL.writing,
  "chars-vs-unknown-length must not keep advancing the bar"
);
assert.equal(
  streamFraction({ phase: "thinking", prior: PHASE_FILL.writing }),
  PHASE_FILL.writing,
  "a later thinking tick must not rewind writing fill"
);
assert.equal(streamFraction({ phase: "start" }), PHASE_FILL.start);

const stream = createProgress([["concept", "Concept"]]);
stream.streamFrac = streamFraction({ phase: "thinking", prior: stream.streamFrac });
stream.streamFrac = streamFraction({ phase: "writing", prior: stream.streamFrac });
assert.equal(stream.streamFrac, PHASE_FILL.writing);
resetStreamPhase(stream);
assert.equal(stream.streamFrac, 0);

applyStep(creature.steps, "spells");
const percents = [];
let floor = writingPct;
for (const phase of ["thinking", "writing", "writing", "thinking", "writing"]) {
  creature.streamFrac = streamFraction({ phase, prior: creature.streamFrac });
  floor = progressPercent({
    steps: creature.steps,
    activeKey: "spells",
    streamFrac: creature.streamFrac,
    floor
  });
  percents.push(floor);
}
for (let i = 1; i < percents.length; i++) {
  assert.ok(percents[i] >= percents[i - 1], `monotonic phase fill: ${percents.join(",")}`);
}

// --- Step timing with a fake clock (U4B telemetry) ---
let clockMs = 1000;
const fakeNow = () => clockMs;
const timed = createProgress([
  ["concept", "Concept"],
  ["spells", "Spells"],
  ["equipment", "Equipment"],
  ["match", "Match"]
], { now: fakeNow });
assert.deepEqual(
  timed.steps.map((s) => [s.startedAt, s.elapsedMs]),
  [[null, null], [null, null], [null, null], [null, null]],
  "a new step list carries no timing"
);
assert.equal(Object.keys(timed.steps).includes("clock"), false, "the clock is not an enumerable step");
assert.deepEqual(JSON.parse(JSON.stringify(timed)).steps.length, 4, "the clock does not leak into a serialized snapshot");

applyStep(timed.steps, "concept");
assert.equal(timed.steps[0].startedAt, 1000);
assert.equal(timed.steps[0].elapsedMs, null, "the active step has no elapsed time yet");

clockMs = 1800;
applyStep(timed.steps, "concept");
assert.equal(timed.steps[0].startedAt, 1000, "re-applying the active key keeps its start time");

applyStep(timed.steps, "spells");
assert.equal(timed.steps[0].state, "done");
assert.equal(timed.steps[0].elapsedMs, 800);
assert.equal(timed.steps[1].startedAt, 1800);

clockMs = 1800 + 65000;
applyStep(timed.steps, "match");
assert.equal(timed.steps[1].elapsedMs, 65000);
assert.equal(timed.steps[2].state, "done");
assert.equal(timed.steps[2].elapsedMs, null, "a step skipped from pending to done has no time");
assert.equal(timed.steps[3].startedAt, 66800);

// An explicit clock argument wins over the one the list was created with.
const overrideClock = createProgress([["concept", "Concept"]], { now: () => 5 });
applyStep(overrideClock.steps, "concept", { now: () => 42 });
assert.equal(overrideClock.steps[0].startedAt, 42);

// No clock given: Date.now, a real number.
const realClock = createProgress([["concept", "Concept"], ["match", "Match"]]);
applyStep(realClock.steps, "concept");
assert.ok(Number.isFinite(realClock.steps[0].startedAt));
applyStep(realClock.steps, "match");
assert.ok(realClock.steps[0].elapsedMs >= 0);

// Going back to an earlier key clears the later steps' timing.
applyStep(timed.steps, "spells");
assert.equal(timed.steps[3].state, "pending");
assert.equal(timed.steps[3].startedAt, null);
assert.equal(timed.steps[3].elapsedMs, null);
assert.equal(timed.steps[0].elapsedMs, 800, "finished steps before the key keep their time");
// Spells runs again from 66800; finishing it at 70000 times the second run.
clockMs = 70000;
applyStep(timed.steps, "match");

// formatElapsed boundaries.
assert.equal(formatElapsed(0), "0.0s");
assert.equal(formatElapsed(49), "0.0s");
assert.equal(formatElapsed(800), "0.8s");
assert.equal(formatElapsed(9940), "9.9s");
assert.equal(formatElapsed(9950), "10s", "rounding to 10.0 s switches to whole seconds");
assert.equal(formatElapsed(12000), "12s");
assert.equal(formatElapsed(59499), "59s");
assert.equal(formatElapsed(59500), "1m 00s");
assert.equal(formatElapsed(65000), "1m 05s");
assert.equal(formatElapsed(600000), "10m 00s");
assert.equal(formatElapsed(null), "");
assert.equal(formatElapsed(undefined), "");
assert.equal(formatElapsed(-1), "");
assert.equal(formatElapsed(Number.NaN), "");

assert.equal(stepElapsed({ state: "done", elapsedMs: 800 }), "0.8s");
assert.equal(stepElapsed({ state: "done", elapsedMs: null }), "");
assert.equal(stepElapsed({ state: "active", elapsedMs: 800 }), "", "only done steps show a time");
assert.equal(stepElapsed({ state: "pending" }), "");

// Context shape the apps hand _progress.hbs.
assert.equal(progressView(null), null);
const view = progressView(timed);
assert.deepEqual(
  view.steps.map((s) => [s.key, s.state, s.elapsed]),
  [
    ["concept", "done", "0.8s"],
    ["spells", "done", "3.2s"],
    ["equipment", "done", ""],
    ["match", "active", ""]
  ]
);
assert.equal(view.totalElapsed, "4.0s", "total sums the timed finished steps");
for (const key of ["phase", "percent", "detail", "streamFrac"]) {
  assert.ok(key in view, `the view keeps progress.${key}`);
}
assert.notEqual(view.steps, timed.steps, "the view copies steps instead of mutating the live list");
assert.equal("elapsed" in timed.steps[0], false, "the live progress object gets no view fields");
assert.equal(progressView(createProgress([["concept", "Concept"]])).totalElapsed, "",
  "no finished step: empty total");

// Elapsed unit letters: defaults unchanged, custom units threaded through.
assert.equal(formatElapsed(4200), "4.2s", "default seconds letter");
assert.equal(formatElapsed(42000), "42s", "default seconds letter, whole");
assert.equal(formatElapsed(65000), "1m 05s", "default minutes letter");
assert.equal(formatElapsed(65000, { seconds: "sek", minutes: "min" }), "1min 05sek");
assert.equal(formatElapsed(65000, { seconds: "sec", minutes: "min" }), "1min 05sec");
assert.equal(formatElapsed(4200, { seconds: "sek", minutes: "min" }), "4.2sek");
assert.equal(formatElapsed(42000, { seconds: "sek", minutes: "min" }), "42sek");
assert.equal(formatElapsed(65000, { seconds: "", minutes: "" }), "1m 05s",
  "empty unit strings fall back to the default letters");
assert.equal(formatElapsed(65000, { seconds: "sek" }), "1m 05sek",
  "missing minutes falls back to the default minutes letter");
assert.equal(formatElapsed(4200, {}), "4.2s", "missing seconds falls back to the default");
assert.equal(formatElapsed(4200, { seconds: 7 }), "4.2s", "non-string unit falls back to the default");
assert.equal(stepElapsed({ state: "done", elapsedMs: 4200 }, { seconds: "sek" }), "4.2sek");
assert.equal(stepElapsed({ state: "active", elapsedMs: 4200 }, { seconds: "sek" }), "");

// progressView passes units to each step's elapsed and to totalElapsed.
const unitTimed = progressView(
  createProgress([["concept", "Concept"], ["spells", "Spells"]]),
  { seconds: "sek", minutes: "min" }
);
assert.equal(unitTimed.totalElapsed, "", "no finished step: empty total with units");
const finished = createProgress([["concept", "Concept"], ["spells", "Spells"]]);
finished.steps[0].state = "done";
finished.steps[0].elapsedMs = 4200;
finished.steps[1].state = "done";
finished.steps[1].elapsedMs = 65000;
const withUnits = progressView(finished, { seconds: "sek", minutes: "min" });
assert.deepEqual(withUnits.steps.map((s) => s.elapsed), ["4.2sek", "1min 05sek"]);
assert.equal(withUnits.totalElapsed, "1min 09sek", "total uses the units too");
assert.equal(progressView(finished).totalElapsed, "1m 09s", "no units argument keeps defaults");

console.log("progress.test.mjs: weighted monotonic progress assertions passed");
