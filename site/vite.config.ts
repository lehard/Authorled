import fs from "node:fs";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// The product site (openspec/specs/web/site). Settings come from the repository .env; only
// SITE_ORIGIN and SITE_APP_URL reach the bundle, nothing has a default.
const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const WEB_DIR = path.join(REPO_ROOT, "web");

function absoluteUrl(env: Record<string, string>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(
      `${name} is not set in the repository .env (see example.env).`,
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} (${value}) is not an absolute URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} (${value}) must be an http(s) URL.`);
  }
  return value.replace(/\/+$/, "");
}

export default defineConfig(({ command, mode, isPreview }) => {
  // The site takes tokens and fonts from web/src/design-system, whose imports resolve from web/node_modules.
  if (!fs.existsSync(path.join(WEB_DIR, "node_modules"))) {
    throw new Error(
      "web/node_modules is missing: the site uses the design system of web/. Run npm ci --prefix web.",
    );
  }
  const env = loadEnv(mode, REPO_ROOT, "");
  const siteOrigin = absoluteUrl(env, "SITE_ORIGIN");
  const appUrl = absoluteUrl(env, "SITE_APP_URL");
  // The form posts to /os/ on the site's own origin; the local servers pass it to AgentOS.
  const serving = command === "serve" || isPreview === true;
  const proxy = serving
    ? {
        "/os/": {
          target: absoluteUrl(env, "AGENTOS_URL"),
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/os/, ""),
        },
      }
    : undefined;

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __SITE_ORIGIN__: JSON.stringify(siteOrigin),
      __SITE_APP_URL__: JSON.stringify(appUrl),
    },
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      proxy,
      fs: {
        allow: [
          import.meta.dirname,
          path.join(WEB_DIR, "src", "design-system"),
          path.join(WEB_DIR, "node_modules"),
        ],
      },
    },
    preview: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      proxy,
    },
    build: { emptyOutDir: true },
  };
});
