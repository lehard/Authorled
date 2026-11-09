// Prerender: every page of the site becomes ready HTML with its own head (openspec/specs/web/site,
// «Страницы в готовом HTML»), plus sitemap.xml and robots.txt. Runs after `vite build` and the SSR build.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const ssrEntry = path.join(root, "dist-ssr", "entry-server.js");

if (!fs.existsSync(ssrEntry))
  throw new Error(
    `No SSR build at ${ssrEntry}: run the build script of site/package.json`,
  );
const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
for (const mark of ["<!--app-head-->", "<!--app-html-->"]) {
  if (!template.includes(mark))
    throw new Error(`dist/index.html has no mark ${mark}`);
}

const { render, PAGES, SITE_ORIGIN } = await import(
  pathToFileURL(ssrEntry).href
);

for (const [key, page] of Object.entries(PAGES)) {
  const { html, head } = render(key);
  const out = template
    .replace("<!--app-head-->", head)
    .replace("<!--app-html-->", html);
  const file = path.join(dist, page.file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out);
  console.log(`prerendered ${page.file}`);
}

const indexed = Object.values(PAGES).filter((page) => page.index);
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...indexed.map(
    (page) => `  <url><loc>${SITE_ORIGIN}${page.path}</loc></url>`,
  ),
  "</urlset>",
  "",
].join("\n");
fs.writeFileSync(path.join(dist, "sitemap.xml"), sitemap);
fs.writeFileSync(
  path.join(dist, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`,
);
fs.rmSync(path.join(root, "dist-ssr"), { recursive: true });
console.log("sitemap.xml, robots.txt");
