// Production-path run budget: a spent budget stops the run before any provider
// request, a failed attempt still costs tokens, and an elapsed deadline reports
// itself instead of the idle timeout. Stubs only the Foundry globals and fetch.
// Run: node scripts/ai.runBudget.test.mjs
import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";
import { beginRunBudget, spendRunTokens, getRunBudget } from "./run-budget.mjs";

const settings = new Map([
  [SETTINGS.apiBaseUrl, "http://localhost:11434/v1"],
  [SETTINGS.apiKey, ""],
  [SETTINGS.apiKeyBaseUrl, ""],
  [SETTINGS.model, "test-model"],
  [SETTINGS.temperature, 0.8],
  [SETTINGS.maxTokens, 8000],
  [SETTINGS.requestTimeout, 90],
  [SETTINGS.runTokenBudget, 60000],
  [SETTINGS.runDeadline, 0]
]);

globalThis.game = {
  settings: { get: (_moduleId, key) => settings.get(key) },
  i18n: {
    localize: (key) => key,
    format: (key, data) => `${key}:${JSON.stringify(data)}`
  }
};

const provider = (content, finishReason = "stop", total = 2) => ({
  choices: [{ message: { content }, finish_reason: finishReason }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: total }
});

// A fresh queue per case: a leftover reply from an earlier case would let a
// later assertion pass without exercising the code it claims to test.
let queue = [];
let calls = 0;
const queueResponses = (replies) => { queue = replies.slice(); calls = 0; };
globalThis.fetch = async () => {
  calls += 1;
  const reply = queue.shift();
  assert.ok(reply, "unexpected provider request: this case should not reach the network");
  return new Response(JSON.stringify(reply), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
};

const { chooseSpellFocus } = await import("./ai.mjs");
const concept = { name: "Watcher", level: 1, blurb: "b", description: "d", traits: ["fire"] };
const args = (signal) => ({ concept, tradition: "arcane", signal });

// (a) A spent budget makes no provider request and fails closed without retrying.
{
  const sig = new AbortController().signal;
  beginRunBudget(sig, { tokenBudget: 5, deadlineMs: 0 });
  spendRunTokens(sig, { total: 5 });
  queueResponses([provider('{"keywords":["fire"]}')]);
  await assert.rejects(chooseSpellFocus(args(sig)), (err) => {
    assert.equal(err.retryable, false);
    assert.equal(err.runLimit, true);
    assert.match(err.message, /RunBudgetExceeded/);
    assert.match(err.message, /5/);
    return true;
  });
  assert.equal(calls, 0);
}

// (b) Without a budget entry the run behaves exactly as before.
{
  const sig = new AbortController().signal;
  queueResponses([provider('{"keywords":["fire","control"]}')]);
  const result = await chooseSpellFocus(args(sig));
  assert.deepEqual(result.keywords, ["fire", "control"]);
  assert.equal(calls, 1);
  assert.equal(getRunBudget(sig), null);
}

// (c) Usage from a truncated attempt still counts against the run: 5 + 2 tokens.
{
  const sig = new AbortController().signal;
  beginRunBudget(sig, { tokenBudget: 1000, deadlineMs: 0 });
  queueResponses([
    provider('{"keywords":["fire"', "length", 5),
    provider('{"keywords":["fire","control"]}', "stop", 2)
  ]);
  const result = await chooseSpellFocus(args(sig));
  assert.deepEqual(result.keywords, ["fire", "control"]);
  assert.equal(calls, 2);
  assert.equal(getRunBudget(sig).tokensSpent, 7);
}

// (d) An elapsed deadline reports the deadline, not the idle timeout.
{
  let clock = 0;
  const sig = new AbortController().signal;
  beginRunBudget(sig, { tokenBudget: 1000, deadlineMs: 500, now: () => clock });
  clock = 1000; // the run deadline has passed before the next call
  queueResponses([provider('{"keywords":["fire"]}')]);
  await assert.rejects(chooseSpellFocus(args(sig)), (err) => {
    assert.match(err.message, /RunDeadline/);
    assert.equal(err.retryable, false);
    assert.equal(err.runLimit, true);
    return true;
  });
  assert.equal(calls, 0);
}

// (e) In flight: a keep-alive stream is aborted at the run deadline. The
// deadline must be an absolute limit, not re-armed by incoming chunks, or a
// provider that keeps trickling tokens could hold the run open indefinitely.
{
  const clock = 0;
  const sig = new AbortController().signal;
  beginRunBudget(sig, { tokenBudget: 1000, deadlineMs: 60, now: () => clock });
  let chunks = 0;
  let closed = false;
  const stubbed = globalThis.fetch;
  globalThis.fetch = (_url, options) => {
    const body = new ReadableStream({
      start(controller) {
        const timer = setInterval(() => {
          if (closed) return;
          chunks += 1;
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"x"}}]}\n\n'));
        }, 10);
        options.signal?.addEventListener("abort", () => {
          closed = true;
          clearInterval(timer);
          try {
            controller.error(Object.assign(new Error("aborted"), { name: "AbortError" }));
          } catch { /* stream already closed */ }
        }, { once: true });
      }
    });
    return Promise.resolve(new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream" }
    }));
  };
  const startedAt = Date.now();
  try {
    await assert.rejects(chooseSpellFocus(args(sig)), (err) => {
      assert.match(err.message, /RunDeadline/);
      assert.equal(err.runLimit, true);
      return true;
    });
  } finally {
    globalThis.fetch = stubbed;
  }
  const elapsed = Date.now() - startedAt;
  assert.ok(chunks > 0, "the stubbed stream must have produced chunks before the deadline");
  assert.ok(elapsed < 900, `the deadline must not wait for the idle timeout (took ${elapsed}ms)`);
}

console.log("ai.runBudget.test.mjs passed");
