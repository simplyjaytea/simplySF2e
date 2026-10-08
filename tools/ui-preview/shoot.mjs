// Renders every fixture, serves the repo over local http (Font Awesome and the
// module CSS need http, not file://), and screenshots each at 720 and 460 px.
//   node shoot.mjs [fixture-id-substring]    -> out/<id>@<width>.png + out/<id>.html
// Each fixture is also squeezed into a short window (SHORT_HEIGHT, clipped the
// way Foundry clips .window-content); the run fails if any control cannot be
// scrolled into view -> out/<id>@<width>-short.png (scrolled to the last control)
import http from "node:http";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REPO, renderFixture, listFixtureFiles } from "./render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "out");
const WIDTHS = [720, 460];
const SHORT_HEIGHT = 360;
// Foundry core gives .window-content flex: 1 and overflow: hidden, and clamps
// a window to the screen or to the size the user drags it to. The default
// harness lifts all of that to show full content; this restores it, and the
// spf-short-window class drops harness.css's lift of the body's own 80vh cap.
const SHORT_WINDOW_CSS = `
  .application { height: ${SHORT_HEIGHT}px !important; }
  .application .window-content { flex: 1; min-height: 0; overflow: hidden !important; }
`;
const filter = process.argv[2] ?? "";

async function loadPlaywright() {
  try { return await import("playwright"); } catch { /* fall through to the global install */ }
  const root = execSync("npm root -g", { encoding: "utf8" }).trim();
  return createRequire(join(root, "noop.js"))("playwright");
}

const MIME = { ".css": "text/css", ".html": "text/html", ".png": "image/png", ".json": "application/json", ".mjs": "text/javascript", ".js": "text/javascript" };

function serve() {
  const server = http.createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
    const file = join(REPO, path.startsWith("out/") ? join("tools", "ui-preview", path) : path);
    if (!file.startsWith(REPO) || !existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const fixtures = [];
for (const file of listFixtureFiles()) {
  const mod = await import(pathToFileURL(join(here, "fixtures", file)));
  fixtures.push(...mod.default);
}
const ids = fixtures.map((f) => f.id);
if (new Set(ids).size !== ids.length) throw new Error(`duplicate fixture ids: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
const selected = fixtures.filter((f) => f.id.includes(filter));
if (!selected.length) throw new Error(`no fixture matches "${filter}"`);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const problems = [];
try {
  for (const fixture of selected) {
    for (const width of WIDTHS) {
      const { html, missingKeys, missingTranslations } = renderFixture(fixture, { cssBase: "/", width });
      if (width === WIDTHS[0]) {
        for (const key of missingKeys) problems.push(`${fixture.id}: template reads "${key}" but the fixture lacks it`);
        for (const key of missingTranslations) problems.push(`${fixture.id}: missing translation ⟦${key}⟧`);
      }
      const name = `${fixture.id}@${width}`;
      writeFileSync(join(OUT, `${name}.html`), html);
      const page = await browser.newPage({ viewport: { width: width + 40, height: 1000 } });
      page.on("requestfailed", (r) => problems.push(`${name}: request failed ${r.url()}`));
      page.on("response", (r) => { if (r.status() >= 400) problems.push(`${name}: HTTP ${r.status()} ${r.url()}`); });
      await page.goto(`${origin}/out/${name}.html`, { waitUntil: "networkidle" });
      await page.locator(".application").screenshot({ path: join(OUT, `${name}.png`) });
      const overflow = await page.evaluate(() => {
        const content = document.querySelector(".window-content");
        return content.scrollWidth > content.clientWidth + 1 ? content.scrollWidth - content.clientWidth : 0;
      });
      // A window body must never need a sideways scrollbar (JT: whole UI reachable).
      if (overflow) problems.push(`${name}: scrolls horizontally by ${overflow}px`);
      await page.addStyleTag({ content: SHORT_WINDOW_CSS });
      await page.evaluate(() => document.documentElement.classList.add("spf-short-window"));
      const unreachable = await page.evaluate(() => {
        // Scroll only what a user can scroll (overflow auto/scroll), never the
        // clipped .window-content itself, and see whether each control fits.
        const content = document.querySelector(".window-content");
        const box = content.getBoundingClientRect();
        const userScrolls = (el) => /auto|scroll/.test(getComputedStyle(el).overflowY);
        const controls = [...content.querySelectorAll("button, input, select, textarea, a[href]")]
          .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden"
            && !el.closest("details:not([open]) > :not(summary)"));
        for (const control of controls) {
          for (let el = control.parentElement; el && el !== content; el = el.parentElement) {
            if (!userScrolls(el)) continue;
            const r = control.getBoundingClientRect(), s = el.getBoundingClientRect();
            if (r.bottom > s.bottom) el.scrollTop += r.bottom - s.bottom;
            if (r.top < s.top) el.scrollTop -= s.top - r.top;
          }
          const r = control.getBoundingClientRect();
          if (r.bottom > box.bottom + 1 || r.top < box.top - 1) return control.textContent.trim() || control.outerHTML.slice(0, 60);
        }
        return null;
      });
      await page.locator(".application").screenshot({ path: join(OUT, `${name}-short.png`) });
      if (unreachable) problems.push(`${name}: in a ${SHORT_HEIGHT}px window a control cannot be scrolled into view: "${unreachable}"`);
      await page.close();
    }
    console.log(`ok  ${fixture.id}`);
  }
} finally {
  await browser.close();
  server.close();
}
if (problems.length) {
  console.error(`\n${problems.length} fixture problem(s):\n  ${problems.join("\n  ")}`);
  process.exitCode = 1;
} else {
  console.log(`\n${selected.length} fixtures x ${WIDTHS.length} widths -> ${OUT}`);
}
