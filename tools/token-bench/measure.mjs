#!/usr/bin/env node
// Token bench: how many tokens one generation sends and receives, per AI call.
// Runs the REAL prompt builders (scripts/ai.mjs) and the real creature chain
// (scripts/creature-pipeline.mjs) against the cached sf2e packs, with `fetch`
// replaced by a scripted provider. Nothing is sent anywhere and no production
// file is changed. Run tools/class-bench/fetch.mjs first (it fills the cache).
//
//   node tools/token-bench/measure.mjs [--scripts <dir>] [--json <file>] [--verbose]
//
// --scripts points at another checkout's scripts/ folder, so two versions of
// the module can be compared with the same tool and the same replies.
// TOKENIZER=<path to gpt-tokenizer's main file> counts with a real BPE
// tokenizer (o200k); without it the module's own estimateTokens() is used.
//
// The scripted replies are what a compliant model returns to each prompt: the
// same content every time, shaped to the schema the prompt shows (see
// replies.mjs). Reply tokens are therefore a comparison between two prompt
// versions, not a measurement of any one live model.
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPacks, installFoundry } from "../class-bench/env.mjs";
import { replyFor, classify } from "./replies.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, "..", "class-bench", "cache");
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const SCRIPTS = resolve(flag("scripts", join(HERE, "..", "..", "scripts")));
const VERBOSE = args.includes("--verbose");
const load = (name) => import(pathToFileURL(join(SCRIPTS, name)).href);

const { packs } = await loadPacks(CACHE);
installFoundry({ packs, state: { freeArchetype: false } });

const { SETTINGS } = await load("settings.mjs");
const settings = new Map([
  [SETTINGS.apiBaseUrl, "http://localhost:11434/v1"], [SETTINGS.apiKey, ""], [SETTINGS.apiKeyBaseUrl, ""],
  [SETTINGS.model, "bench-model"], [SETTINGS.temperature, 0.8], [SETTINGS.maxTokens, 8000],
  [SETTINGS.requestTimeout, 90], [SETTINGS.runTokenBudget, 0], [SETTINGS.runDeadline, 0],
  [SETTINGS.jevApiKey, ""], [SETTINGS.jevSource, ""], [SETTINGS.jevTypeSafeEndpoint, ""],
  ["sourcePacks", {}], ["freeArchetype", false]
]);
game.settings.get = (_module, key) => settings.get(key);
game.i18n.format = (key, data) => `${key}:${JSON.stringify(data)}`;

let countTokens;
let tokenizer = "estimateTokens (about 4 characters per token)";
if (process.env.TOKENIZER) {
  ({ countTokens } = await import(pathToFileURL(resolve(process.env.TOKENIZER)).href));
  tokenizer = "gpt-tokenizer o200k_base";
} else {
  ({ estimateTokens: countTokens } = await load("tokens.mjs"));
}

// ------------------------------------------------------------ provider stub
let calls = [];
globalThis.fetch = async (_url, options) => {
  const body = JSON.parse(options.body);
  const system = body.messages[0].content;
  const user = body.messages[1].content;
  const content = replyFor({ system, user });
  calls.push({
    call: classify(system),
    prompt: countTokens(system) + countTokens(user),
    system: countTokens(system),
    completion: countTokens(content)
  });
  if (VERBOSE) console.log(`\n--- ${classify(system)} ---\n${system}\n\n${user}\n\n>>> ${content}`);
  return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }), {
    status: 200, headers: { "content-type": "application/json" }
  });
};
const warn = console.warn;
console.warn = () => {};
console.debug = () => {};

const ai = await load("ai.mjs");
const pipeline = await load("creature-pipeline.mjs");
const compendium = await load("compendium.mjs");
const encounter = await load("encounter.mjs");
const shop = await load("shop.mjs");
const treasure = await load("treasure.mjs");

const LABELS = {
  concept: "concept", spellFocus: "spellFocus", spells: "spells", abilities: "abilities", feats: "feats",
  equipment: "equipment", loot: "loot", design: "design", cancelled: "Cancelled", member: (i) => `member ${i + 1}`
};
const signal = () => new AbortController().signal;

const SCENARIOS = {
  "Monster, level 3 (beast, no gear)": () => pipeline.generateCreature({
    mode: "monster", prompt: "[beast] a pack-hunting void jackal that stalks derelict stations", level: 3,
    rarity: "common", allowSpellcasting: false, treasureAmount: "standard", labels: LABELS, signal: signal()
  }),
  "NPC, level 7 (caster with gear and loot)": () => pipeline.generateCreature({
    mode: "npc", prompt: "[caster] a disgraced Xenowarden technomancer who sells stolen star charts", level: 7,
    rarity: "uncommon", allowSpellcasting: true, treasureAmount: "standard", labels: LABELS, signal: signal()
  }),
  "Encounter, severe, party of 4 at level 5 (3 creatures)": () => pipeline.generateEncounter({
    composition: encounter.composeEncounter("severe", 4, 5),
    theme: "void cultists ambush the party in a derelict cargo bay", partyLevel: 5, rarity: "common",
    allowSpellcasting: true, treasureAmount: "standard", labels: LABELS, signal: signal()
  }),
  "Character, level 5 (concept, ancestry and class, wealth items)": async () => {
    const { concept } = await ai.generatePCConcept({
      prompt: "a vesk soldier turned bodyguard with a soft spot for strays", level: 5, allowSpellcasting: true
    });
    const [ancestryCandidates, backgroundCandidates, classCandidates, heritageCandidates] = await Promise.all([
      compendium.getAncestryCandidates("uncommon"), compendium.getBackgroundCandidates("uncommon"),
      compendium.getClassCandidates(), compendium.getHeritageCandidates("uncommon")
    ]);
    await ai.selectAncestryBackgroundClass({
      concept: { ...concept, level: 5 }, ancestryCandidates, backgroundCandidates, classCandidates, heritageCandidates
    });
    await ai.generatePCLoot({ concept: { ...concept, level: 5 }, amount: "standard" });
  },
  "Shop, level 6, standard size": async () => {
    const prompt = "a cramped salvage stall run by a retired ysoki mechanic";
    const { concept: raw } = await ai.generateShopConcept({ prompt, level: 6, categories: Object.keys(shop.SHOP_CATEGORIES) });
    const concept = shop.normalizeShopConcept(raw);
    const { types } = shop.shopTypesFor(concept.categories);
    const candidates = await compendium.getShopCandidates(6, concept.keywords, { types, maxRarity: "uncommon" });
    await ai.selectShopStock({ concept, candidates, count: shop.SHOP_SIZES.standard, gmPrompt: prompt });
  },
  "Treasure, level 6, one encounter": async () => {
    const prompt = "what the smugglers left in a flooded cryo-lab";
    const { concept: raw } = await ai.generateTreasureConcept({ prompt, level: 6, categories: Object.keys(shop.SHOP_CATEGORIES) });
    const concept = treasure.normalizeTreasureConcept(raw);
    const { types } = shop.shopTypesFor(concept.categories);
    const candidates = await compendium.getShopCandidates(6, concept.keywords, { types, maxRarity: "uncommon" });
    await ai.selectTreasureItems({ concept, candidates, count: 8, amount: "encounter", gmPrompt: prompt });
  }
};

const results = {};
for (const [name, run] of Object.entries(SCENARIOS)) {
  calls = [];
  try {
    await run();
  } catch (err) {
    warn(`! ${name} stopped: ${err?.message ?? err}`);
  }
  results[name] = calls;
}

const pad = (text, width) => String(text).padEnd(width);
const num = (n) => String(n).padStart(7);
console.log(`Tokenizer: ${tokenizer}\nScripts:   ${SCRIPTS}\n`);
for (const [name, list] of Object.entries(results)) {
  console.log(name);
  console.log(`  ${pad("call", 22)}${num("prompt")}${num("reply")}${num("total")}`);
  for (const c of list) console.log(`  ${pad(c.call, 22)}${num(c.prompt)}${num(c.completion)}${num(c.prompt + c.completion)}`);
  const prompt = list.reduce((sum, c) => sum + c.prompt, 0);
  const completion = list.reduce((sum, c) => sum + c.completion, 0);
  console.log(`  ${pad(`${list.length} calls`, 22)}${num(prompt)}${num(completion)}${num(prompt + completion)}\n`);
}
const out = flag("json", null);
if (out) await writeFile(out, `${JSON.stringify({ tokenizer, results }, null, 2)}\n`);
