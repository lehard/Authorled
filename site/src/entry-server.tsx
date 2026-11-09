import { renderToString } from "react-dom/server";

import { App, DOCUMENT_PAGES, isDocumentPage, STATIC_PAGES } from "./App";
import { LegalDocument } from "./pages/LegalDocument";
import { PAGES, SITE_ORIGIN, pageUrl, type PageKey } from "./site";

// Rendering of every page to HTML at build time (scripts/prerender.mjs, openspec/specs/web/site).

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function head(key: PageKey): string {
  const page = PAGES[key];
  const url = pageUrl(key);
  const tags = [
    `<title>${escape(page.title)}</title>`,
    `<meta name="description" content="${escape(page.description)}" />`,
    page.index
      ? `<link rel="canonical" href="${url}" />`
      : `<meta name="robots" content="noindex" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Соавтор" />`,
    `<meta property="og:locale" content="ru_RU" />`,
    `<meta property="og:title" content="${escape(page.title)}" />`,
    `<meta property="og:description" content="${escape(page.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE_ORIGIN}/og.jpg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ];
  return tags.join("\n    ");
}

function page(key: PageKey): React.JSX.Element {
  if (isDocumentPage(key)) return <LegalDocument doc={DOCUMENT_PAGES[key]} />;
  const Page = STATIC_PAGES[key];
  return <Page />;
}

export function render(key: PageKey): { html: string; head: string } {
  return { html: renderToString(<App>{page(key)}</App>), head: head(key) };
}

export { PAGES, SITE_ORIGIN };
