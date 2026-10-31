import assert from "node:assert/strict";
import { fetchWithBackoff } from "./ai-transport.mjs";

for (const status of [429, 500, 503]) {
  const calls = [];
  const options = { method: "POST", body: "same" };
  const result = await fetchWithBackoff("https://example.test", options, {
    delayMs: 0,
    fetchImpl: async (url, init) => {
      calls.push([url, init]);
      return { status: calls.length === 1 ? status : 200 };
    }
  });
  assert.equal(result.status, 200);
  assert.deepEqual(calls, [["https://example.test", options], ["https://example.test", options]]);
}

for (const status of [200, 400, 401, 404]) {
  let calls = 0;
  const result = await fetchWithBackoff("url", {}, { delayMs: 0, fetchImpl: async () => { calls++; return { status }; } });
  assert.equal(result.status, status);
  assert.equal(calls, 1);
}

{
  let calls = 0;
  const response = { status: 429, headers: { get: () => "60" } };
  assert.equal(await fetchWithBackoff("url", {}, { fetchImpl: async () => { calls++; return response; } }), response);
  assert.equal(calls, 1, "a long Retry-After returns the original response without an early retry");
}

{
  let calls = 0;
  let cancelled = false;
  await fetchWithBackoff("url", {}, { delayMs: 0, fetchImpl: async () => {
    calls++;
    return calls === 1 ? { status: 503, headers: { get: () => "0" }, body: { cancel: async () => { cancelled = true; } } } : { status: 200 };
  } });
  assert.equal(cancelled, true, "discarded response body is released");
}

{
  const controller = new AbortController();
  let calls = 0;
  const pending = fetchWithBackoff("url", { signal: controller.signal }, {
    delayMs: 10000, fetchImpl: async () => { calls++; return { status: 429 }; }
  });
  await Promise.resolve();
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(calls, 1);
}
console.log("ai-transport tests passed");
