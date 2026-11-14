// The tool windows' parts: the config every window and the screenshot
// harness share, the fold carry, and SpfApp's persistent body element.
// Run: node scripts/window-parts.test.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import * as windowParts from "./window-parts.mjs";

if (!vm.SourceTextModule) {
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", import.meta.filename], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

const { WINDOW_PARTS, carryOpenFolds, windowBodyClassName, windowPartsConfig } = windowParts;
const root = new URL("../", import.meta.url);

// --- 1. Config: four windows, three parts each, every template on disk -------
assert.deepEqual(Object.keys(WINDOW_PARTS), ["generator", "itemforge", "shop", "treasure"]);
for (const [windowId, spec] of Object.entries(WINDOW_PARTS)) {
  assert.deepEqual(Object.keys(spec.parts), ["status", "brief", "result"], `${windowId} renders status, brief, result in that order`);
  for (const [partId, path] of Object.entries(spec.parts)) {
    assert.equal(path, `templates/${windowId}-${partId}.hbs`);
    assert.ok(existsSync(new URL(path, root)), `${path} exists`);
    // Foundry refuses a part that renders more or less than one root element.
    const markup = readFileSync(new URL(path, root), "utf8").replace(/\{\{![\s\S]*?\}\}/g, "").trim();
    const rootTag = /^<([a-z]+)\b/.exec(markup)?.[1];
    assert.ok(rootTag, `${path} starts with its root element`);
    assert.ok(markup.endsWith(`</${rootTag}>`), `${path} ends by closing its root <${rootTag}>`);
  }
  const config = windowPartsConfig(windowId, "simplysf2e");
  assert.deepEqual(config.status, { template: `modules/simplysf2e/templates/${windowId}-status.hbs` });
  assert.deepEqual(Object.keys(config), ["status", "brief", "result"]);
}
assert.throws(() => windowPartsConfig("welcome", "simplysf2e"), /unknown tool window/);
assert.throws(() => windowBodyClassName("welcome", {}), /unknown tool window/);

// The status and result roots take no box; the brief's root is the fieldset.
for (const windowId of Object.keys(WINDOW_PARTS)) {
  const read = (partId) => readFileSync(new URL(`templates/${windowId}-${partId}.hbs`, root), "utf8");
  assert.match(read("status"), /<div class="spf-part spf-part-status">\s*\{\{> simplysf2e-statusbar /);
  assert.match(read("result"), /<div class="spf-part spf-part-result">/);
  assert.match(read("brief").trimStart(), /^<fieldset class="spf-inputs spf-card" \{\{#if busy\}\}disabled\{\{\/if\}\}>/);
}
assert.match(readFileSync(new URL("styles/simplysf2e.css", root), "utf8"), /\.simplysf2e \.spf-part\s*\{\s*display:\s*contents;\s*\}/,
  "a part wrapper must take no box, so the body lays its children out as before");

// --- 2. Body classes ----------------------------------------------------------
assert.equal(windowBodyClassName("generator", {}), "spf-window-body simplysf2e-generator");
assert.equal(windowBodyClassName("generator", { monsterMode: true }), "spf-window-body simplysf2e-generator spf-mode-monster");
assert.equal(windowBodyClassName("generator", { monsterMode: false, reskinMode: true, busy: true }),
  "spf-window-body simplysf2e-generator spf-mode-reskin spf-busy");
assert.equal(windowBodyClassName("generator", { monsterMode: true, npcMode: true }), "spf-window-body simplysf2e-generator spf-mode-monster",
  "never two mode classes");
assert.equal(windowBodyClassName("itemforge", { busy: true }), "spf-window-body simplysf2e-generator spf-hud");
assert.equal(windowBodyClassName("shop", {}), "spf-window-body simplysf2e-generator simplysf2e-shop spf-hud");
assert.equal(windowBodyClassName("treasure", {}), "spf-window-body simplysf2e-generator simplysf2e-treasure spf-hud");

// --- 3. Fold carry ------------------------------------------------------------
const fold = (name, open = false) => ({ dataset: { fold: name }, open });
const partWith = (...folds) => ({ querySelectorAll: (selector) => (selector === "details[data-fold]" ? folds : []) });
{
  const next = [fold("advanced"), fold("tokens")];
  assert.equal(carryOpenFolds(partWith(fold("advanced", true), fold("tokens")), partWith(...next)), 1);
  assert.deepEqual(next.map((f) => f.open), [true, false], "an open fold stays open, a closed one stays closed");
}
{
  const next = [fold("stat-check", true)];
  assert.equal(carryOpenFolds(partWith(fold("stat-check", false)), partWith(...next)), 0);
  assert.equal(next[0].open, true, "a fold the template renders open (it holds a problem) is never closed");
}
{
  // Same name several times: matched in order, and a missing one is skipped.
  const next = [fold("review-action"), fold("review-action"), fold("review-action")];
  carryOpenFolds(partWith(fold("review-action"), fold("review-action", true)), partWith(...next));
  assert.deepEqual(next.map((f) => f.open), [false, true, false]);
}
{
  const next = [fold("tokens")];
  assert.equal(carryOpenFolds(partWith(fold("advanced", true)), partWith(...next)), 0, "a different fold is not opened");
  assert.equal(next[0].open, false);
  assert.equal(carryOpenFolds(null, partWith(...next)), 0, "first render: nothing to carry");
  assert.equal(carryOpenFolds(partWith(), null), 0);
}
// Every fold in a tool window's brief or result is named, or it would snap shut on a re-render.
for (const windowId of Object.keys(WINDOW_PARTS)) {
  for (const partId of ["brief", "result"]) {
    const markup = readFileSync(new URL(`templates/${windowId}-${partId}.hbs`, root), "utf8");
    for (const tag of markup.match(/<details\b[^>]*>/g) ?? []) {
      assert.match(tag, /data-fold="[a-z-]+"/, `${windowId}-${partId}.hbs: ${tag} needs a data-fold name`);
    }
  }
}

// --- 4. SpfApp: one persistent body, parts swapped inside it -------------------
// A small stand-in for the DOM calls _replaceHTML makes.
function makeElement(tag = "div") {
  const el = {
    tag, className: "", dataset: {}, children: [], parent: null, folds: [],
    appendChild(child) { child.parent = el; el.children.push(child); return child; },
    replaceChildren(...next) { el.children = []; for (const child of next) el.appendChild(child); },
    replaceWith(next) {
      const siblings = el.parent.children;
      siblings[siblings.indexOf(el)] = next;
      next.parent = el.parent;
      el.parent = null;
    },
    querySelector(selector) {
      if (selector === ":scope > .spf-window-body") return el.children.find((c) => c.className.split(" ").includes("spf-window-body")) ?? null;
      const partId = /^(?::scope > )?\[data-application-part="([a-z]+)"\]$/.exec(selector)?.[1];
      if (partId) return el.children.find((c) => c.dataset.applicationPart === partId) ?? null;
      return null;
    },
    querySelectorAll(selector) { return selector === "details[data-fold]" ? el.folds : []; }
  };
  return el;
}
const partElement = (partId, ...folds) => Object.assign(makeElement(), { dataset: { applicationPart: partId }, folds });

const superCalls = [];
const context = vm.createContext({
  console: { log() {}, warn() {}, error() {}, debug() {} },
  document: { createElement: (tag) => makeElement(tag) },
  game: { i18n: { localize: (key) => key, format: (key) => key } },
  ui: { notifications: { info() {}, warn() {}, error() {} } },
  foundry: {
    applications: {
      instances: { values: () => [][Symbol.iterator]() },
      api: {
        ApplicationV2: class FakeApplicationV2 {
          async _renderHTML() { return {}; }
        },
        DialogV2: {},
        // What Foundry's mixin does with each rendered part: replace the prior
        // element of that part inside `content`, or append a new one.
        HandlebarsApplicationMixin: (Base) => class extends Base {
          _replaceHTML(result, content, options) {
            superCalls.push({ content, parts: Object.keys(result), options });
            for (const [partId, element] of Object.entries(result)) {
              const prior = content.querySelector(`[data-application-part="${partId}"]`);
              if (prior) prior.replaceWith(element);
              else content.appendChild(element);
            }
          }
        }
      }
    }
  }
});
const source = await readFile(new URL("./app-base.mjs", import.meta.url), "utf8");
const appModule = new vm.SourceTextModule(source, { context });
await appModule.link((specifier) => {
  const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .filter((match) => match[2] === specifier).flatMap((match) => match[1].split(",").map((name) => name.trim()));
  return new vm.SyntheticModule(imports, function () {
    for (const name of imports) {
      this.setExport(name, windowParts[name] ?? (name === "MODULE_ID" ? "simplysf2e"
        : name === "ProviderSetupApp" ? class {} : (() => { throw new Error(`Unexpected dependency: ${name}`); })));
    }
  }, { context });
});
await appModule.evaluate();
const { SpfApp } = appModule.namespace;

class ToolApp extends SpfApp {
  static WINDOW_ID = "generator";
  bound = [];
  _onPartRendered(partId, element) {
    super._onPartRendered(partId, element);
    this.bound.push([partId, element]);
  }
}

{
  const app = new ToolApp();
  const content = makeElement("section");
  content.appendChild(makeElement());   // whatever Foundry left in the content

  // First render: every part, monster mode, busy.
  await app._renderHTML({ monsterMode: true, busy: true }, {});
  const first = { status: partElement("status"), brief: partElement("brief", fold("advanced", true)), result: partElement("result", fold("tokens")) };
  app._replaceHTML(first, content, { parts: ["status", "brief", "result"] });
  assert.equal(content.children.length, 1, "the body is the content's only child");
  const body = content.children[0];
  assert.equal(body.className, "spf-window-body simplysf2e-generator spf-mode-monster spf-busy");
  assert.deepEqual(body.children, [first.status, first.brief, first.result], "parts sit inside the body in render order");
  assert.equal(superCalls.at(-1).content, body, "Foundry's replacement runs against the body, not the window content");
  assert.deepEqual(app.bound.map(([id]) => id), ["status", "brief", "result"], "each new part is bound once");

  // The GM opens Token usage, then a click re-renders only the result.
  first.result.folds[0].open = true;
  await app._renderHTML({ monsterMode: true, busy: false }, {});
  const nextResult = partElement("result", fold("tokens"));
  app._replaceHTML({ result: nextResult }, content, { parts: ["result"] });
  assert.equal(content.children[0], body, "the same body element is reused, so its scroll place is kept");
  assert.equal(body.className, "spf-window-body simplysf2e-generator spf-mode-monster", "body classes follow the new context");
  assert.deepEqual(body.children, [first.status, first.brief, nextResult], "status and brief keep their elements");
  assert.equal(nextResult.folds[0].open, true, "the fold the GM opened stays open in the new result");
  assert.equal(first.brief.folds[0].open, true, "the untouched brief keeps its own state");
  assert.deepEqual(app.bound.map(([id]) => id), ["status", "brief", "result", "result"],
    "only the re-rendered part is bound again: the brief's listeners are not doubled");
  assert.equal(app.bound.at(-1)[1], nextResult);
}

// A part whose binding throws does not stop the other parts from binding.
{
  class Faulty extends SpfApp {
    static WINDOW_ID = "shop";
    bound = [];
    _onPartRendered(partId) {
      if (partId === "status") throw new Error("boom");
      this.bound.push(partId);
    }
  }
  const app = new Faulty();
  const content = makeElement("section");
  await app._renderHTML({}, {});
  app._replaceHTML({ status: partElement("status"), brief: partElement("brief") }, content, {});
  assert.deepEqual(app.bound, ["brief"]);
  assert.equal(content.children[0].className, "spf-window-body simplysf2e-generator simplysf2e-shop spf-hud");
}

// A window that names no WINDOW_ID keeps Foundry's own layout untouched.
{
  const app = new (class extends SpfApp {})();
  const content = makeElement("section");
  const only = partElement("body");
  await app._renderHTML({}, {});
  app._replaceHTML({ body: only }, content, {});
  assert.deepEqual(content.children, [only]);
  assert.equal(superCalls.at(-1).content, content);
}

// --- 5. Every render that names parts names real ones -------------------------
for (const [file, windowId] of [["generator-app.mjs", "generator"], ["itemforge-app.mjs", "itemforge"], ["shop-app.mjs", "shop"], ["treasure-app.mjs", "treasure"], ["app-base.mjs", "generator"]]) {
  const text = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
  for (const match of text.matchAll(/parts:\s*\[([^\]]*)\]/g)) {
    const ids = match[1].split(",").map((id) => id.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    assert.ok(ids.length, `${file}: a render must not name an empty part list`);
    for (const id of ids) assert.ok(id in WINDOW_PARTS[windowId].parts, `${file}: unknown part "${id}"`);
  }
}

console.log("window-parts.test.mjs: parts config, body classes, fold carry and the persistent body hold");
