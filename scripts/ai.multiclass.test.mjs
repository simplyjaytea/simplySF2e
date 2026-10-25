import assert from "node:assert/strict";
import { SETTINGS } from "./settings.mjs";
import { normalizeMulticlassPick } from "./ai-response-validation.mjs";
import { COMPLETE_PC_CLASS_SLUGS } from "./pc-support.mjs";

const settings = new Map([[SETTINGS.apiBaseUrl, "http://localhost:11434/v1"], [SETTINGS.apiKey, ""],
  [SETTINGS.apiKeyBaseUrl, ""], [SETTINGS.model, "test-model"], [SETTINGS.temperature, 0.8],
  [SETTINGS.maxTokens, 8000], [SETTINGS.requestTimeout, 90]]);
globalThis.game = { settings: { get: (_module, key) => settings.get(key) },
  i18n: { localize: (key) => key, format: (key) => key } };
const { generatePCConcept } = await import("./ai.mjs");

// Pure list check: only supported slugs survive; everything else is null.
const supported = COMPLETE_PC_CLASS_SLUGS;
assert.equal(normalizeMulticlassPick("mystic", supported), "mystic");
assert.equal(normalizeMulticlassPick(" Soldier ", supported), "soldier", "case and padding are the same slug");
assert.equal(normalizeMulticlassPick(null, supported), null);
assert.equal(normalizeMulticlassPick(undefined, supported), null);
for (const bad of ["wizard", "Mystic Dedication", 3, { slug: "mystic" }, "", "fighter"]) {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    assert.equal(normalizeMulticlassPick(bad, supported), null, `unsupported pick ${JSON.stringify(bad)} is null`);
  } finally { console.warn = original; }
  if (bad !== null && bad !== undefined) assert.equal(warnings.length, 1, `unsupported pick ${JSON.stringify(bad)} warns once`);
}

// Request contract: the multiclass field is requested only when allowMulticlass is true.
const fixture = {
  name: "Scout", ancestry: "Human", heritage: null, background: "Hunter", class: "Soldier", keyAbility: "con",
  blurb: "A soldier who dabbles in mysticism", backstory: "A veteran with a quiet mystic streak.", appearance: "", age: "", gender: "",
  height: "", weight: "", ethnicity: "", nationality: "", personality: "", alignmentFlavor: "", likes: "", dislikes: "",
  allies: "", enemies: "", organizations: "", languages: [], feats: [], spellcasting: null, focusSpells: [], equipment: []
};
let response, calls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, options) => {
  calls.push(JSON.parse(options.body));
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(response) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } }), { headers: { "content-type": "application/json" } });
};
try {
  // GM picked nothing (or a class): the AI is not asked, and the schema never mentions multiclass.
  response = { ...fixture, multiclass: "mystic" };
  calls = [];
  const off = await generatePCConcept({ prompt: "Scout", level: 5, allowSpellcasting: false });
  assert.equal(off.multiclass, null, "without allowMulticlass the AI pick is ignored");
  assert.doesNotMatch(calls[0].messages[0].content, /"multiclass"/, "GM-decided or off: no multiclass schema field");

  // "Let the AI decide": the field is offered, a listed slug is kept.
  calls = [];
  response = { ...fixture, multiclass: "mystic" };
  const picked = await generatePCConcept({ prompt: "A soldier who dabbles in mysticism", level: 5, allowSpellcasting: false, allowMulticlass: true });
  const system = calls[0].messages[0].content;
  assert.match(system, /"multiclass": "envoy"\|"mechanic"\|"mystic"\|"operative"\|"solarian"\|"soldier"\|"technomancer"\|"witchwarper"\|null/);
  assert.match(system, /Never the main class/);
  assert.equal(picked.multiclass, "mystic");
  assert.equal(picked.concept.class, "Soldier", "the rest of the concept is unchanged");
  assert.equal(picked.usage.total, 30);

  // Unlisted, numeric or missing picks become null with one warning, never a guess.
  for (const value of ["wizard", 4, undefined]) {
    response = { ...fixture, multiclass: value };
    const warnings = [];
    const original = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));
    let result;
    try {
      result = await generatePCConcept({ prompt: "Scout", level: 5, allowSpellcasting: false, allowMulticlass: true });
    } finally { console.warn = original; }
    assert.equal(result.multiclass, null, `AI multiclass ${JSON.stringify(value)} is null`);
    assert.equal(warnings.length, value === undefined ? 0 : 1, `AI multiclass ${JSON.stringify(value)} warns only when it was present`);
  }
} finally { globalThis.fetch = originalFetch; }
console.log("ai.multiclass.test.mjs: multiclass schema gated by allowMulticlass and validated against the supported list");
