import { UserManager, type User } from "oidc-client-ts";

import type { AppConfig } from "@/app/config";

// Sign-in with Authentik over OIDC, Authorization Code with PKCE (openspec/specs/auth,
// «Вход фронтенда»). Tokens stay in sessionStorage of this origin; offline_access gives a
// refresh token, so the 10-minute access token renews without leaving the page.

export type ReturnState = { returnTo: string };

let manager: UserManager | null = null;

export function initUserManager(config: AppConfig): void {
  manager = new UserManager({
    authority: config.issuer,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid profile email offline_access",
    automaticSilentRenew: true,
  });
}

export function userManager(): UserManager {
  if (manager === null)
    throw new Error("Вход не настроен: initUserManager не вызван.");
  return manager;
}

export function currentPath(): string {
  return window.location.pathname + window.location.search;
}

/** Signs in again with a refresh token when the access token has expired. */
export async function activeUser(): Promise<User | null> {
  const user = await userManager().getUser();
  if (user === null) return null;
  if (!user.expired) return user;
  if (user.refresh_token === undefined) return null;
  return userManager().signinSilent();
}

export function signIn(returnTo: string): Promise<void> {
  const state: ReturnState = { returnTo };
  return userManager().signinRedirect({ state });
}

// React StrictMode runs effects twice; the code from Authentik can be exchanged only once.
let callback: Promise<User> | null = null;
export function completeSignIn(): Promise<User> {
  callback ??= userManager().signinRedirectCallback();
  return callback;
}
