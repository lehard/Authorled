import { Refine, useIsAuthenticated, type DataProvider } from "@refinedev/core";
import routerProvider from "@refinedev/react-router";
import { useEffect } from "react";
import { Navigate, Outlet } from "react-router";

import { Button } from "@/components/ui/button";

import { useAccountTheme } from "@/account/useAccount";
import { authProvider } from "@/auth/authProvider";
import { currentPath, userManager } from "@/auth/userManager";
import { apiProvider } from "@/data/apiProvider";
import { fixturesProvider } from "@/data/fixturesProvider";
import { MessageScreen } from "@/screens/system/MessageScreen";

import type { DataSource } from "./config";

const DATA_PROVIDERS: Record<DataSource, DataProvider> = {
  api: apiProvider,
  fixtures: fixturesProvider,
};

export function RefineRoot({ dataSource }: { dataSource: DataSource }) {
  return (
    <Refine
      dataProvider={DATA_PROVIDERS[dataSource]}
      routerProvider={routerProvider}
      authProvider={authProvider}
      resources={[
        { name: "projects" },
        { name: "scripts" },
        { name: "characters" },
        { name: "locations" },
        { name: "worlds" },
      ]}
      // Telemetry of Refine goes to telemetry.refine.dev (openspec/specs/web/app).
      options={{
        disableTelemetry: true,
        // Sign-in is started by RequireAuth only, never on route changes (see authProvider.check).
        disableRouteChangeHandler: true,
        syncWithLocation: false,
        // A missing record (404) is an answer, not a failure: no retries before «Не найдено».
        reactQuery: {
          clientConfig: {
            defaultOptions: {
              queries: {
                retry: (count, error) =>
                  (error as { statusCode?: number }).statusCode !== 404 &&
                  count < 3,
              },
            },
          },
        },
        warnWhenUnsavedChanges: false,
      }}
    >
      <Outlet />
    </Refine>
  );
}

/** Screens behind sign-in: without a session the app opens its own sign-in screen. */
export function RequireAuth() {
  const { data, isPending, refetch } = useIsAuthenticated();
  // The session may end in any request for a token (menu, chat), not only in this check:
  // the tokens are then removed, and checking again opens /login («Конец сессии»).
  useEffect(() => {
    const events = userManager().events;
    const recheck = () => void refetch();
    events.addUserUnloaded(recheck);
    return () => events.removeUserUnloaded(recheck);
  }, [refetch]);
  if (isPending) return <MessageScreen loading title="Проверяем вход…" />;
  if (data?.error !== undefined) {
    return (
      <MessageScreen
        title="Не удалось проверить вход"
        text={`Authentik не ответил: ${data.error.message}`}
      >
        <Button className="rounded-full" onClick={() => void refetch()}>
          Попробовать снова
        </Button>
      </MessageScreen>
    );
  }
  if (data?.authenticated !== true) {
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(currentPath())}`}
        replace
      />
    );
  }
  return <SignedIn />;
}

/** Signed-in screens; the theme of the account replaces the browser copy once it arrives. */
function SignedIn() {
  useAccountTheme();
  return <Outlet />;
}
