// Settings of the build (site/vite.config.ts) and the pages of the site (openspec/specs/web/site).

export const SITE_ORIGIN = __SITE_ORIGIN__;
export const APP_URL = __SITE_APP_URL__;
// Same origin as the site: the local servers and, later, Caddy pass /os/ to AgentOS.
export const BETA_REQUEST_URL = "/os/api/v1/beta-requests";

export type PageMeta = {
  path: string;
  file: string;
  title: string;
  description: string;
  index: boolean;
};

export const PAGES = {
  home: {
    path: "/",
    file: "index.html",
    title: "Соавтор — редактор сценариев с ИИ",
    description:
      "Редактор полнометражного сценария с соавтором, который читает всю историю и предлагает правки, а принимает их автор. Закрытая бета.",
    index: true,
  },
  privacy: {
    path: "/privacy/",
    file: "privacy/index.html",
    title: "Политика обработки данных заявки в бету — Соавтор",
    description:
      "Какие данные собирает заявка в бету Соавтора, зачем, где они хранятся и как отозвать согласие.",
    index: true,
  },
  legalOffer: {
    path: "/legal/offer/",
    file: "legal/offer/index.html",
    title: "Публичная оферта — Соавтор",
    description:
      "Условия, на которых Соавтор предоставляет доступ к сервису: тарифы, оплата, возврат, права на тексты и ИИ.",
    index: true,
  },
  legalPrivacy: {
    path: "/legal/privacy/",
    file: "legal/privacy/index.html",
    title: "Политика обработки персональных данных — Соавтор",
    description:
      "Какие персональные данные обрабатывает сервис Соавтор, зачем, кому передаёт, где хранит и как их удалить.",
    index: true,
  },
  pricing: {
    path: "/pricing/",
    file: "pricing/index.html",
    title: "Тарифы — Соавтор",
    description:
      "Тарифы Соавтора: бесплатный редактор и подписка с ИИ-соавтором, порядок оплаты и возврата.",
    index: true,
  },
  notFound: {
    path: "/404",
    file: "404.html",
    title: "Страница не найдена — Соавтор",
    description: "Такой страницы на сайте Соавтора нет.",
    index: false,
  },
} as const satisfies Record<string, PageMeta>;

export type PageKey = keyof typeof PAGES;

/** The page for a path of the browser; anything unknown is the 404 page. */
export function pageForPath(pathname: string): PageKey {
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  for (const key of Object.keys(PAGES) as PageKey[]) {
    if (key !== "notFound" && PAGES[key].path === path) return key;
  }
  return "notFound";
}

export function pageUrl(key: PageKey): string {
  return `${SITE_ORIGIN}${PAGES[key].path}`;
}
