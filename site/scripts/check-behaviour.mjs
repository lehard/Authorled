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
    // Beta tabs: the ring and the focus outline of the first and the last tab are not cut by the scrolling row.
    const tablist = page.getByRole("tablist");
    for (const which of ["first", "last"]) {
      const tab = tablist.getByRole("tab")[which]();
      await tab.scrollIntoViewIfNeeded();
      const room = await tab.evaluate((element) => {
        const own = element.getBoundingClientRect();
        const row = element.parentElement.getBoundingClientRect();
        return Math.min(
          own.top - row.top,
          row.bottom - own.bottom,
          own.left - row.left,
          row.right - own.right,
        );
      });
      check(
        room >= 4,
        `${name}px: the ${which} tab has ${room}px of room in its row, its ring is cut`,
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

  // The contradiction of the first screen: show both lines, mark it as intended, show it again.
  const contradiction = page.locator(
    "section[aria-labelledby='hero-title'] figure",
  );
  const lit = () =>
    contradiction
      .locator("mark")
      .evaluateAll(
        (marks) =>
          marks.filter(
            (mark) =>
              getComputedStyle(mark).backgroundColor !== "rgba(0, 0, 0, 0)",
          ).length,
      );
  check((await lit()) === 0, "contradiction: lines are lit before a click");
  await contradiction
    .getByRole("button", { name: "Показать в тексте" })
    .click();
  check(
    (await lit()) === 2,
    "contradiction: «Показать в тексте» did not light both lines",
  );
  await contradiction.getByRole("button", { name: "Так задумано" }).focus();
  await page.keyboard.press("Enter");
  check(
    (await contradiction
      .getByRole("button", { name: "Так задумано" })
      .count()) === 0,
    "contradiction: Enter on «Так задумано» did not fold the card",
  );
  check(
    (await lit()) === 0,
    "contradiction: «Так задумано» left the lines lit",
  );
  await contradiction.getByRole("button", { name: "Показать снова" }).click();
  check(
    await contradiction
      .getByRole("button", { name: "Так задумано" })
      .isVisible(),
    "contradiction: «Показать снова» did not bring the card back",
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
    const hero = await view.evaluate(() => {
      const figure = document.querySelector(
        "section[aria-labelledby='hero-title'] figure",
      );
      const hidden = [...figure.querySelectorAll("[data-appear]")].filter(
        (element) => Number(getComputedStyle(element).opacity) < 1,
      ).length;
      const undrawn = [...figure.querySelectorAll("[data-rail]")].filter(
        (line) => getComputedStyle(line).transform !== "none",
      ).length;
      return { hidden, undrawn, marks: figure.querySelectorAll("mark").length };
    });
    check(
      hero.marks === 2 && hero.hidden === 0 && hero.undrawn === 0,
      `${name}: the first screen is not in its end state (${JSON.stringify(hero)})`,
    );
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
