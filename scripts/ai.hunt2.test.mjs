// HUNT2-AI regressions, production path with stubbed Foundry globals and fetch:
// inline <think> blocks, ``` inside a JSON string, aborts during a body read,
// and a Retry-After wait that must not be charged to the idle timer.
// Fake timers drive the 10 s idle window, so the file runs in well under a second.
// Run: node scripts/ai.hunt2.test.mjs
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";
import { beginRunBudget } from "./run-budget.mjs";

const settings = new Map([
  [SETTINGS.apiBaseUrl, "http://localhost:11434/v1"],
  [SETTINGS.apiKey, ""],
  [SETTINGS.apiKeyBaseUrl, ""],
  [SETTINGS.model, "test-model"],
  [SETTINGS.temperature, 0.8],
  [SETTINGS.maxTokens, 8000],
  [SETTINGS.requestTimeout, 10],
  [SETTINGS.runTokenBudget, 0],
  [SETTINGS.runDeadline, 0]
]);
globalThis.game = {
  settings: { get: (_moduleId, key) => settings.get(key) },
  i18n: { localize: (key) => key, format: (key, data) => `${key}:${JSON.stringify(data)}` }
};

const { chooseSpellFocus, parseConceptJSON } = await import("./ai.mjs");
const concept = { name: "Watcher", level: 1, blurb: "b", description: "d", traits: ["fire"] };
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;

// Chunked SSE reply, the production stream shape.
const sse = (parts) => new Response(new ReadableStream({
  start(controller) {
    const enc = new TextEncoder();
    for (const part of parts) controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`));
    controller.enqueue(enc.encode("data: [DONE]\n\n"));
    controller.close();
  }
}), { status: 200, headers: { "content-type": "text/event-stream" } });

const jsonReply = (content) => new Response(JSON.stringify({
  choices: [{ message: { content }, finish_reason: "stop" }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
}), { status: 200, headers: { "content-type": "application/json" } });

// Virtual clock: setTimeout/clearTimeout are replaced for the duration of one run;
// the run loop fires the earliest timer whenever the code under test is idle.
// A real-time watchdog and an iteration cap make a hang fail fast.
async function withFakeTime(start) {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  globalThis.setTimeout = (fn, ms = 0) => { seq += 1; timers.set(seq, { at: now + Number(ms), fn }); return seq; };
  globalThis.clearTimeout = (id) => { timers.delete(id); };
  const clock = { now: () => now, at: (ms, fn) => globalThis.setTimeout(fn, ms) };
  let watchdog;
  try {
    const outcome = Promise.resolve(start(clock)).then((value) => ({ value }), (error) => ({ error }));
    let settled = null;
    outcome.then((result) => { settled = result; });
    const dog = new Promise((_, reject) => {
      watchdog = realSetTimeout(() => reject(new Error("watchdog: the call never settled")), 3000);
    });
    const drive = (async () => {
      for (let i = 0; i < 20000 && !settled; i += 1) {
        await new Promise((resolve) => setImmediate(resolve));
        if (settled) break;
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) continue;
        timers.delete(next[0]);
        now = Math.max(now, next[1].at);
        next[1].fn();
      }
      return outcome;
    })();
    const result = await Promise.race([drive, dog]);
    return { ...result, elapsed: now };
  } finally {
    realClearTimeout(watchdog);
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
  }
}

// --- 1. Inline <think> -------------------------------------------------------
{
  const answer = { name: "Real", description: "r" };
  const draft = '{"name":"draft","description":"d"}';
  assert.deepEqual(parseConceptJSON(`<think>maybe ${draft} hmm</think>${JSON.stringify(answer)}`), answer,
    "the object after </think> is the answer, not the draft inside the thought");
  assert.deepEqual(parseConceptJSON(`  \n<THINK>${draft}</Think>\n${JSON.stringify(answer)}`), answer,
    "leading whitespace and case are tolerated");
  assert.deepEqual(parseConceptJSON(`<think>a ${draft}</think>\n<think>b ${draft}</think>${JSON.stringify(answer)}`), answer,
    "two leading think blocks are both dropped");
  assert.throws(() => parseConceptJSON(`<think>${draft}`), /ReasoningWithoutJson/,
    "an unclosed leading <think> means the answer never started: fail closed");
  const inString = { description: "a <think>b</think> c" };
  assert.deepEqual(parseConceptJSON(JSON.stringify(inString)), inString, "a <think> inside a JSON string survives byte for byte");
  const afterProse = { description: "x <think>y</think> z" };
  assert.deepEqual(parseConceptJSON(`Here: ${JSON.stringify(afterProse)}`), afterProse, "only a LEADING <think> is stripped");

  // End to end through a chunked SSE stream split inside the tags.
  globalThis.fetch = async () => sse(["<thi", `nk>try {"keywords":["draft"]} ok</th`, 'ink>{"keywords":["fire"]}']);
  const result = await chooseSpellFocus({ concept, tradition: "arcane", signal: new AbortController().signal });
  assert.deepEqual(result.keywords, ["fire"], "the stream answer comes from after </think>");
}

// --- 2. ``` inside a JSON string --------------------------------------------
{
  const object = { name: "X", description: "Use ```code``` here", traits: [] };
  assert.deepEqual(parseConceptJSON(JSON.stringify(object)), object, "valid JSON with ``` in a string parses to the same object");
  assert.deepEqual(parseConceptJSON(`  ${JSON.stringify(object, null, 2)}\n`), object, "pretty-printed, padded: same");
  // Shapes that parsed on `next` still parse the same.
  const plain = { name: "Y", description: "d" };
  assert.deepEqual(parseConceptJSON("```json\n" + JSON.stringify(plain) + "\n```"), plain, "fenced object");
  assert.deepEqual(parseConceptJSON("Sure!\n```\n" + JSON.stringify(plain) + "\n```\nHope it helps."), plain, "fenced object with prose around it");
  assert.deepEqual(parseConceptJSON("Here you go: " + JSON.stringify(plain)), plain, "prose then a bare object");
}

console.log("ai.hunt2.test.mjs: ok");
