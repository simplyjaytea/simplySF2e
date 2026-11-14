// Interface sounds (UI revamp slice 6): the pure parts of sounds.mjs, the
// player against a fake AudioContext, and the setting and menu wiring.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CUES, CUE_ORDER, MASTER_GAIN, SOUND_LEVELS, cueFor, cuePlan, nextCueState, playCue, soundLevel } from "./sounds.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

// 1. Four cues, each short, quiet and made of plain oscillator notes.
assert.deepEqual(Object.keys(CUES), ["start", "ready", "created", "error"]);
assert.deepEqual(CUE_ORDER, Object.keys(CUES));
for (const [name, notes] of Object.entries(CUES)) {
  assert.ok(notes.length >= 1 && notes.length <= 3, `${name} has 1 to 3 notes`);
  const end = Math.max(...notes.map((note) => note.at + note.dur));
  assert.ok(end <= 0.5, `${name} ends inside half a second (${end})`);
  for (const note of notes) {
    assert.ok(["sine", "triangle"].includes(note.type), `${name} uses a soft waveform`);
    assert.ok(note.freq >= 110 && note.freq <= 1200, `${name} stays in a comfortable range`);
    assert.ok(note.gain > 0 && note.gain <= 1 && note.dur >= 0.05);
  }
}
const pitch = (name) => CUES[name].map((note) => note.freq);
assert.ok(pitch("ready")[1] > pitch("ready")[0], "ready rises");
assert.ok(pitch("created").every((freq, i, all) => i === 0 || freq > all[i - 1]), "created rises");
assert.ok(pitch("error")[1] < pitch("error")[0], "error falls");
assert.ok(Math.max(...pitch("error")) < Math.min(...pitch("ready")), "error is lower than ready, so the two are told apart without looking");

// 2. Levels: off is silent, quiet is under normal, and nothing exceeds the master gain.
assert.deepEqual(Object.keys(SOUND_LEVELS), ["off", "quiet", "normal"]);
assert.equal(soundLevel("quiet"), "quiet");
for (const bad of [undefined, null, "", "loud", "constructor", 1]) assert.equal(soundLevel(bad), "off");
assert.deepEqual(cuePlan("ready", "off"), []);
assert.deepEqual(cuePlan("ready", "loud"), []);
assert.deepEqual(cuePlan("nope", "normal"), []);
assert.deepEqual(cuePlan("constructor", "normal"), []);
assert.deepEqual(cuePlan("ready", "normal", 0), [], "Foundry's interface volume at zero silences the cue");
const normal = cuePlan("created", "normal");
const quiet = cuePlan("created", "quiet");
assert.equal(normal.length, CUES.created.length);
assert.ok(normal.every((note) => note.gain <= MASTER_GAIN + 1e-9));
assert.ok(quiet.every((note, i) => note.gain < normal[i].gain));
assert.ok(Math.abs(cuePlan("created", "normal", 0.5)[2].gain - normal[2].gain / 2) < 1e-9, "the cue follows the interface volume");
assert.equal(cuePlan("created", "normal", 7)[2].gain, normal[2].gain, "a volume over 1 is clamped");
assert.equal(cuePlan("created", "normal", NaN)[2].gain, normal[2].gain);
assert.notEqual(normal[0], CUES.created[0], "the plan never hands out the cue table's own objects");

// 3. Which cue a render calls for.
const idle = (kind = "") => ({ busy: false, kind, startKind: "" });
const running = (startKind = "") => ({ busy: true, kind: startKind, startKind });
const now = (fields) => ({ busy: false, kind: "", error: false, cancelled: false, ...fields });
assert.equal(cueFor(now({ busy: true }), null), null, "the first render of a window is silent");
assert.equal(cueFor(now({ kind: "preview" }), null), null);
assert.equal(cueFor(now({ busy: true }), idle()), "start");
assert.equal(cueFor(now({ busy: true }), running()), null, "a re-render mid-run is silent");
assert.equal(cueFor(now({ kind: "preview" }), idle("preview")), null, "an idle re-render is silent");
assert.equal(cueFor(now({ kind: "preview" }), idle()), null, "a stored preview shown without a run is silent");
assert.equal(cueFor(now({ kind: "preview" }), running()), "ready");
assert.equal(cueFor(now({ kind: "card" }), running("card")), "ready", "another version of a draft is a new result");
assert.equal(cueFor(now({ kind: "created" }), running("preview")), "created");
assert.equal(cueFor(now({ kind: "created" }), running()), "created", "one-click create");
assert.equal(cueFor(now({ kind: "review" }), running()), "created");
assert.equal(cueFor(now({}), running("card")), "created", "the draft was consumed by a create");
assert.equal(cueFor(now({}), running()), null, "a run that ends with nothing to show is silent");
assert.equal(cueFor(now({ error: true }), running("preview")), "error");
assert.equal(cueFor(now({ error: true, kind: "preview" }), running("preview")), "error", "an error wins over the card still on screen");
assert.equal(cueFor(now({ error: true, cancelled: true }), running()), null, "a cancel is not an error");
assert.equal(cueFor(now({ kind: "preview", cancelled: true }), running("preview")), null);

// The remembered state: the card on screen when the run began is kept until it ends.
assert.deepEqual(nextCueState(now({ kind: "preview" }), null), { busy: false, kind: "preview", startKind: "" });
assert.deepEqual(nextCueState(now({ busy: true }), idle("card")), { busy: true, kind: "", startKind: "card" });
assert.deepEqual(nextCueState(now({ busy: true, kind: "preview" }), running("card")), { busy: true, kind: "preview", startKind: "card" });
assert.deepEqual(nextCueState(now({}), running("card")), idle());
assert.deepEqual(nextCueState(now({ busy: true }), null), { busy: true, kind: "", startKind: "" });

// 4. The player: schedules one oscillator per note, resumes a suspended
// context, and never throws.
{
  const made = [];
  const param = () => ({ calls: [], setValueAtTime(v, t) { this.calls.push(["set", v, t]); }, linearRampToValueAtTime(v, t) { this.calls.push(["lin", v, t]); }, exponentialRampToValueAtTime(v, t) { this.calls.push(["exp", v, t]); } });
  let resumed = 0;
  const context = {
    state: "suspended",
    currentTime: 10,
    destination: { name: "out" },
    resume: () => { resumed += 1; return Promise.resolve(); },
    createOscillator: () => { const osc = { frequency: param(), connect(to) { this.to = to; }, start(t) { this.startAt = t; }, stop(t) { this.stopAt = t; } }; made.push(osc); return osc; },
    createGain: () => ({ gain: param(), connect(to) { this.to = to; } })
  };
  assert.equal(playCue("created", { level: "normal", context }), 3);
  assert.equal(resumed, 1);
  assert.equal(made.length, 3);
  made.forEach((osc, i) => {
    const note = CUES.created[i];
    assert.equal(osc.type, note.type);
    assert.deepEqual(osc.frequency.calls[0].slice(0, 2), ["set", note.freq]);
    assert.ok(Math.abs(osc.startAt - (10.01 + note.at)) < 1e-9);
    assert.ok(osc.stopAt > osc.startAt + note.dur, "every oscillator is stopped, so none is left running");
    assert.equal(osc.to.to, context.destination);
    const gains = osc.to.gain.calls;
    assert.deepEqual(gains.map(([kind]) => kind), ["set", "lin", "exp"], "attack and release ramps, so no note clicks");
    assert.ok(gains[0][1] > 0 && gains[2][1] > 0, "an exponential ramp never targets zero");
    assert.ok(gains[1][1] <= MASTER_GAIN + 1e-9);
  });
  made.length = 0;
  assert.equal(playCue("created", { level: "off", context }), 0);
  assert.equal(playCue("nope", { level: "normal", context }), 0);
  assert.equal(made.length, 0, "off and unknown cues touch no audio node");
  assert.equal(playCue("ready", { level: "normal", AudioContextClass: null }), 0, "a browser without Web Audio is silent");
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(playCue("ready", { level: "normal", context: { state: "running", currentTime: 0, createOscillator() { throw new Error("no audio"); } } }), 0, "a failing context is swallowed");
  } finally {
    console.warn = warn;
  }
}

// 5. Wiring: a client setting, off by default, three choices; a Test sounds
// menu; the cues follow Foundry's interface volume; nothing is broadcast.
{
  const settings = read("scripts/settings.mjs");
  const block = settings.match(/game\.settings\.register\(MODULE_ID, SETTINGS\.interfaceSounds, \{([\s\S]*?)\n  \}\);/)?.[1] ?? "";
  assert.match(block, /scope: "client"/);
  assert.match(block, /config: true/);
  assert.match(block, /default: "off"/);
  assert.deepEqual([...block.matchAll(/^\s+(off|quiet|normal): "SIMPLYSF2E\.Settings\.InterfaceSounds\.(Off|Quiet|Normal)"/gm)].map((m) => m[1]), Object.keys(SOUND_LEVELS));
  assert.match(settings, /registerMenu\(MODULE_ID, "soundTestMenu", \{[\s\S]*?type: SoundTestApp,/);
  assert.match(settings, /game\.settings\.get\("core", "globalInterfaceVolume"\)/);
  const lang = JSON.parse(read("lang/en.json")).SIMPLYSF2E;
  for (const key of ["Name", "Hint", "Off", "Quiet", "Normal"]) assert.ok(lang.Settings.InterfaceSounds[key], key);
  for (const key of ["MenuName", "MenuLabel", "MenuHint", "TestPlaying"]) assert.ok(lang.Sounds[key], key);
  const test = read("scripts/sound-test-app.mjs");
  assert.match(test, /async render\(\) \{[\s\S]*?CUE_ORDER\.forEach\(\(name, index\) => \{\s*setTimeout\(\(\) => playCue\(name, \{ level: "normal", volume \}\), index \* TEST_GAP_MS\);[\s\S]*?return this;\s*\}/,
    "the test plays the four cues in order and opens no window");
  assert.match(read("scripts/simplysf2e.mjs"), /registerSettings\(SourcesConfigApp, ProviderSetupApp, WelcomeApp, WhatsNewApp, SoundTestApp\);/);
  // Only app-base and the test button play a cue, and no file ships audio or talks to a socket for it.
  const sources = ["app-base", "sound-test-app", "sounds"];
  for (const name of sources) assert.doesNotMatch(read(`scripts/${name}.mjs`), /socket|AudioHelper|\.(?:ogg|mp3|wav)\b/, `${name} neither broadcasts nor loads a file`);
  const base = read("scripts/app-base.mjs");
  assert.match(base, /const level = interfaceSoundLevel\(\);\s*if \(level !== "off"\) playCue\(cue, \{ level, volume: interfaceSoundVolume\(\) \}\);/);
  assert.match(base, /_recordFailure\(err, operation, shown\) \{[^}]*this\._failureCancelled = Boolean\(err\?\.cancelled\);/);
}

console.log("sounds.test.mjs: cues, levels, the cue decision, the player and the setting hold");
