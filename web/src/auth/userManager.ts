import { ErrorResponse, UserManager, type User } from "oidc-client-ts";

import type { AppConfig } from "@/app/config";

// Sign-in with Authentik over OIDC, Authorization Code with PKCE (openspec/specs/auth,
// «Вход фронтенда»). Tokens stay in sessionStorage of this origin; offline_access gives a
// refresh token, so the 10-minute access token renews without leaving the page.
//
// Authentik issues a new refresh token on every renewal and refuses the old one when it comes
// again (openspec/specs/auth, «Refresh token фронтенда»). So a tab renews through one gate,
// renew(): the library timer and every caller with an expired token share one request.

export type ReturnState = { returnTo: string };

let manager: UserManager | null = null;

export function initUserManager(config: AppConfig): void {
  manager = new UserManager({
    authority: config.issuer,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid profile email offline_access",
    // The library's own renewal would run beside renew() and send the same refresh token twice.
    automaticSilentRenew: false,
  });
  // The library timer, a minute before the access token expires, renews through the gate.
  manager.events.addAccessTokenExpiring(() => {
    renew().catch((error: unknown) => {
      // A failure surfaces on the next request for a token, which renews again.
      console.error("Продление входа по таймеру не удалось:", error);
    });
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

let renewing: Promise<User | null> | null = null;

/**
 * Renews the tokens with the refresh token: one request per tab, shared by all who wait.
 * Authentik refusing it (invalid_grant: revoked, expired or used already) ends the session of
 * this tab: the tokens are removed and the result is null (openspec/specs/web/workspace,
 * «Конец сессии»). Any other failure (network, timeout, 5xx) is thrown as it is.
 */
function renew(): Promise<User | null> {
  renewing ??= (async () => {
    try {
      return await userManager().signinSilent();
    } catch (error) {
      if (error instanceof ErrorResponse && error.error === "invalid_grant") {
        await userManager().removeUser();
        return null;
      }
      throw error;
    } finally {
      renewing = null;
    }
  })();
  return renewing;
}

/** The signed-in user with a live access token, or null when this tab has no session. */
export async function activeUser(): Promise<User | null> {
  const user = await userManager().getUser();
  if (user === null) return null;
  if (!user.expired) return user;
  if (user.refresh_token === undefined) {
    // Nothing to renew with: the session of this tab is over, like a refused renewal.
    await userManager().removeUser();
    return null;
  }
  return renew();
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
