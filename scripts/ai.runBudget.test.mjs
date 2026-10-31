import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";
import { beginRunBudget } from "./run-budget.mjs";

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
  settings: { get: (_m, key) => settings.get(key) },
  i18n: { localize: (k) => k, format: (k, d) => `${k}:${JSON.stringify(d)}` }
};

const providerReplies = [{ choices: [{ message: { content: '{"keywords":["fire","control"]}' }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }];
globalThis.fetch = async () => {
  const r = providerReplies.shift();
  return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
};

const { chooseSpellFocus } = await import("./ai.mjs");

// (a) over budget -> 0 requests
{
  const sig = new AbortController().signal;
  beginRunBudget(sig, { tokenBudget: 1, deadlineMs: 0 });
  // spend budget
  const { spendRunTokens } = await import("./run-budget.mjs");
  spendRunTokens(sig, { total: 5 });
  let reqCount = 0;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { reqCount++; return origFetch(); };
  try {
    await assert.rejects(
      chooseSpellFocus({ concept: { name: "X", level: 1, blurb: "b", description: "d", traits: ["fire"] }, tradition: "arcane", signal: sig }),
      (e) => { assert.equal(e.retryable, false); assert.match(e.message, /RunBudgetExceeded/); return true; }
    );
  } finally { globalThis.fetch = origFetch; }
  assert.equal(reqCount, 0);
}

// (b) no budget entry -> behaves as today
{
  const sig = new AbortController().signal;
  providerReplies.push({ choices: [{ message: { content: '{"keywords":["a","b"]}' }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  const r = await chooseSpellFocus({ concept: { name: "Y", level: 1, blurb: "b", description: "d", traits: ["fire"] }, tradition: "arcane", signal: sig });
  assert.ok(Array.isArray(r.keywords));
}

// (c) truncated attempt counted
{
  const sig = new AbortController().signal;
  beginRunBudget(sig, { tokenBudget: 1000, deadlineMs: 0 });
  providerReplies.length = 0;
  providerReplies.push(
    { choices: [{ message: { content: '{"keywords":["t"' }, finish_reason: "length" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 5 } },
    { choices: [{ message: { content: '{"keywords":["t","ok"]}' }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }
  );
  const beforeC = globalThis.fetch ? 0 : 0;
  await chooseSpellFocus({ concept: { name: "Z", level: 1, blurb: "b", description: "d", traits: ["fire"] }, tradition: "arcane", signal: sig });
  const { getRunBudget } = await import("./run-budget.mjs");
  assert.equal(getRunBudget(sig).tokensSpent, 7);
}

// (d) deadline elapsed -> deadline message
{
  const sig = new AbortController().signal;
  beginRunBudget(sig, { tokenBudget: 1000, deadlineMs: 1, now: () => Date.now() - 100000 });
  await assert.rejects(
    chooseSpellFocus({ concept: { name: "W", level: 1, blurb: "b", description: "d", traits: ["fire"] }, tradition: "arcane", signal: sig }),
    (e) => { assert.match(e.message, /RunDeadline/); return true; }
  );
}

console.log("ai.runBudget.test.mjs passed");
