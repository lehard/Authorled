import { createBrowserRouter } from "react-router";

import { CallbackScreen } from "@/auth/CallbackScreen";
import { LoginScreen } from "@/auth/LoginScreen";
import { OpenDraft } from "@/screens/project/OpenDraft";
import { SettingsScreen } from "@/screens/settings/SettingsScreen";
import { ProjectTrashScreen } from "@/screens/shelf/ProjectTrashScreen";
import { ShelfScreen } from "@/screens/shelf/ShelfScreen";
import { NotFoundScreen } from "@/screens/system/NotFoundScreen";

import type { DataSource } from "./config";
import { RefineRoot, RequireAuth } from "./RefineRoot";
import { projectScreen, showcaseScreen } from "./screens";

// Addresses of the screens (openspec/specs/web/workspace, «Адреса экранов»).
export function createRouter(dataSource: DataSource) {
  return createBrowserRouter([
    {
      element: <RefineRoot dataSource={dataSource} />,
      children: [
        { path: "/showcase", element: <showcaseScreen.Screen /> },
        { path: "/login", element: <LoginScreen /> },
        { path: "/auth/callback", element: <CallbackScreen /> },
        {
          element: <RequireAuth dataSource={dataSource} />,
          children: [
            { path: "/", element: <ShelfScreen /> },
            { path: "/trash", element: <ProjectTrashScreen /> },
            { path: "/settings", element: <SettingsScreen /> },
            { path: "/p/:projectId", element: <OpenDraft /> },
            { path: "/p/:projectId/:doc", element: <OpenDraft /> },
            {
              path: "/p/:projectId/d/:draftId/:doc",
              element: <projectScreen.Screen />,
            },
            { path: "*", element: <NotFoundScreen /> },
          ],
        },
      ],
    },
  ]);
}
