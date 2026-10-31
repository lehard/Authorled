import type { AuthProvider } from "@refinedev/core";

import { appConfig } from "@/app/config";

import { activeUser, userManager } from "./userManager";

export type Identity = { name: string; email: string };

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

  logout: async () => {
    // Ends the Authentik session; Authentik returns to the sign-in screen (logout redirect URI).
    await userManager().signoutRedirect({
      post_logout_redirect_uri: appConfig().logoutUri,
    });
    return { success: true };
  },

  onError: async (error: unknown) => {
    throw error;
  },

  getIdentity: async (): Promise<Identity> => {
    const user = await activeUser();
    if (user === null) throw new Error("Нет входа: профиль недоступен.");
    const { name, preferred_username: username, email } = user.profile;
    const shown = name ?? username ?? email;
    if (shown === undefined || email === undefined) {
      throw new Error(
        "Authentik не передал имя и email пользователя (scopes profile и email).",
      );
    }
    return { name: shown, email };
  },
};
