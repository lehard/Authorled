// Checks of the built site against openspec/specs/web/site: files, text without JavaScript, metadata,
// links, no placeholders and no values of the repository .env except the two settings of the build.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const problems = [];
const fail = (message) => problems.push(message);
const read = (file) => fs.readFileSync(path.join(dist, file), "utf8");

for (const file of [
  "index.html",
  "privacy/index.html",
  "404.html",
  "sitemap.xml",
  "robots.txt",
  "og.jpg",
  "favicon.svg",
]) {
  if (!fs.existsSync(path.join(dist, file))) fail(`missing ${file}`);
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
  for (const id of ["path-title", "impact-title"]) {
    const block = section(id);
    if (!block) fail(`index.html has no section ${id}`);
    else if (!block.includes("Концепт"))
      fail(`section ${id} is not marked «Концепт»`);
    else if (!block.includes("пока нет"))
      fail(`section ${id} does not say the beta has none of it yet`);
  }
  const count = (html, needle) => html.split(needle).length - 1;
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
  for (const [file, html] of [
    ["index.html", home],
    ["privacy/index.html", privacy],
    ["404.html", notFound],
  ]) {
    if (!html.includes('<html lang="ru"')) fail(`${file}: lang is not ru`);
    if (!html.includes('href="/privacy/"'))
      fail(`${file}: no link to the policy`);
  }
  const policyLinks = home.split('href="/privacy/"').length - 1;
  if (policyLinks < 2)
    fail("index.html: the policy must be linked from the form and the footer");
  const sitemap = read("sitemap.xml");
  for (const loc of [`${origin}/`, `${origin}/privacy/`]) {
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

if (problems.length > 0) {
  console.error(`site build check failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("site build check passed");
