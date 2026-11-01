import { useGetIdentity, useKeys } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { applyAccountTheme } from "@/design-system/theme";

import { patchMe, type Account, type AccountChanges } from "./meApi";

/** The account from GET /api/v1/me, cached as the Refine identity. */
export function useAccount() {
  return useGetIdentity<Account>();
}

/** Saves changes and puts the answer into the identity cache, so the menu shows them at once. */
export function useSaveAccount(): (
  changes: AccountChanges,
) => Promise<Account> {
  const queryClient = useQueryClient();
  const { keys } = useKeys();
  return async (changes) => {
    const saved = await patchMe(changes);
    queryClient.setQueryData(keys().auth().action("identity").get(), saved);
    return saved;
  };
}

/** Applies the theme of the account once it is known (openspec/specs/web/design-system, «Темы»). */
export function useAccountTheme(): void {
  const { data } = useAccount();
  const theme = data === undefined ? undefined : data.theme;
  useEffect(() => {
    if (theme !== undefined) applyAccountTheme(theme);
  }, [theme]);
}
