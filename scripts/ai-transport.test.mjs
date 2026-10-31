import assert from "node:assert/strict";
import { fetchWithBackoff } from "./ai-transport.mjs";

function response(status, { retryAfter } = {}) {
  const headers = {
    get(name) {
      if (String(name).toLowerCase() === "retry-after" && retryAfter != null) return String(retryAfter);
      return null;
    }
  };
  return { status, headers };
}

// Transient statuses retry once.
for (const status of [429, 502, 503, 504]) {
  const calls = [];
  const options = { method: "POST", body: "same" };
  const result = await fetchWithBackoff("https://example.test", options, {
    delayMs: 0,
    fetchImpl: async (url, init) => {
      calls.push([url, init]);
      return calls.length === 1 ? response(status) : response(200);
    }
  });
  assert.equal(result.status, 200, `status ${status} should retry`);
  assert.equal(calls.length, 2, `status ${status} should make 2 calls`);
  assert.deepEqual(calls[0][1], options);
  assert.deepEqual(calls[1][1], options);
}

// Non-retryable statuses make a single request.
for (const status of [200, 400, 401, 404, 418]) {
  let calls = 0;
  const result = await fetchWithBackoff("url", {}, {
    delayMs: 0,
    fetchImpl: async () => { calls++; return response(status); }
  });
  assert.equal(result.status, status);
  assert.equal(calls, 1, `status ${status} should not retry`);
}

// Ambiguous 5xx without Retry-After is not retried (may already be billed).
{
  let calls = 0;
  const result = await fetchWithBackoff("url", {}, {
    delayMs: 0,
    fetchImpl: async () => { calls++; return response(500); }
  });
  assert.equal(result.status, 500);
  assert.equal(calls, 1, "500 without Retry-After must not retry");
}

// 5xx with Retry-After is retried.
{
  const calls = [];
  const result = await fetchWithBackoff("url", {}, {
    delayMs: 0,
    fetchImpl: async () => {
      calls.push(1);
      return calls.length === 1 ? response(500, { retryAfter: 0 }) : response(200);
    }
  });
  assert.equal(result.status, 200);
  assert.equal(calls.length, 2, "500 with Retry-After should retry");
}

// Pre-aborted signal never fetches.
{
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    fetchWithBackoff("url", { signal: controller.signal }, {
      delayMs: 0,
      fetchImpl: async () => { calls++; return response(429); }
    }),
    { name: "AbortError" }
  );
  assert.equal(calls, 0, "pre-aborted signal must not fetch");
}

// Abort during the wait rejects and does not issue the retry.
{
  const controller = new AbortController();
  let calls = 0;
  const pending = fetchWithBackoff("url", { signal: controller.signal }, {
    delayMs: 10000,
    fetchImpl: async () => { calls++; return response(429); }
  });
  // Let the first fetch resolve and the wait begin.
  await new Promise((resolve) => setTimeout(resolve, 20));
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(calls, 1, "abort during wait must not issue retry");
}

// Exhausted retry budget prevents a retry even on a transient status.
{
  let calls = 0;
  const result = await fetchWithBackoff("url", {}, {
    delayMs: 0,
    retryBudget: { remaining: 0 },
    fetchImpl: async () => { calls++; return response(429); }
  });
  assert.equal(result.status, 429);
  assert.equal(calls, 1, "exhausted budget must not retry");
}

// Retry-After is honored: a budget with remaining retries waits instead of
// failing immediately. (Timing is bounded by maxDelayMs.)
{
  const calls = [];
  const result = await fetchWithBackoff("url", {}, {
    delayMs: 0,
    maxDelayMs: 1000,
    fetchImpl: async () => {
      calls.push(1);
      return calls.length === 1 ? response(429, { retryAfter: 0 }) : response(200);
    }
  });
  assert.equal(result.status, 200);
  assert.equal(calls.length, 2);
}

// Budget is consumed by a retry.
{
  const budget = { remaining: 1 };
  const calls = [];
  await fetchWithBackoff("url", {}, {
    delayMs: 0,
    retryBudget: budget,
    fetchImpl: async () => {
      calls.push(1);
      return calls.length === 1 ? response(429) : response(200);
    }
  });
  assert.equal(budget.remaining, 0, "budget must be consumed");
}

console.log("ai-transport tests passed");