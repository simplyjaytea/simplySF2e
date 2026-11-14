// The tool windows' parts: the config every window and the screenshot
// harness share, the fold carry, and SpfApp's persistent body element.
// Run: node scripts/window-parts.test.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import * as windowParts from "./window-parts.mjs";
import * as sounds from "./sounds.mjs";

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
  assert.match(read("brief").trimStart(), /^<fieldset class="spf-inputs spf-card(?:\{\{#if briefFold\.collapsed\}\} spf-brief-collapsed\{\{\/if\}\})?" \{\{#if busy\}\}disabled\{\{\/if\}\}>/);
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
// Interface sounds: the level the fake client has set, and every cue the app asked for.
let soundLevelNow = "off";
const cuesPlayed = [];
const cueMocks = {
  interfaceSoundLevel: () => soundLevelNow,
  interfaceSoundVolume: () => 0.5,
  playCue: (name, options) => { cuesPlayed.push([name, options.level, options.volume]); return 1; }
};
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
      this.setExport(name, cueMocks[name] ?? windowParts[name] ?? sounds[name] ?? (name === "MODULE_ID" ? "simplysf2e"
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

// --- 6. Which parts each action renders ---------------------------------------
// A click that changes one region must leave the others alone, above all the
// brief the GM may be typing in.
const fnBody = (text, signature) => {
  const start = text.indexOf(signature);
  assert.notEqual(start, -1, `${signature} not found`);
  let depth = 0;
  for (let i = text.indexOf("{", start + signature.length - 1); i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error(`${signature} has no end`);
};
const sources = Object.fromEntries(await Promise.all(["generator", "itemforge", "shop", "treasure"]
  .map(async (name) => [name, await readFile(new URL(`./${name}-app.mjs`, import.meta.url), "utf8")])));
const expectParts = (app, signature, parts) => {
  const renders = fnBody(sources[app], signature).match(/this\.render\([^)]*\)/g) ?? [];
  assert.deepEqual(renders, [`this.render({ parts: [${parts.map((id) => `"${id}"`).join(", ")}] })`],
    `${app}: ${signature} renders only ${parts.join(" + ")}`);
};
expectParts("generator", "async #refitMemberLoot(member) {", ["result"]);
expectParts("generator", "static async #onForgetRecent(event, target) {", ["result"]);
expectParts("generator", "static async #onUseParty() {", ["brief"]);
expectParts("generator", "#stepReskinLevel(delta) {", ["brief", "result"]);
expectParts("generator", "static async #onDismissCharacterReview() {", ["brief", "result"]);
expectParts("generator", "static async #onGenerateAnother() {", ["brief", "result"]);
expectParts("shop", "static async #onRemoveStock(_event, target) {", ["result"]);
expectParts("treasure", "static async #onRemoveItem(_event, target) {", ["result"]);
expectParts("treasure", "static async #onUseParty() {", ["brief"]);
for (const app of Object.keys(sources)) expectParts(app, "static async #onAuthorizeApiKey(_event, target) {", ["status"]);
// A changed connection touches only the status strip, in this window and in the others.
assert.match(fnBody(source, "async _switchActiveConnection(id) {"), /await selectProviderConnection\(id\);\s*await this\._renderStatus\(\);/);
assert.match(fnBody(source, "export async function refreshOtherConnectionViews(self) {"), /app\._preserveForm\(\);\s*await app\._renderStatus\(\);/);
// A step change that cannot patch the card in place renders the part that holds it.
assert.match(fnBody(source, "async _setStep(key) {"), /await this\.render\(this\.constructor\.WINDOW_ID \? \{ parts: \["result"\] \} : \{\}\);/);

// --- 7. A run always unlocks the window ---------------------------------------
// Between the busy flag going up and the `try` that guards it there is no
// await: nothing can throw or yield while the window is locked without a
// `finally` to unlock it. Every busy run ends through #endBusy.
{
  const generator = sources.generator;
  const starts = [...generator.matchAll(/^    this\.#beginBusy\(\);\n/gm)];
  assert.equal(starts.length, 10, "ten Generator runs take the busy flag");
  for (const start of starts) {
    const line = generator.slice(0, start.index).split("\n").length;
    const tryAt = generator.indexOf("\n    try {\n", start.index);
    assert.notEqual(tryAt, -1, `generator-app.mjs:${line} busy start has a try`);
    const gap = generator.slice(start.index, tryAt);
    assert.ok(gap.split("\n").length <= 16, `generator-app.mjs:${line} the try follows the busy start`);
    assert.doesNotMatch(gap, /\bawait\b/, `generator-app.mjs:${line} nothing awaits between the busy start and its try`);
    const finallyAt = generator.indexOf("\n    } finally {\n", tryAt);
    assert.match(generator.slice(finallyAt, finallyAt + 400), /this\.#endBusy\((?:\{ finishRun: true \})?\);/,
      `generator-app.mjs:${line} the run's finally leaves the busy state`);
  }
  assert.equal((generator.match(/this\.#busy = (?:true|false);/g) ?? []).length, 2,
    "the busy flag changes only in #beginBusy and #endBusy");
}

// --- 8. Console layout: brief fold, arrival, fixed height, pinned bars ----------
{
  const { CONSOLE_HEIGHT, briefFoldContext, resultArrives } = windowParts;

  // The brief folds once the active mode shows a result, and only then.
  assert.deepEqual(briefFoldContext({}), { foldable: false, collapsed: false, hasResult: false });
  for (const key of ["preview", "encounterPreview", "pcPreview", "created", "characterReview"]) {
    assert.deepEqual(briefFoldContext({ [key]: {} }), { foldable: true, collapsed: true, hasResult: true }, `${key} folds the brief`);
  }
  // Reskin never folds: its brief holds the source and the re-level table.
  assert.deepEqual(briefFoldContext({ reskinMode: true, reskinPreview: {} }), { foldable: false, collapsed: false, hasResult: true });
  // The GM's own toggle wins until the next run ends.
  assert.equal(briefFoldContext({ preview: {} }, { override: false }).collapsed, false);
  assert.equal(briefFoldContext({ preview: {} }, { override: true }).collapsed, true);
  assert.equal(briefFoldContext({}, { override: true }).collapsed, false, "nothing to fold away without a result");
  // During a run the fold keeps the state the run started in.
  assert.equal(briefFoldContext({ busy: true }, { auto: false }).foldable, false, "a first run leaves the form open");
  assert.equal(briefFoldContext({ busy: true }, { auto: true }).collapsed, true, "a later run leaves the form folded");
  assert.equal(briefFoldContext({ busy: true, preview: {} }, { auto: false }).collapsed, false, "a draft shown mid-run does not fold the form");
  assert.equal(briefFoldContext({ busy: true }, { auto: true, override: false }).collapsed, false);

  // A card arrives when its kind changes, never on a re-render, never on open.
  assert.equal(resultArrives({ busy: false, kind: "preview" }, null), false, "a window that opens on a stored result is still");
  assert.equal(resultArrives({ busy: false, kind: "preview" }, { busy: false, kind: "" }), true);
  assert.equal(resultArrives({ busy: true, kind: "preview" }, { busy: true, kind: "" }), true, "the draft arrives when it first shows");
  assert.equal(resultArrives({ busy: false, kind: "preview" }, { busy: true, kind: "preview" }), false, "the Generator's finished draft does not arrive twice");
  assert.equal(resultArrives({ busy: false, kind: "created" }, { busy: true, kind: "preview" }), true);
  assert.equal(resultArrives({ busy: false, kind: "preview" }, { busy: false, kind: "preview" }), false, "a member +/- re-render is still");
  assert.equal(resultArrives({ busy: false, kind: "" }, { busy: false, kind: "preview" }), false);
  assert.equal(resultArrives({ busy: false, kind: "card" }, { busy: true, kind: "card" }, { afterRun: true }), true, "a shop replaced by a run arrives");
  assert.equal(resultArrives({ busy: true, kind: "card" }, { busy: true, kind: "card" }, { afterRun: true }), false);

  // SpfApp plays it from the result part only, and the Generator opts out of the after-run case.
  const base = sources.base ?? readFileSync(new URL("scripts/app-base.mjs", root), "utf8");
  assert.match(base, /if \(partId === "result"\) \{\s*this\._playResultArrival\(element\);\s*this\._playResultCue\(element\);\s*\}/);
  assert.match(base, /this\._resultState = null;\s+\/\/ a new frame/);
  assert.match(base, /if \(!arrives\) return;\s*card\.classList\?\.add\("spf-arrive"\);/);
  assert.match(sources.generator, /static ARRIVE_AFTER_RUN = false;/);
  // Flash: set only on a successful reroll, played once by the result part, never while busy.
  assert.match(sources.generator, /this\.#manifest = manifest;\s*this\.#flashPick = '\[data-section="loot"\]';\s*\} catch/);
  assert.match(sources.generator, /this\.#manifest = manifest;\s*this\.#flashPick = `\[data-action="rerollPick"\]\[data-kind="\$\{kind\}"\]\[data-index="\$\{index\}"\]`;\s*\} catch/);
  assert.equal(sources.generator.match(/this\.#flashPick = [^n]/g).length, 2, "nothing else starts a flash");
  assert.match(sources.generator, /if \(partId === "result"\) this\.#playFlash\(element\);/);
  assert.match(sources.generator, /#playFlash\(element\) \{\s*if \(this\.#busy \|\| !this\.#flashPick\) return;\s*const selector = this\.#flashPick;\s*this\.#flashPick = null;/);

  // Every tool window opens at the shared fixed height.
  assert.ok(Number.isInteger(CONSOLE_HEIGHT) && CONSOLE_HEIGHT >= 600 && CONSOLE_HEIGHT <= 760);
  for (const file of ["generator", "itemforge", "shop", "treasure"]) {
    const app = readFileSync(new URL(`scripts/${file}-app.mjs`, root), "utf8");
    assert.match(app, /position: \{ width: 720, height: CONSOLE_HEIGHT \},/, `${file} opens at the console height`);
    assert.match(app, /resizable: true/, `${file} stays resizable`);
  }

  // The brief template: the fold hides fields without removing them from the
  // form, the mode tiles and the run row stay outside it.
  const brief = readFileSync(new URL("templates/generator-brief.hbs", root), "utf8");
  const bodyStart = brief.indexOf('<div class="spf-brief-body" id="spf-generator-brief-body">');
  const runRow = brief.indexOf('<div class="spf-generate-row">');
  assert.ok(bodyStart > 0 && runRow > bodyStart);
  assert.ok(brief.indexOf('class="spf-mode-toggle"') < bodyStart, "mode tiles are never folded away");
  assert.ok(brief.indexOf('name="prompt"') > bodyStart && brief.lastIndexOf('name="prompt"') < runRow, "the prompt is inside the fold");
  assert.match(brief.slice(bodyStart, runRow), /<\/details>\s*\{\{\/unless\}\}\s*<\/div>\s*$/, "the fold body closes right before the run row");
  assert.match(brief, /\{\{#if briefFold\.foldable\}\}\s*<button type="button" class="spf-brief-summary" data-action="toggleBrief" aria-expanded="\{\{#if briefFold\.collapsed\}\}false\{\{else\}\}true\{\{\/if\}\}" aria-controls="spf-generator-brief-body">/);
  assert.match(sources.generator, /toggleBrief: GeneratorApp\.#onToggleBrief,/);
  assert.match(fnBody(sources.generator, "#endBusy({ finishRun = false } = {}) {"), /this\.#briefOverride = null;/);
  assert.doesNotMatch(fnBody(sources.generator, "static #onToggleBrief(_event, target) {"), /\.render\(/, "a fold toggle never re-renders");

  // The labels say what the buttons do: the main button creates in one click.
  const lang = JSON.parse(readFileSync(new URL("lang/en.json", root), "utf8")).SIMPLYSF2E;
  assert.match(fnBody(sources.generator, "static async #onGenerate() {"), /create: true/);
  assert.match(fnBody(sources.generator, "static async #onPreviewPlan() {"), /create: false/);
  for (const key of ["GenerateMonster", "GenerateNpc", "GenerateEncounter", "GenerateCharacter", "GenerateAnotherVersion"]) {
    assert.match(lang.Generator[key], /^Create /, `${key} creates, and says so`);
  }
  assert.match(lang.Generator.GenerateReskin, /create/);
  assert.equal(lang.Generator.PreviewPlan, "Preview first");
  for (const key of ["EmptyHint", "EmptyHintReskin", "EmptyHintReskinReady"]) {
    assert.match(lang.Generator[key], /in one step\. Preview first shows it here and creates nothing until you confirm\.$/, `${key} names both paths`);
  }
  // Item Forge previews first, so it keeps "Generate".
  assert.match(readFileSync(new URL("templates/itemforge-brief.hbs", root), "utf8"), /SIMPLYSF2E\.ItemForge\.GenerateAnotherVersion/);
  assert.match(lang.ItemForge.GenerateAnotherVersion, /^Generate /);

  // CSS: pinned bars, no body cap, two panes, and motion that can be turned off.
  const css = readFileSync(new URL("styles/simplysf2e.css", root), "utf8");
  const generatorCss = readFileSync(new URL("styles/apps/generator.css", root), "utf8");
  assert.match(css, /\.spf-window-body\.simplysf2e-generator \{\s*max-height: none;/);
  assert.match(css, /\.spf-inputs > \.spf-generate-row,\s*\.simplysf2e \.spf-window-body\.simplysf2e-generator \.spf-preview > \.spf-actions \{\s*position: sticky;/);
  assert.match(css, /@container spf-frame \(min-width: 900px\) \{\s*\.simplysf2e \.spf-window-body\.simplysf2e-generator \{\s*display: grid;/);
  assert.match(generatorCss, /@container spf-frame \(min-width: 900px\) \{\s*\.simplysf2e \.spf-brief-collapsed > \.spf-brief-body \{\s*display: block;/, "two panes never hide the form");
  const reduced = (text) => text.slice(text.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduced(css), /\.simplysf2e \.spf-arrive,\s*\.simplysf2e \.spf-open \{\s*animation: none;/);
  assert.match(reduced(generatorCss), /\.simplysf2e \.spf-unfold \{\s*animation: none;/);
  assert.match(reduced(generatorCss), /\.simplysf2e \.spf-brief-chevron \{\s*transition: none;/);
  assert.match(reduced(generatorCss), /\.simplysf2e \.spf-mode-toggle\.spf-slide::before \{\s*animation: none;/);
  assert.match(reduced(generatorCss), /\.simplysf2e \.spf-flash::after,\s*\.simplysf2e \.spf-flash \.spf-reroll-pick i \{\s*animation: none;/);
  // One-time motion moves only transform and opacity.
  // Every keyframe in the module moves only transform and opacity, so no
  // animation lays out or repaints.
  const seen = [];
  for (const text of [css, generatorCss]) {
    for (const [, name, frames] of text.matchAll(/@keyframes ([a-z-]+) \{([\s\S]*?)\n\}/g)) {
      const props = [...frames.matchAll(/[{;]\s*([a-z-]+)\s*:/g)].map((m) => m[1]);
      assert.ok(props.length > 0 && props.every((prop) => ["opacity", "transform"].includes(prop)), `${name} animates ${props.join(", ")}`);
      seen.push(name);
    }
  }
  for (const name of ["spf-arrive", "spf-unfold", "spf-flash", "spf-turn", "spf-slide", "spf-step-slide", "spf-await-pulse", "spf-telemetry-blink",
    "spf-reveal", "spf-scan", "spf-streak", "spf-fade", "spf-pop", "spf-shake", "spf-ring"]) {
    assert.ok(seen.includes(name), `${name} is checked`);
  }
  assert.equal(new Set(seen).size, seen.length, "no keyframe is defined twice");
}

// 9. Slice 5: the mode marker slides only on a real mode change, and every
// window's content rises once per open.
{
  const { MODE_ORDER, modeSlideFrom } = await import("./window-parts.mjs");
  assert.deepEqual(MODE_ORDER, ["monster", "npc", "encounter", "character", "reskin"]);
  assert.equal(modeSlideFrom(null, "monster"), null, "the first render does not slide");
  assert.equal(modeSlideFrom("npc", "npc"), null, "a re-render in the same mode does not slide");
  assert.equal(modeSlideFrom("monster", "reskin"), 0);
  assert.equal(modeSlideFrom("reskin", "npc"), 4);
  assert.equal(modeSlideFrom("npc", null), null, "a brief without tiles does not slide");
  assert.equal(modeSlideFrom("bogus", "npc"), null);
  const read = (path) => readFileSync(new URL(path, root), "utf8");
  const generatorApp = read("scripts/generator-app.mjs");
  assert.match(generatorApp, /if \(partId !== "brief"\) return;\s*this\.#playModeSlide\(element\);/);
  assert.match(generatorApp, /const from = modeSlideFrom\(this\.#modeShown, mode\);\s*this\.#modeShown = mode;\s*if \(from === null\) return;\s*toggle\.style\.setProperty\("--spf-mode-from", String\(from\)\);\s*toggle\.classList\.add\("spf-slide"\);/);
  const appBase = read("scripts/app-base.mjs");
  assert.match(appBase, /static ARRIVE_ON_OPEN = true;/);
  assert.match(appBase, /this\._keysElement = this\.element;\s*(?:\/\/[^\n]*\s*)?if \(this\.constructor\.ARRIVE_ON_OPEN\) this\.element\.querySelector\?\.\("\.window-content"\)\?\.classList\?\.add\("spf-open"\);/,
    "the rise is added once per window frame, never on a re-render");
  const opens = ["welcome", "whats-new", "provider-setup", "sources", "manage-presets", "generator", "itemforge", "shop", "treasure"]
    .filter((name) => /static ARRIVE_ON_OPEN = true;/.test(read(`scripts/${name}-app.mjs`)));
  assert.deepEqual(opens, [], "every window rises on open since the pop round; none overrides the default");
}

// 10. Slice 6: interface sounds. The result part decides the cue; nothing
// plays while the setting is off, and a cancelled run is not an error.
{
  const result = ({ kind = null, error = false } = {}) => ({
    querySelector: (selector) => selector === ".spf-preview" ? (kind === null ? null : { dataset: kind === "card" ? {} : { result: kind }, classList: { add() {} } })
      : selector === ".spf-error-notice" ? (error ? {} : null) : null
  });
  const render = (app, busy, shown) => { app._renderBusy = busy; app._playResultCue(result(shown)); };
  const app = new SpfApp();
  cuesPlayed.length = 0;

  // Off: the state is still tracked, but nothing is played.
  soundLevelNow = "off";
  render(app, false, {});
  render(app, true, {});
  render(app, false, { kind: "preview" });
  assert.deepEqual(cuesPlayed, []);

  soundLevelNow = "quiet";
  render(app, true, { kind: "preview" });                 // Create pressed on a preview
  render(app, true, { kind: "preview" });                 // a re-render mid-run is silent
  render(app, false, { kind: "created" });
  render(app, false, { kind: "created" });                // idle re-render is silent
  assert.deepEqual(cuesPlayed, [["start", "quiet", 0.5], ["created", "quiet", 0.5]]);

  // A run that fails sounds the error cue; a run the GM cancelled does not.
  cuesPlayed.length = 0;
  render(app, true, { kind: "created" });
  app._recordFailure(new Error("boom"), "generation", "boom");
  render(app, false, { error: true });
  render(app, true, {});
  app._recordFailure(Object.assign(new Error("stopped"), { cancelled: true }), "generation", "stopped");
  render(app, false, { error: true });
  render(app, true, {});
  render(app, false, { kind: "preview" });
  assert.deepEqual(cuesPlayed.map(([name]) => name), ["start", "error", "start", "start", "ready"],
    "the cancel is silent, and the next run is not muted by it");

  // Item Forge, Shop and Treasure consume the draft on create: card, then nothing.
  cuesPlayed.length = 0;
  const shop = new SpfApp();
  render(shop, false, { kind: "card" });
  render(shop, true, { kind: "card" });
  render(shop, false, {});
  assert.deepEqual(cuesPlayed.map(([name]) => name), ["start", "created"]);
  soundLevelNow = "off";
}

// 11. Pop round (JT, 2026-11-14): flashier, still event-driven, still off
// under reduced motion, and never in the way of a click.
{
  const css = readFileSync(new URL("styles/simplysf2e.css", root), "utf8");
  const generatorCss = readFileSync(new URL("styles/apps/generator.css", root), "utf8");
  const plain = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "");
  const reduced = (text) => plain(text).slice(plain(text).lastIndexOf("@media (prefers-reduced-motion: reduce)"));

  // The reveal never staggers a card's action bar: Create is usable at once.
  assert.match(css, /\.simplysf2e \.spf-preview\.spf-arrive > :not\(\.spf-actions, \.spf-scan\) \{\s*--spf-i: 10;\s*animation: spf-reveal var\(--spf-motion\) var\(--spf-ease-out\) backwards;\s*animation-delay: calc\(var\(--spf-i\) \* var\(--spf-stagger\)\);/);
  const steps = [...css.matchAll(/\.spf-preview\.spf-arrive > :nth-child\((\d+)\) \{ --spf-i: (\d+); \}/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(steps, Array.from({ length: 10 }, (_, i) => [i + 1, i]), "ten steps, then the rest together");
  const ms = (name) => Number(css.match(new RegExp(`${name}: (\\d+)ms;`))[1]);
  assert.ok(10 * ms("--spf-stagger") + ms("--spf-motion") <= 600, "the longest card settles within 0.6 s");
  assert.ok(ms("--spf-motion-sweep") <= 600 && ms("--spf-motion-slow") <= 350);

  // Decoration takes no clicks.
  for (const selector of ["\\.spf-scan", "button\\.spf-primary:not\\(:disabled\\)::after", "\\.spf-preview\\.spf-arrive \\.spf-statblock-header::after"]) {
    assert.match(plain(css), new RegExp(`\\.simplysf2e ${selector} \\{[^}]*pointer-events: none;`), `${selector} takes no pointer events`);
  }
  assert.match(plain(generatorCss), /\.spf-preview\.spf-arrive \.spf-status-title i::after \{[^}]*pointer-events: none;/);

  // No new idle loop: the only endless animations are the run's sheen and
  // blink and the "waiting for you" pulse.
  const endless = [...plain(css + generatorCss).matchAll(/animation:\s*(spf-[a-z-]+)[^;]*infinite/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(endless)], ["spf-await-pulse", "spf-step-slide", "spf-telemetry-blink"]);

  // Transitions move transform, or a row's background, or the bar's width.
  const transitions = [...plain(css + generatorCss).matchAll(/transition:\s*([a-z-]+)/g)].map((m) => m[1]);
  assert.ok(transitions.every((prop) => ["transform", "background-color", "width", "none"].includes(prop)), transitions.join(", "));

  // Reduced motion switches every piece of it off.
  const off = reduced(css);
  assert.match(off, /\.simplysf2e \.spf-arrive,\s*\.simplysf2e \.spf-open \{\s*animation: none;/);
  assert.match(off, /\.spf-preview\.spf-arrive > :not\(\.spf-actions, \.spf-scan\),[^{]*\.simplysf2e \.spf-shake \{\s*animation: none;/);
  // Effects inside a card key off the arriving card, never off an open window.
  for (const [, selectors] of plain(css + generatorCss).matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (const selector of selectors.split(",").map((part) => part.trim()).filter((part) => /\.spf-arrive [.>]/.test(part) || /\.spf-arrive > /.test(part))) {
      assert.match(selector, /\.spf-preview\.spf-arrive /, `${selector} must name the card`);
    }
  }
  assert.doesNotMatch(plain(css + generatorCss), /\.spf-open [.>:]/, "nothing is styled by being inside an open window");
  assert.match(off, /\.simplysf2e \.spf-scan \{\s*display: none;/);
  assert.match(off, /\.simplysf2e \.spf-icon-btn > i,\s*\.simplysf2e button\.spf-primary:not\(:disabled\):hover::after \{\s*transition: none;/);
  assert.match(off, /\.window-content button:not\(:disabled\):active,\s*\.simplysf2e \.spf-icon-btn:not\(:disabled\):is\(:hover, :focus-visible\) > i \{\s*transform: none;/);
  assert.match(off, /button\.spf-primary:not\(:disabled\)::after \{\s*display: none;/);
  const offGenerator = reduced(generatorCss);
  assert.match(offGenerator, /\.spf-review-actions::before,\s*\.simplysf2e \.spf-stat-check-attention::before \{\s*animation: none;/);
  assert.match(offGenerator, /\.spf-preview\.spf-arrive \.spf-stat-strip > div,\s*\.simplysf2e \.spf-preview\.spf-arrive \.spf-status-title i,\s*\.simplysf2e \.spf-mode-toggle\.spf-slide label\.spf-mode-active > i \{\s*animation: none;/);
  assert.match(offGenerator, /\.spf-preview\.spf-arrive \.spf-status-title i::after \{\s*display: none;/);
  // Every selector that starts an animation outside the reduced block is named inside it.
  for (const [text, block] of [[css, off], [generatorCss, offGenerator]]) {
    const body = plain(text).slice(0, plain(text).lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    for (const [, selectors] of body.matchAll(/([^{}]+)\{[^{}]*\banimation:\s*spf-(?!step-slide|telemetry-blink)[a-z-]+/g)) {
      for (const selector of selectors.split(",").map((part) => part.trim())) {
        assert.ok(block.includes(selector), `reduced motion must switch off ${selector}`);
      }
    }
  }

  // The scan line: added to an arriving card, hidden from assistive tech, removed when it ends.
  const made = [];
  const card = (kind) => {
    const children = [];
    const self = {
      dataset: { result: kind },
      classList: { names: [], add(name) { this.names.push(name); } },
      ownerDocument: {
        createElement: (tag) => {
          const el = { tag, attrs: {}, listeners: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(type, fn, opts) { this.listeners[type] = [fn, opts]; }, remove() { children.splice(children.indexOf(el), 1); } };
          made.push(el);
          return el;
        }
      },
      append: (el) => children.push(el),
      children
    };
    return self;
  };
  const part = (cardNow) => ({ querySelector: (selector) => selector === ".spf-preview" ? cardNow : null });
  const app = new SpfApp();
  app._renderBusy = false;
  const stored = card("preview");
  app._playResultArrival(part(stored));
  assert.deepEqual([stored.classList.names, stored.children.length], [[], 0], "a stored result shown on open neither rises nor scans");
  app._playResultArrival(part(null));
  const fresh = card("preview");
  app._playResultArrival(part(fresh));
  assert.deepEqual(fresh.classList.names, ["spf-arrive"]);
  assert.equal(fresh.children.length, 1);
  const scan = fresh.children[0];
  assert.deepEqual([scan.tag, scan.className, scan.attrs["aria-hidden"]], ["span", "spf-scan", "true"]);
  assert.equal(scan.listeners.animationend[1].once, true);
  scan.listeners.animationend[0]();
  assert.equal(fresh.children.length, 0, "the scan element is removed when its sweep ends");
  app._playResultArrival(part(fresh));
  assert.equal(fresh.children.length, 0, "a re-render of the same card does not scan again");

  // The error shake follows the same decision as the error cue, with sounds off.
  soundLevelNow = "off";
  cuesPlayed.length = 0;
  const notice = { classList: { names: [], add(name) { this.names.push(name); } } };
  const failing = new SpfApp();
  const show = (busy, error) => { failing._renderBusy = busy; failing._playResultCue({ querySelector: (selector) => selector === ".spf-error-notice" && error ? notice : null }); };
  show(false, false);
  show(true, false);
  failing._recordFailure(new Error("boom"), "generation", "boom");
  show(false, true);
  assert.deepEqual(notice.classList.names, ["spf-shake"]);
  show(false, true);
  assert.deepEqual(notice.classList.names, ["spf-shake"], "an idle re-render does not shake again");
  show(true, false);
  failing._recordFailure(Object.assign(new Error("stopped"), { cancelled: true }), "generation", "stopped");
  show(false, true);
  assert.deepEqual(notice.classList.names, ["spf-shake"], "a cancelled run does not shake");
  // An error box still on screen when the next run starts is not shaken by the start.
  const stale = { classList: { names: [], add(name) { this.names.push(name); } } };
  failing._playResultCue({ querySelector: () => null });
  failing._renderBusy = true;
  failing._playResultCue({ querySelector: (selector) => selector === ".spf-error-notice" ? stale : null });
  assert.deepEqual(stale.classList.names, [], "only the error cue shakes");
  assert.deepEqual(cuesPlayed, []);
}

console.log("window-parts.test.mjs: parts config, body classes, fold carry, the persistent body and the console layout hold");
