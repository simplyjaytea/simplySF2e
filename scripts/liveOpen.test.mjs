// Provider Setup and Compendium Sources have one fixed window id each, so every opener must
// go through the static open() helper (reuses the live window) and nothing else may construct
// them: Foundry's settings menu builds its own instance, which the render() hand-over covers.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");
const files = (await readdir(new URL(".", import.meta.url))).filter((f) => f.endsWith(".mjs") && !f.includes(".test."));
const owners = { "provider-setup-app.mjs": "ProviderSetupApp", "sources-app.mjs": "SourcesConfigApp" };
for (const cls of ["ProviderSetupApp", "SourcesConfigApp"]) {
  for (const file of files) {
    const hits = stripComments(await readFile(new URL(`./${file}`, import.meta.url), "utf8")).match(new RegExp(`new ${cls}\\(`, "g"))?.length ?? 0;
    const allowed = owners[file] === cls ? 1 : 0; // the helper's own construction
    assert.equal(hits, allowed, `${file}: ${hits} \`new ${cls}(\` (allowed ${allowed}); use ${cls}.open()`);
  }
}
const settings = stripComments(await readFile(new URL("./settings.mjs", import.meta.url), "utf8"));
assert.ok(/type: ProviderSetupApp/.test(settings) && /type: SourcesConfigApp/.test(settings),
  "the settings menus still pass the class as a type (Foundry constructs it)");
for (const [file, cls] of Object.entries(owners)) {
  const text = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
  assert.ok(/static open\(/.test(text) && /async render\(options = \{\}, _options = \{\}\)/.test(text), `${file}: open() and the render hand-over exist`);
}
console.log("liveOpen.test.mjs: no direct construction of Provider Setup or Compendium Sources outside open()");
