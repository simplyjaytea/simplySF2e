// Standard SF2e class presets: catalog ids, picker grouping, last-used
// fallback. Flavor keys only — not pack UUIDs or COMPLETE_PC_CLASS_SLUGS.
// Run: node scripts/presets.catalog.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BUILT_IN_PRESETS, STANDARD_PRESET_IDS, EXAMPLE_PROMPTS,
  resolveSelectedPresetId, presetPickerGroups
} from "./presets.mjs";

const EXPECTED = [
  "envoy", "mystic", "operative", "solarian", "soldier", "witchwarper"
];
const DROPPED = [
  "alchemist", "barbarian", "bard", "champion", "cleric", "druid", "fighter",
  "gunslinger", "inventor", "investigator", "kineticist", "magus", "monk",
  "oracle", "psychic", "ranger", "rogue", "sorcerer", "summoner",
  "swashbuckler", "thaumaturge", "witch", "wizard",
  "cultivator", "fire-mage", "assassin", "healer", "tank", "skill-monkey"
];

assert.deepEqual(STANDARD_PRESET_IDS, EXPECTED, "Standard ids must be the six SF2e classes in pack order");
assert.deepEqual(BUILT_IN_PRESETS.map((p) => p.id), EXPECTED);
assert.equal(new Set(STANDARD_PRESET_IDS).size, EXPECTED.length, "preset ids must be unique");
for (const dropped of DROPPED) {
  assert.equal(STANDARD_PRESET_IDS.includes(dropped), false, `${dropped} must not remain a built-in`);
  assert.equal(Object.hasOwn(EXAMPLE_PROMPTS, dropped), false, `${dropped} must not keep example prompts`);
}

for (const preset of BUILT_IN_PRESETS) {
  assert.match(preset.name, /^SIMPLYSF2E\.Presets\./, `${preset.id} must localize its label`);
  assert.match(preset.prompt, /^Build like /);
  assert.doesNotMatch(preset.prompt, /\b\d+(\.\d+)?\b/, `${preset.id} prompt must stay scale-words, not numbers`);
  assert.doesNotMatch(preset.id, /Compendium\.|Item\./, "preset ids are module-local flavor keys, not pack refs");
  const examples = EXAMPLE_PROMPTS[preset.id];
  assert.ok(Array.isArray(examples) && examples.length === 5, `${preset.id} needs five example prompts`);
  assert.equal(examples.every((line) => typeof line === "string" && line.length > 0), true);
}
assert.equal(EXAMPLE_PROMPTS[""].length, 5, "the empty preset keeps a five-example pool");

assert.equal(resolveSelectedPresetId(""), "", "fresh default stays None so monsters are not force-flavored");
assert.equal(resolveSelectedPresetId(null), "");
assert.equal(resolveSelectedPresetId("soldier"), "soldier");
assert.equal(resolveSelectedPresetId("custom-abc", [{ id: "custom-abc", name: "Mine" }]), "custom-abc");
assert.equal(resolveSelectedPresetId("fighter"), "envoy", "retired PF2e ids fall back to first Standard");
assert.equal(resolveSelectedPresetId("custom-gone", [{ id: "custom-live", name: "Live" }]), "envoy");

const emptyCustom = presetPickerGroups("", []);
assert.equal(emptyCustom.selectedId, "");
assert.equal(emptyCustom.standard.length, 6);
assert.deepEqual(emptyCustom.custom, [], "empty Custom must be an empty array so the optgroup can be omitted");
assert.equal(emptyCustom.standard[0].id, "envoy");
assert.equal(emptyCustom.standard.every((p) => p.selected === false), true, "None selected means no Standard option is selected");

const grouped = presetPickerGroups("witchwarper", [{ id: "custom-1", name: "Drift Hag" }]);
assert.equal(grouped.selectedId, "witchwarper");
assert.equal(grouped.standard.find((p) => p.id === "witchwarper").selected, true);
assert.equal(grouped.custom.length, 1);
assert.equal(grouped.custom[0].selected, false);

const lang = JSON.parse(await readFile(new URL("../lang/en.json", import.meta.url), "utf8"));
const keys = lang.SIMPLYSF2E.Presets;
assert.equal(keys.StandardGroup, "Standard classes");
assert.equal(keys.CustomGroup, "Custom presets");
assert.match(keys.FlavorGuide, /flavor guides only/i);
assert.match(keys.FlavorGuide, /not yet available/i);
assert.doesNotMatch(keys.FlavorGuide, /Fighter|Rogue|Investigator|Magus|Witch\b/);
for (const dropped of [
  "Alchemist", "Barbarian", "Bard", "Champion", "Cleric", "Druid", "Fighter",
  "Gunslinger", "Inventor", "Investigator", "Kineticist", "Magus", "Monk",
  "Oracle", "Psychic", "Ranger", "Rogue", "Sorcerer", "Summoner",
  "Swashbuckler", "Thaumaturge", "Witch", "Wizard",
  "Cultivator", "FireMage", "Assassin", "Healer", "Tank", "SkillMonkey"
]) {
  assert.equal(Object.hasOwn(keys, dropped), false, `${dropped} lang key must be removed`);
}
for (const preset of BUILT_IN_PRESETS) {
  const leaf = preset.name.slice("SIMPLYSF2E.Presets.".length);
  assert.equal(typeof keys[leaf], "string", `${preset.name} must exist in en.json`);
}

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
assert.match(readme, /^# SimplySF2e/m);
assert.match(readme, /Starfinder 2e/);
assert.match(readme, /simplyjaytea\/simplySF2e\/releases\/latest\/download\/module\.json/);
assert.doesNotMatch(readme, /placeholder until the first release/i);
assert.match(readme, /not play-ready/i);
assert.match(readme, /`sf2e`/);
assert.doesNotMatch(readme, /\*\*Standard\*\*.*23 Remaster/s);
assert.doesNotMatch(readme, /complete-only still finishes \*\*Fighter\*\*/);
assert.doesNotMatch(readme, /What's new/);
assert.doesNotMatch(readme, /Cultivator|Fire Mage|Skill-Monkey|eighteen built-ins/i);

console.log("presets.catalog.test.mjs: SF2e Standard catalog and picker grouping passed");
