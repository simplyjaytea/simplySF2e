// Interface sounds: four short synthesised cues, off by default, heard only
// on the GM's own client. No audio files: each cue is a few notes played
// through the browser's Web Audio. Everything here is pure except `playCue`,
// which is the only place that touches an AudioContext, and it never throws.

/** The client setting's values and the gain each one plays at. */
export const SOUND_LEVELS = { off: 0, quiet: 0.35, normal: 1 };

/** Loudest a note may get before the level and Foundry's interface volume scale it. */
export const MASTER_GAIN = 0.2;

/**
 * The cues. `at` and `dur` are seconds; `gain` is 0 to 1 within the cue.
 * start: one soft blip. ready: two rising notes. created: a rising triad.
 * error: two low falling notes. Every cue ends inside half a second.
 */
export const CUES = {
  start: [{ freq: 440, at: 0, dur: 0.07, type: "sine", gain: 0.5 }],
  ready: [
    { freq: 659.25, at: 0, dur: 0.09, type: "sine", gain: 0.8 },
    { freq: 880, at: 0.09, dur: 0.14, type: "sine", gain: 0.8 }
  ],
  created: [
    { freq: 523.25, at: 0, dur: 0.08, type: "triangle", gain: 0.8 },
    { freq: 659.25, at: 0.08, dur: 0.08, type: "triangle", gain: 0.8 },
    { freq: 783.99, at: 0.16, dur: 0.2, type: "triangle", gain: 1 }
  ],
  error: [
    { freq: 220, at: 0, dur: 0.13, type: "triangle", gain: 0.9 },
    { freq: 164.81, at: 0.13, dur: 0.22, type: "triangle", gain: 0.9 }
  ]
};

/** The order the Test sounds button plays them in. */
export const CUE_ORDER = ["start", "ready", "created", "error"];

/** A stored setting value as one of the three levels; anything else is off. */
export function soundLevel(value) {
  return Object.hasOwn(SOUND_LEVELS, value) ? value : "off";
}

/**
 * The notes to play for a cue: its notes with their final gain, or nothing
 * when sounds are off, the cue is unknown or the volume is zero.
 * @param {string} name a key of CUES
 * @param {string} level a key of SOUND_LEVELS
 * @param {number} [volume] Foundry's interface volume, 0 to 1
 */
export function cuePlan(name, level, volume = 1) {
  const notes = Object.hasOwn(CUES, name) ? CUES[name] : null;
  const scale = SOUND_LEVELS[soundLevel(level)] * MASTER_GAIN * Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 1));
  if (!notes || !(scale > 0)) return [];
  return notes.map((note) => ({ ...note, gain: note.gain * scale }));
}

/**
 * Which cue a render of a tool window's result part calls for, from what the
 * part shows now and what it showed on its previous render.
 *   start    a run or a create began
 *   ready    a run ended with a result on screen
 *   created  a create ended: the Generator shows its created or review card,
 *            and the other windows consume the draft that was on screen
 *   error    a run or a create ended with an error (a cancel is not an error)
 * @param {{busy: boolean, kind: string, error: boolean, cancelled: boolean}} now
 * @param {{busy: boolean, kind: string, startKind: string}|null} before
 * @returns {"start"|"ready"|"created"|"error"|null}
 */
export function cueFor(now, before) {
  if (!now || !before) return null;
  if (now.busy) return before.busy ? null : "start";
  if (!before.busy || now.cancelled) return null;
  if (now.error) return "error";
  if (now.kind === "created" || now.kind === "review") return "created";
  if (!now.kind) return before.startKind ? "created" : null;
  return "ready";
}

/**
 * The state to remember for the next render: the card on screen when the run
 * began stays in `startKind` until the run ends.
 */
export function nextCueState(now, before) {
  const startKind = now.busy ? (before?.busy ? before.startKind : (before?.kind ?? "")) : "";
  return { busy: Boolean(now.busy), kind: now.kind || "", startKind: startKind || "" };
}

let sharedContext = null;

/**
 * Play one cue now. Returns the number of notes scheduled (0 when sounds are
 * off or the browser has no Web Audio). Never throws: a sound must not be
 * able to break a run.
 * @param {string} name
 * @param {{level?: string, volume?: number, context?: object, AudioContextClass?: Function}} [options]
 */
export function playCue(name, { level = "off", volume = 1, context = null, AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext } = {}) {
  try {
    const plan = cuePlan(name, level, volume);
    if (!plan.length) return 0;
    const ctx = context ?? (sharedContext ??= AudioContextClass ? new AudioContextClass() : null);
    if (!ctx) return 0;
    if (ctx.state === "suspended") ctx.resume?.()?.catch?.(() => {});
    const t0 = ctx.currentTime + 0.01;
    for (const note of plan) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = note.type;
      osc.frequency.setValueAtTime(note.freq, t0 + note.at);
      // A short attack and an exponential release, so no note clicks.
      amp.gain.setValueAtTime(0.0001, t0 + note.at);
      amp.gain.linearRampToValueAtTime(note.gain, t0 + note.at + 0.008);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + note.at + note.dur);
      osc.connect(amp);
      amp.connect(ctx.destination);
      osc.start(t0 + note.at);
      osc.stop(t0 + note.at + note.dur + 0.02);
    }
    return plan.length;
  } catch (err) {
    console.warn("simplysf2e | interface sound failed", err);
    return 0;
  }
}
