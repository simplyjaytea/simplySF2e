import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";

const settings = new Map([
  [SETTINGS.apiBaseUrl, "http://localhost:11434/v1"],
  [SETTINGS.apiKey, ""],
  [SETTINGS.model, "m"],
  [SETTINGS.requestTimeout, 90]
]);

globalThis.game = {
  settings: { get: (_m, key) => settings.get(key) },
  i18n: { localize: (k) => k, format: (k, d) => `${k}:${JSON.stringify(d)}` }
};

// 429 then 200
{
  const replies = [
    { status: 429, body: { error: { message: "rate" } } },
    { status: 200, body: { data: [{ id: "m1" }] } }
  ];
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    const r = replies.shift();
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
  };
  const { listProviderModels } = await import("./ai.mjs");
  const models = await listProviderModels();
  assert.deepEqual(models, ["m1"]);
  assert.equal(calls, 2, "429 must be retried once");
}

// 401 not retried
{
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ error: { message: "unauth" } }), { status: 401, headers: { "content-type": "application/json" } }); };
  const { listProviderModels } = await import("./ai.mjs");
  await assert.rejects(listProviderModels());
  assert.equal(calls, 1, "401 must not retry");
}

console.log("ai.models tests passed");
