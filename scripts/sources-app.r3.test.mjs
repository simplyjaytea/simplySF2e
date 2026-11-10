// Compendium Sources window: Enter in the filter must not submit the form.
// Source scan (the app class cannot be imported under Node).
// Run: node scripts/sources-app.r3.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./sources-app.mjs", import.meta.url), "utf8");

// The filter input gets a keydown listener in _onRender, next to its input listener.
const inputAt = source.indexOf('filterInput?.addEventListener("input", update)');
const keydownAt = source.indexOf('filterInput?.addEventListener("keydown"');
assert.ok(inputAt >= 0, "filter input listener is bound in _onRender");
assert.ok(keydownAt > inputAt, "filter keydown listener is bound with the input listener");

// The handler prevents Enter, so the form's implicit submit (save and close) does not run.
const handler = source.slice(keydownAt, source.indexOf("});", keydownAt) + 3);
assert.match(handler, /event\.key === "Enter"/, "handler checks for Enter");
assert.match(handler, /event\.preventDefault\(\)/, "Enter is prevented");

// Closing on submit is unchanged.
assert.match(source, /closeOnSubmit: true/, "closeOnSubmit untouched");

console.log("sources-app.r3.test.mjs: ok");
