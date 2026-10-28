import "./design-system/tokens.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { currentTheme } from "./design-system/theme";

// index.html must have applied a known theme; fail loudly otherwise.
currentTheme();

const root = document.getElementById("root");
if (root === null) {
  throw new Error("index.html has no #root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
