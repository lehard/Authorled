// Checks of the built site against openspec/specs/web/site: files, text without JavaScript, metadata,
// links, no placeholders and no values of the repository .env except the two settings of the build.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { ONE_ACTION, SANDBOX, VISION_CARD } from "../src/content/copy.ts";
import {
  CONTRADICTION,
  KOLYA,
  ONE_ACTION_QUOTES,
  SCENE_6,
} from "../src/content/demo.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const problems = [];
const fail = (message) => problems.push(message);
const read = (file) => fs.readFileSync(path.join(dist, file), "utf8");

for (const file of [
  "index.html",
  "privacy/index.html",
  "legal/offer/index.html",
  "legal/privacy/index.html",
  "pricing/index.html",
  "404.html",
  "sitemap.xml",
  "robots.txt",
  "og.jpg",
  // Page icons and the mark (openspec/specs/web/brand).
  "favicon.svg",
  "favicon.ico",
  "apple-touch-icon.png",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "brand-mark.svg",
]) {
  if (!fs.existsSync(path.join(dist, file))) fail(`missing ${file}`);
}

// Every built page links the page icons (openspec/specs/web/brand, «Значки страницы сайта»).
const ICON_LINKS = [
  'href="/favicon.svg"',
  'href="/favicon.ico"',
  'href="/apple-touch-icon.png"',
  'href="/manifest.webmanifest"',
];
const htmlPages = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlPages(full);
    return entry.name.endsWith(".html") ? [full] : [];
  });
for (const page of htmlPages(dist)) {
  const html = fs.readFileSync(page, "utf8");
  for (const link of ICON_LINKS) {
    if (!html.includes(link))
      fail(`${path.relative(dist, page)} has no icon link ${link}`);
  }
}
if (problems.length === 0) {
  const home = read("index.html");
  const privacy = read("privacy/index.html");
  const notFound = read("404.html");
  const origin = /<meta property="og:url" content="([^"]+)\/"/.exec(home)?.[1];
  if (!origin) fail("index.html has no og:url");

  // The main page of the second version (openspec/specs/web/site): structure, not exact wording,
  // because the texts change without OpenSpec.
  for (const text of ["Хочу в бету", "Войти"]) {
    if (!home.includes(text))
      fail(`index.html has no text «${text}» without JavaScript`);
  }
  const section = (id) =>
    new RegExp(`<section[^>]*aria-labelledby="${id}"[\\s\\S]*?</section>`).exec(
      home,
    )?.[0] ?? "";
  // The contradiction of the first screen: two quoted scenes, the co-author's card and the caption of the example.
  const hero = section("hero-title");
  if ((hero.match(/<mark[\s>]/g) ?? []).length !== 2)
    fail("the first screen must quote two lines in <mark>");
  if ((hero.match(/Сцена(?:\s|<!-- -->)*\d+/g) ?? []).length !== 2)
    fail("the first screen must name two scenes by number");
  if (!/role="group"[^>]*aria-label="[^"]+"/.test(hero))
    fail("the first screen has no labelled card of the co-author");
  if (!/<figcaption[^>]*>[^<]*[Пп]ример/.test(hero))
    fail("the first screen is not captioned as an example");
  for (const id of ["path-title", "impact-title"]) {
    const block = section(id);
    if (!block) fail(`index.html has no section ${id}`);
    else if (!block.includes("Концепт"))
      fail(`section ${id} is not marked «Концепт»`);
    else if (!block.includes("пока нет"))
      fail(`section ${id} does not say the beta has none of it yet`);
  }
  const count = (html, needle) => html.split(needle).length - 1;
  // React splits text around expressions with <!-- --> in the prerender; compare without those markers.
  const plain = (html) => html.replaceAll("<!-- -->", "");
  // Examples of the co-author below the first screen (design D5 of site-coauthor-examples), texts from content/.
  const sandbox = plain(section("sandbox-title"));
  for (const text of [
    SCENE_6.heading,
    SCENE_6.lead,
    SCENE_6.quote,
    "Сц. 5",
    "Сц. 6",
  ]) {
    if (!sandbox.includes(text)) fail(`the sandbox has no «${text}»`);
  }
  if (!sandbox.includes(SANDBOX.linksConcept))
    fail("the scene links of the sandbox are not marked as a concept");
  const beta = plain(section("beta-tabs-title"));
  const cards = beta.slice(beta.indexOf(ONE_ACTION.title));
  if (!beta.includes(ONE_ACTION.title))
    fail("the beta block has no row of «one action» cards");
  for (const text of [
    ONE_ACTION.caption,
    ONE_ACTION_QUOTES.mishaGoal,
    ONE_ACTION_QUOTES.suggestion.before,
    ONE_ACTION_QUOTES.suggestion.after,
    ONE_ACTION_QUOTES.comment.quote,
    ONE_ACTION.comment.text,
  ]) {
    if (!cards.includes(text)) fail(`the «one action» cards have no «${text}»`);
  }
  if (cards.includes("Концепт"))
    fail("the «one action» cards must not be marked «Концепт»");
  for (const line of [CONTRADICTION.first.line, CONTRADICTION.second.line]) {
    if (cards.includes(line))
      fail(`the «one action» cards repeat the first screen: «${line}»`);
  }
  const vision = plain(section("vision-title"));
  if (!vision) fail("index.html has no section vision-title");
  for (const text of [
    KOLYA.name,
    ...KOLYA.facts.map((fact) => fact.text),
    ...KOLYA.facts
      .filter((fact) => fact.scene !== null)
      .map((fact) => `${VISION_CARD.scene} ${fact.scene}`),
    VISION_CARD.badge,
    VISION_CARD.notYet,
  ]) {
    if (!vision.includes(text)) fail(`the hero card has no «${text}»`);
  }
  if (count(section("sandbox-title"), "пример ответа") < 3)
    fail("the sandbox must have at least three answers marked «пример ответа»");
  if (count(home, 'role="tabpanel"') < 5)
    fail("the beta block must have five tab panels in the HTML");
  if (count(home, "data-word") < 10)
    fail("the vision phrase is not split into words");
  const stages = [
    "Карта импульсов",
    "Манифест темы",
    "Этический компас",
    "Мировоззренческий базис",
    "Тональный манифест",
    "Паспорт места",
    "Атлас правил",
    "Жанровый кодекс",
    "Концепт-вектор",
    "Референсное поле",
    "Главный вопрос",
    "Выбор формата",
    "Скелетная карта",
    "Поэпизодник",
    "Кастинг-лист",
    "Психологические профили",
    "Диалоговая партитура",
    "Ансамбль и рентген",
    "Битовая карта сцены",
    "Черновик сцены",
    "Обратный протокол",
    "Финальный текст",
  ];
  for (const stage of stages) {
    if (!section("path-title").includes(stage))
      fail(`the story path has no stage «${stage}»`);
  }
  const faq = section("faq-title");
  if (
    count(faq, "<details") < 5 ||
    count(faq, "<summary") !== count(faq, "<details")
  )
    fail("questions and answers must be <details> with a <summary>");

  // Budget of the scripts the main page loads (≤ 120 KB gzip).
  const scripts = [
    ...home.matchAll(/<script[^>]+src="([^"]+\.js)"/g),
    ...home.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g),
  ].map((match) => match[1]);
  if (scripts.length === 0) fail("index.html loads no scripts");
  const gzipped = scripts.reduce(
    (sum, src) => sum + gzipSync(fs.readFileSync(path.join(dist, src))).length,
    0,
  );
  if (gzipped > 120 * 1024)
    fail(
      `the scripts of the main page weigh ${(gzipped / 1024).toFixed(1)} KB gzip, more than 120 KB`,
    );

  // Every image the pages reference exists.
  for (const [file, html] of [
    ["index.html", home],
    ["privacy/index.html", privacy],
  ]) {
    const refs = [
      ...html.matchAll(/(?:src|href)="(\/(?:shots|concept)\/[^"]+)"/g),
      ...[...html.matchAll(/srcSet="([^"]+)"|srcset="([^"]+)"/g)].flatMap(
        (match) =>
          (match[1] ?? match[2])
            .split(",")
            .map((part) => [null, part.trim().split(" ")[0]]),
      ),
    ].map((match) => match[1]);
    for (const ref of refs) {
      if (ref.startsWith("/") && !fs.existsSync(path.join(dist, ref)))
        fail(`${file} references a missing file ${ref}`);
    }
  }
  console.log(`main page scripts: ${(gzipped / 1024).toFixed(1)} KB gzip`);
  if (!home.includes(`<link rel="canonical" href="${origin}/" />`))
    fail("index.html: canonical is not the origin");
  if (!privacy.includes(`<link rel="canonical" href="${origin}/privacy/" />`))
    fail("privacy: canonical is wrong");
  if (
    !privacy.includes(`<meta property="og:url" content="${origin}/privacy/" />`)
  )
    fail("privacy: og:url is wrong");
  const title = (html) => /<title>([^<]*)<\/title>/.exec(html)?.[1];
  if (!title(home) || title(home) === title(privacy))
    fail("the titles of the home page and the policy must differ");
  if (!notFound.includes('<meta name="robots" content="noindex" />'))
    fail("404.html is not noindex");
  // The documents of the service (openspec/specs/web/site, «Документы сервиса», «Документы в подвале»).
  const DOCUMENTS = [
    ["/legal/offer/", "legal/offer/index.html", "offer.md"],
    ["/legal/privacy/", "legal/privacy/index.html", "privacy.md"],
    ["/pricing/", "pricing/index.html", "pricing.md"],
  ];
  const documents = DOCUMENTS.map(([url, file, source]) => [
    url,
    file,
    source,
    read(file),
  ]);
  const pages = [
    ["index.html", home],
    ["privacy/index.html", privacy],
    ["404.html", notFound],
    ...documents.map(([, file, , html]) => [file, html]),
  ];
  const footer = (html) => /<footer[\s\S]*?<\/footer>/.exec(html)?.[0] ?? "";
  for (const [file, html] of pages) {
    if (!html.includes('<html lang="ru"')) fail(`${file}: lang is not ru`);
    for (const [url] of DOCUMENTS) {
      if (!footer(html).includes(`href="${url}"`))
        fail(`${file}: the footer has no link to ${url}`);
    }
    if (footer(html).includes('href="/privacy/"'))
      fail(`${file}: the footer links the policy of the beta request`);
  }
  if (!home.includes('href="/privacy/"'))
    fail("index.html: the consent of the form has no link to /privacy/");
  const sitemap = read("sitemap.xml");
  const pageUrls = new Set([
    ...[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
      match[1].slice(origin.length),
    ),
  ]);
  for (const [url, file, source, html] of documents) {
    if (!html.includes(`<link rel="canonical" href="${origin}${url}" />`))
      fail(`${file}: canonical is wrong`);
    if (!html.includes(`<meta property="og:url" content="${origin}${url}" />`))
      fail(`${file}: og:url is wrong`);
    if (!/<h1[^>]*>[^<]+<\/h1>/.test(html)) fail(`${file}: no heading`);
    if (title(html) === title(home) || title(html) === title(privacy))
      fail(`${file}: the title repeats another page`);
    // Links of a document to the product domain must lead to pages of the site (design D6). Only links of
    // the text (<a>): canonical and og:url of the page start with the origin of the build and have their own checks.
    for (const match of html.matchAll(
      /<a[^>]+href="(https:\/\/soavtor\.app[^"]*)"/g,
    ))
      fail(`${file}: a link to ${match[1]} was not made local`);
    for (const match of html.matchAll(/<a[^>]+href="(\/[^"#]*)/g)) {
      if (!pageUrls.has(match[1]))
        fail(`${file}: a link to ${match[1]}, which is not a page of the site`);
    }
    // Every numbered point (7.1., 7.2., …) is a paragraph of its own, not glued to the previous one.
    for (const match of html.matchAll(/<p>([\s\S]*?)<\/p>/g)) {
      // Glued lines keep their line break; a reference such as «раздел 7.5.» inside a sentence does not.
      if ((match[1].match(/(?:^|\n)\d+\.\d+\.\s/g) ?? []).length > 1)
        fail(
          `${file}: numbered points share a paragraph; separate them with an empty line in docs/legal/${source}`,
        );
    }
    if (source === "privacy.md" || source === "pricing.md") {
      if (!html.includes("<table"))
        fail(`${file}: the tables of docs/legal/${source} are not rendered`);
    }
  }
  if (!documents[0][3].includes('id="materials"'))
    fail("legal/offer/index.html has no anchor #materials");
  if (title(privacy) === title(documents[1][3]))
    fail("the titles of /privacy/ and /legal/privacy/ must differ");
  if (!/заявк/.test(title(privacy) ?? ""))
    fail("the title of /privacy/ must name the beta request");
  for (const loc of [
    `${origin}/`,
    `${origin}/privacy/`,
    ...DOCUMENTS.map(([url]) => `${origin}${url}`),
  ]) {
    if (!sitemap.includes(`<loc>${loc}</loc>`))
      fail(`sitemap.xml has no ${loc}`);
  }
  if (!read("robots.txt").includes(`Sitemap: ${origin}/sitemap.xml`))
    fail("robots.txt does not point to sitemap.xml");

  // Placeholders and secrets in any built text file.
  const env = fs.existsSync(path.join(root, "..", ".env"))
    ? fs.readFileSync(path.join(root, "..", ".env"), "utf8")
    : "";
  const secrets = env
    .split("\n")
    .map((line) => /^([A-Z0-9_]+)=(.+)$/.exec(line.trim()))
    .filter(
      (match) =>
        match &&
        !["SITE_ORIGIN", "SITE_APP_URL"].includes(match[1]) &&
        match[2].length >= 12,
    )
    .map((match) => match[2]);
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });
  for (const file of walk(dist).filter((name) =>
    /\.(html|js|css|xml|txt)$/.test(name),
  )) {
    const text = fs.readFileSync(file, "utf8");
    const relative = path.relative(dist, file);
    if (text.includes("{{"))
      fail(`${relative} has a placeholder {{…}}: fill it before the build`);
    if (secrets.some((secret) => text.includes(secret)))
      fail(`${relative} contains a value of the repository .env`);
  }
}

// The sources of the documents of the service (openspec/specs/web/site, «Документы без заглушек»; design D7):
// no placeholder in square brackets except a Markdown link, no draft mark, a real date of the edition.
const MONTHS =
  "января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря";
const EDITION = new RegExp(
  `^Редакция от (\\d{2}\\.\\d{2}\\.\\d{4}|\\d{1,2} (${MONTHS}) \\d{4} года)\\.`,
  "m",
);
for (const name of ["offer.md", "privacy.md", "pricing.md"]) {
  const source = `docs/legal/${name}`;
  const text = fs.readFileSync(path.join(root, "..", source), "utf8");
  for (const match of text.matchAll(/\[[^\]\n]*\](?!\()/g))
    fail(`${source} has a placeholder ${match[0]}: fill it before the build`);
  if (text.includes("ЧЕРНОВИК")) fail(`${source} is marked ЧЕРНОВИК`);
  if (!EDITION.test(text))
    fail(`${source} has no line «Редакция от <date>.» with a real date`);
}

if (problems.length > 0) {
  console.error(`site build check failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("site build check passed");
