// R4-I18N: GM-visible English moved out of JS into lang/en.json. Source scans only.
// Run: node scripts/i18n.r4.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const lang = JSON.parse(read("lang/en.json"));
const lookup = (key) => key.split(".").reduce((node, part) => node?.[part], lang);

const GONE = {
  "scripts/generator-app.mjs": [
    "still exists. The draft", "still exists`", "The plan was discarded", "\"unverified actor\"",
    "\"unverified character\"", "\"encounter actor\""
  ],
  "scripts/itemforge-app.mjs": ["} credits`"],
  "scripts/generator-context/rows.mjs": ["Spell Gem of", "\"archetype \""],
  "scripts/generator-context/creature-preview.mjs": [" ft.`"],
  "scripts/provider-setup-app.mjs": ["\"New connection\""],
  "scripts/generator-context/encounter-preview.mjs": ["en-US"]
};
for (const [file, needles] of Object.entries(GONE)) {
  const source = read(file);
  for (const needle of needles) assert.ok(!source.includes(needle), `${file} still contains ${needle}`);
}

const KEYS = {
  "scripts/generator-app.mjs": [
    "SIMPLYSF2E.Generator.SurvivorDraft", "SIMPLYSF2E.Generator.SurvivorIncompleteCharacter",
    "SIMPLYSF2E.Generator.SurvivorFolder", "SIMPLYSF2E.Generator.PlanDiscarded",
    "SIMPLYSF2E.Generator.RollbackUnverifiedActor", "SIMPLYSF2E.Generator.RollbackUnverifiedCharacter",
    "SIMPLYSF2E.Generator.RollbackEncounterActor"
  ],
  "scripts/itemforge-app.mjs": ["SIMPLYSF2E.ItemForge.PriceCredits"],
  "scripts/generator-context/rows.mjs": [
    "SIMPLYSF2E.Preview.SpellGem", "SIMPLYSF2E.Preview.Feet", "SIMPLYSF2E.Preview.SlotLabel",
    "SIMPLYSF2E.Preview.SlotLabelArchetype", "SIMPLYSF2E.Preview.SlotAncestry", "SIMPLYSF2E.Preview.SlotClass",
    "SIMPLYSF2E.Preview.SlotGeneral", "SIMPLYSF2E.Preview.SlotSkill"
  ],
  "scripts/provider-setup-app.mjs": ["SIMPLYSF2E.ProviderSetup.NewConnection"]
};
for (const [file, keys] of Object.entries(KEYS)) {
  const source = read(file);
  for (const key of keys) {
    assert.equal(typeof lookup(key), "string", `${key} missing from lang/en.json`);
    assert.ok(source.includes(`"${key}"`), `${file} does not use ${key}`);
    assert.ok(!/ — |\(s\)/.test(lookup(key)), `${key} breaks the copy rules`);
  }
}
assert.ok(read("scripts/generator-context/creature-preview.mjs").includes("feetText("), "creature preview formats feet through the key");
console.log("i18n.r4: all assertions passed");
