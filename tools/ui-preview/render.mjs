// Renders module templates to static HTML with Handlebars, standing in for
// Foundry's Handlebars pipeline. Pure Node, no browser.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";

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

/** Foundry-style `{name}` interpolation; a missing key renders visibly. */
export function localize(key, data = {}) {
  if (typeof key !== "string" || !(key in LANG)) return `⟦${key}⟧`;
  return LANG[key].replace(/\{(\w+)\}/g, (match, name) => (name in data ? String(data[name]) : match));
}

/** A fresh Handlebars environment so helper/partial state never leaks between runs. */
export function createEnvironment() {
  const hbs = Handlebars.create();
  hbs.registerHelper("localize", (key, options) => localize(key, options?.hash ?? {}));
  hbs.registerHelper("eq", (a, b) => a === b);
  hbs.registerPartial("simplysf2e-progress", readFileSync(join(REPO, "templates", "_progress.hbs"), "utf8"));
  return hbs;
}

export const APPS = {
  generator: { template: "generator.hbs", title: "SIMPLYSF2E.Generator.Title", icon: "fa-solid fa-dragon", tag: "form" },
  itemforge: { template: "itemforge.hbs", title: "SIMPLYSF2E.ItemForge.Title", icon: "fa-solid fa-hammer", tag: "form" },
  "provider-setup": { template: "provider-setup.hbs", title: "SIMPLYSF2E.ProviderSetup.Title", icon: "fa-solid fa-plug-circle-check", tag: "form" },
  sources: { template: "sources.hbs", title: "SIMPLYSF2E.Sources.Title", icon: "fa-solid fa-book-atlas", tag: "form" },
  "manage-presets": { template: "manage-presets.hbs", title: "SIMPLYSF2E.Presets.ManageTitle", icon: "fa-solid fa-bookmark", tag: "div" }
};

/**
 * Wraps `context` in a Proxy that records every top-level key the template
 * reads which the fixture does not define. The real `_prepareContext()`
 * always returns every key it has (null when empty), so a read of a missing
 * root key means the fixture drifted from the real context and would render
 * a silent blank.
 */
function watchRoot(context, missing) {
  return new Proxy(context, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && !(prop in target)) missing.add(prop);
      return Reflect.get(target, prop, receiver);
    }
  });
}

/**
 * Render one fixture to a full HTML page.
 * A fixture may list `optionalKeys`: root keys the real context genuinely
 * omits (and a template or partial reads anyway), so they are not drift.
 * @returns {{html: string, missingKeys: string[], missingTranslations: string[]}}
 */
export function renderFixture(fixture, { cssBase = "/", width = 720 } = {}) {
  const app = APPS[fixture.app];
  if (!app) throw new Error(`fixture ${fixture.id}: unknown app "${fixture.app}"`);
  const hbs = createEnvironment();
  const source = readFileSync(join(REPO, "templates", app.template), "utf8");
  const missing = new Set();
  const body = hbs.compile(source)(watchRoot(fixture.context, missing));
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
