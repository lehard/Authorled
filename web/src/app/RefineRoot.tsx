import {
  Refine,
  useIsAuthenticated,
  useLogout,
  type DataProvider,
} from "@refinedev/core";
import routerProvider from "@refinedev/react-router";
import { useEffect } from "react";
import { Navigate, Outlet } from "react-router";

import { Button } from "@/components/ui/button";

import { useAccount, useAccountTheme } from "@/account/useAccount";
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
export function RequireAuth({ dataSource }: { dataSource: DataSource }) {
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
  return dataSource === "api" ? <AccountGate /> : <SignedIn />;
}

/**
 * Screens wait for the account (openspec/specs/web/workspace, «Аккаунт до экранов»): GET /api/v1/me
 * creates it on the first sign-in, and the routes of stories answer 404 until then. Only a missing
 * account stops the screens: a failed refresh of a known account leaves them open.
 */
function AccountGate() {
  const { data, error, refetch } = useAccount();
  const { mutate: logout, error: logoutError } = useLogout();
  if (data !== undefined) return <SignedIn />;
  if (error === null) {
    return <MessageScreen loading title="Загружаем аккаунт…" />;
  }
  return (
    <MessageScreen
      title="Не удалось загрузить аккаунт"
      text={
        logoutError === null
          ? error.message
          : `${error.message} Не удалось выйти: ${logoutError.message}`
      }
    >
      <Button className="rounded-full" onClick={() => void refetch()}>
        Повторить
      </Button>
      <Button
        className="rounded-full"
        variant="outline"
        onClick={() => logout()}
      >
        Выйти
      </Button>
    </MessageScreen>
  );
}

/** Signed-in screens; the theme of the account replaces the browser copy once it arrives. */
function SignedIn() {
  useAccountTheme();
  return <Outlet />;
}
