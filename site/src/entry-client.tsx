import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import "./styles.css";

import { App, DOCUMENT_PAGES, isDocumentPage, STATIC_PAGES } from "./App";
import { PAGES, pageForPath } from "./site";

const found = document.getElementById("root");
if (found === null) {
  throw new Error("index.html has no #root");
}
const root: HTMLElement = found;
const page = pageForPath(window.location.pathname);

function mount(content: React.JSX.Element) {
  const app = (
    <StrictMode>
      <App>{content}</App>
    </StrictMode>
  );
  // Built pages arrive rendered and are hydrated; the dev server sends an empty #root.
  if (root.firstElementChild !== null) {
    hydrateRoot(root, app);
  } else {
    document.title = PAGES[page].title;
    createRoot(root).render(app);
  }
}

if (isDocumentPage(page)) {
  // The renderer of the documents is a chunk of its own (App.tsx, DOCUMENT_PAGES).
  void import("./pages/LegalDocument").then(({ LegalDocument }) =>
    mount(<LegalDocument doc={DOCUMENT_PAGES[page]} />),
  );
} else {
  const Page = STATIC_PAGES[page];
  mount(<Page />);
}
