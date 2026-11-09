/**
 * Pure generation-progress math. Step weights come from AI task budgets so
 * concept writing owns more of the bar than a short selector call. Intra-step
 * fill is phase-based (thinking → writing), never chars-vs-unknown-length.
 */
import { AI_TASK, taskMaxTokens } from "./ai-task-profiles.mjs";

/** Display share for local (non-AI) steps — not a measured duration. */
export const LOCAL_STEP_WEIGHT = 400;

/** How much of the active step the bar may fill for each stream phase. */
export const PHASE_FILL = Object.freeze({
  start: 0.02,
  thinking: 0.35,
  writing: 0.75
});

export function stepWeight(key) {
  const name = String(key ?? "");
  if (/^member\d+$/.test(name)) {
    return taskMaxTokens(AI_TASK.CREATURE_CONCEPT)
      + taskMaxTokens(AI_TASK.SPELL_FOCUS)
      + taskMaxTokens(AI_TASK.SPELL_SELECTION)
      + taskMaxTokens(AI_TASK.ABILITY_SELECTION)
      + taskMaxTokens(AI_TASK.CREATURE_FEAT_SELECTION)
      + taskMaxTokens(AI_TASK.EQUIPMENT_SELECTION)
      + taskMaxTokens(AI_TASK.LOOT_SELECTION);
  }
  switch (name) {
    case "concept": return taskMaxTokens(AI_TASK.CREATURE_CONCEPT);
    case "spells": return taskMaxTokens(AI_TASK.SPELL_FOCUS) + taskMaxTokens(AI_TASK.PC_SPELL_SELECTION);
    case "abilities": return taskMaxTokens(AI_TASK.ABILITY_SELECTION);
    case "feats": return taskMaxTokens(AI_TASK.FEAT_SELECTION);
    case "equipment": return taskMaxTokens(AI_TASK.EQUIPMENT_SELECTION);
    case "loot": return taskMaxTokens(AI_TASK.LOOT_SELECTION);
    case "design": return taskMaxTokens(AI_TASK.ENCOUNTER_DESIGN);
    case "reskin": return taskMaxTokens(AI_TASK.RESKIN_FLAVOR);
    case "reroll": return taskMaxTokens(AI_TASK.REROLL_PICK);
    case "shopConcept": return taskMaxTokens(AI_TASK.SHOP_CONCEPT);
    case "stock": return taskMaxTokens(AI_TASK.SHOP_SELECTION);
    case "abc": return taskMaxTokens(AI_TASK.ABC_SELECTION);
    case "choices": return taskMaxTokens(AI_TASK.CHARACTER_CHOICES);
    default: return LOCAL_STEP_WEIGHT;
  }
}

/**
 * `now` is the clock `applyStep` reads for step timing (tests pass a fake one).
 * It rides on the steps array as a non-enumerable property because callers
 * hand `applyStep` the array, not the progress object.
 */
export function createProgress(defs, { now } = {}) {
  const steps = (defs ?? []).map(([key, label]) => ({
    key,
    label,
    state: "pending",
    weight: stepWeight(key),
    startedAt: null,
    elapsedMs: null
  }));
  if (typeof now === "function") {
    Object.defineProperty(steps, "clock", { value: now, enumerable: false });
  }
  return {
    steps,
    detail: "",
    percent: 0,
    streamFrac: 0,
    phase: "local"
  };
}

const PROGRESS_PHASES = new Set(["thinking", "writing", "local", "cancelling"]);

/** CSS/data-phase token for the progress card. Unknown values stay "local". */
export function progressPhaseClass(phase) {
  return PROGRESS_PHASES.has(phase) ? phase : "local";
}

/**
 * Distinguish a user-cancel abort from the idle timeout abort.
 * Timeouts stay timeouts; a user abort never looks like completion.
 */
export function classifyRequestAbort({ userAborted = false, aborted = false } = {}) {
  if (userAborted) return "cancelled";
  if (aborted) return "timeout";
  return null;
}

/**
 * Unknown keys leave state unchanged so a missing step cannot mark everything done.
 * Timing: a step records `startedAt` when it becomes active and `elapsedMs`
 * when it moves from active to done. A step skipped straight from pending to
 * done has no time (`elapsedMs` stays null); a step sent back to pending
 * loses its time. The clock is `now`, else the one `createProgress` was given,
 * else `Date.now`.
 */
export function applyStep(steps, key, { now } = {}) {
  const list = Array.isArray(steps) ? steps : [];
  if (!list.some((step) => step.key === key)) return false;
  const clock = typeof now === "function" ? now
    : typeof list.clock === "function" ? list.clock
      : Date.now;
  const at = Number(clock());
  let reached = false;
  for (const step of list) {
    const was = step.state;
    if (step.key === key) {
      step.state = "active";
      if (was !== "active") {
        step.startedAt = at;
        step.elapsedMs = null;
      }
      reached = true;
    } else if (reached) {
      step.state = "pending";
      step.startedAt = null;
      step.elapsedMs = null;
    } else {
      step.state = "done";
      if (was === "active" && Number.isFinite(step.startedAt) && Number.isFinite(at)) {
        step.elapsedMs = Math.max(0, at - step.startedAt);
      }
    }
  }
  return true;
}

/** Unit letters for elapsed time: seconds and minutes. */
export const DEFAULT_ELAPSED_UNITS = Object.freeze({ seconds: "s", minutes: "m" });

/** A unit letter from `units[key]`, or the default when it is missing or not a non-empty string. */
function elapsedUnit(units, key) {
  const value = units?.[key];
  return typeof value === "string" && value.length > 0 ? value : DEFAULT_ELAPSED_UNITS[key];
}

/**
 * Elapsed time as a short status value: tenths below 10 s ("0.8 s"), whole
 * seconds below a minute ("12 s"), then minutes and padded seconds
 * ("1 m 05 s"). Rounds first, so 9.96 s reads "10 s" and 59.6 s "1 m 00 s".
 * `units` overrides the unit letters (`seconds`, `minutes`); a missing or
 * empty one falls back to the default. A missing or negative value is "".
 */
export function formatElapsed(ms, units = DEFAULT_ELAPSED_UNITS) {
  if (ms === null || ms === undefined || ms === "") return "";
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return "";
  const secondsUnit = elapsedUnit(units, "seconds");
  const minutesUnit = elapsedUnit(units, "minutes");
  const tenths = Math.round(value / 100);
  if (tenths < 100) return `${(tenths / 10).toFixed(1)} ${secondsUnit}`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds} ${secondsUnit}`;
  return `${Math.floor(seconds / 60)} ${minutesUnit} ${String(seconds % 60).padStart(2, "0")} ${secondsUnit}`;
}

/** The status value a finished step shows: its elapsed time, or "" when it has none. */
export function stepElapsed(step, units = DEFAULT_ELAPSED_UNITS) {
  return step?.state === "done" ? formatElapsed(step.elapsedMs, units) : "";
}

/**
 * Template context for `_progress.hbs`: the progress object plus `elapsed`
 * per step (formatted, done steps only) and `totalElapsed` (the finished
 * steps' times summed, formatted; "" before the first step finishes).
 * The active step shows the `Progress.Running` label, not a time: nothing
 * re-renders the card on a timer. Returns null for no progress.
 */
export function progressView(progress, units = DEFAULT_ELAPSED_UNITS) {
  if (!progress) return null;
  const steps = Array.isArray(progress.steps) ? progress.steps : [];
  const timed = steps.filter((step) => step.state === "done" && Number.isFinite(step.elapsedMs));
  const total = timed.reduce((sum, step) => sum + step.elapsedMs, 0);
  return {
    ...progress,
    steps: steps.map((step) => ({ ...step, elapsed: stepElapsed(step, units) })),
    totalElapsed: timed.length ? formatElapsed(total, units) : ""
  };
}

export function resetStreamPhase(progress) {
  if (!progress) return progress;
  progress.streamFrac = 0;
  return progress;
}

/**
 * Advance the active step's fill from the stream phase only.
 * Extra tokens do not move the bar — length is unknown until the call ends.
 */
export function streamFraction({ phase, prior = 0 }) {
  const next = phase === "writing" ? PHASE_FILL.writing
    : phase === "thinking" ? PHASE_FILL.thinking
    : PHASE_FILL.start;
  return Math.min(0.92, Math.max(Number(prior) || 0, next));
}

/**
 * Weighted percent in 0–99. `floor` keeps the bar monotonic across ticks and
 * step changes. An unknown active key returns `floor` unchanged.
 */
export function progressPercent({ steps, activeKey, streamFrac = 0, floor = 0 }) {
  const list = Array.isArray(steps) ? steps : [];
  const floorClamped = Math.max(0, Math.min(100, Number(floor) || 0));
  if (!list.length) return floorClamped;
  const idx = list.findIndex((step) => step.key === activeKey);
  if (idx < 0) return floorClamped;
  const totalWeight = list.reduce((sum, step) => sum + (Number(step.weight) || 0), 0) || 1;
  const doneWeight = list.slice(0, idx).reduce((sum, step) => sum + (Number(step.weight) || 0), 0);
  const frac = Math.min(0.92, Math.max(PHASE_FILL.start, Number(streamFrac) || 0));
  const raw = ((doneWeight + frac * (Number(list[idx].weight) || 0)) / totalWeight) * 100;
  const next = Math.round(Math.max(0, Math.min(99, raw)));
  return Math.max(floorClamped, Math.max(1, next));
}
