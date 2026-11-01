import type { AuthProvider } from "@refinedev/core";

import { getMe, type Account } from "@/account/meApi";
import { appConfig } from "@/app/config";

import { SignInFlow } from "./flow/flowClient";
import { activeUser, userManager } from "./userManager";

// Token revocation of Authentik, on the frontend's origin (dev: Vite proxy).
const REVOKE_URL = "/application/o/revoke/";

async function revoke(
  token: string,
  hint: "access_token" | "refresh_token",
): Promise<void> {
  const response = await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token,
      token_type_hint: hint,
      client_id: appConfig().clientId,
    }),
  });
  if (!response.ok)
    throw new Error(`Authentik не отозвал ${hint}: ответ ${response.status}.`);
}

export type Identity = Account;

export const authProvider: AuthProvider = {
  // Without a session the check itself leaves for Authentik and comes back to this address.
  // The check only reports: it never leaves for Authentik itself, because Refine also runs it
  // on /auth/callback, where leaving would abort the code exchange. RequireAuth opens /login.
  // A failure (Authentik down, bad settings) is returned, not thrown: Refine only logs a thrown
  // error and would leave the page waiting.
  check: async () => {
    try {
      return { authenticated: (await activeUser()) !== null };
    } catch (error) {
      return {
        authenticated: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  // Sign-in goes through the app's own screen (/login), never straight to Authentik.
  login: async () => ({ success: false, redirectTo: "/login" }),

  // Sign-out without Authentik pages (openspec/specs/auth, «Вход фронтенда»): revoke the tokens,
  // end the Authentik session through the product sign-out flow on our origin, forget the user,
  // open the sign-in screen (AUTH_FRONTEND_LOGOUT_URI).
  logout: async () => {
    const user = await userManager().getUser();
    if (user !== null) {
      if (user.refresh_token !== undefined)
        await revoke(user.refresh_token, "refresh_token");
      await revoke(user.access_token, "access_token");
    }
    await new SignInFlow().endAuthentikSession();
    await userManager().removeUser();
    return {
      success: true,
      redirectTo: new URL(appConfig().logoutUri).pathname,
    };
  },

  onError: async (error: unknown) => {
    throw error;
  },

  // The account of the product, not the ID token: its name is the one the user set in settings
  // (openspec/specs/web/workspace, «Данные аккаунта из API»).
  getIdentity: async (): Promise<Identity> => getMe(),
};
