import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { ConfigError, loadConfig } from "./app/config";
import { createRouter } from "./app/router";
import { initUserManager } from "./auth/userManager";
import { currentTheme } from "./design-system/theme";
import { ConfigErrorScreen } from "./screens/system/ConfigErrorScreen";

// index.html must have applied a known theme; fail loudly otherwise.
currentTheme();

const root = document.getElementById("root");
if (root === null) {
  throw new Error("index.html has no #root element");
}

function app() {
  try {
    const config = loadConfig();
    initUserManager(config);
    return <RouterProvider router={createRouter(config.dataSource)} />;
  } catch (error) {
    // Only a ConfigError gets its own screen; anything else is a bug and stays thrown.
    if (error instanceof ConfigError)
      return <ConfigErrorScreen error={error} />;
    throw error;
  }
}

createRoot(root).render(<StrictMode>{app()}</StrictMode>);
// From now on the app reports failed parts itself (index.html stops replacing the splash).
window.dispatchEvent(new Event("soavtor:mounted"));
