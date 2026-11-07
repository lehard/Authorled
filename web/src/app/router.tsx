import { createBrowserRouter } from "react-router";

import { CallbackScreen } from "@/auth/CallbackScreen";
import { LoginScreen } from "@/auth/LoginScreen";
import { OpenDraft } from "@/screens/project/OpenDraft";
import { ProjectScreen } from "@/screens/project/ProjectScreen";
import {
  BillingFailScreen,
  BillingReturnScreen,
} from "@/screens/settings/BillingReturnScreen";
import { SettingsScreen } from "@/screens/settings/SettingsScreen";
import { ProjectTrashScreen } from "@/screens/shelf/ProjectTrashScreen";
import { ShelfScreen } from "@/screens/shelf/ShelfScreen";
import { NotFoundScreen } from "@/screens/system/NotFoundScreen";
import { Showcase } from "@/showcase/Showcase";

import type { DataSource } from "./config";
import { RefineRoot, RequireAuth } from "./RefineRoot";

// Addresses of the screens (openspec/specs/web/workspace, «Адреса экранов»).
export function createRouter(dataSource: DataSource) {
  return createBrowserRouter([
    {
      element: <RefineRoot dataSource={dataSource} />,
      children: [
        { path: "/showcase", element: <Showcase /> },
        { path: "/login", element: <LoginScreen /> },
        { path: "/auth/callback", element: <CallbackScreen /> },
        {
          element: <RequireAuth dataSource={dataSource} />,
          children: [
            { path: "/", element: <ShelfScreen /> },
            { path: "/trash", element: <ProjectTrashScreen /> },
            { path: "/settings", element: <SettingsScreen /> },
            {
              path: "/settings/billing/return",
              element: <BillingReturnScreen />,
            },
            { path: "/settings/billing/fail", element: <BillingFailScreen /> },
            { path: "/p/:projectId", element: <OpenDraft /> },
            { path: "/p/:projectId/:doc", element: <OpenDraft /> },
            {
              path: "/p/:projectId/d/:draftId/:doc",
              element: <ProjectScreen />,
            },
            { path: "*", element: <NotFoundScreen /> },
          ],
        },
      ],
    },
  ]);
}
