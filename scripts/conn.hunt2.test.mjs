// HUNT2 fixes, GeneratorApp half: a blank or whitespace-only number box falls back
// (Level 1, then the mode's clamp; Party size keeps the previous value) instead of
// becoming 0 (Number("") is 0). Loads the real class, as generator-app.rerollPick.test.mjs does.
// Run: node scripts/conn.hunt2.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import * as windowParts from "./window-parts.mjs";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}
const source = (await readFile(new URL("./generator-app.mjs", import.meta.url), "utf8"))
  .replace(/#(readForm|input)\b/g, "_test_$1");
const context = vm.createContext({
  console: { warn() {}, error() {}, log() {}, debug() {} },
  game: { i18n: { localize: (key) => key, format: (key) => key }, settings: { set: async () => {} } },
  ui: { notifications: { warn() {} } }
});
const mocks = {
  ...windowParts,
  MODULE_ID: "simplysf2e",
  SETTINGS: { generatorInput: "generatorInput" }, getSetting: () => undefined,
  restoreGeneratorInput: (_saved, defaults) => defaults, rememberedInput: (input) => input,
  SpfApp: class { async render() {} }
};
const module = new vm.SourceTextModule(source, { context });
await module.link((specifier) => {
  const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .filter((match) => match[2] === specifier)
    .flatMap((match) => match[1].split(",").map((name) => name.trim()));
  return new vm.SyntheticModule(imports, function () {
    for (const name of imports) this.setExport(name, mocks[name] ?? (() => { throw new Error(`Unexpected dependency: ${name}`); }));
  }, { context });
});
await module.evaluate();
const App = module.namespace.GeneratorApp;

/** Read a form with these field values through the real #readForm; returns the resulting input. */
function read({ mode, level, partySize, previousPartySize = 6 }) {
  const app = new App();
  app._test_input = { ...app._test_input, mode, level: 7, partySize: previousPartySize };
  const fields = { level: level === undefined ? null : { value: level }, partySize: partySize === undefined ? null : { value: partySize } };
  app.element = {
    querySelector(selector) {
      if (selector === '[name="mode"]:checked') return { value: mode };
      if (selector === '[name="level"]') return fields.level;
      if (selector === '[name="partySize"]') return fields.partySize;
      return null;
    }
  };
  app._test_readForm();
  return app._test_input;
}

for (const blank of ["", "   ", "\t"]) {
  assert.equal(read({ mode: "monster", level: blank }).level, 1, `monster: blank Level ${JSON.stringify(blank)} gives 1, not 0`);
  assert.equal(read({ mode: "encounter", level: blank }).level, 1, `encounter: blank Party level ${JSON.stringify(blank)} gives 1`);
  assert.equal(read({ mode: "character", level: blank }).level, 1, `character: blank Level gives 1`);
}
assert.equal(read({ mode: "monster", level: "0" }).level, 0, 'monster: "0" stays 0');
assert.equal(read({ mode: "monster", level: "-1" }).level, -1, 'monster: "-1" stays -1');
assert.equal(read({ mode: "encounter", level: "0" }).level, 1, 'encounter: "0" clamps to 1');
assert.equal(read({ mode: "monster", level: "30" }).level, 24, "monster: clamp max 24 unchanged");
assert.equal(read({ mode: "character", level: "30" }).level, 20, "character: clamp max 20 unchanged");
assert.equal(read({ mode: "monster", level: "3.6" }).level, 4, "rounding unchanged");
assert.equal(read({ mode: "reskin" }).level, 7, "no Level box (Reskin): the previous level is kept");

// Party size: a blank box keeps the previous size (the documented fallback), not 1.
assert.equal(read({ mode: "encounter", level: "5", partySize: "" }).partySize, 6, "blank Party size keeps the previous value");
assert.equal(read({ mode: "encounter", level: "5", partySize: "  " }).partySize, 6, "whitespace Party size keeps the previous value");
assert.equal(read({ mode: "encounter", level: "5", partySize: "0" }).partySize, 1, '"0" still clamps to 1');
assert.equal(read({ mode: "encounter", level: "5", partySize: "99" }).partySize, 8, "clamp max 8 unchanged");
assert.equal(read({ mode: "encounter", level: "5", partySize: "5" }).partySize, 5, "a number is read as before");

console.log("conn.hunt2.test.mjs: ok");
