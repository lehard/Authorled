import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import "./styles.css";

import { App } from "./App";
import { PAGES, pageForPath } from "./site";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("index.html has no #root");
}
const page = pageForPath(window.location.pathname);
const app = (
  <StrictMode>
    <App page={page} />
  </StrictMode>
);
// Built pages arrive rendered and are hydrated; the dev server sends an empty #root.
if (root.firstElementChild !== null) {
  hydrateRoot(root, app);
} else {
  document.title = PAGES[page].title;
  createRoot(root).render(app);
}
