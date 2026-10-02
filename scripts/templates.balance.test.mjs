// Every Handlebars block helper must close with its own name, and every
// <div> must close. A missing {{#each}} makes Handlebars refuse to compile
// the whole template, so the window never opens; an unclosed <div> silently
// breaks the layout. Neither is caught by `node --check`.
// Run: node scripts/templates.balance.test.mjs

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../templates/", import.meta.url);
const files = readdirSync(dir).filter((name) => name.endsWith(".hbs"));
assert.ok(files.includes("generator.hbs"), "templates directory must be found");

for (const file of files) {
  const source = readFileSync(new URL(file, dir), "utf8").replace(/\{\{!--[\s\S]*?--\}\}|\{\{![\s\S]*?\}\}/g, "");
  const stack = [];
  for (const match of source.matchAll(/\{\{~?([#/])\s*([\w-]+)/g)) {
    const line = source.slice(0, match.index).split("\n").length;
    if (match[1] === "#") stack.push({ name: match[2], line });
    else {
      const open = stack.pop();
      assert.ok(open, `${file}:${line} closes {{/${match[2]}}} with no open block`);
      assert.equal(open.name, match[2], `${file}:${line} closes {{/${match[2]}}} but {{#${open.name}}} opened at line ${open.line}`);
    }
  }
  assert.deepEqual(stack, [], `${file} leaves blocks open`);
  const opens = source.match(/<div\b/g)?.length ?? 0;
  const closes = source.match(/<\/div>/g)?.length ?? 0;
  assert.equal(opens, closes, `${file} has ${opens} <div> but ${closes} </div>`);
}
console.log(`templates.balance.test.mjs: ${files.length} templates have balanced blocks and divs`);
