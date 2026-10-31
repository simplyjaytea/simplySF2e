// Golden-replay recorder: SSE reconstruction and live capture, offline.
// Proves the recorder can turn a real streaming OR non-streaming reply into a
// fixture, and that it never writes the API key into one.
// Run: node scripts/golden-replay-record.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildFixture, recordFixture, sseToProviderPayload } from "../tools/golden-replay/record.mjs";

const creatureFixture = JSON.parse(readFileSync(
  fileURLToPath(new URL("../tools/golden-replay/fixtures/creature-concept.json", import.meta.url)),
  "utf8"
));
const conceptPayload = creatureFixture.responses[0];
const conceptArgs = creatureFixture.args;
const FAKE_KEY = "sk-test-not-a-real-key";

// --- SSE reconstruction -----------------------------------------------------
const chunk = (content, extra = {}) => `data: ${JSON.stringify({
  choices: [{ delta: { content }, ...(extra.finish ? { finish_reason: "stop" } : {}) }]
})}\n\n`;
const usageChunk = `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 11, completion_tokens: 22, total_tokens: 33 } })}\n\n`;
const reasoningChunk = `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "thinking..." } }] })}\n\n`;

const sse = chunk("{\"name\":\"A") + reasoningChunk + chunk("sh\",") + chunk(" \"blurb\":\"b\"}", { finish: true }) + usageChunk + "data: [DONE]\n\n";
const rebuilt = sseToProviderPayload(sse);
assert.equal(rebuilt.choices[0].message.content, "{\"name\":\"Ash\", \"blurb\":\"b\"}", "deltas concatenate; reasoning is ignored");
assert.equal(rebuilt.choices[0].finish_reason, "stop");
assert.deepEqual(rebuilt.usage, { prompt_tokens: 11, completion_tokens: 22, total_tokens: 33 });

// A message-shaped final chunk also works, and a missing usage block is omitted.
assert.equal(
  sseToProviderPayload(`data: ${JSON.stringify({ choices: [{ message: { content: "{}" }, finish_reason: "length" }] })}\n\n`).choices[0].finish_reason,
  "length"
);
assert.equal(Object.hasOwn(sseToProviderPayload(`data: ${JSON.stringify({ choices: [{ delta: { content: "{}" } }] })}\n\n`), "usage"), false);

// Fail closed: empty content and an in-stream provider error both throw.
assert.throws(() => sseToProviderPayload(""), /no message content/);
assert.throws(() => sseToProviderPayload("data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"x\"}}]}\n\n"), /no message content/);
assert.throws(
  () => sseToProviderPayload(`data: ${JSON.stringify({ error: { message: "insufficient credits" } })}\n\n`),
  /provider stream error/
);

// --- Fixture shaping --------------------------------------------------------
const fixture = buildFixture({ id: "live-x", task: "creatureConcept", args: conceptArgs, payload: conceptPayload, note: " recorded from model M on 2026-11-01 " });
assert.deepEqual(Object.keys(fixture), ["id", "task", "note", "args", "responses", "expect"]);
assert.equal(fixture.note, "recorded from model M on 2026-11-01", "the note is trimmed");
assert.deepEqual(fixture.expect, { ok: true, requestCount: 1 });
assert.deepEqual(fixture.responses, [conceptPayload]);
assert.throws(() => buildFixture({ task: "creatureConcept", args: {}, payload: conceptPayload }), /id is required/);
assert.throws(() => buildFixture({ id: "x", task: "notATask", args: {}, payload: conceptPayload }), /no recordable production entry point/);
assert.throws(() => buildFixture({ id: "x", task: "creatureConcept", args: null, payload: conceptPayload }), /args must be an object/);
assert.throws(() => buildFixture({ id: "x", task: "creatureConcept", args: {}, payload: {} }), /payload must be a provider reply/);

// --- Live capture, stubbed transport ---------------------------------------
const realFetch = globalThis.fetch;
const jsonResponse = (payload) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: { "content-type": "application/json" }
});
const sseResponse = (body) => new Response(body, {
  status: 200,
  headers: { "content-type": "text/event-stream" }
});
const sseFromPayload = (payload) => {
  const content = payload.choices[0].message.content;
  const mid = Math.floor(content.length / 2);
  return chunk(content.slice(0, mid)) + chunk(content.slice(mid), { finish: true }) + usageChunk + "data: [DONE]\n\n";
};

const capturedJson = await recordFixture({
  id: "live-json", task: "creatureConcept", args: conceptArgs,
  baseUrl: "https://example.test/v1", model: "test-model", apiKey: FAKE_KEY,
  fetchImpl: async () => jsonResponse(conceptPayload)
});
assert.equal(capturedJson.responses[0].choices[0].message.content, conceptPayload.choices[0].message.content);
assert.equal(capturedJson.task, "creatureConcept");
assert.ok(!JSON.stringify(capturedJson).includes(FAKE_KEY), "the API key must never reach a fixture");

const capturedSse = await recordFixture({
  id: "live-sse", task: "creatureConcept", args: conceptArgs,
  baseUrl: "https://example.test/v1", model: "test-model", apiKey: FAKE_KEY,
  fetchImpl: async () => sseResponse(sseFromPayload(conceptPayload))
});
assert.equal(
  capturedSse.responses[0].choices[0].message.content,
  conceptPayload.choices[0].message.content,
  "a streamed reply is reconstructed into the same concept"
);
assert.deepEqual(capturedSse.responses[0].usage, { prompt_tokens: 11, completion_tokens: 22, total_tokens: 33 });
assert.ok(!JSON.stringify(capturedSse).includes(FAKE_KEY));

// Missing credentials fail before any request.
let requested = 0;
await assert.rejects(
  recordFixture({ id: "x", task: "creatureConcept", args: conceptArgs, baseUrl: "https://example.test/v1", model: "m", apiKey: "", fetchImpl: async () => { requested += 1; } }),
  /API key is required/
);
await assert.rejects(
  recordFixture({ id: "x", task: "creatureConcept", args: conceptArgs, baseUrl: "", model: "m", apiKey: "k", fetchImpl: async () => { requested += 1; } }),
  /base URL is required/
);
assert.equal(requested, 0, "no request may be made without credentials");

// The stubbed globals are restored.
assert.equal(globalThis.game, undefined, "game is restored after a capture");
assert.equal(globalThis.fetch, realFetch, "fetch is restored after a capture");

console.log("golden-replay-record.test.mjs passed");
