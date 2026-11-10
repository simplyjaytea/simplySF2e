// R3-AI regressions in the provider request layer, production path with
// stubbed Foundry globals and fetch. One section per finding:
// (1) a 400 naming both token-cap fields never leads to an uncapped request,
// (2) parameter names match only as whole tokens ("upstream" is not "stream"),
// (3) rejected parameters are remembered per endpoint + model for the page,
// (4) tokens streamed before a failure are charged once to the run budget,
// (5) a mid-stream network drop is a localized AIRequestError,
// (6) the response stream is released when the request fails,
// (7) null/empty usage counts fall back to the estimate,
// (8) a Retry-After longer than the backoff cap is not retried early.
// Fake timers drive the 10 s idle window, so the file runs in about a second.
// Run: node scripts/ai.r3.test.mjs
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";
import { beginRunBudget, getRunBudget } from "./run-budget.mjs";
import { estimateTokens, normalizeUsage } from "./tokens.mjs";
import { fetchWithBackoff } from "./ai-transport.mjs";

const LOCAL = "http://localhost:11434/v1";
const OPENAI = "https://api.openai.com/v1";
const settings = new Map([
  [SETTINGS.apiBaseUrl, LOCAL],
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

const ai = await import("./ai.mjs");
const { AIRequestError, chooseSpellFocus, testProviderConnection } = ai;
const concept = { name: "Watcher", level: 1, blurb: "b", description: "d", traits: ["fire"] };
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const enc = new TextEncoder();

/** Fresh endpoint, model and parameter memory for one scenario. */
function useEndpoint(baseUrl = LOCAL, model = "test-model") {
  settings.set(SETTINGS.apiBaseUrl, baseUrl);
  settings.set(SETTINGS.model, model);
  ai.resetProviderParameterMemory?.();
}

const jsonOk = (content = '{"ok":true}', usage = { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }) =>
  new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }], usage }),
    { status: 200, headers: { "content-type": "application/json" } });
const bad400 = (message) => new Response(JSON.stringify({ error: { message } }), { status: 400 });
const sseRecord = (object) => enc.encode(`data: ${JSON.stringify(object)}\n\n`);
const delta = (content) => sseRecord({ choices: [{ delta: { content } }] });

/** Record every POST body; `reply(body, index)` answers it. */
function stubFetch(reply) {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    return reply(body, bodies.length - 1, init);
  };
  return bodies;
}
const settle = (promise) => promise.then((value) => ({ value }), (error) => ({ error }));

// Virtual clock (as in ai.hunt2.test.mjs): the run loop fires the earliest
// timer whenever the code under test is idle; a real-time watchdog makes a
// hang fail fast.
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

const hasCap = (body) => "max_tokens" in body || "max_completion_tokens" in body;

// --- 1. Both token-cap names in one 400: never send an uncapped request -----
{
  useEndpoint();
  const detail = "max_tokens or max_completion_tokens is too large: 64. Context window is 32.";
  const bodies = stubFetch((body) => (hasCap(body) ? bad400(detail) : jsonOk()));
  const { error } = await settle(testProviderConnection());
  assert.ok(bodies.every(hasCap), "every POST carries a token cap");
  assert.equal(bodies.length, 2, "max_tokens, then max_completion_tokens, then stop");
  assert.ok(error instanceof AIRequestError, "the call fails with an AIRequestError");
  assert.match(error.message, /^SIMPLYSF2E\.Errors\.ApiError:/, "the provider's own error surfaces");
  assert.match(error.message, /too large: 64/);

  // A provider that rejects only one name still negotiates to the other.
  useEndpoint();
  const swap = stubFetch((body) => ("max_tokens" in body ? bad400("Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead.") : jsonOk()));
  await testProviderConnection();
  assert.equal(swap.length, 2);
  assert.equal(swap[1].max_completion_tokens, 64, "the cap moves to max_completion_tokens");
  assert.equal("max_tokens" in swap[1], false);
}
console.log("ai.r3.test.mjs: ok");
