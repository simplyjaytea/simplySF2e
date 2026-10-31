// Record ONE real provider reply into a golden-replay fixture.
//
// The replay suite (scripts/golden-replay.test.mjs) is only as honest as its
// fixtures. This tool runs one production task against a live endpoint, captures
// what the provider actually sent, and writes it in the replay fixture format.
// It never writes the API key anywhere.
//
//   $env:SIMPLY_BASE_URL = "https://openrouter.ai/api/v1"
//   $env:SIMPLY_MODEL    = "deepseek/deepseek-chat"
//   $env:SIMPLY_API_KEY  = "<key>"
//   node tools/golden-replay/record.mjs --task creatureConcept --id live-creature-commander \
//        --args '{"prompt":"a vesk siege marshal","level":5,"rarity":"common","allowSpellcasting":false,"intent":"monster"}' \
//        --note "recorded from <model> on <date>"
//
// Anything that is not a concept task needs its own realistic args (candidates,
// concepts) — pass them through --args; they are stored verbatim in the fixture.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { SETTINGS } from "../../scripts/settings.mjs";

/** Tasks with a direct production entry point and no must-be-issued candidates. */
export const RECORDABLE = {
  creatureConcept: "generateConcept",
  pcConcept: "generatePCConcept",
  magicItemConcept: "generateMagicItemConcept",
  encounterDesign: "designEncounter",
  reskinFlavor: "generateReskin",
  shopConcept: "generateShopConcept",
  treasureConcept: "generateTreasureConcept"
};

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

// Mirrors scripts/ai.mjs visibleTextContent: providers may send a string or an
// array of content parts. Copied deliberately so a recorded fixture carries what
// the production reader would have produced.
function visibleTextContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  let text = "";
  for (const part of content) {
    if (typeof part === "string") text += part;
    else if (part && typeof part.text === "string") text += part.text;
  }
  return text;
}

/**
 * Rebuild the non-stream provider payload the replay stub should return from an
 * SSE body, using the same rules as the production reader: accumulate
 * `delta.content`, keep a message-shaped copy as a fallback only when no delta
 * text arrived, and never treat reasoning as the answer. Pure.
 * @param {string} text raw `text/event-stream` body
 */
export function sseToProviderPayload(text) {
  let content = "";
  let messageContent = "";
  let finishReason = "stop";
  let usage = null;
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    let chunk;
    try { chunk = JSON.parse(data); } catch { continue; }
    if (isRecord(chunk?.error)) throw new Error(`provider stream error: ${JSON.stringify(chunk.error).slice(0, 200)}`);
    if (isRecord(chunk?.usage)) usage = chunk.usage;
    const choice = chunk?.choices?.[0];
    if (!choice) continue;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const deltaText = visibleTextContent(choice.delta?.content);
    if (deltaText) content += deltaText;
    const messageText = visibleTextContent(choice.message?.content);
    if (messageText) messageContent = messageText;
  }
  // Prefer streamed deltas: a provider that echoes the full message on its last
  // chunk must not double the answer.
  const answer = content || messageContent;
  if (!answer.trim()) throw new Error("the stream carried no message content");
  return {
    choices: [{ message: { content: answer }, finish_reason: finishReason }],
    ...(usage ? { usage } : {})
  };
}

/**
 * Shape captured provider payloads into a replay fixture. Pure: the caller
 * supplies everything the production path saw. Multiple payloads happen when
 * production retried (a compatibility negotiation or the JSON retry), and the
 * fixture must replay the same sequence.
 */
export function buildFixture({ id, task, note, args, payload, payloads, expect } = {}) {
  if (!id || typeof id !== "string") throw new Error("record: an id is required");
  if (!Object.hasOwn(RECORDABLE, task)) throw new Error(`record: task ${task} has no recordable production entry point`);
  if (!isRecord(args)) throw new Error("record: args must be an object");
  const replies = Array.isArray(payloads) ? payloads : (payload ? [payload] : []);
  if (!replies.length) throw new Error("record: at least one provider reply is required");
  for (const reply of replies) {
    if (!isRecord(reply) || !Array.isArray(reply.choices)) throw new Error("record: payload must be a provider reply");
  }
  return {
    id,
    task,
    note: typeof note === "string" && note.trim() ? note.trim() : `recorded live from the provider; see git history for the model and date`,
    args,
    responses: replies,
    expect: expect ?? { ok: true, requestCount: replies.length }
  };
}

/**
 * Run one production task against a live endpoint and capture the reply.
 * `fetchImpl` is injectable so the capture can be tested without a network.
 * Returns the fixture object; writes nothing.
 */
export async function recordFixture({
  id, task, note, args, baseUrl, model, apiKey, settings = {}, fetchImpl = globalThis.fetch, expect
} = {}) {
  const fn = RECORDABLE[task];
  if (!fn) throw new Error(`record: task ${task} has no recordable production entry point`);
  if (!baseUrl) throw new Error("record: a base URL is required");
  if (!apiKey) throw new Error("record: an API key is required");
  if (!model) throw new Error("record: a model is required");

  const values = new Map([
    [SETTINGS.apiBaseUrl, baseUrl],
    [SETTINGS.apiKey, apiKey],
    [SETTINGS.apiKeyBaseUrl, baseUrl],
    [SETTINGS.model, model],
    [SETTINGS.temperature, 0.8],
    [SETTINGS.maxTokens, 8000],
    [SETTINGS.requestTimeout, 120]
  ]);
  for (const [key, value] of Object.entries(settings)) values.set(key, value);
  const previousGame = globalThis.game;
  const previousFetch = globalThis.fetch;
  globalThis.game = {
    settings: { get: (_moduleId, key) => values.get(key) },
    i18n: { localize: (key) => key, format: (key) => key }
  };

  const captured = [];
  globalThis.fetch = async (url, options) => {
    const response = await fetchImpl(url, options);
    // Clone before production consumes it: clone() tees the stream.
    const copy = response.clone();
    const contentType = copy.headers.get("content-type") ?? "";
    const bodyText = await copy.text();
    captured.push(contentType.includes("text/event-stream")
      ? sseToProviderPayload(bodyText)
      : JSON.parse(bodyText));
    return response;
  };

  try {
    const ai = await import("../../scripts/ai.mjs");
    await ai[fn](args ?? {});
  } finally {
    globalThis.fetch = previousFetch;
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
  }

  if (!captured.length) throw new Error("record: the task made no provider request");
  return buildFixture({ id, task, note, args, payloads: captured, expect });
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag.startsWith("--")) continue;
    out[flag.slice(2)] = argv[i + 1];
    i += 1;
  }
  return out;
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const task = argv.task;
  const id = argv.id;
  const outPath = argv.out ?? `tools/golden-replay/fixtures/${id}.json`;
  let args = {};
  if (argv.args) {
    try { args = JSON.parse(argv.args); }
    catch { console.error("record: --args must be a JSON object"); return 2; }
  }
  const fixture = await recordFixture({
    id,
    task,
    note: argv.note,
    args,
    baseUrl: process.env.SIMPLY_BASE_URL,
    model: process.env.SIMPLY_MODEL,
    apiKey: process.env.SIMPLY_API_KEY
  });
  writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`recorded ${fixture.id} (${fixture.task}) -> ${outPath}`);
  console.log("run: node scripts/golden-replay.test.mjs");
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().then((code) => { process.exitCode = code; })
    .catch((err) => { console.error(`record: ${err?.message ?? err}`); process.exitCode = 1; });
}
