// Behaviour of the main page in a real browser (openspec/specs/web/site; design D11). Local check, not part
// of validate.sh: CI has no browsers. Run against the built site:
//   npm run build --prefix site && npm run preview --prefix site
//   SITE_URL=http://127.0.0.1:5174 CHROMIUM_PATH=<Chromium> npm run check:behaviour --prefix site
import { chromium } from "playwright-core";

const SITE_URL = process.env.SITE_URL;
const CHROMIUM_PATH = process.env.CHROMIUM_PATH;
if (!SITE_URL)
  throw new Error(
    "SITE_URL is not set: the address of `npm run preview --prefix site`",
  );
if (!CHROMIUM_PATH)
  throw new Error(
    "CHROMIUM_PATH is not set: the path to a Chromium executable",
  );

const problems = [];
const check = (ok, message) => {
  if (!ok) problems.push(message);
};

async function scrollThrough(page) {
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  for (let y = 0; y < height; y += 250) {
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(800);
}

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
try {
  // Layout at two widths: no horizontal scroll, both buttons on the first screen, no errors.
  for (const [name, width, height] of [
    ["1440", 1440, 900],
    ["390", 390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on(
      "console",
      (message) => message.type() === "error" && errors.push(message.text()),
    );
    await page.goto(SITE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    for (const label of ["Хочу в бету", "Войти"]) {
      const box = await page
        .getByRole("link", { name: label })
        .first()
        .boundingBox();
      check(
        box !== null && box.y + box.height <= height,
        `${name}px: «${label}» is not on the first screen`,
      );
    }
    await scrollThrough(page);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    check(overflow === 0, `${name}px: horizontal scroll of ${overflow}px`);
    check(
      errors.length === 0,
      `${name}px: errors in the page: ${errors.join("; ")}`,
    );
    await page.close();
  }

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.goto(SITE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // The live edit of the first screen.
  const sheet = page.locator("section[aria-labelledby='hero-title'] figure");
  await sheet.getByRole("button", { name: "Принять" }).click();
  check(
    (await sheet.locator("del").count()) === 0,
    "live edit: «Принять» left the struck line",
  );
  check(
    await sheet.getByText("Утонул. Всё.").isVisible(),
    "live edit: «Принять» did not set the new line",
  );
  await sheet.getByRole("button", { name: "Показать снова" }).click();
  await sheet.getByRole("button", { name: "Отклонить" }).focus();
  await page.keyboard.press("Enter");
  check(
    await sheet.getByText("Он утонул. Всё.").isVisible(),
    "live edit: Enter on «Отклонить» did not keep the line",
  );
  check(
    (await sheet.locator("ins").count()) === 0,
    "live edit: «Отклонить» left the inserted line",
  );

  // The vision phrase lights up word by word.
  await scrollThrough(page);
  const unlit = await page.locator("[data-word]:not([data-lit])").count();
  check(unlit === 0, `vision: ${unlit} words did not light up`);

  // The sandbox: an own answer for each question, no requests.
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  const sandbox = page.locator("section[aria-labelledby='sandbox-title']");
  const questions = sandbox
    .getByRole("group", { name: "Вопросы соавтору" })
    .getByRole("button");
  const answers = new Set();
  for (let i = 0; i < (await questions.count()); i += 1) {
    await questions.nth(i).click();
    await page.waitForTimeout(2500);
    const visible = sandbox.locator("[aria-live='polite']");
    const text = await visible.innerText();
    check(
      text.includes("пример ответа"),
      `sandbox: answer ${i + 1} is not marked «пример ответа»`,
    );
    answers.add(text);
  }
  check(
    answers.size === (await questions.count()),
    "sandbox: questions do not have their own answers",
  );
  check(
    requests.length === 0,
    `sandbox: requests were sent: ${requests.join(", ")}`,
  );

  // Beta tabs: the arrow key opens the next tab.
  const tabs = page.getByRole("tablist").getByRole("tab");
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  check(
    (await tabs.nth(1).getAttribute("aria-selected")) === "true",
    "tabs: ArrowRight did not open the next tab",
  );
  check(
    await page.getByRole("tabpanel").first().isVisible(),
    "tabs: no visible panel",
  );

  // The story path: the line is drawn, a stage shows its concept frame.
  const path = page.locator("section[aria-labelledby='path-title']");
  check(
    (await path.locator("svg[data-in]").count()) === 1,
    "path: the line was not drawn",
  );
  await path.getByRole("button", { name: "13", exact: true }).click();
  await page.waitForTimeout(300);
  check(
    ((await path.locator("figure img").getAttribute("src")) ?? "").includes(
      "timeline",
    ),
    "path: stage 13 does not show the timeline frame",
  );
  await path.getByRole("button", { name: "1", exact: true }).click();
  await page.waitForTimeout(300);
  check(
    ((await path.locator("figure img").getAttribute("src")) ?? "").includes(
      "impulses",
    ),
    "path: stage 1 does not show the frame of the impulses",
  );

  // The impact of a changed decision.
  const impact = page.locator("section[aria-labelledby='impact-title']");
  await impact.getByRole("button", { name: "Изменить решение" }).click();
  const impacted = await impact
    .getByText("Задето 3 документа из 7")
    .waitFor({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  check(impacted, "impact: no «Задето 3 документа из 7»");

  // The form still reports an accepted request (the API answer is stubbed here).
  await page.route("**/os/api/v1/beta-requests", (route) =>
    route.fulfill({
      status: 202,
      contentType: "application/json",
      body: '{"status":"accepted"}',
    }),
  );
  await page.getByLabel("Почта").fill("check@authorled.test");
  await page.getByLabel("Имя").fill("Проверка");
  await page.getByText("Сценарист", { exact: true }).click();
  await page.locator("input[type='checkbox']").check();
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  const accepted = await page
    .getByText("Заявка принята")
    .waitFor({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  check(accepted, "form: no «Заявка принята»");
  await page.close();

  // Without JavaScript and with reduced motion everything is shown in its end state.
  for (const [name, options] of [
    ["no JavaScript", { javaScriptEnabled: false }],
    ["reduced motion", { reducedMotion: "reduce" }],
  ]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ...options,
    });
    const view = await context.newPage();
    await view.goto(SITE_URL, { waitUntil: "load" });
    await view.waitForTimeout(500);
    const hidden = await view.evaluate(
      () =>
        [...document.querySelectorAll("[data-reveal], [data-word]")].filter(
          (element) => Number(getComputedStyle(element).opacity) < 1,
        ).length,
    );
    check(hidden === 0, `${name}: ${hidden} blocks or words are not shown`);
    const faq = view
      .locator("section[aria-labelledby='faq-title'] details")
      .first();
    await faq.locator("summary").click();
    check(
      (await faq.getAttribute("open")) !== null,
      `${name}: a question does not open`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}

if (problems.length > 0) {
  console.error(`site behaviour check failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("site behaviour check passed");
