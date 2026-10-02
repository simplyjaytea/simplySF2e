// Run: node scripts/jev.test.mjs
import assert from "node:assert/strict";
import {
  JEV_ENDPOINT, JEV_MODEL, buildChoiceQuestion, parseJevAnswers, requestJevDecision, resolveJevConfig
} from "./jev.mjs";
import { normalizeJevUsage } from "./tokens.mjs";

const orState = (apiKey) => ({ apiKey, provider: { id: "openrouter" } });

// default `dedicated` reads the separate Jev key setting (J1b)
{
  const store = new Map([["jevApiKey", "  stored-jev  "]]);
  globalThis.game = { settings: { get: (_m, key) => store.get(key) } };
  assert.deepEqual(
    resolveJevConfig({ provider: () => ({ apiKey: "", provider: { id: "openai" } }) }),
    { endpoint: JEV_ENDPOINT, apiKey: "stored-jev" }, "default dedicated source is the stored Jev key");
  store.set("jevApiKey", "");
  assert.equal(resolveJevConfig({ provider: () => ({ apiKey: "", provider: { id: "openai" } }) }), null);
  delete globalThis.game;
}

// resolver order
assert.equal(JEV_ENDPOINT, "https://openrouter.ai/api/v1/systemone");
assert.equal(JEV_MODEL, "typesafe/jev-1.13");
assert.deepEqual(
  resolveJevConfig({ provider: () => orState("or-key"), dedicated: () => ({ apiKey: " dedicated " }) }),
  { endpoint: JEV_ENDPOINT, apiKey: "dedicated" }, "dedicated key wins");
assert.deepEqual(
  resolveJevConfig({ provider: () => orState("or-key"), dedicated: () => null }),
  { endpoint: JEV_ENDPOINT, apiKey: "or-key" }, "OpenRouter chat key reused");
assert.equal(resolveJevConfig({ provider: () => orState(""), dedicated: () => null }), null, "unbound OpenRouter key -> null");
assert.equal(resolveJevConfig({ provider: () => ({ apiKey: "k", provider: { id: "openai" } }), dedicated: () => null }), null);
assert.equal(resolveJevConfig({ provider: () => orState("k"), dedicated: () => ({ apiKey: "  " }) }).apiKey, "k");
assert.equal(resolveJevConfig({ provider: () => { throw new Error("x"); }, dedicated: () => null }), null);
let calls = 0;
resolveJevConfig({ provider: () => { calls += 1; return orState("k"); }, dedicated: () => null });
assert.equal(calls, 1, "provider read once");

// question building
const q = buildChoiceQuestion({ instructions: "Pick one", candidates: [{ id: "a1", name: "Alpha" }, { id: "b2", name: "Beta" }] });
assert.deepEqual(q, { type: "choice", instructions: "Pick one", criteria: { a1: "Alpha", b2: "Beta" } });
const many = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `N${i}` }));
assert.ok(buildChoiceQuestion({ instructions: "x", candidates: many(255) }));
assert.equal(buildChoiceQuestion({ instructions: "x", candidates: many(256) }), null, "255 cap");
assert.equal(buildChoiceQuestion({ instructions: "x", candidates: [] }), null);
assert.equal(buildChoiceQuestion({ instructions: "x", candidates: [{ id: "a", name: "A" }, { id: "a", name: "B" }] }), null);
assert.equal(buildChoiceQuestion({ instructions: " ", candidates: many(2) }), null);

// response parsing: the cited quickstart example
const questions = {
  kind: q,
  fit: { type: "score", instructions: "Rate", criteria: ["low", "high"] },
  flag: { type: "noul", instructions: "Is it?" }
};
const cited = {
  model: "jev-1.13.0",
  answers: {
    kind: { type: "choice", choice: "a1", confidence: 0.78, probabilities: { a1: 0.78, b2: 0.22 } },
    fit: { type: "score", score: 1.0, confidence: 1.0, legend: { 0: "low", 1: "high" }, probabilities: { 0: 0, 1: 1 } },
    flag: { type: "noul", noul: 1.0 }
  },
  usage: { input_tokens: 392, output_tokens: 65 }
};
const parsed = parseJevAnswers(cited, questions);
assert.equal(parsed.kind.choice, "a1");
assert.equal(parsed.fit.score, 1);
assert.equal(parsed.flag.noul, 1);
assert.ok(parseJevAnswers(cited, ["kind", "fit", "flag"]), "id array accepted");
const clone = () => structuredClone(cited);
assert.equal(parseJevAnswers({ model: "m" }, questions), null, "missing answers");
assert.equal(parseJevAnswers(null, questions), null);
let bad = clone(); bad.answers.kind.type = "nope";
assert.equal(parseJevAnswers(bad, questions), null, "wrong type");
bad = clone(); bad.answers.kind.type = "score";
assert.equal(parseJevAnswers(bad, questions), null, "type differs from question");
bad = clone(); bad.answers.extra = { type: "noul", noul: 0 };
assert.equal(parseJevAnswers(bad, questions), null, "unknown id");
bad = clone(); delete bad.answers.flag;
assert.equal(parseJevAnswers(bad, questions), null, "missing id");
bad = clone(); bad.answers.kind.choice = "zzz";
assert.equal(parseJevAnswers(bad, questions), null, "choice outside criteria");
bad = clone(); bad.answers.kind.confidence = 7;
assert.equal(parseJevAnswers(bad, questions), null, "confidence out of range");

// usage
assert.deepEqual(normalizeJevUsage({ input_tokens: 392, output_tokens: 65, cost: 0.00002 }),
  { prompt: 392, completion: 65, total: 457, cost: 0.00002, estimated: false });
assert.equal(normalizeJevUsage({ input_tokens: 10 }).cost, null);
assert.equal(normalizeJevUsage({ input_tokens: 10 }).completion, 0);
assert.equal(normalizeJevUsage({}), null);
assert.equal(normalizeJevUsage(null), null);

// transport
const origWarn = console.warn; console.warn = () => {};
try {
  let seen;
  const ok = async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => cited }; };
  const res = await requestJevDecision({ apiKey: "sekret", state: "s", questions, fetchImpl: ok });
  assert.equal(res.model, "jev-1.13.0");
  assert.equal(res.usage.input_tokens, 392);
  assert.equal(typeof res.ms, "number");
  assert.equal(seen.url, JEV_ENDPOINT);
  assert.equal(seen.init.headers.Authorization, "Bearer sekret");
  assert.deepEqual(JSON.parse(seen.init.body), { model: JEV_MODEL, state: "s", questions });

  assert.equal(await requestJevDecision({ apiKey: "", state: "s", questions, fetchImpl: ok }), null, "no key");
  assert.equal(await requestJevDecision({ apiKey: "k", state: "s", questions, fetchImpl: async () => ({ ok: false, status: 429 }) }), null);
  assert.equal(await requestJevDecision({ apiKey: "k", state: "s", questions, fetchImpl: async () => { throw new Error("net"); } }), null);
  assert.equal(await requestJevDecision({ apiKey: "k", state: "s", questions, fetchImpl: async () => ({ ok: true, json: async () => ({ answers: {} }) }) }), null, "bad shape");
  assert.equal(await requestJevDecision({ apiKey: "k", state: "s", questions, fetchImpl: async () => ({ ok: true, json: async () => { throw new Error("json"); } }) }), null);

  const hang = (_u, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
  assert.equal(await requestJevDecision({ apiKey: "k", state: "s", questions, fetchImpl: hang, timeoutMs: 20 }), null, "timeout");
  const ac = new AbortController();
  const pending = requestJevDecision({ apiKey: "k", state: "s", questions, fetchImpl: hang, signal: ac.signal });
  ac.abort();
  assert.equal(await pending, null, "caller abort");
  const pre = new AbortController(); pre.abort();
  assert.equal(await requestJevDecision({ apiKey: "k", state: "s", questions, fetchImpl: ok, signal: pre.signal }), null);

  const logged = [];
  console.warn = (...a) => logged.push(a.join(" "));
  await requestJevDecision({ apiKey: "sekret", state: "s", questions, fetchImpl: async () => ({ ok: false, status: 401 }) });
  assert.ok(logged.length && logged.every((l) => !l.includes("sekret")), "key never logged");
} finally {
  console.warn = origWarn;
}
console.log("jev.test.mjs ok");
