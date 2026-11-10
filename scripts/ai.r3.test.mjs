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

// --- 2. Parameter names match only as whole tokens -------------------------
{
  for (const message of [
    "upstream connect error or disconnect/reset before headers",
    "Bad request from upstream provider: streaming backend overthinking",
    "The developers of this gateway rejected the request: context too long"
  ]) {
    useEndpoint(message.includes("developers") ? OPENAI : LOCAL);
    const bodies = stubFetch(() => bad400(message));
    const { error } = await settle(testProviderConnection());
    assert.equal(bodies.length, 1, `"${message}": one POST, nothing dropped`);
    assert.ok(error instanceof AIRequestError);
    assert.match(error.message, /^SIMPLYSF2E\.Errors\.ApiError:/);
    assert.ok(error.message.includes(message.slice(0, 20)), "the provider error surfaces");
  }
  // A quoted parameter name still negotiates, and "stream" survives it.
  useEndpoint();
  const quoted = stubFetch((body) => ("stream_options" in body ? bad400("Unsupported parameter: 'stream_options'") : jsonOk()));
  await testProviderConnection();
  assert.equal(quoted.length, 2);
  assert.equal("stream_options" in quoted[1], false, "stream_options dropped");
  assert.equal(quoted[1].stream, true, "stream kept");
  // A backticked name and a bare word also negotiate.
  useEndpoint();
  const ticked = stubFetch((body) => ("stream" in body ? bad400("`stream` is not supported by this model") : jsonOk()));
  await testProviderConnection();
  assert.equal(ticked.length, 2);
  assert.equal("stream" in ticked[1], false, "stream dropped");
  assert.equal("stream_options" in ticked[1], true, "stream_options kept: only the named field goes");
  // The developer role falls back only when "developer" is a whole word.
  useEndpoint(OPENAI);
  const role = stubFetch((body) => (body.messages[0].role === "developer" ? bad400("Invalid value: 'developer'. Supported roles: system, user.") : jsonOk()));
  await testProviderConnection();
  assert.equal(role.length, 2);
  assert.equal(role[1].messages[0].role, "system");
}

// --- 3. Rejected parameters are remembered per endpoint + model ------------
{
  const picky = (body) => {
    if ("reasoning_effort" in body) return bad400("Unrecognized request argument supplied: reasoning_effort");
    if ("stream_options" in body) return bad400("Unsupported parameter: 'stream_options'");
    return jsonOk();
  };
  useEndpoint(LOCAL, "model-a");
  const first = stubFetch(picky);
  await testProviderConnection();
  assert.equal(first.length, 3, "the first logical request negotiates twice");
  const second = stubFetch(picky);
  await testProviderConnection();
  assert.equal(second.length, 1, "the next request to the same URL + model sends one POST");
  assert.equal("reasoning_effort" in second[0], false);
  assert.equal("stream_options" in second[0], false);
  assert.equal(second[0].max_tokens, 64, "the token cap is still present");
  assert.equal(second[0].stream, true);

  settings.set(SETTINGS.model, "model-b");
  const otherModel = stubFetch(picky);
  await testProviderConnection();
  assert.equal(otherModel.length, 3, "a different model starts fresh");
  settings.set(SETTINGS.apiBaseUrl, "http://localhost:8080/v1");
  settings.set(SETTINGS.model, "model-a");
  const otherUrl = stubFetch(picky);
  await testProviderConnection();
  assert.equal(otherUrl.length, 3, "a different URL starts fresh");
  settings.set(SETTINGS.apiBaseUrl, LOCAL);
  const back = stubFetch(picky);
  await testProviderConnection();
  assert.equal(back.length, 1, "the first key is still remembered");

  // The cap swap and the developer role are remembered too.
  useEndpoint(OPENAI, "o-model");
  const strict = (body) => {
    if (body.messages[0].role === "developer") return bad400("Invalid value: 'developer'.");
    if ("max_completion_tokens" in body) return bad400("Unsupported parameter: 'max_completion_tokens'");
    return jsonOk();
  };
  const learn = stubFetch(strict);
  await testProviderConnection();
  assert.equal(learn.length, 3);
  const reuse = stubFetch(strict);
  await testProviderConnection();
  assert.equal(reuse.length, 1, "remembered role and cap name: one POST");
  assert.equal(reuse[0].messages[0].role, "system");
  assert.equal(reuse[0].max_tokens, 64, "the cap moved to max_tokens, never removed");
  assert.equal("max_completion_tokens" in reuse[0], false);

  // A remembered cap name that the provider later rejects too stops with its error, still capped.
  const both = stubFetch((body) => (hasCap(body) ? bad400("Unsupported parameter: 'max_tokens'") : jsonOk()));
  const { error } = await settle(testProviderConnection());
  assert.equal(both.length, 1);
  assert.ok(both.every(hasCap));
  assert.match(error.message, /^SIMPLYSF2E\.Errors\.ApiError:/);
  assert.equal(typeof ai.resetProviderParameterMemory, "function");
}

// --- 4. Tokens streamed before a failure are charged once -------------------
{
  useEndpoint();
  const streamed = "x".repeat(4000); // no JSON punctuation: estimate is chars / 4
  // One chunk, then the body stays open until the request signal aborts.
  const stalling = (init) => {
    let n = 0;
    return new Response(new ReadableStream({
      pull(c) {
        if (n++ === 0) { c.enqueue(delta(streamed)); return; }
        return new Promise((resolve) => {
          const abort = () => { c.error(new DOMException("Aborted", "AbortError")); resolve(); };
          if (init.signal.aborted) abort();
          else init.signal.addEventListener("abort", abort, { once: true });
        });
      }
    }), { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  const run = async (trigger) => {
    const ac = new AbortController();
    let posts = 0;
    globalThis.fetch = async (_url, init) => { posts += 1; return stalling(init); };
    const outcome = await withFakeTime((clock) => {
      beginRunBudget(ac.signal, { tokenBudget: 1e9, deadlineMs: trigger === "deadline" ? 50 : 0, now: clock.now });
      if (trigger === "cancel") clock.at(20, () => ac.abort());
      return chooseSpellFocus({ concept, tradition: "arcane", signal: ac.signal });
    });
    return { ...outcome, posts, spent: getRunBudget(ac.signal).tokensSpent };
  };
  for (const [trigger, pattern] of [["idle", /Timeout/], ["cancel", /Cancelled/], ["deadline", /RunDeadline/]]) {
    const { error, posts, spent } = await run(trigger);
    assert.ok(error instanceof AIRequestError, `${trigger}: AIRequestError`);
    assert.match(error.message, pattern, `${trigger}: classification unchanged`);
    assert.equal(posts, 1);
    assert.equal(error.usage?.estimated, true, `${trigger}: usage attached and estimated`);
    assert.equal(error.usage.completion, estimateTokens(streamed), `${trigger}: streamed text is charged`);
    assert.ok(error.usage.prompt > 0, `${trigger}: the prompt is charged`);
    assert.equal(spent, error.usage.total, `${trigger}: the run budget holds exactly the attached usage`);
  }

  // A connect failure sends nothing billable: nothing is charged.
  {
    const ac = new AbortController();
    beginRunBudget(ac.signal, { tokenBudget: 1e9, deadlineMs: 0 });
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    const { error } = await settle(chooseSpellFocus({ concept, tradition: "arcane", signal: ac.signal }));
    assert.match(error.message, /NetworkError/);
    assert.equal(getRunBudget(ac.signal).tokensSpent, 0, "connect failure charges nothing");
    assert.equal(error.usage?.total ?? 0, 0);
  }
  // A rejected HTTP status (no completion produced) charges nothing.
  {
    const ac = new AbortController();
    beginRunBudget(ac.signal, { tokenBudget: 1e9, deadlineMs: 0 });
    globalThis.fetch = async () => new Response("no", { status: 401 });
    await settle(chooseSpellFocus({ concept, tradition: "arcane", signal: ac.signal }));
    assert.equal(getRunBudget(ac.signal).tokensSpent, 0, "an HTTP error charges nothing");
  }
  // Success with exact usage: charged exactly once.
  {
    const ac = new AbortController();
    beginRunBudget(ac.signal, { tokenBudget: 1e9, deadlineMs: 0 });
    globalThis.fetch = async () => new Response(new ReadableStream({
      start(c) {
        c.enqueue(delta('{"keywords":["fire"]}'));
        c.enqueue(sseRecord({ choices: [], usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 } }));
        c.enqueue(enc.encode("data: [DONE]\n\n"));
        c.close();
      }
    }), { status: 200, headers: { "content-type": "text/event-stream" } });
    const result = await chooseSpellFocus({ concept, tradition: "arcane", signal: ac.signal });
    assert.deepEqual(result.keywords, ["fire"]);
    assert.equal(result.usage.total, 18);
    assert.equal(getRunBudget(ac.signal).tokensSpent, 18, "success charges exactly once");
  }
  // A truncated reply followed by a good one: each attempt charged once.
  {
    const ac = new AbortController();
    beginRunBudget(ac.signal, { tokenBudget: 1e9, deadlineMs: 0 });
    const replies = [
      { choices: [{ message: { content: '{"keywords":["fi' }, finish_reason: "length" }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } },
      { choices: [{ message: { content: '{"keywords":["fire"]}' }, finish_reason: "stop" }], usage: { prompt_tokens: 11, completion_tokens: 5, total_tokens: 16 } }
    ];
    globalThis.fetch = async () => new Response(JSON.stringify(replies.shift()), { status: 200, headers: { "content-type": "application/json" } });
    const result = await chooseSpellFocus({ concept, tradition: "arcane", signal: ac.signal });
    assert.equal(result.usage.total, 46);
    assert.equal(getRunBudget(ac.signal).tokensSpent, 46, "truncated + success: 30 + 16");
  }
}

// --- 5. A mid-stream network drop is a localized AIRequestError -------------
{
  useEndpoint();
  const ac = new AbortController();
  beginRunBudget(ac.signal, { tokenBudget: 1e9, deadlineMs: 0 });
  let posts = 0;
  globalThis.fetch = async () => {
    posts += 1;
    let n = 0;
    return new Response(new ReadableStream({
      pull(c) {
        if (n++ === 0) c.enqueue(delta("x".repeat(400)));
        else c.error(new TypeError("network error"));
      }
    }), { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  const { error } = await settle(chooseSpellFocus({ concept, tradition: "arcane", signal: ac.signal }));
  assert.ok(error instanceof AIRequestError, "a mid-stream TypeError is wrapped");
  assert.match(error.message, /^SIMPLYSF2E\.Errors\.NetworkError:/, "same key as a connect-time failure");
  assert.match(error.message, /network error/);
  assert.equal(error.retryable, false, "a POST that may have been billed is not retried");
  assert.equal(posts, 1);
  assert.equal(error.usage?.estimated, true, "streamed tokens attached");
  assert.equal(getRunBudget(ac.signal).tokensSpent, error.usage.total);
}

// --- 6. The stream is released when the request fails ------------------------
{
  useEndpoint();
  let released = false;
  let requestSignal = null;
  globalThis.fetch = async (_url, init) => {
    requestSignal = init.signal;
    let n = 0;
    return new Response(new ReadableStream({
      pull(c) {
        if (n++ === 0) {
          c.enqueue(delta("partial"));
          c.enqueue(sseRecord({ error: { message: "Insufficient credits" } }));
          return;
        }
        return new Promise(() => {}); // the provider keeps the socket open
      },
      cancel() { released = true; }
    }), { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  const ac = new AbortController();
  const { error } = await settle(chooseSpellFocus({ concept, tradition: "arcane", signal: ac.signal }));
  assert.ok(error instanceof AIRequestError);
  assert.match(error.message, /^SIMPLYSF2E\.Errors\.ProviderError:/, "the provider's error, not Cancelled or Timeout");
  assert.match(error.message, /Insufficient credits/);
  assert.notEqual(error.cancelled, true);
  assert.equal(ac.signal.aborted, false, "the run's own signal is untouched");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(released, true, "the response body was cancelled");
  assert.equal(requestSignal.aborted, true, "the request's internal controller was aborted");

  // A success leaves the request signal alone.
  globalThis.fetch = async (_url, init) => { requestSignal = init.signal; return jsonOk('{"keywords":["fire"]}'); };
  await chooseSpellFocus({ concept, tradition: "arcane", signal: new AbortController().signal });
  assert.equal(requestSignal.aborted, false, "a completed request is not aborted");
}
console.log("ai.r3.test.mjs: ok");
