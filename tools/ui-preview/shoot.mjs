// Renders every fixture, serves the repo over local http (Font Awesome and the
// module CSS need http, not file://), and screenshots each at 720 and 460 px.
//   node shoot.mjs [fixture-id-substring]    -> out/<id>@<width>.png + out/<id>.html
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
        for (const key of missingKeys) problems.push(`${fixture.id}: template reads root key "${key}" the fixture lacks`);
        for (const key of missingTranslations) problems.push(`${fixture.id}: missing translation ⟦${key}⟧`);
      }
      const name = `${fixture.id}@${width}`;
      writeFileSync(join(OUT, `${name}.html`), html);
      const page = await browser.newPage({ viewport: { width: width + 40, height: 1000 } });
      await page.goto(`${origin}/out/${name}.html`, { waitUntil: "networkidle" }).catch(() => {});
      await page.locator(".application").screenshot({ path: join(OUT, `${name}.png`) });
      const overflow = await page.evaluate(() => {
        const content = document.querySelector(".window-content");
        return content.scrollWidth > content.clientWidth + 1 ? content.scrollWidth - content.clientWidth : 0;
      });
      if (overflow) console.log(`note: ${name} scrolls horizontally by ${overflow}px`);
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
