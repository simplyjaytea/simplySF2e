// R3 Generator fixes, source-scan checks (the app class cannot be imported under Node).
//   A. The busy branch of runFromChat changes no state (no setInput / #mergeInput).
//   B. Recent-preview names and details use data-tooltip-text, not the HTML data-tooltip.
//   C. Error text is never read as a bare err.message in the item forge or generator.
// Run: node scripts/generator-app.r3.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const generator = await read("./generator-app.mjs");
const itemforge = await read("./itemforge-app.mjs");
// The Generator window renders three part templates (window-parts.mjs).
const template = (await Promise.all(["status", "brief", "result"]
  .map((part) => read(`../templates/generator-${part}.hbs`)))).join("\n");

// A. Busy branch of runFromChat: from the busy check to its return.
const start = generator.indexOf("async runFromChat(");
assert.notEqual(start, -1, "runFromChat not found");
const busyStart = generator.indexOf("if (this.#busy || this.#createPending || this.#chatPending)", start);
assert.notEqual(busyStart, -1, "busy check not found in runFromChat");
const busyEnd = generator.indexOf("return;", busyStart);
assert.notEqual(busyEnd, -1, "busy branch return not found");
const busyBranch = generator.slice(busyStart, busyEnd);
assert.ok(busyBranch.includes("SIMPLYSF2E.Chat.Busy"), "busy branch should still warn");
assert.ok(!busyBranch.includes("setInput("), "busy branch must not call setInput(");
assert.ok(!busyBranch.includes("#mergeInput("), "busy branch must not call #mergeInput(");

// B. Recent-preview tooltips are plain text.
assert.ok(!template.includes('data-tooltip="{{this.name}}"'), 'template must not use data-tooltip="{{this.name}}"');
assert.ok(!template.includes('data-tooltip="{{this.detail}}"'), 'template must not use data-tooltip="{{this.detail}}"');
assert.ok(template.includes('data-tooltip-text="{{this.name}}"'), "recent name should use data-tooltip-text");
assert.ok(template.includes('data-tooltip-text="{{this.detail}}"'), "recent detail should use data-tooltip-text");

// C. No bare err.message assigned to the displayed error.
for (const [label, source] of [["itemforge-app.mjs", itemforge], ["generator-app.mjs", generator]]) {
  assert.ok(!source.includes("#error = err.message"), `${label} must not contain "#error = err.message"`);
}

console.log("generator-app.r3.test.mjs: all assertions passed");
