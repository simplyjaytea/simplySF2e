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

// A provider that sends deltas AND an echoed full message must not double the text.
// Two deltas plus an earlier partial message copy: preferring the message would
// silently truncate the answer, which is the failure this guards.
assert.equal(
  sseToProviderPayload(
    chunk("{\"a\":") + chunk("1}") + `data: ${JSON.stringify({ choices: [{ message: { content: "{" } }] })}\n\n`
  ).choices[0].message.content,
  "{\"a\":1}",
  "streamed deltas win over an earlier message copy"
);
// Some relays attach a benign `error: {}` to every chunk; that is not a failure.
assert.equal(
  sseToProviderPayload(`data: ${JSON.stringify({ choices: [{ delta: { content: "{}" } }], error: {} })}\n\n`).choices[0].message.content,
  "{}",
  "an empty provider error object must not abort the recording"
);
// A message-only stream still yields its content.
assert.equal(
  sseToProviderPayload(`data: ${JSON.stringify({ choices: [{ message: { content: "{\"b\":2}" }, finish_reason: "stop" }] })}\n\n`).choices[0].message.content,
  "{\"b\":2}"
);
// Content-part arrays are read like production's visibleTextContent, not dropped.
assert.equal(
  sseToProviderPayload(`data: ${JSON.stringify({ choices: [{ delta: { content: [{ type: "text", text: "{\"c\":" }, { type: "text", text: "3}" }] } }] })}\n\n`).choices[0].message.content,
  "{\"c\":3}",
  "array content parts are concatenated, not truncated"
);

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
await assert.rejects(
  recordFixture({ id: "x", task: "creatureConcept", args: {}, baseUrl: "https://example.test/v1", model: "m", apiKey: "k", fetchImpl: async () => { requested += 1; } }),
  /non-empty --args/,
  "an empty args object must not be recorded as a paid call"
);
assert.equal(requested, 0, "no request may be made without args");

// A retried run captures every exchange: the fixture must replay the sequence,
// not claim a single request and drop the first reply.
const retryQueue = [
  { choices: [{ message: { content: "{\"nope\":true}" }, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } },
  conceptPayload
];
const captured = await recordFixture({
  id: "live-retry", task: "creatureConcept", args: conceptArgs,
  baseUrl: "https://example.test/v1", model: "test-model", apiKey: FAKE_KEY,
  fetchImpl: async () => jsonResponse(retryQueue.shift())
});
assert.equal(captured.responses.length, 2, "a retried run records both provider exchanges");
assert.equal(captured.expect.requestCount, 2, "the fixture replays the same request count");
assert.equal(captured.responses[1].choices[0].message.content, conceptPayload.choices[0].message.content);

// A failed capture still restores the globals.
await assert.rejects(
  recordFixture({
    id: "live-throw", task: "creatureConcept", args: conceptArgs,
    baseUrl: "https://example.test/v1", model: "test-model", apiKey: FAKE_KEY,
    fetchImpl: async () => { throw new Error("network down"); }
  }),
  /Errors\.NetworkError/
);
assert.equal(globalThis.fetch, realFetch, "fetch is restored when the capture throws");
assert.equal(globalThis.game, undefined, "game is restored when the capture throws");

// The stubbed globals are restored.
assert.equal(globalThis.game, undefined, "game is restored after a capture");
assert.equal(globalThis.fetch, realFetch, "fetch is restored after a capture");

console.log("golden-replay-record.test.mjs passed");
