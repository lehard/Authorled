import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

// Sign-in settings shared with Authentik and the API; only these reach the bundle
// (AUTH_DEV_SERVICE_TOKEN and other AUTH_* stay out). Missing values are reported by
// src/app/config.ts at start, so CI builds without .env still pass.
const AUTH_KEYS = [
  "AUTH_ISSUER",
  "AUTH_FRONTEND_CLIENT_ID",
  "AUTH_FRONTEND_REDIRECT_URI",
  "AUTH_FRONTEND_LOGOUT_URI",
] as const;

// The development mailbox of compose (auth/compose.yaml); the quick sign-in reads codes from it.
const MAILPIT_URL = "http://127.0.0.1:8025";

// Dev and preview servers listen on loopback only (openspec/specs/web/app).
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, REPO_ROOT, "");
  const auth = Object.fromEntries(
    AUTH_KEYS.map((key) => [key, env[key] ?? null]),
  );
  // The sign-in API of Authentik is opened on the frontend's own origin (openspec/specs/auth,
  // «Вход фронтенда»); without AUTH_ISSUER the app stops at start with its name, so no proxy.
  const authOrigin =
    env.AUTH_ISSUER === undefined ? null : new URL(env.AUTH_ISSUER).origin;
  // The dev server needs the API address for the chat; a build (CI) does not.
  const agentosUrl = env.AGENTOS_URL ?? null;
  if (command === "serve" && agentosUrl === null) {
    throw new Error(
      "AGENTOS_URL is not set in the repository .env: the dev server proxies /os/ to AgentOS.",
    );
  }
  return {
    plugins: [react(), tailwindcss()],
    // VITE_* variables (VITE_DATA_SOURCE) come from the repository .env.
    envDir: REPO_ROOT,
    define: {
      __AUTH_CONFIG__: JSON.stringify(auth),
      // The product site that the sign-in screen links to; checked at start by src/app/config.ts.
      __SITE_ORIGIN__: JSON.stringify(env.SITE_ORIGIN ?? null),
      // Test password of the development users, for the quick sign-in of `vite serve` only;
      // a production build never carries it.
      __DEV_USER_PASSWORD__: JSON.stringify(
        command === "serve" ? (env.AUTH_DEV_USER_PASSWORD ?? null) : null,
      ),
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
    },
    server: {
      host: "127.0.0.1",
      strictPort: true,
      proxy: {
        ...(authOrigin === null
          ? {}
          : {
              "/api/v3/flows/executor/": {
                target: authOrigin,
                changeOrigin: true,
              },
              // Token revocation on sign-out (Authentik sends no CORS headers for it).
              "/application/o/revoke/": {
                target: authOrigin,
                changeOrigin: true,
              },
              // Resets an unfinished sign-in kept in the Authentik session.
              "/flows/-/cancel/": {
                target: authOrigin,
                changeOrigin: true,
              },
            }),
        // AgentOS API (chat AG-UI, sessions) on the frontend's own origin.
        "/os/": {
          target: agentosUrl ?? undefined,
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/os/, ""),
        },
        "/mailpit/": {
          target: MAILPIT_URL,
          rewrite: (p: string) => p.replace(/^\/mailpit/, ""),
        },
      },
    },
    // The manifest lets scripts/check-bundle.mjs measure the first screen (openspec/specs/web/app,
    // «Бюджет первого экрана»).
    build: {
      manifest: true,
    },
    preview: {
      host: "127.0.0.1",
      strictPort: true,
    },
  };
});
