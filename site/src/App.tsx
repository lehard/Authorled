import type { ReactNode } from "react";

import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import type { LegalDocumentKey } from "./pages/LegalDocument";
import { NotFound } from "./pages/NotFound";
import { Privacy } from "./pages/Privacy";
import type { PageKey } from "./site";

// Pages whose code is in the main bundle.
export const STATIC_PAGES = {
  home: Home,
  privacy: Privacy,
  notFound: NotFound,
} as const satisfies Partial<Record<PageKey, () => React.JSX.Element>>;

// Pages of the documents of the service and their files in docs/legal/. Their renderer is a chunk of its
// own, loaded only on these pages: the main page stays within its script budget
// (openspec/specs/web/site, «Бюджет скриптов главной»).
export const DOCUMENT_PAGES = {
  legalOffer: "offer",
  legalPrivacy: "privacy",
  pricing: "pricing",
} as const satisfies Partial<Record<PageKey, LegalDocumentKey>>;

export type DocumentPageKey = keyof typeof DOCUMENT_PAGES;

export function isDocumentPage(page: PageKey): page is DocumentPageKey {
  return page in DOCUMENT_PAGES;
}

export function App({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}
