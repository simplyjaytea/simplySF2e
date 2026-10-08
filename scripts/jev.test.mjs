// Run: node scripts/jev.test.mjs
import assert from "node:assert/strict";
import {
  JEV_ENDPOINT, JEV_MODEL, TYPESAFE_JEV_ENDPOINT, TYPESAFE_JEV_MODEL, JEV_TEST_QUESTIONS,
  buildChoiceQuestion, callJev, normalizeJevSource, normalizeTypeSafeEndpoint, parseJevAnswers, requestJevDecision, resolveJevConfig,
  jevKeySource, testJevConnection
} from "./jev.mjs";
import { normalizeJevUsage } from "./tokens.mjs";

const orState = (apiKey) => ({ apiKey, provider: { id: "openrouter" } });
const orRoute = (apiKey) => ({ source: "openrouter", endpoint: JEV_ENDPOINT, model: JEV_MODEL, apiKey });
const tsRoute = (apiKey) => ({ source: "typesafe", endpoint: TYPESAFE_JEV_ENDPOINT, model: TYPESAFE_JEV_MODEL, apiKey });

// default `dedicated` reads the separate Jev key setting (J1b)
{
  const store = new Map([["jevApiKey", "  stored-jev  "]]);
  globalThis.game = { settings: { get: (_m, key) => store.get(key) } };
  assert.deepEqual(
    resolveJevConfig({ provider: () => ({ apiKey: "", provider: { id: "openai" } }) }),
    orRoute("stored-jev"), "default dedicated source is the stored Jev key");
  store.set("jevSource", "typesafe");
  assert.deepEqual(
    resolveJevConfig({ provider: () => ({ apiKey: "", provider: { id: "openai" } }) }),
    tsRoute("stored-jev"), "stored source picks the TypeSafe route");
  store.set("jevApiKey", "");
  assert.equal(resolveJevConfig({ provider: () => ({ apiKey: "", provider: { id: "openai" } }) }), null);
  delete globalThis.game;
}

// status-bar source (J6)
assert.equal(jevKeySource({ provider: () => orState("or-key"), dedicated: () => ({ apiKey: "k" }) }), "key");
assert.equal(jevKeySource({ provider: () => orState("or-key"), dedicated: () => ({ apiKey: "k", source: "typesafe" }) }), "typesafe");
assert.equal(jevKeySource({ provider: () => orState("or-key"), dedicated: () => null }), "connection");
assert.equal(jevKeySource({ provider: () => ({ apiKey: "x", provider: { id: "openai" } }), dedicated: () => null }), null);
assert.equal(jevKeySource({ provider: () => orState(""), dedicated: () => ({ apiKey: " " }) }), null);

// resolver order
assert.equal(JEV_ENDPOINT, "https://openrouter.ai/api/v1/systemone");
assert.equal(JEV_MODEL, "typesafe/jev-1.13");
assert.deepEqual(
  resolveJevConfig({ provider: () => orState("or-key"), dedicated: () => ({ apiKey: " dedicated " }) }),
  orRoute("dedicated"), "dedicated key wins");
assert.deepEqual(
  resolveJevConfig({ provider: () => orState("or-key"), dedicated: () => ({ apiKey: "ts", source: "typesafe" }) }),
  tsRoute("ts"), "a TypeSafe key goes only to TypeSafe");
assert.deepEqual(
  resolveJevConfig({ provider: () => orState("or-key"), dedicated: () => ({ apiKey: "", source: "typesafe" }) }),
  orRoute("or-key"), "no TypeSafe key: OpenRouter chat key stays on OpenRouter");
assert.deepEqual(
  resolveJevConfig({ provider: () => orState("or-key"), dedicated: () => ({ apiKey: "k", source: "bogus" }) }),
  orRoute("k"), "unknown source falls back to OpenRouter");
assert.deepEqual(
  resolveJevConfig({ provider: () => orState("or-key"), dedicated: () => null }),
  orRoute("or-key"), "OpenRouter chat key reused");
// TypeSafe endpoint (a GM's own CORS proxy)
const proxy = "https://jev-proxy.example.com/v1/systemone";
assert.equal(normalizeTypeSafeEndpoint(""), TYPESAFE_JEV_ENDPOINT, "blank is the official endpoint");
assert.equal(normalizeTypeSafeEndpoint(undefined), TYPESAFE_JEV_ENDPOINT);
assert.equal(normalizeTypeSafeEndpoint(` ${proxy} `), proxy);
assert.equal(normalizeTypeSafeEndpoint("https://api.typesafe.ai/v1/systemone/"), TYPESAFE_JEV_ENDPOINT, "trailing slash is still official");
assert.equal(normalizeTypeSafeEndpoint("https://API.typesafe.ai:443/v1/systemone"), TYPESAFE_JEV_ENDPOINT, "explicit :443 is still official");
assert.notEqual(normalizeTypeSafeEndpoint("https://api.typesafe.ai/v1/other"), TYPESAFE_JEV_ENDPOINT);
assert.equal(normalizeTypeSafeEndpoint("http://localhost:8787/systemone"), "http://localhost:8787/systemone", "plain http allowed on this machine");
assert.equal(normalizeTypeSafeEndpoint("http://127.0.0.1:8787/"), "http://127.0.0.1:8787/");
assert.equal(normalizeTypeSafeEndpoint("http://[::1]:8787/x"), "http://[::1]:8787/x");
assert.equal(normalizeTypeSafeEndpoint("http://proxy.example.com/systemone"), null, "no plain http across the network");
assert.equal(normalizeTypeSafeEndpoint("https://user:pw@proxy.example.com/"), null, "no credentials in the URL");
assert.equal(normalizeTypeSafeEndpoint("ftp://proxy.example.com/"), null);
assert.equal(normalizeTypeSafeEndpoint("javascript:alert(1)"), null);
assert.equal(normalizeTypeSafeEndpoint("not a url"), null);
assert.deepEqual(
  resolveJevConfig({ provider: () => orState("or-key"), dedicated: () => ({ apiKey: "ts", source: "typesafe", endpoint: proxy }) }),
  { ...tsRoute("ts"), endpoint: proxy }, "a TypeSafe key goes to the saved proxy");
assert.deepEqual(
  resolveJevConfig({ provider: () => orState("or-key"), dedicated: () => ({ apiKey: "k", source: "openrouter", endpoint: proxy }) }),
  orRoute("k"), "the TypeSafe endpoint never moves an OpenRouter key");
assert.equal(
  resolveJevConfig({ provider: () => orState("or-key"), dedicated: () => ({ apiKey: "ts", source: "typesafe", endpoint: "http://evil.example.com/" }) }),
  null, "an unusable stored endpoint turns Jev off instead of sending the key");

assert.equal(normalizeJevSource("typesafe"), "typesafe");
assert.equal(normalizeJevSource("__proto__"), "openrouter");
assert.equal(normalizeJevSource(undefined), "openrouter");
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

  // model follows the route
  await requestJevDecision({ ...tsRoute("ts"), state: "s", questions, fetchImpl: ok });
  assert.equal(seen.url, TYPESAFE_JEV_ENDPOINT);
  assert.equal(JSON.parse(seen.init.body).model, "jev-1.13.0");

  // callJev failure reasons (Test Jev button)
  assert.equal((await callJev({ apiKey: "", questions, fetchImpl: ok })).reason, "nokey");
  const http = await callJev({ apiKey: "k", state: "s", questions, fetchImpl: async () => ({ ok: false, status: 401 }) });
  assert.deepEqual([http.ok, http.reason, http.status], [false, "http", 401]);
  assert.equal((await callJev({ apiKey: "k", state: "s", questions, fetchImpl: async () => { throw new TypeError("Failed to fetch"); } })).reason, "network");
  assert.equal((await callJev({ apiKey: "k", state: "s", questions, fetchImpl: hang, timeoutMs: 20 })).reason, "timeout");
  const ac2 = new AbortController();
  const pending2 = callJev({ apiKey: "k", state: "s", questions, fetchImpl: hang, signal: ac2.signal });
  ac2.abort();
  assert.equal((await pending2).reason, "cancelled");
  assert.equal((await callJev({ apiKey: "k", state: "s", questions, fetchImpl: async () => ({ ok: true, json: async () => ({ answers: {} }) }) })).reason, "shape");

  // testJevConnection
  assert.deepEqual(await testJevConnection({ config: null }), { ok: false, source: null, reason: "unconfigured", ms: 0 });
  const pong = async (url, init) => {
    seen = { url, init };
    return { ok: true, json: async () => ({ model: "jev-1.13.0", answers: { ping: { type: "choice", choice: "red", confidence: 0.99, probabilities: { red: 0.99, table: 0.01 } } } }) };
  };
  const passed = await testJevConnection({ config: tsRoute("ts"), fetchImpl: pong });
  assert.equal(passed.ok, true);
  assert.equal(passed.source, "typesafe");
  assert.equal(seen.url, TYPESAFE_JEV_ENDPOINT);
  assert.deepEqual(JSON.parse(seen.init.body).questions, JEV_TEST_QUESTIONS);
  const blocked = await testJevConnection({ config: tsRoute("ts"), fetchImpl: async () => { throw new TypeError("Failed to fetch"); } });
  assert.deepEqual([blocked.ok, blocked.source, blocked.reason, blocked.endpoint], [false, "typesafe", "network", TYPESAFE_JEV_ENDPOINT]);

  const logged = [];
  console.warn = (...a) => logged.push(a.join(" "));
  await requestJevDecision({ apiKey: "sekret", state: "s", questions, fetchImpl: async () => ({ ok: false, status: 401 }) });
  assert.ok(logged.length && logged.every((l) => !l.includes("sekret")), "key never logged");
} finally {
  console.warn = origWarn;
}
console.log("jev.test.mjs ok");
