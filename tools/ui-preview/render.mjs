// Renders module templates to static HTML with Handlebars, standing in for
// Foundry's Handlebars pipeline. Pure Node, no browser.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import { WINDOW_PARTS, windowBodyClassName } from "../../scripts/window-parts.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const REPO = join(here, "..", "..");
// Foundry ships Font Awesome 6 itself; the free npm build stands in for it. A
// CDN link would need the sandbox TLS proxy to be trusted by the browser.
const FONT_AWESOME = "tools/ui-preview/node_modules/@fortawesome/fontawesome-free/css/all.min.css";

function flatten(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, path, out);
    else out[path] = String(value);
  }
  return out;
}

export const LANG = flatten(JSON.parse(readFileSync(join(REPO, "lang", "en.json"), "utf8")));
export const MODULE_STYLES = JSON.parse(readFileSync(join(REPO, "module.json"), "utf8")).styles;

// The few sf2e/pf2e system strings a fixture passes through `localize` (a
// ChoiceSet prompt in the character review). Foundry resolves them from the
// system's own language file, which the harness does not load.
const SYSTEM_LANG = { "PF2E.UI.RuleElements.ChoiceSet.Prompt": "Make a selection." };

/** Foundry-style `{name}` interpolation; a missing key renders visibly. */
export function localize(key, data = {}) {
  if (typeof key === "string" && key in SYSTEM_LANG) return SYSTEM_LANG[key];
  if (typeof key !== "string" || !(key in LANG)) return `⟦${key}⟧`;
  return LANG[key].replace(/\{(\w+)\}/g, (match, name) => (name in data ? String(data[name]) : match));
}

/** A fresh Handlebars environment so helper/partial state never leaks between runs. */
export function createEnvironment(missing = null) {
  const hbs = Handlebars.create();
  hbs.registerHelper("localize", (key, options) => localize(key, options?.hash ?? {}));
  hbs.registerHelper("eq", (a, b) => a === b);
  hbs.registerPartial("simplysf2e-progress", readFileSync(join(REPO, "templates", "_progress.hbs"), "utf8"));
  // The status strip takes hash arguments, so Handlebars hands it a plain copy
  // of the context. Watch that copy again, or a key the strip reads and a
  // fixture lacks would render blank without failing the run.
  const statusbar = hbs.compile(readFileSync(join(REPO, "templates", "_statusbar.hbs"), "utf8"));
  hbs.registerPartial("simplysf2e-statusbar", (context, options) =>
    statusbar(missing ? watch(context, missing) : context, options));
  return hbs;
}

export const APPS = {
  generator: { title: "SIMPLYSF2E.Generator.Title", icon: "fa-solid fa-microchip", tag: "form" },
  itemforge: { title: "SIMPLYSF2E.ItemForge.Title", icon: "fa-solid fa-gears", tag: "form" },
  shop: { title: "SIMPLYSF2E.Shop.Title", icon: "fa-solid fa-store", tag: "form" },
  treasure: { title: "SIMPLYSF2E.Treasure.Title", icon: "fa-solid fa-gem", tag: "form" },
  "provider-setup": { template: "provider-setup.hbs", title: "SIMPLYSF2E.ProviderSetup.Title", icon: "fa-solid fa-plug-circle-check", tag: "form" },
  sources: { template: "sources.hbs", title: "SIMPLYSF2E.Sources.Title", icon: "fa-solid fa-book-atlas", tag: "form" },
  "manage-presets": { template: "manage-presets.hbs", title: "SIMPLYSF2E.Presets.ManageTitle", icon: "fa-solid fa-bookmark", tag: "div" },
  "whats-new": { template: "whats-new.hbs", title: "SIMPLYSF2E.WhatsNew.Title", icon: "fa-solid fa-sparkles", tag: "div" },
  welcome: { template: "welcome.hbs", title: "SIMPLYSF2E.Welcome.Title", icon: "fa-solid fa-rocket", tag: "div" }
};

/**
 * Wraps `context` (and, lazily, every nested object and array) in a Proxy that
 * records each property the template reads which the fixture does not define,
 * as a dotted path. The real context builders return every key they have
 * (null or "" when empty), so a read of an absent key means the fixture
 * drifted and would render a silent blank. Array indexes and `length` are
 * never reported; Handlebars also probes `toString`-style inherited names,
 * which `in` covers.
 */
function watch(value, missing, path = "") {
  if (value === null || typeof value !== "object") return value;
  return new Proxy(value, {
    get(target, prop, receiver) {
      if (typeof prop !== "string") return Reflect.get(target, prop, receiver);
      if (!(prop in target)) {
        if (!Array.isArray(target) || !/^\d+$/.test(prop)) missing.add(path ? `${path}.${prop}` : prop);
        return undefined;
      }
      const child = Reflect.get(target, prop, receiver);
      return typeof child === "function" ? child : watch(child, missing, Array.isArray(target) ? `${path}[]` : path ? `${path}.${prop}` : prop);
    }
  });
}

/**
 * The window content as Foundry builds it. A tool window (window-parts.mjs)
 * renders each part template to one root element, marks it with its part id
 * and puts the parts inside the body element `SpfApp._replaceHTML` creates.
 * Every other window is a single template that carries its own body.
 */
function renderBody(hbs, fixture, app, missing) {
  const context = watch(fixture.context, missing);
  const spec = WINDOW_PARTS[fixture.app];
  if (!spec) return hbs.compile(readFileSync(join(REPO, "templates", app.template), "utf8"))(context);
  const parts = Object.entries(spec.parts).map(([partId, path]) => {
    const html = hbs.compile(readFileSync(join(REPO, path), "utf8"))(context).trim();
    const roots = html.replace(/<!--[\s\S]*?-->/g, "").match(/^<([a-z]+)\b/i);
    if (!roots) throw new Error(`fixture ${fixture.id}: part "${partId}" must render one root element`);
    return html.replace(/^<([a-z]+)\b/i, `<$1 data-application-part="${partId}"`);
  });
  return `<div class="${windowBodyClassName(fixture.app, fixture.context)}">\n${parts.join("\n")}\n</div>`;
}

/**
 * Render one fixture to a full HTML page.
 * A fixture may list `optionalKeys`: dotted paths (array levels written `[]`)
 * the real context genuinely omits though a template reads them, so they are
 * not drift.
 * @returns {{html: string, missingKeys: string[], missingTranslations: string[]}}
 */
export function renderFixture(fixture, { cssBase = "/", width = 720 } = {}) {
  const app = APPS[fixture.app];
  if (!app) throw new Error(`fixture ${fixture.id}: unknown app "${fixture.app}"`);
  const missing = new Set();
  const hbs = createEnvironment(missing);
  const body = renderBody(hbs, fixture, app, missing);
  const title = localize(app.title);
  const tag = app.tag;
  const busy = fixture.context.busy ? " spf-busy" : "";
  const links = [...[FONT_AWESOME, ...MODULE_STYLES].map((file) => `${cssBase}${file}`), `${cssBase}tools/ui-preview/harness.css`]
    .map((href) => `<link rel="stylesheet" href="${href}">`).join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${fixture.id}</title>
${links}
</head><body>
<${tag} class="application simplysf2e${busy}" id="${fixture.app === "generator" ? "simplysf2e-generator" : `simplysf2e-${fixture.app}`}" style="width:${width}px${fixture.height ? `;height:${fixture.height}px` : ""}">
<header class="window-header"><h1 class="window-title"><i class="${app.icon}" aria-hidden="true"></i> ${title}</h1></header>
<section class="window-content">${body}</section>
</${tag}>
</body></html>`;
  const missingTranslations = [...new Set([...body.matchAll(/⟦([^⟧]*)⟧/g)].map((m) => m[1]))];
  const optional = new Set(fixture.optionalKeys ?? []);
  return { html, missingKeys: [...missing].filter((key) => !optional.has(key)), missingTranslations };
}

export function listFixtureFiles() {
  return readdirSync(join(here, "fixtures")).filter((f) => f.endsWith(".mjs") && !f.startsWith("_")).sort();
}
