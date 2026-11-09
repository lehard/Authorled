import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import offer from "../../../docs/legal/offer.md?raw";
import pricing from "../../../docs/legal/pricing.md?raw";
import privacy from "../../../docs/legal/privacy.md?raw";
import { PAGES } from "../site";

// The documents of the service (openspec/specs/web/site, «Документы сервиса»): the text of each page is its
// file in docs/legal/, rendered at build time; there is no copy of it in the code (design D1).

const SOURCES = { offer, privacy, pricing } as const;
export type LegalDocumentKey = keyof typeof SOURCES;

// The documents give full addresses of the product domain (design D6). Links to pages of this site become
// relative, so a local or test build leads to its own pages; scripts/check-build.mjs refuses a link to a
// path of the domain that is not a page of the site.
export const DOCUMENT_ORIGIN = "https://soavtor.app";

// Stable anchors of sections other screens link to (design D5): «Подробнее» in the co-author chat of the
// service leads to /legal/offer/#materials. scripts/check-build.mjs requires the anchor.
export const ANCHORS: Record<string, string> = {
  "7. Материалы Пользователя и ИИ": "materials",
};

const LINK = "text-primary underline underline-offset-2 hover:no-underline";

function textOf(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number")
    return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  return "";
}

function localHref(href: string | undefined): string | undefined {
  if (href === undefined || !href.startsWith(`${DOCUMENT_ORIGIN}/`))
    return href;
  return href.slice(DOCUMENT_ORIGIN.length);
}

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="heading-3 text-paper-foreground">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2
      id={ANCHORS[textOf(children)]}
      className="mt-6 scroll-mt-24 heading-5 text-paper-foreground"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 title-3 text-paper-foreground">{children}</h3>
  ),
  p: ({ children }) => <p>{children}</p>,
  ul: ({ children }) => (
    <ul className="flex list-disc flex-col gap-2 pl-6">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="flex list-decimal flex-col gap-2 pl-6">{children}</ol>
  ),
  a: ({ href, children }) => (
    <a className={LINK} href={localHref(href)}>
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse body-6">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 text-left align-top font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-3 py-2 align-top">{children}</td>
  ),
};

export function LegalDocument({ doc }: { doc: LegalDocumentKey }) {
  return (
    <article className="px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-2xl bg-paper p-6 shadow-paper ring-1 ring-border sm:p-12">
        <a
          className="w-fit body-6 text-muted-foreground hover:text-foreground hover:underline"
          href={PAGES.home.path}
        >
          ← На главную
        </a>
        <div className="flex flex-col gap-4 body-3 text-paper-foreground">
          <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
            {SOURCES[doc]}
          </Markdown>
        </div>
      </div>
    </article>
  );
}
